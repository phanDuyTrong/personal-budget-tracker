const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function parseDateRange(query) {
    const now = new Date();
    const dateFrom = query.date_from ? new Date(query.date_from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const dateTo = query.date_to ? new Date(query.date_to) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { dateFrom, dateTo };
}

// GET /api/dashboard/kpis
router.get('/kpis', async (req, res, next) => {
    try {
        const { dateFrom, dateTo } = parseDateRange(req.query);
        const prevFrom = new Date(dateFrom); prevFrom.setMonth(prevFrom.getMonth() - 1);
        const prevTo = new Date(dateTo); prevTo.setMonth(prevTo.getMonth() - 1);

        const [accounts, curIncome, curExpense, prevIncome, prevExpense] = await prisma.$transaction([
            prisma.account.aggregate({ _sum: { balance: true }, where: { userId: req.userId, deletedAt: null } }),
            prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: req.userId, type: 'income', date: { gte: dateFrom, lte: dateTo } } }),
            prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: req.userId, type: 'expense', date: { gte: dateFrom, lte: dateTo } } }),
            prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: req.userId, type: 'income', date: { gte: prevFrom, lte: prevTo } } }),
            prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: req.userId, type: 'expense', date: { gte: prevFrom, lte: prevTo } } }),
        ]);

        const totalBalance = Number(accounts._sum.balance) || 0;
        const income = Number(curIncome._sum.amount) || 0;
        const expenses = Number(curExpense._sum.amount) || 0;
        const pIncome = Number(prevIncome._sum.amount) || 0;
        const pExpenses = Number(prevExpense._sum.amount) || 0;
        const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
        const prevSavingsRate = pIncome > 0 ? ((pIncome - pExpenses) / pIncome) * 100 : 0;

        res.json({
            totalBalance,
            monthlyIncome: income,
            monthlyExpenses: expenses,
            savingsRate: Math.round(savingsRate * 10) / 10,
            deltas: {
                income: pIncome > 0 ? ((income - pIncome) / pIncome) * 100 : null,
                expenses: pExpenses > 0 ? ((expenses - pExpenses) / pExpenses) * 100 : null,
                savingsRate: prevSavingsRate !== 0 ? savingsRate - prevSavingsRate : null,
            },
        });
    } catch (err) { next(err); }
});

// GET /api/dashboard/net-worth  (last 12 months)
router.get('/net-worth', async (req, res, next) => {
    try {
        const months = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleString('default', { month: 'short', year: '2-digit' }) });
        }

        const result = await Promise.all(months.map(async ({ year, month, label }) => {
            const endOfMonth = new Date(year, month, 0, 23, 59, 59);
            const [income, expense] = await prisma.$transaction([
                prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: req.userId, type: 'income', date: { lte: endOfMonth } } }),
                prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: req.userId, type: 'expense', date: { lte: endOfMonth } } }),
            ]);
            const baseBalance = await prisma.account.aggregate({ _sum: { balance: true }, where: { userId: req.userId, deletedAt: null } });
            // Approximate: current balance is ground truth; net worth = base + (historical net)
            const net = (Number(income._sum.amount) || 0) - (Number(expense._sum.amount) || 0);
            return { label, netWorth: Number(baseBalance._sum.balance) || 0 + net };
        }));

        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/dashboard/income-expense  (last 6 months)
router.get('/income-expense', async (req, res, next) => {
    try {
        const now = new Date();
        const result = [];
        for (let i = 5; i >= 0; i--) {
            const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            const label = from.toLocaleString('default', { month: 'short', year: '2-digit' });
            const [income, expense] = await prisma.$transaction([
                prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: req.userId, type: 'income', date: { gte: from, lte: to } } }),
                prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: req.userId, type: 'expense', date: { gte: from, lte: to } } }),
            ]);
            result.push({ label, income: Number(income._sum.amount) || 0, expense: Number(expense._sum.amount) || 0 });
        }
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/dashboard/spending-by-category
router.get('/spending-by-category', async (req, res, next) => {
    try {
        const { dateFrom, dateTo } = parseDateRange(req.query);
        const { parent_id } = req.query;

        const where = { userId: req.userId, type: 'expense', date: { gte: dateFrom, lte: dateTo } };
        if (parent_id) {
            where.category = { parentId: parent_id };
        } else {
            where.category = { parentId: null };
        }

        const txs = await prisma.transaction.findMany({ where, include: { category: true } });
        const grouped = {};
        txs.forEach(tx => {
            const key = tx.categoryId || '__uncategorized__';
            const label = tx.category?.name || 'Uncategorized';
            const color = tx.category?.color || '#94a3b8';
            const icon = tx.category?.icon || '📦';
            if (!grouped[key]) grouped[key] = { id: key, name: label, color, icon, amount: 0 };
            grouped[key].amount += Number(tx.amount);
        });

        res.json(Object.values(grouped).sort((a, b) => b.amount - a.amount));
    } catch (err) { next(err); }
});

