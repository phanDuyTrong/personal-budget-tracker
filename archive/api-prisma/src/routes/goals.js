const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/goals
router.get('/', async (req, res, next) => {
    try {
        const { status } = req.query;
        const where = { userId: req.userId };
        if (status) where.status = status;
        const goals = await prisma.goal.findMany({ where, include: { account: true }, orderBy: { createdAt: 'desc' } });

        // Enrich with progress metrics
        const enriched = goals.map(g => {
            const target = Number(g.targetAmount);
            const current = Number(g.currentAmount);
            const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
            const remaining = Math.max(target - current, 0);
            let requiredMonthlySaving = null;
            if (g.deadline) {
                const now = new Date();
                const deadline = new Date(g.deadline);
                const monthsLeft = (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth());
                requiredMonthlySaving = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
                const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
                return { ...g, percentage, remaining, requiredMonthlySaving, daysLeft };
            }
            return { ...g, percentage, remaining, requiredMonthlySaving };
        });

        res.json(enriched);
    } catch (err) { next(err); }
});

// POST /api/goals
router.post('/', async (req, res, next) => {
    try {
        const { accountId, name, targetAmount, currentAmount, deadline } = req.body;
        if (!name || !targetAmount) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name and targetAmount are required' } });
        const goal = await prisma.goal.create({
            data: { userId: req.userId, accountId: accountId || null, name, targetAmount: parseFloat(targetAmount), currentAmount: parseFloat(currentAmount) || 0, deadline: deadline ? new Date(deadline) : null },
            include: { account: true },
        });
        res.status(201).json(goal);
    } catch (err) { next(err); }
});

// GET /api/goals/:id
router.get('/:id', async (req, res, next) => {
    try {
        const goal = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.userId }, include: { account: true } });
        if (!goal) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found' } });
        res.json(goal);
    } catch (err) { next(err); }
});

// PUT /api/goals/:id
router.put('/:id', async (req, res, next) => {
    try {
        const existing = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found' } });
        const { accountId, name, targetAmount, currentAmount, deadline, status } = req.body;
        const goal = await prisma.goal.update({
            where: { id: req.params.id },
            data: { accountId: accountId !== undefined ? accountId : existing.accountId, name: name ?? existing.name, targetAmount: targetAmount !== undefined ? parseFloat(targetAmount) : existing.targetAmount, currentAmount: currentAmount !== undefined ? parseFloat(currentAmount) : existing.currentAmount, deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : existing.deadline, status: status ?? existing.status },
            include: { account: true },
        });
        res.json(goal);
    } catch (err) { next(err); }
});

// PATCH /api/goals/:id/amount
router.patch('/:id/amount', async (req, res, next) => {
    try {
        const { currentAmount } = req.body;
        const existing = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found' } });
        const newAmount = parseFloat(currentAmount);
        const newStatus = newAmount >= Number(existing.targetAmount) ? 'completed' : existing.status;
        const goal = await prisma.goal.update({ where: { id: req.params.id }, data: { currentAmount: newAmount, status: newStatus } });
        res.json(goal);
    } catch (err) { next(err); }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const existing = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found' } });
        await prisma.goal.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (err) { next(err); }
});

module.exports = router;
