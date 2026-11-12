require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
  quiet: true,
});
process.env.JWT_SECRET = "isolated-test-secret-not-for-production";
const request = require("supertest");
const jwt = require("jsonwebtoken");
const pool = require("../src/db/pool");
const app = require("../src/app");
const { today, range, SLOTS } = require("../src/utils/dates");
const schema = `sweety_test_${process.pid}_${Date.now()}`;
let token, otherToken, userId, readingId;
const reading = (overrides = {}) => ({
  date: "2024-03-15",
  slot: SLOTS[0],
  value: 100,
  ...overrides,
});
const post = (body) =>
  request(app).post("/api/readings").auth(token, { type: "bearer" }).send(body);
beforeAll(async () => {
  pool.options.max = 1;
  await pool.query(`CREATE SCHEMA "${schema}"`);
  pool.options.options = `-c search_path=${schema}`;
  await pool.query(`SET search_path TO "${schema}"`);
  const sql = require("fs").readFileSync(
    require("path").join(__dirname, "../src/db/schema.sql"),
    "utf8",
  );
  await pool.query(sql);
  await pool.query(sql); // Reproducibility includes idempotency.
}, 20000);
afterAll(async () => {
  try {
    await pool.query("SET search_path TO public");
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await pool.end();
  }
});
test("registration, password hashing, duplicate email and login", async () => {
  const result = await request(app).post("/api/auth/register").send({
    name: "Test User",
    email: "TEST@example.test",
    password: "Password123!",
  });
  expect(result.status).toBe(201);
  userId = result.body.user.id;
  expect(result.body.user.password_hash).toBeUndefined();
  const stored = await pool.query(
    "SELECT password_hash FROM users WHERE id=$1",
    [userId],
  );
  expect(
    await require("bcrypt").compare(
      "Password123!",
      stored.rows[0].password_hash,
    ),
  ).toBe(true);
  expect(
    (
      await request(app).post("/api/auth/register").send({
        name: "Other",
        email: "test@example.test",
        password: "Password123!",
      })
    ).status,
  ).toBe(409);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "TEST@example.test", password: "Password123!" });
  expect(login.status).toBe(200);
  token = login.body.token;
  const other = await request(app).post("/api/auth/register").send({
    name: "Other",
    email: "other@example.test",
    password: "Password123!",
  });
  otherToken = jwt.sign({ userId: other.body.user.id }, process.env.JWT_SECRET);
});
test("invalid registration and wrong credentials", async () => {
  expect(
    (
      await request(app)
        .post("/api/auth/register")
        .send({ name: "", email: "bad", password: "short" })
    ).status,
  ).toBe(400);
  for (const email of ["test@example.test", "unknown@example.test"]) {
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email, password: "wrong" })
      ).status,
    ).toBe(401);
  }
});
test("protected endpoints reject missing, invalid and expired tokens", async () => {
  for (const endpoint of ["/api/readings", "/api/reports?date=2024-03-15"]) {
    expect((await request(app).get(endpoint)).status).toBe(401);
    expect(
      (await request(app).get(endpoint).auth("invalid", { type: "bearer" }))
        .status,
    ).toBe(401);
    const expired = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: -1,
    });
    expect(
      (await request(app).get(endpoint).auth(expired, { type: "bearer" }))
        .status,
    ).toBe(401);
  }
});
test.each([39, 601, 100.5, undefined, null, "100", 108.5, -1, "invalid", ""])(
  "reject invalid value %s on create and edit",
  async (value) => {
    expect((await post(reading({ value }))).status).toBe(400);
    expect(
      (
        await request(app)
          .put("/api/readings/1")
          .auth(token, { type: "bearer" })
          .send(reading({ value }))
      ).status,
    ).toBe(400);
  },
);
test("future, impossible date and invalid slots fail on create and edit", async () => {
  for (const body of [
    reading({ date: "2999-01-01" }),
    reading({ date: "2024-02-30" }),
    reading({ slot: "Snack" }),
  ]) {
    expect((await post(body)).status).toBe(400);
    expect(
      (
        await request(app)
          .put("/api/readings/1")
          .auth(token, { type: "bearer" })
          .send(body)
      ).status,
    ).toBe(400);
  }
});
test("boundaries, four slots, database duplicate constraint and editing", async () => {
  for (let i = 0; i < 4; i++) {
    const result = await post(
      reading({ slot: SLOTS[i], value: [40, 600, 100, 101][i] }),
    );
    expect(result.status).toBe(201);
    if (i === 0) readingId = result.body.reading.id;
  }
  expect((await post(reading())).status).toBe(409);
  await expect(
    pool.query(
      "INSERT INTO readings (user_id,reading_date,slot,value_mg_dl) VALUES ($1,$2,$3,$4)",
      [userId, "2024-03-15", SLOTS[0], 120],
    ),
  ).rejects.toMatchObject({ code: "23505" });
  const edit = await request(app)
    .put("/api/readings/" + readingId)
    .auth(token, { type: "bearer" })
    .send(reading({ value: 41 }));
  expect(edit.status).toBe(200);
  expect(edit.body.reading.value).toBe(41);
  expect(
    (
      await request(app)
        .put("/api/readings/" + readingId)
        .auth(token, { type: "bearer" })
        .send(reading({ slot: SLOTS[1] }))
    ).status,
  ).toBe(409);
});
test("read, edit, delete and report ownership are isolated", async () => {
  const list = await request(app)
    .get("/api/readings")
    .auth(otherToken, { type: "bearer" });
  expect(list.body.readings).toEqual([]);
  expect(
    (
      await request(app)
        .put("/api/readings/" + readingId)
        .auth(otherToken, { type: "bearer" })
        .send(reading())
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .delete("/api/readings/" + readingId)
        .auth(otherToken, { type: "bearer" })
    ).status,
  ).toBe(404);
  const report = await request(app)
    .get("/api/reports?date=2024-03-15")
    .auth(otherToken, { type: "bearer" });
  expect(report.body.count).toBe(0);
});
test("daily, MTD and previous-month statistics use inclusive calendar boundaries", async () => {
  for (const [date, value] of [
    ["2024-03-01", 80],
    ["2024-03-16", 500],
    ["2024-02-01", 90],
    ["2024-02-29", 150],
    ["2024-01-31", 600],
  ]) {
    expect((await post(reading({ date, value }))).status).toBe(201);
  }
  for (const [type, expected] of [
    [
      "daily",
      {
        count: 4,
        highest: 600,
        lowest: 41,
        average: 210.5,
        start: "2024-03-15",
        end: "2024-03-15",
      },
    ],
    [
      "mtd",
      {
        count: 5,
        highest: 600,
        lowest: 41,
        average: 184.4,
        start: "2024-03-01",
        end: "2024-03-15",
      },
    ],
    [
      "monthly",
      {
        count: 2,
        highest: 150,
        lowest: 90,
        average: 120,
        start: "2024-02-01",
        end: "2024-02-29",
      },
    ],
  ]) {
    const response = await request(app)
      .get(`/api/reports?date=2024-03-15&type=${type}`)
      .auth(token, { type: "bearer" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(expected);
    expect(response.body.readings.length).toBe(type === "daily" ? 4 : 0);
  }
  expect(range("monthly", "2025-01-01")).toEqual(["2024-12-01", "2024-12-31"]);
  expect(range("monthly", "2025-03-31")).toEqual(["2025-02-01", "2025-02-28"]);
  expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
test.each(["daily", "mtd", "monthly"])(
  "empty %s report returns null statistics",
  async (type) => {
    const result = await request(app)
      .get(`/api/reports?date=1901-01-01&type=${type}`)
      .auth(token, { type: "bearer" });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      count: 0,
      highest: null,
      lowest: null,
      average: null,
      readings: [],
    });
  },
);
test("delete owned reading, missing ID and bad report parameters", async () => {
  expect(
    (
      await request(app)
        .delete("/api/readings/" + readingId)
        .auth(token, { type: "bearer" })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .delete("/api/readings/" + readingId)
        .auth(token, { type: "bearer" })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .delete("/api/readings/nope")
        .auth(token, { type: "bearer" })
    ).status,
  ).toBe(400);
  for (const query of [
    "date=2024-02-30",
    "date=2999-01-01",
    "date=2024-01-01&type=bad",
  ]) {
    expect(
      (
        await request(app)
          .get("/api/reports?" + query)
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(400);
  }
});

test("calendar today follows the configured timezone near UTC midnight", () => {
  const originalTimezone = process.env.APP_TIMEZONE;
  jest.useFakeTimers().setSystemTime(new Date("2024-03-31T20:00:00Z"));
  try {
    process.env.APP_TIMEZONE = "Asia/Kolkata";
    expect(today()).toBe("2024-04-01");
    process.env.APP_TIMEZONE = "America/Los_Angeles";
    expect(today()).toBe("2024-03-31");
  } finally {
    jest.useRealTimers();
    if (originalTimezone === undefined) delete process.env.APP_TIMEZONE;
    else process.env.APP_TIMEZONE = originalTimezone;
  }
});

test.each([40, 108, 600])(
  "accepted value %s persists through create, edit, read and delete",
  async (value) => {
    const body = reading({ date: "2024-09-01", value });
    const created = await post(body);
    expect(created.status).toBe(201);
    const id = created.body.reading.id;
    const changed = await request(app)
      .put("/api/readings/" + id)
      .auth(token, { type: "bearer" })
      .send({ ...body, slot: SLOTS[1] });
    expect(changed.status).toBe(200);
    const stored = await pool.query(
      "SELECT reading_date::text AS date,slot,value_mg_dl FROM readings WHERE id=$1 AND user_id=$2",
      [id, userId],
    );
    expect(stored.rows[0]).toEqual({
      date: body.date,
      slot: SLOTS[1],
      value_mg_dl: value,
    });
    const list = await request(app)
      .get("/api/readings?date=" + body.date)
      .auth(token, { type: "bearer" });
    expect(list.body.readings).toContainEqual({
      id,
      date: body.date,
      slot: SLOTS[1],
      value,
    });
    expect(
      (
        await request(app)
          .delete("/api/readings/" + id)
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(200);
    expect(
      (await pool.query("SELECT id FROM readings WHERE id=$1", [id])).rows,
    ).toEqual([]);
  },
);
test("mutating reading routes reject requests without a token", async () => {
  expect(
    (await request(app).post("/api/readings").send(reading())).status,
  ).toBe(401);
  expect(
    (await request(app).put("/api/readings/1").send(reading())).status,
  ).toBe(401);
  expect((await request(app).delete("/api/readings/1")).status).toBe(401);
});
test("two users may independently save the same date and slot without leaking data", async () => {
  const body = reading({ date: "2024-08-01", slot: "After lunch", value: 108 });
  const owned = await post({ ...body, user_id: -1 });
  expect(owned.status).toBe(201);
  const other = await request(app)
    .post("/api/readings")
    .auth(otherToken, { type: "bearer" })
    .send({ ...body, value: 120 });
  expect(other.status).toBe(201);
  expect(
    (
      await request(app)
        .put("/api/readings/" + owned.body.reading.id)
        .auth(otherToken, { type: "bearer" })
        .send({ ...body, value: 600 })
    ).status,
  ).toBe(404);
  for (const [accessToken, expected] of [
    [token, 108],
    [otherToken, 120],
  ]) {
    const response = await request(app)
      .get("/api/readings?date=" + body.date)
      .auth(accessToken, { type: "bearer" });
    expect(response.status).toBe(200);
    expect(response.body.readings).toHaveLength(1);
    expect(response.body.readings[0].value).toBe(expected);
  }
});
test("After lunch duplicate and fifth daily entry are rejected on create and edit", async () => {
  const body = reading({ date: "2024-07-01" });
  let id;
  for (const slot of SLOTS) {
    const result = await post({ ...body, slot });
    expect(result.status).toBe(201);
    if (slot === SLOTS[0]) id = result.body.reading.id;
  }
  const duplicate = await post({ ...body, slot: "After lunch" });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.message).toMatch(/already exists/);
  expect(
    (
      await request(app)
        .put("/api/readings/" + id)
        .auth(token, { type: "bearer" })
        .send({ ...body, slot: "After lunch" })
    ).status,
  ).toBe(409);
  const count = await pool.query(
    "SELECT count(*)::int AS count FROM readings WHERE user_id=$1 AND reading_date=$2",
    [userId, body.date],
  );
  expect(count.rows[0].count).toBe(4);
});
test("report ranges match the October 2026 assignment example", () => {
  expect(range("daily", "2026-10-15")).toEqual(["2026-10-15", "2026-10-15"]);
  expect(range("mtd", "2026-10-15")).toEqual(["2026-10-01", "2026-10-15"]);
  expect(range("monthly", "2026-10-15")).toEqual(["2026-09-01", "2026-09-30"]);
});
