const jwt = require('jsonwebtoken');
module.exports = function authenticate(req, res, next) {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ message: 'Please log in to continue.' });
  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!Number.isInteger(payload.userId) || payload.userId < 1) throw new Error('Invalid user');
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or expired. Please log in again.' });
  }
};
