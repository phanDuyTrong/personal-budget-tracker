const express = require('express');
const { Decimal } = require('@prisma/client/runtime/library');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Helper: adjust account balance
async function adjustBalance(accountId, delta) {
    if (!accountId) return;
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (account) {
        await prisma.account.update({
            where: { id: accountId },
            data: { balance: Number(account.balance) + delta },
        });
    }
}

// GET /api/transactions
router.get('/', async (req, res, next) => {
    try {
        const { date_from, date_to, category_id, account_id, type, is_reviewed, page = 1, limit = 50, search } = req.query;
        const where = { userId: req.userId };
        if (date_from || date_to) {
            where.date = {};
            if (date_from) where.date.gte = new Date(date_from);
            if (date_to) where.date.lte = new Date(date_to);
        }
        if (category_id) where.categoryId = category_id;
        if (account_id) where.accountId = account_id;
        if (type) where.type = type;
        if (is_reviewed !== undefined) where.isReviewed = is_reviewed === 'true';
        if (search) where.description = { contains: search, mode: 'insensitive' };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [transactions, total] = await prisma.$transaction([
            prisma.transaction.findMany({
                where,
                include: { account: true, category: { include: { parent: true } }, splits: { include: { category: true } } },
                orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
                skip,
                take: parseInt(limit),
            }),
            prisma.transaction.count({ where }),
        ]);
        res.json({ data: transactions, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) { next(err); }
});

// POST /api/transactions
router.post('/', async (req, res, next) => {
    try {
        const { accountId, categoryId, amount, type, description, date, isRecurring, recurrenceRule, toAccountId } = req.body;
        if (!amount || !type || !date) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'amount, type, and date are required' } });
        const numAmount = parseFloat(amount);

        const transaction = await prisma.transaction.create({
            data: { userId: req.userId, accountId: accountId || null, categoryId: categoryId || null, amount: numAmount, type, description: description || null, date: new Date(date), isRecurring: !!isRecurring, recurrenceRule: recurrenceRule || null, toAccountId: toAccountId || null },
            include: { account: true, category: { include: { parent: true } }, splits: true },
        });

        // Adjust balances
        if (type === 'expense') await adjustBalance(accountId, -numAmount);
        else if (type === 'income') await adjustBalance(accountId, numAmount);
        else if (type === 'transfer') {
            await adjustBalance(accountId, -numAmount);
            await adjustBalance(toAccountId, numAmount);
        }

        res.status(201).json(transaction);
    } catch (err) { next(err); }
});

// GET /api/transactions/:id
router.get('/:id', async (req, res, next) => {
    try {
        const tx = await prisma.transaction.findFirst({
            where: { id: req.params.id, userId: req.userId },
            include: { account: true, category: { include: { parent: true } }, splits: { include: { category: true } } },
        });
        if (!tx) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
        res.json(tx);
    } catch (err) { next(err); }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res, next) => {
    try {
        const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });

        const { accountId, categoryId, amount, type, description, date, isRecurring, recurrenceRule, toAccountId } = req.body;
        const newAmount = amount !== undefined ? parseFloat(amount) : Number(existing.amount);
        const newType = type ?? existing.type;
        const newAccountId = accountId !== undefined ? accountId : existing.accountId;
        const newToAccountId = toAccountId !== undefined ? toAccountId : existing.toAccountId;

        // Reverse old balance effect
        if (existing.type === 'expense') await adjustBalance(existing.accountId, Number(existing.amount));
        else if (existing.type === 'income') await adjustBalance(existing.accountId, -Number(existing.amount));
        else if (existing.type === 'transfer') {
            await adjustBalance(existing.accountId, Number(existing.amount));
            await adjustBalance(existing.toAccountId, -Number(existing.amount));
        }

        const updated = await prisma.transaction.update({
            where: { id: req.params.id },
            data: { accountId: newAccountId, categoryId: categoryId !== undefined ? categoryId : existing.categoryId, amount: newAmount, type: newType, description: description !== undefined ? description : existing.description, date: date ? new Date(date) : existing.date, isRecurring: isRecurring !== undefined ? !!isRecurring : existing.isRecurring, recurrenceRule: recurrenceRule !== undefined ? recurrenceRule : existing.recurrenceRule, toAccountId: newToAccountId },
            include: { account: true, category: { include: { parent: true } }, splits: { include: { category: true } } },
        });

        // Apply new balance effect
        if (newType === 'expense') await adjustBalance(newAccountId, -newAmount);
        else if (newType === 'income') await adjustBalance(newAccountId, newAmount);
        else if (newType === 'transfer') {
            await adjustBalance(newAccountId, -newAmount);
            await adjustBalance(newToAccountId, newAmount);
        }

        res.json(updated);
    } catch (err) { next(err); }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });

        // Reverse balance
        if (existing.type === 'expense') await adjustBalance(existing.accountId, Number(existing.amount));
        else if (existing.type === 'income') await adjustBalance(existing.accountId, -Number(existing.amount));
        else if (existing.type === 'transfer') {
            await adjustBalance(existing.accountId, Number(existing.amount));
            await adjustBalance(existing.toAccountId, -Number(existing.amount));
        }

        await prisma.transaction.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (err) { next(err); }
});

// POST /api/transactions/:id/splits  (replace all splits atomically)
router.post('/:id/splits', async (req, res, next) => {
    try {
        const tx = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!tx) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
        const { splits } = req.body;
        if (!Array.isArray(splits) || splits.length === 0) return res.status(400).json({ error: { code: 'INVALID_SPLITS', message: 'splits must be a non-empty array' } });

        const totalSplit = splits.reduce((sum, s) => sum + parseFloat(s.amount), 0);
        if (Math.abs(totalSplit - Number(tx.amount)) > 0.01) {
            return res.status(400).json({ error: { code: 'SPLIT_MISMATCH', message: `Splits total (${totalSplit}) must equal transaction amount (${tx.amount})` } });
        }

        await prisma.$transaction([
            prisma.transactionSplit.deleteMany({ where: { transactionId: tx.id } }),
            prisma.transactionSplit.createMany({ data: splits.map(s => ({ transactionId: tx.id, categoryId: s.categoryId || null, amount: parseFloat(s.amount), note: s.note || null })) }),
        ]);

        const updated = await prisma.transaction.findUnique({ where: { id: tx.id }, include: { splits: { include: { category: true } } } });
        res.json(updated);
    } catch (err) { next(err); }
});

// PATCH /api/transactions/:id/review
router.patch('/:id/review', async (req, res, next) => {
    try {
        const tx = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!tx) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
        const updated = await prisma.transaction.update({ where: { id: req.params.id }, data: { isReviewed: !tx.isReviewed } });
        res.json(updated);
    } catch (err) { next(err); }
});

module.exports = router;
