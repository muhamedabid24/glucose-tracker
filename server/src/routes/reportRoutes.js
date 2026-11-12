const router = require('express').Router();
const pool = require('../db/pool');
const { validDate, today, range, SLOTS } = require('../utils/dates');
router.use(require('../middleware/auth'));
router.get('/', async (req, res, next) => {
  const { type = 'daily', date } = req.query;
  if (!['daily', 'mtd', 'monthly'].includes(type) || !validDate(date) || date > today()) {
    return res.status(400).json({ message: 'Choose a valid report type and a date that is not in the future.' });
  }
  const [start, end] = range(type, date);
  try {
    // A single query gives statistics and daily details from the same database snapshot.
    const result = await pool.query(`SELECT id, reading_date::text AS date, slot, value_mg_dl AS value
      FROM readings WHERE user_id=$1 AND reading_date BETWEEN $2::date AND $3::date
      ORDER BY reading_date, array_position($4::text[], slot), id`, [req.userId, start, end, SLOTS]);
    const values = result.rows.map(row => row.value);
    const count = values.length;
    const stats = { count, highest: count ? values.reduce((max, value) => Math.max(max, value), values[0]) : null,
      lowest: count ? values.reduce((min, value) => Math.min(min, value), values[0]) : null,
      average: count ? Number((values.reduce((sum, value) => sum + value, 0) / count).toFixed(1)) : null };
    res.json({ type, start, end, ...stats, readings: type === 'daily' ? result.rows : [] });
  } catch (error) { next(error); }
});
module.exports = router;
