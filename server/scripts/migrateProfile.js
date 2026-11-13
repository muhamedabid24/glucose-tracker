require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
  quiet: true,
});
const pool = require("../src/db/pool");
(async () => {
  try {
    await pool.query(
      require("fs").readFileSync(
        require("path").join(
          __dirname,
          "../src/db/migrations/001_user_profile.sql",
        ),
        "utf8",
      ),
    );
    console.log(
      "Profile migration applied; existing users and readings preserved.",
    );
  } catch (error) {
    console.error("Profile migration failed:", error.code || "DATABASE_ERROR");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
