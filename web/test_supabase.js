import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('transactions').select('*, wallet:wallets!wallet_id(id,name), to_wallet:wallets!to_wallet_id(id,name), category:categories(id,name,icon,color,parent_id), splits:transaction_splits(*, category:categories(id,name,icon,color)), contact:contacts(id,name)', { count: 'exact' }).limit(1);
    console.log("Error:", error);
    console.log("Data:", data);
}
run();
