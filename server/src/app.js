const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '16kb' }));
app.get('/api/health', (req, res) => res.json({ success: true, message: 'Sweety API is running successfully' }));
app.get('/api/config', (req, res) => res.json({ today: require('./utils/dates').today(), timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/readings', require('./routes/readingRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use((req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
app.use((error, req, res, next) => {
  if (error.code === '23503') return res.status(401).json({ message: 'Account no longer exists. Please log in again.' });
  if (error.code === '23505') return res.status(409).json({ message: 'A reading already exists for that date and slot. Edit it instead.' });
  if (['23514', '23502', '22P02', '22007', '22008'].includes(error.code)) return res.status(400).json({ message: 'Invalid reading. Check the date, slot and glucose value.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body must be valid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
  // Never log database parameters, credentials, or raw authentication errors.
  console.error('API request failed:', error.code || 'INTERNAL_ERROR');
  res.status(500).json({ message: 'Unable to complete the request. Please try again.' });
});
module.exports = app;
