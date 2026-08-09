import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { nowISO } from '@/features/shared/api';
import { enrichGoal, resolveGoalStatus } from './money';
import { parseMoneyInput } from '@/lib/money';
import { useAuthStore } from '@/stores/authStore';
import { getRequiredUser } from '@/lib/auth';

// ── Goals ─────────────────────────────────────────────────────────
export const useGoals = (params: Record<string, any> = {}) => {
    const { session, isReady } = useAuthStore();

    return useQuery({
        queryKey: ['goals', session?.user?.id ?? null, params],
        enabled: isReady && !!session?.user?.id,
        queryFn: async () => {
            let query = supabase.from('goals').select('*').order('created_at', { ascending: false });
            if (params.status) query = query.eq('status', params.status);
            if (params.excludeStatus) query = query.neq('status', params.excludeStatus);
            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map((goal) => enrichGoal(goal));
        },
    });
};

export const useGoalMutations = () => {
    const qc = useQueryClient();
    const inv = () => {
        qc.invalidateQueries({ queryKey: ['goals'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
    };
    const create = useMutation({
        mutationFn: async (d: any) => {
            const user = await getRequiredUser('You must be signed in to create a goal.');

            const targetAmount = parseMoneyInput(d.targetAmount);
            const currentAmount = parseMoneyInput(d.currentAmount);
            if (targetAmount <= 0) {
                throw new Error('Target amount must be greater than 0.');
            }

            const status = resolveGoalStatus({ targetAmount, currentAmount });
            const { data, error } = await supabase.from('goals').insert({
                user_id: user.id,
                wallet_id: d.walletId || null,
                name: d.name,
                target_amount: targetAmount,
                current_amount: currentAmount,
                deadline: d.deadline || null,
                status,
            }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, walletId, targetAmount, currentAmount, ...d }: any) => {
            const { data: existing, error: existingError } = await supabase
                .from('goals')
                .select('target_amount, current_amount, status')
                .eq('id', id)
                .single();
            if (existingError) throw existingError;

            const nextTargetAmount =
                targetAmount !== undefined && targetAmount !== ''
                    ? parseMoneyInput(targetAmount)
                    : Number(existing.target_amount);
            const nextCurrentAmount =
                currentAmount !== undefined && currentAmount !== ''
                    ? parseMoneyInput(currentAmount)
                    : Number(existing.current_amount);

            if (nextTargetAmount <= 0) {
                throw new Error('Target amount must be greater than 0.');
            }

            const nextStatus =
                targetAmount !== undefined || currentAmount !== undefined
                    ? resolveGoalStatus({
                        targetAmount: nextTargetAmount,
                        currentAmount: nextCurrentAmount,
                        fallbackStatus: existing.status,
                    })
                    : d.status;
            const { data, error } = await supabase.from('goals').update({
                wallet_id: walletId,
                target_amount: nextTargetAmount,
                current_amount: nextCurrentAmount,
                ...d,
                ...(nextStatus ? { status: nextStatus } : {}),
                updated_at: nowISO(),
            }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const updateAmount = useMutation({
        mutationFn: async ({ id, currentAmount, mode = 'set' }: any) => {
            const { data: g, error: goalError } = await supabase
                .from('goals')
                .select('target_amount, status, current_amount')
                .eq('id', id)
                .single();
            if (goalError) throw goalError;
            const parsedCurrentAmount = parseMoneyInput(currentAmount);
            if (parsedCurrentAmount < 0) {
                throw new Error('Contribution amount cannot be negative.');
            }
            const nextCurrentAmount =
                mode === 'add'
                    ? Number(g.current_amount || 0) + parsedCurrentAmount
                    : parsedCurrentAmount;
            const newStatus = resolveGoalStatus({
                targetAmount: Number(g.target_amount),
                currentAmount: nextCurrentAmount,
                fallbackStatus: g.status,
            });
            const { error } = await supabase.from('goals').update({ current_amount: nextCurrentAmount, status: newStatus, updated_at: nowISO() }).eq('id', id);
            if (error) throw error;
            return nextCurrentAmount;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id: string) => { const { error } = await supabase.from('goals').delete().eq('id', id); if (error) throw error; },
        onSuccess: inv,
    });
    return { create, update, updateAmount, remove };
};
