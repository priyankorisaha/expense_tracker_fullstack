const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const CURRENCY_ALIASES = {
    '$': 'USD',
    'us dollar': 'USD',
    usd: 'USD',
    '₹': 'INR',
    inr: 'INR',
    rupee: 'INR',
    rs: 'INR',
    '€': 'EUR',
    eur: 'EUR',
};

const TIMEZONE_ALIASES = {
    utc: 'UTC',
    gmt: 'UTC',
    ist: 'Asia/Kolkata',
    india: 'Asia/Kolkata',
    kolkata: 'Asia/Kolkata',
    'india standard time': 'Asia/Kolkata',
};

const signToken = (user) =>
    jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET || 'dev_secret_change_me', {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

const isValidCurrency = (currencyCode) => {
    try {
        new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(10);
        return true;
    } catch (error) {
        return false;
    }
};

const normalizeCurrency = (value) => {
    const raw = (value || '').toString().trim();
    if (!raw) return 'USD';
    const alias = CURRENCY_ALIASES[raw.toLowerCase()] || CURRENCY_ALIASES[raw];
    const normalized = (alias || raw).toUpperCase();
    return normalized;
};

const isValidTimezone = (timezone) => {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return true;
    } catch (error) {
        return false;
    }
};

const normalizeTimezone = (value) => {
    const raw = (value || '').toString().trim();
    if (!raw) return 'UTC';
    return TIMEZONE_ALIASES[raw.toLowerCase()] || raw;
};

exports.register = async (req, res) => {
    try {
        const { name, email, password, currency, timezone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'name, email, password are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        const normalizedCurrency = normalizeCurrency(currency);
        if (!isValidCurrency(normalizedCurrency)) {
            return res.status(400).json({
                message: 'Invalid currency. Use ISO code like USD or INR (symbols like ₹ are also accepted).',
            });
        }

        const normalizedTimezone = normalizeTimezone(timezone);
        if (!isValidTimezone(normalizedTimezone)) {
            return res.status(400).json({
                message: 'Invalid timezone. Use UTC or IANA value like Asia/Kolkata.',
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email: normalizedEmail,
            passwordHash,
            currency: normalizedCurrency,
            timezone: normalizedTimezone,
        });

        const token = signToken(user);
        return res.status(201).json({
            message: 'User created',
            token,
            user: { id: user._id, name: user.name, email: user.email, currency: user.currency, timezone: user.timezone },
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Server Error', detail: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = signToken(user);
        return res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user._id, name: user.name, email: user.email, currency: user.currency, timezone: user.timezone },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server Error' });
    }
};
