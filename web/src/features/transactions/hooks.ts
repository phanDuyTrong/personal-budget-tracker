import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { nowISO } from '@/features/shared/api';
import { sortTransactionsForDisplay, TRANSACTION_SORT_MODES } from '@/features/transactions/sort';
import { parseMoneyInput } from '@/lib/money';
import { getRequiredUser } from '@/lib/auth';

// ── Transactions ─────────────────────────────────────────────────
export const useTransactions = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['transactions', params],
    queryFn: async () => {
        let query = supabase.from('transactions').select('*, wallet:wallets!wallet_id(id,name), to_wallet:wallets!to_wallet_id(id,name), category:categories(id,name,icon,color,parent_id), splits:transaction_splits(*, category:categories(id,name,icon,color)), contact:contacts(id,name)', { count: 'exact' });
        if (params.sortDate === TRANSACTION_SORT_MODES.OLDEST) {
            query = query.order('date', { ascending: true }).order('created_at', { ascending: true });
        } else if (params.sortDate === TRANSACTION_SORT_MODES.UPDATED_NEWEST) {
            query = query
                .order('updated_at', { ascending: false, nullsFirst: false })
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });
        } else if (params.sortDate === TRANSACTION_SORT_MODES.UPDATED_OLDEST) {
            query = query
                .order('updated_at', { ascending: true, nullsFirst: false })
                .order('date', { ascending: true })
                .order('created_at', { ascending: true });
        } else {
            query = query.order('date', { ascending: false }).order('created_at', { ascending: false });
        }
        if (params.date_from) query = query.gte('date', params.date_from);
        if (params.date_to) query = query.lte('date', params.date_to);
        if (params.category_ids?.length) query = query.in('category_id', params.category_ids);
        else if (params.category_id) query = query.eq('category_id', params.category_id);
        if (params.wallet_id) query = query.eq('wallet_id', params.wallet_id);
        if (params.to_wallet_id) query = query.eq('to_wallet_id', params.to_wallet_id);
        if (params.contact_id) query = query.eq('contact_id', params.contact_id);
        if (params.type) query = query.eq('type', params.type);
        if (params.is_reviewed !== undefined) query = query.eq('is_reviewed', params.is_reviewed === 'true');
        if (params.search) query = query.ilike('description', `%${params.search}%`);
        const limit = parseInt(params.limit) || 50;
        const page = parseInt(params.page) || 1;
        const from = (page - 1) * limit;
        query = query.range(from, from + limit - 1);
        const { data, error, count } = await query;
        if (error) throw error;
        return {
            data: sortTransactionsForDisplay(data || [], params.sortDate),
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        };
    },
});

export const useAllTransactions = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['all-transactions', params],
    queryFn: async () => {
        let query = supabase.from('transactions').select('*, category:categories(id,name,icon,color,parent_id)').order('created_at', { ascending: false }).order('date', { ascending: false });
        if (params.date_from) query = query.gte('date', params.date_from);
        if (params.date_to) query = query.lte('date', params.date_to);
        if (params.type) query = query.eq('type', params.type);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },
});

