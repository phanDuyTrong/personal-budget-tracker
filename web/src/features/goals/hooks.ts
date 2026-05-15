import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { nowISO } from '@/features/shared/api';
import { enrichGoal } from './money';

// ── Goals ─────────────────────────────────────────────────────────
export const useGoals = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['goals', params],
    queryFn: async () => {
        let query = supabase.from('goals').select('*, wallet:wallets(id,name)').order('created_at', { ascending: false });
        if (params.status) query = query.eq('status', params.status);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(enrichGoal);
    },
});

export const useGoalMutations = () => {
    const qc = useQueryClient();
    const inv = () => qc.invalidateQueries({ queryKey: ['goals'] });
    const create = useMutation({
        mutationFn: async (d: any) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.from('goals').insert({ user_id: user.id, wallet_id: d.walletId || null, name: d.name, target_amount: parseFloat(d.targetAmount), current_amount: parseFloat(d.currentAmount) || 0, deadline: d.deadline || null }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, walletId, targetAmount, currentAmount, ...d }: any) => {
            const { data, error } = await supabase.from('goals').update({ wallet_id: walletId, target_amount: targetAmount ? parseFloat(targetAmount) : undefined, current_amount: currentAmount !== undefined ? parseFloat(currentAmount) : undefined, ...d, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const updateAmount = useMutation({
        mutationFn: async ({ id, currentAmount }: any) => {
            const { data: g } = await supabase.from('goals').select('target_amount').eq('id', id).single();
            const newStatus = parseFloat(currentAmount) >= Number(g.target_amount) ? 'completed' : undefined;
            const { error } = await supabase.from('goals').update({ current_amount: parseFloat(currentAmount), ...(newStatus && { status: newStatus }), updated_at: nowISO() }).eq('id', id);
            if (error) throw error;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id: string) => { const { error } = await supabase.from('goals').delete().eq('id', id); if (error) throw error; },
        onSuccess: inv,
    });
    return { create, update, updateAmount, remove };
}
