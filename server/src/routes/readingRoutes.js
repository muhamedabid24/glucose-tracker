const router = require("express").Router();
const pool = require("../db/pool");
const authenticate = require("../middleware/auth");
const { SLOTS, today, validDate } = require("../utils/dates");
router.use(authenticate);
const fields = "id, reading_date::text AS date, slot, value_mg_dl AS value";
function validate(req, res, next) {
  const { date, slot, value } = req.body || {};
  if (!validDate(date))
    return res
      .status(400)
      .json({ message: "Choose a valid date (YYYY-MM-DD)." });
  if (date > today())
    return res.status(400).json({ message: "Date cannot be in the future." });
  if (!SLOTS.includes(slot))
    return res
      .status(400)
      .json({ message: "Choose one of the four allowed slots." });
  if (!Number.isInteger(value) || value < 40 || value > 600) {
    return res
      .status(400)
      .json({
        message: "Glucose value must be a whole number from 40 to 600 mg/dl.",
      });
  }
  next();
}
router.param("id", (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
    return res.status(400).json({ message: "Invalid reading ID." });
  next();
});
router.get("/", async (req, res, next) => {
  try {
    if (req.query.date !== undefined && !validDate(req.query.date))
      return res.status(400).json({ message: "Invalid date." });
    const result = await pool.query(
      `SELECT ${fields} FROM readings WHERE user_id = $1
      AND ($2::date IS NULL OR reading_date = $2::date) ORDER BY reading_date DESC,
      array_position($3::text[], slot), id`,
      [req.userId, req.query.date || null, SLOTS],
    );
    res.json({ readings: result.rows });
  } catch (error) {
    next(error);
  }
});
router.post("/", validate, async (req, res, next) => {
  try {
    const { date, slot, value } = req.body;
    const result = await pool.query(
      `INSERT INTO readings (user_id, reading_date, slot, value_mg_dl)
      VALUES ($1, $2, $3, $4) RETURNING ${fields}`,
      [req.userId, date, slot, value],
    );
    res
      .status(201)
      .json({ reading: result.rows[0], message: "Reading added." });
  } catch (error) {
    next(error);
  }
});
router.put("/:id", validate, async (req, res, next) => {
  try {
    const { date, slot, value } = req.body;
    const result = await pool.query(
      `UPDATE readings SET reading_date=$1, slot=$2, value_mg_dl=$3,
      updated_at=NOW() WHERE id=$4 AND user_id=$5 RETURNING ${fields}`,
      [date, slot, value, req.params.id, req.userId],
    );
    if (!result.rows.length)
      return res.status(404).json({ message: "Reading not found." });
    res.json({ reading: result.rows[0], message: "Reading updated." });
  } catch (error) {
    next(error);
  }
});
router.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM readings WHERE id=$1 AND user_id=$2 RETURNING id",
      [req.params.id, req.userId],
    );
    if (!result.rows.length)
      return res.status(404).json({ message: "Reading not found." });
    res.json({ message: "Reading deleted." });
  } catch (error) {
    next(error);
  }
});
module.exports = router;
