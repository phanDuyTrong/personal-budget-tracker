import { supabase } from '@/lib/supabase';

const TRANSACTION_BATCH_SIZE = 1000;

export async function fetchAllTransactions<T = any>(
    select: string,
    configure?: (query: any) => any,
): Promise<T[]> {
    const rows: T[] = [];
    let from = 0;

    while (true) {
        let query = supabase.from('transactions').select(select);

        if (configure) {
            query = configure(query);
        }

        query = query
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, from + TRANSACTION_BATCH_SIZE - 1);

        const { data, error } = await query;
        if (error) throw error;

        const batch = data || [];
        rows.push(...batch);

        if (batch.length < TRANSACTION_BATCH_SIZE) {
            break;
        }

        from += TRANSACTION_BATCH_SIZE;
    }

    return rows;
}
