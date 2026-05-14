import { createClient } from '@supabase/supabase-js';

const env = process.env;
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

const required = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    RLS_USER_A_EMAIL: env.RLS_USER_A_EMAIL,
    RLS_USER_A_PASSWORD: env.RLS_USER_A_PASSWORD,
    RLS_USER_B_EMAIL: env.RLS_USER_B_EMAIL,
    RLS_USER_B_PASSWORD: env.RLS_USER_B_PASSWORD,
};

const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

if (missing.length > 0) {
    console.error('Missing required env vars: ' + missing.join(', '));
    console.error('Create two confirmed Supabase auth test users, then run this script with their credentials.');
    process.exit(1);
}

function createAnonClient() {
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

async function signIn(client, label, email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
        throw new Error('Could not sign in ' + label + ': ' + error.message);
    }
    return data.user;
}

const userAClient = createAnonClient();
const userBClient = createAnonClient();
let walletId;

try {
    const userB = await signIn(userBClient, 'user B', env.RLS_USER_B_EMAIL, env.RLS_USER_B_PASSWORD);

    const { data: wallet, error: insertError } = await userBClient
        .from('wallets')
        .insert({
            user_id: userB.id,
            name: 'rls-smoke-' + Date.now(),
            type: 'checking',
            balance: 0,
        })
        .select('id')
        .single();

    if (insertError) {
        throw new Error('User B could not create a wallet: ' + insertError.message);
    }

    walletId = wallet.id;

    await signIn(userAClient, 'user A', env.RLS_USER_A_EMAIL, env.RLS_USER_A_PASSWORD);

    const { data: visibleWallets, error: selectError } = await userAClient
        .from('wallets')
        .select('id')
        .eq('id', walletId);

    if (selectError) {
        throw new Error('User A wallet lookup failed: ' + selectError.message);
    }

    if (visibleWallets.length !== 0) {
        throw new Error('RLS failed: user A can see user B wallet ' + walletId);
    }

    console.log('RLS smoke test passed: user A cannot see user B wallet.');
} finally {
    if (walletId) {
        await userBClient.from('wallets').delete().eq('id', walletId);
    }
    await Promise.allSettled([
        userAClient.auth.signOut(),
        userBClient.auth.signOut(),
    ]);
}
