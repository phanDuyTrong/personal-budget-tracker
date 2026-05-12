const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    const client = await pool.connect();
    try {
        await client.query(`ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_debt BOOLEAN DEFAULT false;`);
        console.log("Successfully added is_debt column to transactions table!");
    } catch (err) {
        console.error('Error executing query', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
