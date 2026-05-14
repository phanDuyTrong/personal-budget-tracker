const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const contactsToSeed = [
    'Cá nhân',
    'Ín',
    'Ba',
    'Mẹ',
    'Em zai',
    'Người trong nhà',
    'Bạn bè',
    'Đồng nghiệp',
    'Đối tác',
    'Dịch vụ'
];

async function main() {
    const client = await pool.connect();
    try {
        const userRes = await client.query(`SELECT id FROM auth.users WHERE email = 'sangtrongphuc@gmail.com' LIMIT 1;`);
        if (userRes.rows.length === 0) {
            console.error("User sangtrongphuc@gmail.com not found!");
            return;
        }
        const userId = userRes.rows[0].id;
        console.log("Found user ID:", userId);

        const values = contactsToSeed.map(c => `('${userId}', '${c.replace(/'/g, "''")}')`).join(',');

        // Using ON CONFLICT DO NOTHING implies we might need a unique constraint on (user_id, name)
        // Assuming there might not be, we can just insert them blindly or check first.
        // Let's check first to avoid duplicates
        const existingRes = await client.query(`SELECT name FROM public.contacts WHERE user_id = '${userId}';`);
        const existingNames = new Set(existingRes.rows.map(r => r.name));

        let insertedCount = 0;
        for (const name of contactsToSeed) {
            if (!existingNames.has(name)) {
                await client.query(`INSERT INTO public.contacts (user_id, name) VALUES ($1, $2)`, [userId, name]);
                console.log(`Inserted contact: ${name}`);
                insertedCount++;
            } else {
                console.log(`Contact already exists: ${name}`);
            }
        }

        console.log(`\nSuccessfully seeded ${insertedCount} new contacts!`);

    } catch (err) {
        console.error('Error executing query', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
