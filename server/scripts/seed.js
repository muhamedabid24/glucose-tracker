require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const pool = require('../src/db/pool');
const bcrypt = require('bcrypt');
const { today, range, SLOTS } = require('../src/utils/dates');
(async () => {
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  const email = 'demo@sweety.example';
  const result = await client.query(`INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3)
    ON CONFLICT DO NOTHING RETURNING id`, ['Demo User',email,await bcrypt.hash('SweetyDemo123!',12)]);
  if (!result.rows.length) {
    await client.query('ROLLBACK');
    console.log('Demo email already exists; account and readings left unchanged.'); return;
  }
  const dates = [today(), today().slice(0,7)+'-01', range('monthly',today())[0]];
  for (const date of new Set(dates)) {
   for (let i=0;i<SLOTS.length;i++) await client.query(`INSERT INTO readings (user_id,reading_date,slot,value_mg_dl)
     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[result.rows[0].id,date,SLOTS[i],[94,132,145,118][i]]);
  }
  await client.query('COMMIT');
  console.log('Demo created: demo@sweety.example / SweetyDemo123!');
 } catch (error) {
  await client.query('ROLLBACK');console.error('Seed failed:',error.code || 'INTERNAL_ERROR');process.exitCode=1;
 } finally { client.release();await pool.end(); }
})().catch(() => {console.error('Database connection unavailable.');process.exitCode=1;pool.end();});
