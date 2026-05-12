const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Build tree from flat list
function buildTree(categories) {
    const map = {};
    categories.forEach(c => { map[c.id] = { ...c, children: [] }; });
    const roots = [];
    categories.forEach(c => {
        if (c.parentId) {
            if (map[c.parentId]) map[c.parentId].children.push(map[c.id]);
        } else {
            roots.push(map[c.id]);
        }
    });
    return roots;
}

// GET /api/categories  (returns tree)
router.get('/', async (req, res, next) => {
    try {
        const categories = await prisma.category.findMany({
            where: { userId: req.userId },
            orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
        });
        res.json(buildTree(categories));
    } catch (err) { next(err); }
});

// POST /api/categories
router.post('/', async (req, res, next) => {
    try {
        const { name, icon, color, type, parentId } = req.body;
        if (!name || !type) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name and type are required' } });
        // Depth guard: parent must be a root category
        if (parentId) {
            const parent = await prisma.category.findFirst({ where: { id: parentId, userId: req.userId } });
            if (!parent) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Parent category not found' } });
            if (parent.parentId) return res.status(400).json({ error: { code: 'MAX_DEPTH', message: 'Max category depth is 2 levels' } });
        }
        const category = await prisma.category.create({
            data: { userId: req.userId, name, icon: icon || null, color: color || null, type, parentId: parentId || null },
        });
        res.status(201).json(category);
    } catch (err) { next(err); }
});

// GET /api/categories/:id
router.get('/:id', async (req, res, next) => {
    try {
        const category = await prisma.category.findFirst({
            where: { id: req.params.id, userId: req.userId },
            include: { children: true },
        });
        if (!category) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
        res.json(category);
    } catch (err) { next(err); }
});

// PUT /api/categories/:id
router.put('/:id', async (req, res, next) => {
    try {
        const { name, icon, color, type, parentId } = req.body;
        const existing = await prisma.category.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
        const category = await prisma.category.update({
            where: { id: req.params.id },
            data: { name: name ?? existing.name, icon: icon !== undefined ? icon : existing.icon, color: color !== undefined ? color : existing.color, type: type ?? existing.type, parentId: parentId !== undefined ? parentId : existing.parentId },
        });
        res.json(category);
    } catch (err) { next(err); }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const existing = await prisma.category.findFirst({ where: { id: req.params.id, userId: req.userId } });
        if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
        // Check for linked transactions
        const linkedCount = await prisma.transaction.count({ where: { categoryId: req.params.id } });
        if (linkedCount > 0) {
            return res.status(409).json({ error: { code: 'LINKED_TRANSACTIONS', message: `${linkedCount} transaction(s) linked. Reassign before deleting.`, linkedCount } });
        }
        // Also check splits
        const splitCount = await prisma.transactionSplit.count({ where: { categoryId: req.params.id } });
        if (splitCount > 0) {
            return res.status(409).json({ error: { code: 'LINKED_SPLITS', message: `${splitCount} split(s) linked. Reassign before deleting.`, splitCount } });
        }
        await prisma.category.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (err) { next(err); }
});

// POST /api/categories/:id/reassign — bulk reassign transactions before delete
router.post('/:id/reassign', async (req, res, next) => {
    try {
        const { newCategoryId } = req.body;
        await prisma.$transaction([
            prisma.transaction.updateMany({ where: { categoryId: req.params.id, userId: req.userId }, data: { categoryId: newCategoryId || null } }),
            prisma.transactionSplit.updateMany({ where: { categoryId: req.params.id }, data: { categoryId: newCategoryId || null } }),
        ]);
        res.json({ message: 'Reassigned successfully' });
    } catch (err) { next(err); }
});

module.exports = router;
