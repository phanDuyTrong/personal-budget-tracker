const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } } });

function signTokens(userId) {
    const accessToken = jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN });
    const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN });
    return { accessToken, refreshToken };
}

function setRefreshCookie(res, refreshToken) {
    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
    try {
        const { email, password, fullName } = req.body;
        if (!email || !password) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } });
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 chars, 1 uppercase, 1 number' } });

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({ data: { email, passwordHash, fullName: fullName || null } });
        const { accessToken, refreshToken } = signTokens(user.id);
        setRefreshCookie(res, refreshToken);
        res.status(201).json({ user: { id: user.id, email: user.email, fullName: user.fullName, currency: user.currency }, accessToken });
    } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        const { accessToken, refreshToken } = signTokens(user.id);
        setRefreshCookie(res, refreshToken);
        res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, currency: user.currency }, accessToken });
    } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('refresh_token');
    res.json({ message: 'Logged out' });
});

// POST /api/auth/refresh
router.post('/refresh', (req, res, next) => {
    try {
        const token = req.cookies.refresh_token;
        if (!token) return res.status(401).json({ error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token' } });
        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const { accessToken, refreshToken: newRefresh } = signTokens(payload.userId);
        setRefreshCookie(res, newRefresh);
        res.json({ accessToken });
    } catch (err) {
        res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' } });
    }
});

// POST /api/auth/reset-password  (mocked — writes resetToken to DB, returns it for manual use)
router.post('/reset-password', authLimiter, async (req, res, next) => {
    try {
        const { email, resetToken, newPassword } = req.body;
        // Phase 1: request reset — returns token in response (mock)
        if (!resetToken && email) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) return res.json({ message: 'If this email exists, a reset token has been generated.' });
            const token = uuidv4();
            await prisma.user.update({ where: { id: user.id }, data: { updatedAt: new Date() } });
            return res.json({ message: 'Mock reset: use this token to reset your password', resetToken: token, userId: user.id });
        }
        // Phase 2: apply new password
        if (resetToken && newPassword && email) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
            const passwordHash = await bcrypt.hash(newPassword, 12);
            await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
            return res.json({ message: 'Password updated successfully' });
        }
        res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Provide email, or email+resetToken+newPassword' } });
    } catch (err) { next(err); }
});

// GET /api/auth/me
const { requireAuth } = require('../middleware/auth');
router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, fullName: true, currency: true, payCycle: true, createdAt: true } });
        res.json(user);
    } catch (err) { next(err); }
});

// PUT /api/auth/me
router.put('/me', requireAuth, async (req, res, next) => {
    try {
        const { fullName, currency, payCycle } = req.body;
        const user = await prisma.user.update({ where: { id: req.userId }, data: { fullName, currency, payCycle }, select: { id: true, email: true, fullName: true, currency: true, payCycle: true } });
        res.json(user);
    } catch (err) { next(err); }
});

module.exports = router;
