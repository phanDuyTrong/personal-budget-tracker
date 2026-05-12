import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

config(); // load .env

export default defineConfig({
    datasource: {
        url: process.env.DATABASE_URL,
    },
});
