const jwt = require('jsonwebtoken');

/* T-31: runs before every owner-scoped route and lets the request through 
only with a valid, unexpired token that this server signed.*/
function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (!/^Bearer$/i.test(scheme || '') || !token) {
    return res.status(401).json({ error: 'Missing token.' });
  }

  let payload;
  try {
    // Only accept HS256, the algorithm issueToken signs with.
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
  if (!payload.sub) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.user = { user_id: payload.sub, email: payload.email };
  next();
}

module.exports = authenticate;