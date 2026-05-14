require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const budgetData = [
    { name: 'Mua đồ ăn', amount: 500000 },
    { name: 'Ăn sang', amount: 1500000 },
    { name: 'Uống nước', amount: 150000 },
    { name: 'Xăng xe', amount: 1000000 },
    { name: 'Gửi xe', amount: 100000 },
    { name: 'Bảo trì bảo dưỡng', amount: 250000 },
    { name: 'Điện thoại', amount: 100000 },
    { name: 'Mạng 4G', amount: 50000 },
    { name: 'Mua sắm đồ cá nhân', amount: 600000 },
    { name: 'Xem phim', amount: 150000 },
    { name: 'Đánh bài', amount: 500000 },
    { name: 'Khóa học online', amount: 3500000 },
    { name: 'Cho tiền người thân', amount: 200000 },
    { name: 'Từ thiện', amount: 70000 },
    { name: 'Răng', amount: 500000 },
    { name: 'Khám chữa bệnh', amount: 100000 },
    { name: 'Gym/Fitness', amount: 350000 },
    { name: 'Hoạt động thể thao', amount: 100000 },
    { name: 'Sửa thiết bị', amount: 65000 },
    { name: 'Vệ sinh giày', amount: 132000 },
    { name: 'AI', amount: 33000 }
];

async function main() {
    console.log('Fetching all categories...');
    const categories = await prisma.categories.findMany();

    if (categories.length === 0) {
        console.log('No categories found.');
        return;
    }

    // Use the user_id from the first category found
    const userId = categories[0].user_id;

    const existingBudgets = await prisma.budgets.findMany({ where: { user_id: userId } });
    const existingMap = {};
    existingBudgets.forEach(b => {
        existingMap[b.category_id] = b;
    });

    let inserted = 0;
    let updated = 0;
    let notFound = 0;

    for (const item of budgetData) {
        // Exact or case-insensitive match
        const cat = categories.find(c => c.name.toLowerCase() === item.name.toLowerCase());
        if (!cat) {
            console.log(`⚠️ Category not found for: "${item.name}"`);
            notFound++;
            continue;
        }

        if (existingMap[cat.id]) {
            // Update
            await prisma.budgets.update({
                where: { id: existingMap[cat.id].id },
                data: { amount: item.amount }
            });
            updated++;
        } else {
            // Insert
            await prisma.budgets.create({
                data: {
                    category_id: cat.id,
                    amount: item.amount,
                    period: 'monthly',
                    user_id: userId,
                    start_date: new Date()
                }
            });
            inserted++;
        }
    }

    console.log(`Done! Inserted: ${inserted}, Updated: ${updated}, Not Found: ${notFound}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