// GET /api/dashboard/budget-health
router.get('/budget-health', async (req, res, next) => {
    try {
        const { dateFrom, dateTo } = parseDateRange(req.query);
        const budgets = await prisma.budget.findMany({ where: { userId: req.userId }, include: { category: true } });

        const result = await Promise.all(budgets.map(async (b) => {
            const spent = await prisma.transaction.aggregate({
                _sum: { amount: true }, where: { userId: req.userId, categoryId: b.categoryId, type: 'expense', date: { gte: dateFrom, lte: dateTo } },
            });
            const spentAmount = Number(spent._sum.amount) || 0;
            const limit = Number(b.amount);
            const percentage = limit > 0 ? Math.round((spentAmount / limit) * 100) : 0;
            return { ...b, spent: spentAmount, percentage, status: percentage < 80 ? 'ok' : percentage < 100 ? 'warning' : 'over' };
        }));

        res.json(result.sort((a, b) => b.percentage - a.percentage));
    } catch (err) { next(err); }
});

// GET /api/dashboard/daily-spend?month=YYYY-MM
router.get('/daily-spend', async (req, res, next) => {
    try {
        const monthStr = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [year, month] = monthStr.split('-').map(Number);
        const from = new Date(year, month - 1, 1);
        const to = new Date(year, month, 0);

        const txs = await prisma.transaction.findMany({
            where: { userId: req.userId, type: 'expense', date: { gte: from, lte: to } },
            orderBy: { date: 'asc' },
        });

        const dailyMap = {};
        txs.forEach(tx => {
            const day = new Date(tx.date).getDate();
            dailyMap[day] = (dailyMap[day] || 0) + Number(tx.amount);
        });

        const days = to.getDate();
        const result = [];
        for (let d = 1; d <= days; d++) {
            result.push({ day: d, amount: dailyMap[d] || 0 });
        }

        // 7-day rolling average
        const withAvg = result.map((r, i) => {
            const window = result.slice(Math.max(0, i - 6), i + 1);
            const avg = window.reduce((s, x) => s + x.amount, 0) / window.length;
            return { ...r, rollingAvg: Math.round(avg * 100) / 100 };
        });

        res.json(withAvg);
    } catch (err) { next(err); }
});

// GET /api/dashboard/top-categories
router.get('/top-categories', async (req, res, next) => {
    try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const txs = await prisma.transaction.findMany({
            where: { userId: req.userId, type: 'expense', date: { gte: from, lte: to }, category: { parentId: null } },
            include: { category: true },
        });

        const grouped = {};
        txs.forEach(tx => {
            if (!tx.categoryId) return;
            if (!grouped[tx.categoryId]) grouped[tx.categoryId] = { ...tx.category, total: 0, sparkline: [] };
            grouped[tx.categoryId].total += Number(tx.amount);
        });

        const top5 = Object.values(grouped).sort((a, b) => b.total - a.total).slice(0, 5);

        // Add 3-month sparkline
        const enriched = await Promise.all(top5.map(async (cat) => {
            const sparkline = [];
            for (let i = 2; i >= 0; i--) {
                const mFrom = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const mTo = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
                const agg = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { userId: req.userId, categoryId: cat.id, type: 'expense', date: { gte: mFrom, lte: mTo } } });
                sparkline.push(Number(agg._sum.amount) || 0);
            }
            return { ...cat, sparkline };
        }));

        res.json(enriched);
    } catch (err) { next(err); }
});

// GET /api/dashboard/goals-progress
router.get('/goals-progress', async (req, res, next) => {
    try {
        const goals = await prisma.goal.findMany({ where: { userId: req.userId, status: 'active' }, include: { account: true } });
        const enriched = goals.map(g => {
            const target = Number(g.targetAmount);
            const current = Number(g.currentAmount);
            const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
            const remaining = Math.max(target - current, 0);
            let requiredMonthlySaving = null;
            let daysLeft = null;
            if (g.deadline) {
                const now = new Date();
                const deadline = new Date(g.deadline);
                const monthsLeft = (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth());
                daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
                requiredMonthlySaving = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
            }
            return { ...g, percentage, remaining, requiredMonthlySaving, daysLeft };
        });
        res.json(enriched);
    } catch (err) { next(err); }
});

module.exports = router;
