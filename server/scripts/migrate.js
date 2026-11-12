require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const pool = require('../src/db/pool');
(async () => {
 try {
  await pool.query(require('fs').readFileSync(require('path').join(__dirname, '../src/db/schema.sql'), 'utf8'));
  console.log('Schema applied successfully. Existing data preserved.');
 } catch (error) { console.error('Schema failed:', error.code || 'INTERNAL_ERROR'); process.exitCode = 1; }
 finally { await pool.end(); }
})();
