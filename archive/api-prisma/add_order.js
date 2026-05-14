require('dotenv').config();
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        await client.query('ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "orderIndex" INTEGER DEFAULT 0;');
        console.log("✅ Added orderIndex to budgets");
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