export const useTransactionMutations = () => {
    const qc = useQueryClient();
    const invAll = () => {
        qc.invalidateQueries({ queryKey: ['transactions'] });
        qc.invalidateQueries({ queryKey: ['all-transactions'] });
        qc.invalidateQueries({ queryKey: ['wallets'] });
        qc.invalidateQueries({ queryKey: ['calculated-wallets'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['budgets'] });
        qc.invalidateQueries({ queryKey: ['goals'] });
        qc.invalidateQueries({ queryKey: ['trips'] });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['categories'] });
    };
    const create = useMutation({
        mutationFn: async (d: any) => {
            const user = await getRequiredUser('You must be signed in to create a transaction.');
            const amt = parseMoneyInput(d.amount);
            const { data: tx, error } = await supabase.from('transactions').insert({ user_id: user.id, wallet_id: d.walletId || null, category_id: d.categoryId || null, contact_id: d.contactId || null, trip_id: d.tripId || null, amount: amt, type: d.type, description: d.description || null, date: d.date, is_recurring: !!d.isRecurring, is_debt: !!d.isDebt, to_wallet_id: d.type === 'transfer' ? (d.toWalletId || null) : null }).select().single();
            if (error) throw error; return tx;
        }, onSuccess: invAll,
    });
    const update = useMutation({
        mutationFn: async ({ id, ...d }: any) => {
            const { data: existing } = await supabase.from('transactions').select('*').eq('id', id).single();
            const amt = d.amount !== undefined ? parseMoneyInput(d.amount) : Number(existing.amount);
            const newType = d.type || existing.type;
            const { data: tx, error } = await supabase.from('transactions').update({ wallet_id: d.walletId !== undefined ? (d.walletId || null) : existing.wallet_id, category_id: d.categoryId !== undefined ? (d.categoryId || null) : existing.category_id, contact_id: d.contactId !== undefined ? (d.contactId || null) : existing.contact_id, trip_id: d.tripId !== undefined ? (d.tripId || null) : existing.trip_id, amount: amt, type: newType, description: d.description !== undefined ? d.description : existing.description, date: d.date || existing.date, is_reviewed: d.isReviewed !== undefined ? d.isReviewed : existing.is_reviewed, is_debt: d.isDebt !== undefined ? d.isDebt : existing.is_debt, to_wallet_id: newType === 'transfer' ? (d.toWalletId !== undefined ? (d.toWalletId || null) : existing.to_wallet_id) : null, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return tx;
        }, onSuccess: invAll,
    });
    const remove = useMutation({
        mutationFn: async (id: string) => { const { error } = await supabase.from('transactions').delete().eq('id', id); if (error) throw error; },
        onSuccess: invAll,
    });
    const bulkUpdateCategory = useMutation({
        mutationFn: async ({ ids, categoryId }: { ids: string[]; categoryId: string | null }) => {
            const { error } = await supabase
                .from('transactions')
                .update({ category_id: categoryId || null, updated_at: nowISO() })
                .in('id', ids);
            if (error) throw error;
        },
        onSuccess: invAll,
    });
    const bulkUpdate = useMutation({
        mutationFn: async ({ ids, patch }: { ids: string[]; patch: Record<string, any> }) => {
            if (ids.length === 0 || Object.keys(patch).length === 0) return;
            const { error } = await supabase
                .from('transactions')
                .update({ ...patch, updated_at: nowISO() })
                .in('id', ids);
            if (error) throw error;
        },
        onSuccess: invAll,
    });
    const bulkDuplicate = useMutation({
        mutationFn: async ({ transactions, date }: { transactions: any[]; date: string }) => {
            if (transactions.length === 0) return;
            const user = await getRequiredUser('You must be signed in to duplicate transactions.');
            const txRows = transactions.map((tx) => ({
                user_id: user.id,
                wallet_id: tx.wallet_id,
                to_wallet_id: tx.to_wallet_id,
                category_id: tx.category_id,
                contact_id: tx.contact_id,
                trip_id: tx.trip_id,
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                date,
                is_recurring: !!tx.is_recurring,
                is_reviewed: !!tx.is_reviewed,
                is_debt: !!tx.is_debt,
            }));
            const { data: inserted, error: txError } = await supabase
                .from('transactions')
                .insert(txRows)
                .select('id');
            if (txError) throw txError;

            const splitRows = transactions.flatMap((tx, index) =>
                (tx.splits || []).map((split: any) => ({
                    transaction_id: inserted?.[index]?.id,
                    category_id: split.category_id,
                    amount: split.amount,
                    note: split.note,
                })).filter((split: any) => split.transaction_id),
            );
            if (splitRows.length > 0) {
                const { error: splitError } = await supabase.from('transaction_splits').insert(splitRows);
                if (splitError) throw splitError;
            }
        },
        onSuccess: invAll,
    });
    const restoreCategories = useMutation({
        mutationFn: async (rows: Array<{ id: string; category_id: string | null; updated_at?: string | null }>) => {
            await Promise.all(rows.map(async (row) => {
                const { error } = await supabase
                    .from('transactions')
                    .update({ category_id: row.category_id || null, updated_at: row.updated_at || nowISO() })
                    .eq('id', row.id);
                if (error) throw error;
            }));
        },
        onSuccess: invAll,
    });
    const bulkDelete = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('transactions').delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: invAll,
    });
    const restoreDeleted = useMutation({
        mutationFn: async (transactions: any[]) => {
            const txRows = transactions.map((tx) => ({
                id: tx.id,
                user_id: tx.user_id,
                wallet_id: tx.wallet_id,
                to_wallet_id: tx.to_wallet_id,
                category_id: tx.category_id,
                contact_id: tx.contact_id,
                trip_id: tx.trip_id,
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                date: tx.date,
                is_recurring: !!tx.is_recurring,
                is_reviewed: !!tx.is_reviewed,
                is_debt: !!tx.is_debt,
                created_at: tx.created_at,
                updated_at: tx.updated_at,
            }));
            const { error: txError } = await supabase.from('transactions').insert(txRows);
            if (txError) throw txError;

            const splitRows = transactions.flatMap((tx) =>
                (tx.splits || []).map((split: any) => ({
                    id: split.id,
                    transaction_id: tx.id,
                    category_id: split.category_id,
                    amount: split.amount,
                    note: split.note,
                    created_at: split.created_at,
                })),
            );
            if (splitRows.length > 0) {
                const { error: splitError } = await supabase.from('transaction_splits').insert(splitRows);
                if (splitError) throw splitError;
            }
        },
        onSuccess: invAll,
    });
    const setSplits = useMutation({
        mutationFn: async ({ id, splits }: any) => {
            await supabase.from('transaction_splits').delete().eq('transaction_id', id);
            if (splits.length > 0) { const { error } = await supabase.from('transaction_splits').insert(splits.map((s: any) => ({ transaction_id: id, category_id: s.categoryId || null, amount: parseMoneyInput(s.amount), note: s.note || null }))); if (error) throw error; }
        }, onSuccess: invAll,
    });
    const toggleReview = useMutation({
        mutationFn: async (id: string) => {
            const { data: tx } = await supabase.from('transactions').select('is_reviewed').eq('id', id).single();
            const { error } = await supabase.from('transactions').update({ is_reviewed: !tx.is_reviewed }).eq('id', id);
            if (error) throw error;
        }, onSuccess: invAll,
    });
    return { create, update, remove, bulkUpdateCategory, restoreCategories, bulkUpdate, bulkDuplicate, bulkDelete, restoreDeleted, setSplits, toggleReview };
};
