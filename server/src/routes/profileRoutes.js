const router = require("express").Router();
const pool = require("../db/pool");
router.use(require("../middleware/auth"));
const fields = "id, name, age, weight::double precision AS weight";
const allowed = new Set(["name", "age", "weight"]);
function validationErrors(body) {
  const errors = {};
  if (
    Object.hasOwn(body, "name") &&
    (typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 100)
  )
    errors.name = "Enter a name from 1 to 100 characters.";
  if (
    Object.hasOwn(body, "age") &&
    body.age !== null &&
    (!Number.isInteger(body.age) || body.age < 0 || body.age > 130)
  )
    errors.age =
      "Enter a whole-number age from 0 to 130 years, or leave it blank.";
  if (
    Object.hasOwn(body, "weight") &&
    body.weight !== null &&
    (typeof body.weight !== "number" ||
      !Number.isFinite(body.weight) ||
      body.weight <= 0 ||
      body.weight > 500 ||
      Math.abs(body.weight * 100 - Math.round(body.weight * 100)) > 1e-8)
  )
    errors.weight =
      "Enter a weight above 0 and up to 500 kg, with at most two decimal places, or leave it blank.";
  return errors;
}
function missing(res) {
  return res
    .status(401)
    .json({ message: "Account no longer exists. Please log in again." });
}
router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${fields} FROM users WHERE id=$1`, [
      req.userId,
    ]);
    if (!result.rows.length) return missing(res);
    res.json({ profile: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
router.patch("/", async (req, res, next) => {
  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !Object.keys(body).length ||
    Object.keys(body).some((key) => !allowed.has(key))
  )
    return res.status(400).json({
      message:
        "Provide only name, age and/or weight. Account identifiers cannot be changed.",
    });
  const errors = validationErrors(body);
  if (Object.keys(errors).length)
    return res
      .status(400)
      .json({ message: "Please correct the profile fields.", errors });
  const keys = Object.keys(body);
  const values = keys.map((key) =>
    key === "name" ? body.name.trim() : body[key],
  );
  values.push(req.userId);
  try {
    // Column names come only from the fixed allowlist; all values are parameters.
    const result = await pool.query(
      `UPDATE users SET ${keys.map((key, index) => `${key}=$${index + 1}`).join(", ")} WHERE id=$${values.length} RETURNING ${fields}`,
      values,
    );
    if (!result.rows.length) return missing(res);
    res.json({
      profile: result.rows[0],
      message: "Profile updated successfully.",
    });
  } catch (error) {
    if (["23514", "22003", "22P02"].includes(error.code))
      return res
        .status(400)
        .json({ message: "Invalid profile. Check your name, age and weight." });
    next(error);
  }
});
module.exports = router;
