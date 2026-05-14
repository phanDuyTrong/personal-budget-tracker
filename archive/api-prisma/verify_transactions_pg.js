// Using the new pg client to check that the database has transactions seeded properly
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT COUNT(*) as count FROM public.transactions
      WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sangtrongphuc@gmail.com' LIMIT 1);
    `);

        console.log("Total Transactions Seeded:", res.rows[0].count);

        const accountsRes = await client.query(`
      SELECT name, (
        SELECT COUNT(*) FROM public.transactions 
        WHERE account_id = accounts.id
      ) as count
      FROM public.accounts
      WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sangtrongphuc@gmail.com' LIMIT 1);
    `);

        console.log("\nTransactions per Account:");
        accountsRes.rows.forEach(row => {
            console.log(`- ${row.name}: ${row.count} transactions`);
        });

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
