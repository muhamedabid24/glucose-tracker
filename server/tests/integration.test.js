require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
process.env.JWT_SECRET = 'isolated-test-secret-not-for-production';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const pool = require('../src/db/pool');
const app = require('../src/app');
const { today, range, SLOTS } = require('../src/utils/dates');
const schema = `sweety_test_${process.pid}_${Date.now()}`;
let token, otherToken, userId, readingId;
const reading = (overrides = {}) => ({ date: '2024-03-15', slot: SLOTS[0], value: 100, ...overrides });
const post = body => request(app).post('/api/readings').auth(token, { type: 'bearer' }).send(body);
beforeAll(async () => {
  pool.options.max = 1;
  await pool.query(`CREATE SCHEMA "${schema}"`);
  pool.options.options = `-c search_path=${schema}`;
  await pool.query(`SET search_path TO "${schema}"`);
  const sql = require('fs').readFileSync(require('path').join(__dirname, '../src/db/schema.sql'), 'utf8');
  await pool.query(sql);
  await pool.query(sql); // Reproducibility includes idempotency.
}, 20000);
afterAll(async () => {
  try { await pool.query('SET search_path TO public'); await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
  finally { await pool.end(); }
});
test('registration, password hashing, duplicate email and login', async () => {
  const result = await request(app).post('/api/auth/register').send({ name: 'Test User', email: 'TEST@example.test', password: 'Password123!' });
  expect(result.status).toBe(201); userId = result.body.user.id;
  expect(result.body.user.password_hash).toBeUndefined();
  const stored = await pool.query('SELECT password_hash FROM users WHERE id=$1', [userId]);
  expect(await require('bcrypt').compare('Password123!', stored.rows[0].password_hash)).toBe(true);
  expect((await request(app).post('/api/auth/register').send({name:'Other',email:'test@example.test',password:'Password123!'})).status).toBe(409);
  const login = await request(app).post('/api/auth/login').send({ email: 'TEST@example.test', password: 'Password123!' });
  expect(login.status).toBe(200); token = login.body.token;
  const other = await request(app).post('/api/auth/register').send({ name: 'Other', email: 'other@example.test', password: 'Password123!' });
  otherToken = jwt.sign({ userId: other.body.user.id }, process.env.JWT_SECRET);
});
test('invalid registration and wrong credentials', async () => {
  expect((await request(app).post('/api/auth/register').send({name:'',email:'bad',password:'short'})).status).toBe(400);
  for (const email of ['test@example.test', 'unknown@example.test']) {
    expect((await request(app).post('/api/auth/login').send({email,password:'wrong'})).status).toBe(401);
  }
});
test('protected endpoints reject missing, invalid and expired tokens', async () => {
  for (const endpoint of ['/api/readings', '/api/reports?date=2024-03-15']) {
    expect((await request(app).get(endpoint)).status).toBe(401);
    expect((await request(app).get(endpoint).auth('invalid',{type:'bearer'})).status).toBe(401);
    const expired = jwt.sign({userId},process.env.JWT_SECRET,{expiresIn:-1});
    expect((await request(app).get(endpoint).auth(expired,{type:'bearer'})).status).toBe(401);
  }
});
test.each([39, 601, 100.5, undefined, null, '100'])('reject invalid value %s on create and edit', async value => {
  expect((await post(reading({ value }))).status).toBe(400);
  expect((await request(app).put('/api/readings/1').auth(token,{type:'bearer'}).send(reading({value}))).status).toBe(400);
});
test('future, impossible date and invalid slots fail on create and edit', async () => {
  for (const body of [reading({date:'2999-01-01'}),reading({date:'2024-02-30'}),reading({slot:'Snack'})]) {
    expect((await post(body)).status).toBe(400);
    expect((await request(app).put('/api/readings/1').auth(token,{type:'bearer'}).send(body)).status).toBe(400);
  }
});
test('boundaries, four slots, database duplicate constraint and editing', async () => {
  for (let i=0;i<4;i++) {
    const result=await post(reading({slot:SLOTS[i],value:[40,600,100,101][i]}));
    expect(result.status).toBe(201); if(i===0)readingId=result.body.reading.id;
  }
  expect((await post(reading())).status).toBe(409);
  await expect(pool.query('INSERT INTO readings (user_id,reading_date,slot,value_mg_dl) VALUES ($1,$2,$3,$4)',[userId,'2024-03-15',SLOTS[0],120])).rejects.toMatchObject({code:'23505'});
  const edit=await request(app).put('/api/readings/'+readingId).auth(token,{type:'bearer'}).send(reading({value:41}));
  expect(edit.status).toBe(200);expect(edit.body.reading.value).toBe(41);
  expect((await request(app).put('/api/readings/'+readingId).auth(token,{type:'bearer'}).send(reading({slot:SLOTS[1]}))).status).toBe(409);
});
test('read, edit, delete and report ownership are isolated', async () => {
  const list=await request(app).get('/api/readings').auth(otherToken,{type:'bearer'});
  expect(list.body.readings).toEqual([]);
  expect((await request(app).put('/api/readings/'+readingId).auth(otherToken,{type:'bearer'}).send(reading())).status).toBe(404);
  expect((await request(app).delete('/api/readings/'+readingId).auth(otherToken,{type:'bearer'})).status).toBe(404);
  const report=await request(app).get('/api/reports?date=2024-03-15').auth(otherToken,{type:'bearer'});
  expect(report.body.count).toBe(0);
});
test('daily, MTD and previous-month statistics use inclusive calendar boundaries', async () => {
  for (const [date,value] of [['2024-03-01',80],['2024-03-16',500],['2024-02-01',90],['2024-02-29',150],['2024-01-31',600]]) {
    expect((await post(reading({date,value}))).status).toBe(201);
  }
  for (const [type,expected] of [
    ['daily',{count:4,highest:600,lowest:41,average:210.5,start:'2024-03-15',end:'2024-03-15'}],
    ['mtd',{count:5,highest:600,lowest:41,average:184.4,start:'2024-03-01',end:'2024-03-15'}],
    ['monthly',{count:2,highest:150,lowest:90,average:120,start:'2024-02-01',end:'2024-02-29'}]
  ]) {
    const response=await request(app).get(`/api/reports?date=2024-03-15&type=${type}`).auth(token,{type:'bearer'});
    expect(response.status).toBe(200);expect(response.body).toMatchObject(expected);
    expect(response.body.readings.length).toBe(type==='daily'?4:0);
  }
  expect(range('monthly','2025-01-01')).toEqual(['2024-12-01','2024-12-31']);
  expect(range('monthly','2025-03-31')).toEqual(['2025-02-01','2025-02-28']);
  expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
test.each(['daily','mtd','monthly'])('empty %s report returns null statistics', async type => {
  const result=await request(app).get(`/api/reports?date=1901-01-01&type=${type}`).auth(token,{type:'bearer'});
  expect(result.status).toBe(200);expect(result.body).toMatchObject({count:0,highest:null,lowest:null,average:null,readings:[]});
});
test('delete owned reading, missing ID and bad report parameters', async () => {
  expect((await request(app).delete('/api/readings/'+readingId).auth(token,{type:'bearer'})).status).toBe(200);
  expect((await request(app).delete('/api/readings/'+readingId).auth(token,{type:'bearer'})).status).toBe(404);
  expect((await request(app).delete('/api/readings/nope').auth(token,{type:'bearer'})).status).toBe(400);
  for(const query of ['date=2024-02-30','date=2999-01-01','date=2024-01-01&type=bad']) {
    expect((await request(app).get('/api/reports?'+query).auth(token,{type:'bearer'})).status).toBe(400);
  }
});

test('calendar today follows the configured timezone near UTC midnight', () => {
  const originalTimezone = process.env.APP_TIMEZONE;
  jest.useFakeTimers().setSystemTime(new Date('2024-03-31T20:00:00Z'));
  try {
    process.env.APP_TIMEZONE='Asia/Kolkata'; expect(today()).toBe('2024-04-01');
    process.env.APP_TIMEZONE='America/Los_Angeles'; expect(today()).toBe('2024-03-31');
  } finally {
    jest.useRealTimers();
    if(originalTimezone===undefined)delete process.env.APP_TIMEZONE;else process.env.APP_TIMEZONE=originalTimezone;
  }
});
