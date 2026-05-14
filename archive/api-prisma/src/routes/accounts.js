const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/accounts
router.get('/', async (req, res, next) => {
    try {
        const accounts = await prisma.account.findMany({
            where: { userId: req.userId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
        res.json(accounts);
    } catch (err) { next(err); }
});

// POST /api/accounts
router.post('/', async (req, res, next) => {
    try {
        const { name, type, balance, currency } = req.body;
        if (!name || !type) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name and type are required' } });
        const account = await prisma.account.create({
            data: { userId: req.userId, name, type, balance: parseFloat(balance) || 0, currency: currency || 'USD' },
        });
        res.status(201).json(account);
    } catch (err) { next(err); }
});

// GET /api/accounts/:id
router.get('/:id', async (req, res, next) => {
    try {
        const account = await prisma.account.findFirst({ where: { id: req.params.id, userId: req.userId, deletedAt: null } });
        if (!account) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account not found' } });
        res.json(account);
    } catch (err) { next(err); }
});

// PUT /api/accounts/:id
router.put('/:id', async (req, res, next) => {
    try {
        const { name, type, balance, currency } = req.body;
        const existing = await prisma.account.findFirst({ where: { id: req.params.id, userId: req.userId, deletedAt: null } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account not found' } });
        const account = await prisma.account.update({
            where: { id: req.params.id },
            data: { name: name ?? existing.name, type: type ?? existing.type, balance: balance !== undefined ? parseFloat(balance) : existing.balance, currency: currency ?? existing.currency },
        });
        res.json(account);
    } catch (err) { next(err); }
});

// DELETE /api/accounts/:id (soft delete)
router.delete('/:id', async (req, res, next) => {
    try {
        const existing = await prisma.account.findFirst({ where: { id: req.params.id, userId: req.userId, deletedAt: null } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account not found' } });
        await prisma.account.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
        res.status(204).send();
    } catch (err) { next(err); }
});

module.exports = router;
