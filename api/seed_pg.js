require('dotenv').config();
const { Client } = require('pg');

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
    console.log("Connecting to database:", process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();

        // 1. Get user_id from existing categories since it's single user
        const { rows: categories } = await client.query('SELECT * FROM "categories" LIMIT 1');
        if (categories.length === 0) {
            console.log('No categories found.');
            return;
        }
        const userId = categories[0].user_id;

        // 2. Fetch all categories
        const { rows: allCategories } = await client.query('SELECT * FROM "categories" WHERE "user_id" = $1', [userId]);

        // 3. Fetch existing budgets
        const { rows: existingBudgets } = await client.query('SELECT * FROM "budgets" WHERE "user_id" = $1', [userId]);
        const existingMap = {};
        existingBudgets.forEach(b => {
            existingMap[b.category_id] = b;
        });

        let inserted = 0; let updated = 0; let notFound = 0;

        for (const item of budgetData) {
            const cat = allCategories.find(c => c.name.toLowerCase() === item.name.toLowerCase());
            if (!cat) {
                console.log(`⚠️ Category not found for: "${item.name}"`);
                notFound++;
                continue;
            }

            if (existingMap[cat.id]) {
                await client.query('UPDATE "budgets" SET "amount" = $1, "updated_at" = NOW() WHERE "id" = $2', [item.amount, existingMap[cat.id].id]);
                updated++;
            } else {
                await client.query(`
                    INSERT INTO "budgets" ("category_id", "amount", "period", "user_id", "start_date")
                    VALUES ($1, $2, $3, $4, NOW())
                `, [cat.id, item.amount, 'monthly', userId]);
                inserted++;
            }
        }

        console.log(`✅ Done! Inserted: ${inserted}, Updated: ${updated}, Not Found: ${notFound}`);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
