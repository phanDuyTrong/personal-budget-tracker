import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { nowISO } from '@/features/shared/api';

// ── Transactions ─────────────────────────────────────────────────
export const useTransactions = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['transactions', params],
    queryFn: async () => {
        let query = supabase.from('transactions').select('*, wallet:wallets!wallet_id(id,name), to_wallet:wallets!to_wallet_id(id,name), category:categories(id,name,icon,color,parent_id), splits:transaction_splits(*, category:categories(id,name,icon,color)), contact:contacts(id,name)', { count: 'exact' });
        if (params.sortDate === 'oldest') query = query.order('date', { ascending: true }).order('created_at', { ascending: true });
        else query = query.order('date', { ascending: false }).order('created_at', { ascending: false });
        if (params.date_from) query = query.gte('date', params.date_from);
        if (params.date_to) query = query.lte('date', params.date_to);
        if (params.category_id) query = query.eq('category_id', params.category_id);
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
        return { data: data || [], total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) };
    },
});

export const useAllTransactions = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['all-transactions', params],
    queryFn: async () => {
        let query = supabase.from('transactions').select('*, category:categories(id,name,icon,color,parent_id)').order('date', { ascending: false });
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
    };
    const create = useMutation({
        mutationFn: async (d: any) => {
            const { data: { user } } = await supabase.auth.getUser();
            const amt = parseFloat(d.amount);
            const { data: tx, error } = await supabase.from('transactions').insert({ user_id: user.id, wallet_id: d.walletId || null, category_id: d.categoryId || null, contact_id: d.contactId || null, trip_id: d.tripId || null, amount: amt, type: d.type, description: d.description || null, date: d.date, is_recurring: !!d.isRecurring, is_debt: !!d.isDebt, to_wallet_id: d.type === 'transfer' ? (d.toWalletId || null) : null }).select().single();
            if (error) throw error; return tx;
        }, onSuccess: invAll,
    });
    const update = useMutation({
        mutationFn: async ({ id, ...d }: any) => {
            const { data: existing } = await supabase.from('transactions').select('*').eq('id', id).single();
            const amt = d.amount !== undefined ? parseFloat(d.amount) : Number(existing.amount);
            const newType = d.type || existing.type;
            const { data: tx, error } = await supabase.from('transactions').update({ wallet_id: d.walletId !== undefined ? (d.walletId || null) : existing.wallet_id, category_id: d.categoryId !== undefined ? (d.categoryId || null) : existing.category_id, contact_id: d.contactId !== undefined ? (d.contactId || null) : existing.contact_id, trip_id: d.tripId !== undefined ? (d.tripId || null) : existing.trip_id, amount: amt, type: newType, description: d.description !== undefined ? d.description : existing.description, date: d.date || existing.date, is_reviewed: d.isReviewed !== undefined ? d.isReviewed : existing.is_reviewed, is_debt: d.isDebt !== undefined ? d.isDebt : existing.is_debt, to_wallet_id: newType === 'transfer' ? (d.toWalletId !== undefined ? (d.toWalletId || null) : existing.to_wallet_id) : null, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return tx;
        }, onSuccess: invAll,
    });
    const remove = useMutation({
        mutationFn: async (id: string) => { const { error } = await supabase.from('transactions').delete().eq('id', id); if (error) throw error; },
        onSuccess: invAll,
    });
    const setSplits = useMutation({
        mutationFn: async ({ id, splits }: any) => {
            await supabase.from('transaction_splits').delete().eq('transaction_id', id);
            if (splits.length > 0) { const { error } = await supabase.from('transaction_splits').insert(splits.map((s: any) => ({ transaction_id: id, category_id: s.categoryId || null, amount: parseFloat(s.amount), note: s.note || null }))); if (error) throw error; }
        }, onSuccess: invAll,
    });
    const toggleReview = useMutation({
        mutationFn: async (id: string) => {
            const { data: tx } = await supabase.from('transactions').select('is_reviewed').eq('id', id).single();
            const { error } = await supabase.from('transactions').update({ is_reviewed: !tx.is_reviewed }).eq('id', id);
            if (error) throw error;
        }, onSuccess: invAll,
    });
    return { create, update, remove, setSplits, toggleReview };
};
