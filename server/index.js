require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured in server/.env');
const app = require('./src/app');
const pool = require('./src/db/pool');
const server = app.listen(process.env.PORT || 5000, () => console.log('Sweety API started.'));
server.on('error', error => { console.error('Server failed to start:', error.code); process.exitCode = 1; });
function shutdown() { server.close(() => pool.end().then(() => process.exit(0))); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
