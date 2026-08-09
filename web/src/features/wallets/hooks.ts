import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { nowISO, useDevMockData } from '@/features/shared/api';
import { applyTransactionsToWallets } from './balance';
import { parseMoneyInput } from '@/lib/money';
import { fetchAllTransactions } from '@/lib/transactionsFetch';
import { getRequiredUser } from '@/lib/auth';

// ── Wallets ─────────────────────────────────────────────────────
export const useWallets = () => useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
        const { data, error } = await supabase.from('wallets').select('*').is('deleted_at', null).order('name');
        if (error) throw error;
        return data;
    },
});

export const useCalculatedWallets = () => useQuery({
    queryKey: ['calculated-wallets'],
    queryFn: async () => {
        if (useDevMockData) {
            return [
                { id: 'w1', name: 'Main Checking', type: 'checking', liveBalance: 5500, balance: 5500, color: '#3b82f6' },
                { id: 'w2', name: 'Savings Account', type: 'savings', liveBalance: 6000, balance: 6000, color: '#10b981' },
                { id: 'w3', name: 'Credit Card', type: 'credit', liveBalance: -1500, balance: -1500, color: '#ef4444' }
            ];
        }
        const { data: wallets, error: accError } = await supabase.from('wallets').select('*').is('deleted_at', null).order('name');
        if (accError) throw accError;
        const txs = await fetchAllTransactions('amount, type, wallet_id, to_wallet_id');
        return applyTransactionsToWallets(wallets || [], txs || []);
    },
});

export const useWalletMutations = () => {
    const qc = useQueryClient();
    const inv = () => {
        qc.invalidateQueries({ queryKey: ['wallets'] });
        qc.invalidateQueries({ queryKey: ['calculated-wallets'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
    };
    const create = useMutation({
        mutationFn: async (d: any) => {
            const user = await getRequiredUser('You must be signed in to create a wallet.');
            const { data, error } = await supabase.from('wallets').insert({ user_id: user.id, name: d.name, type: d.type || 'checking', balance: parseMoneyInput(d.balance) }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, ...d }: any) => {
            const { data, error } = await supabase.from('wallets').update({ name: d.name, type: d.type || 'checking', updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id: string) => { const { error } = await supabase.from('wallets').update({ deleted_at: nowISO() }).eq('id', id); if (error) throw error; },
        onSuccess: inv,
    });
    return { create, update, remove };
};
