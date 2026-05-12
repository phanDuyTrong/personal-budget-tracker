const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/budgets (includes spent amount for current period)
router.get('/', async (req, res, next) => {
    try {
        const budgets = await prisma.budget.findMany({
            where: { userId: req.userId },
            include: { category: true },
            orderBy: { createdAt: 'desc' },
        });

        const now = new Date();
        const enriched = await Promise.all(budgets.map(async (b) => {
            const startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            const spent = await prisma.transaction.aggregate({
                _sum: { amount: true },
                where: {
                    userId: req.userId,
                    categoryId: b.categoryId,
                    type: 'expense',
                    date: { gte: startOfPeriod, lte: endOfPeriod },
                },
            });
            return { ...b, spent: Number(spent._sum.amount) || 0 };
        }));

        res.json(enriched);
    } catch (err) { next(err); }
});

// POST /api/budgets
router.post('/', async (req, res, next) => {
    try {
        const { categoryId, amount, period, rollover, startDate } = req.body;
        if (!categoryId || !amount || !period || !startDate) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'categoryId, amount, period, startDate are required' } });
        const budget = await prisma.budget.create({
            data: { userId: req.userId, categoryId, amount: parseFloat(amount), period, rollover: !!rollover, startDate: new Date(startDate) },
            include: { category: true },
        });
        res.status(201).json(budget);
    } catch (err) { next(err); }
});

// GET /api/budgets/:id
router.get('/:id', async (req, res, next) => {
    try {
        const budget = await prisma.budget.findFirst({ where: { id: req.params.id, userId: req.userId }, include: { category: true } });
        if (!budget) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Budget not found' } });
        res.json(budget);
    } catch (err) { next(err); }
});

// PUT /api/budgets/:id
router.put('/:id', async (req, res, next) => {
    try {
        const existing = await prisma.budget.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Budget not found' } });
        const { categoryId, amount, period, rollover, startDate } = req.body;
        const budget = await prisma.budget.update({
            where: { id: req.params.id },
            data: { categoryId: categoryId ?? existing.categoryId, amount: amount !== undefined ? parseFloat(amount) : existing.amount, period: period ?? existing.period, rollover: rollover !== undefined ? !!rollover : existing.rollover, startDate: startDate ? new Date(startDate) : existing.startDate },
            include: { category: true },
        });
        res.json(budget);
    } catch (err) { next(err); }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const existing = await prisma.budget.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Budget not found' } });
        await prisma.budget.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (err) { next(err); }
});

module.exports = router;
