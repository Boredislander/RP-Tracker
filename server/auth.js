const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'apex-tracker-dev-secret';

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

function middleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Unauthorized' });
  const token = header.replace(/^Bearer\s+/, '');
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Forbidden' });
  next();
}

module.exports = { sign, middleware, adminOnly };
