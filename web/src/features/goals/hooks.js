import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { nowISO } from '@/features/shared/api';

// ── Goals ─────────────────────────────────────────────────────────
export function enrichGoal(g) {
    const target = Number(g.target_amount), current = Number(g.current_amount);
    const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
    const remaining = Math.max(target - current, 0);
    let requiredMonthlySaving = null, daysLeft = null;
    if (g.deadline) {
        const now = new Date(), deadline = new Date(g.deadline);
        const monthsLeft = (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth());
        daysLeft = Math.ceil((deadline - now) / 86400000);
        requiredMonthlySaving = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
    }
    return { ...g, percentage, remaining, requiredMonthlySaving, daysLeft, targetAmount: g.target_amount, currentAmount: g.current_amount };
}

export const useGoals = (params = {}) => useQuery({
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
        mutationFn: async (d) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.from('goals').insert({ user_id: user.id, wallet_id: d.walletId || null, name: d.name, target_amount: parseFloat(d.targetAmount), current_amount: parseFloat(d.currentAmount) || 0, deadline: d.deadline || null }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, walletId, targetAmount, currentAmount, ...d }) => {
            const { data, error } = await supabase.from('goals').update({ wallet_id: walletId, target_amount: targetAmount ? parseFloat(targetAmount) : undefined, current_amount: currentAmount !== undefined ? parseFloat(currentAmount) : undefined, ...d, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const updateAmount = useMutation({
        mutationFn: async ({ id, currentAmount }) => {
            const { data: g } = await supabase.from('goals').select('target_amount').eq('id', id).single();
            const newStatus = parseFloat(currentAmount) >= Number(g.target_amount) ? 'completed' : undefined;
            const { error } = await supabase.from('goals').update({ current_amount: parseFloat(currentAmount), ...(newStatus && { status: newStatus }), updated_at: nowISO() }).eq('id', id);
            if (error) throw error;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id) => { const { error } = await supabase.from('goals').delete().eq('id', id); if (error) throw error; },
        onSuccess: inv,
    });
    return { create, update, updateAmount, remove };
}
