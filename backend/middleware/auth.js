const jwt = require('jsonwebtoken');

exports.requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: token missing' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
        req.user = { id: payload.sub, email: payload.email };
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized: invalid token' });
    }
};
