const express = require('express');
const { createObjectCsvStringifier } = require('fast-csv');
const PDFDocument = require('pdfkit');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

// fast-csv v5 uses format(), not createObjectCsvStringifier — let's use the correct API
const { format: csvFormat } = require('fast-csv');
const { Readable, PassThrough } = require('stream');

const router = express.Router();
router.use(requireAuth);

function buildTransactionWhere(userId, query) {
    const where = { userId };
    if (query.date_from || query.date_to) {
        where.date = {};
        if (query.date_from) where.date.gte = new Date(query.date_from);
        if (query.date_to) where.date.lte = new Date(query.date_to);
    }
    if (query.category_id) where.categoryId = query.category_id;
    if (query.account_id) where.accountId = query.account_id;
    if (query.type) where.type = query.type;
    return where;
}

// GET /api/export/transactions/csv
router.get('/transactions/csv', async (req, res, next) => {
    try {
        const txs = await prisma.transaction.findMany({
            where: buildTransactionWhere(req.userId, req.query),
            include: { account: true, category: { include: { parent: true } } },
            orderBy: { date: 'desc' },
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');

        const csvStream = csvFormat({ headers: true });
        csvStream.pipe(res);
        txs.forEach(tx => {
            csvStream.write({
                date: tx.date.toISOString().split('T')[0],
                description: tx.description || '',
                type: tx.type,
                amount: Number(tx.amount),
                account: tx.account?.name || '',
                category: tx.category?.parent?.name || tx.category?.name || '',
                subCategory: tx.category?.parent ? tx.category?.name : '',
                reviewed: tx.isReviewed ? 'Yes' : 'No',
            });
        });
        csvStream.end();
    } catch (err) { next(err); }
});

// GET /api/export/transactions/pdf
router.get('/transactions/pdf', async (req, res, next) => {
    try {
        const txs = await prisma.transaction.findMany({
            where: buildTransactionWhere(req.userId, req.query),
            include: { account: true, category: { include: { parent: true } } },
            orderBy: { date: 'desc' },
            take: 500, // PDF cap
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.pdf"');

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        doc.pipe(res);

        doc.fontSize(18).font('Helvetica-Bold').text('Transaction Export', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(1);

        // Table header
        const cols = { date: 70, description: 180, type: 60, amount: 80, account: 90, category: 90 };
        const startX = 40;
        let y = doc.y;

        doc.font('Helvetica-Bold').fontSize(9);
        let x = startX;
        Object.entries(cols).forEach(([key, w]) => {
            doc.text(key.toUpperCase(), x, y, { width: w });
            x += w;
        });
        y += 16;
        doc.moveTo(startX, y).lineTo(startX + Object.values(cols).reduce((s, v) => s + v, 0), y).stroke();
        y += 4;

        doc.font('Helvetica').fontSize(8);
        txs.forEach((tx, i) => {
            if (y > 760) { doc.addPage(); y = 40; }
            const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
            const rowH = 14;
            doc.rect(startX, y, Object.values(cols).reduce((s, v) => s + v, 0), rowH).fill(bg);
            doc.fill('#1e293b');
            x = startX;
            const values = [
                tx.date.toISOString().split('T')[0],
                (tx.description || '').substring(0, 28),
                tx.type,
                `$${Number(tx.amount).toFixed(2)}`,
                (tx.account?.name || '').substring(0, 14),
                (tx.category?.name || 'Uncategorized').substring(0, 14),
            ];
            Object.values(cols).forEach((w, idx) => {
                doc.text(values[idx], x + 2, y + 2, { width: w - 4, ellipsis: true });
                x += w;
            });
            y += rowH;
        });

        doc.end();
    } catch (err) { next(err); }
});

module.exports = router;
