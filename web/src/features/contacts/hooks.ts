import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { nowISO } from '@/features/shared/api';
import { getRequiredUser } from '@/lib/auth';

// ── Contacts ───────────────────────────────────────────────────────
export const useContacts = () => useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
        const { data, error } = await supabase.from('contacts').select('*').order('name');
        if (error) throw error;
        return data;
    },
});

export const useDebts = () => useQuery({
    queryKey: ['debts'],
    queryFn: async () => {
        const { data: contacts, error: contactError } = await supabase.from('contacts').select('*');
        if (contactError) throw contactError;
        const { data: txs, error: txError } = await supabase.from('transactions').select('amount, type, contact_id, date').eq('is_debt', true);
        if (txError) throw txError;
        const balances: Record<string, any> = {};
        contacts.forEach(c => { balances[c.id] = { ...c, balance: 0, debtTxs: [] }; });
        (txs || []).forEach(tx => {
            if (!tx.contact_id || !balances[tx.contact_id]) return;
            const amt = Number(tx.amount) || 0;
            if (tx.type === 'expense') balances[tx.contact_id].balance += amt;
            else if (tx.type === 'income') balances[tx.contact_id].balance -= amt;
            balances[tx.contact_id].debtTxs.push(tx);
        });
        return Object.values(balances).filter(b => b.balance !== 0 || b.debtTxs.length > 0).sort((a, b) => b.balance - a.balance);
    },
});

export const useContactMutations = () => {
    const qc = useQueryClient();
    const inv = () => {
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['debts'] });
        qc.invalidateQueries({ queryKey: ['transactions'] });
        qc.invalidateQueries({ queryKey: ['all-transactions'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
    };
    const create = useMutation({
        mutationFn: async (d: any) => {
            const user = await getRequiredUser('You must be signed in to create a contact.');
            const { data, error } = await supabase.from('contacts').insert({ user_id: user.id, name: d.name, email: d.email || null, phone: d.phone || null }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, ...d }: any) => {
            const { data, error } = await supabase.from('contacts').update({ name: d.name, email: d.email || null, phone: d.phone || null, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id: string) => {
            const { error: unlinkError } = await supabase
                .from('transactions')
                .update({ contact_id: null })
                .eq('contact_id', id);
            if (unlinkError) throw unlinkError;
            const { error } = await supabase.from('contacts').delete().eq('id', id);
            if (error) throw error; return true;
        }, onSuccess: inv,
    });
    return { create, update, remove };
};
