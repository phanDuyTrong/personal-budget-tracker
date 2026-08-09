import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { nowISO } from '@/features/shared/api';
import { getMonthRangeByParts } from '@/lib/date';
import { parseMoneyInput } from '@/lib/money';
import { getRequiredUser } from '@/lib/auth';

// ── Budgets ───────────────────────────────────────────────────────
export const useBudgets = ({ year, month }) => useQuery({
    queryKey: ['budgets', year, month],
    queryFn: async () => {
        const { from: startOfMonth, to: endOfMonth } = getMonthRangeByParts(year, month);
        const { data: budgets, error } = await supabase
            .from('budgets')
            .select('*, category:categories(id,name,icon,color)')
            .lte('start_date', endOfMonth)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return Promise.all((budgets || []).map(async (b) => {
            const { data: txs } = await supabase
                .from('transactions')
                .select('amount')
                .eq('category_id', b.category_id)
                .eq('type', 'expense')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);
            const spent = (txs || []).reduce((s, t) => s + Number(t.amount), 0);
            return { ...b, spent };
        }));
    },
    enabled: Number.isInteger(year) && Number.isInteger(month),
});

export const useBudgetMutations = () => {
    const qc = useQueryClient();
    const inv = () => {
        qc.invalidateQueries({ queryKey: ['budgets'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
    };
    const create = useMutation({
        mutationFn: async (d: any) => {
            const user = await getRequiredUser('You must be signed in to create a budget.');
            const { data, error } = await supabase.from('budgets').insert({ user_id: user.id, category_id: d.categoryId, amount: parseMoneyInput(d.amount), period: d.period, rollover: !!d.rollover, start_date: d.startDate }).select('*, category:categories(*)').single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, categoryId, startDate, ...d }: any) => {
            const nextAmount =
                d.amount !== undefined && d.amount !== ''
                    ? parseMoneyInput(d.amount)
                    : undefined;
            const { data, error } = await supabase.from('budgets').update({ category_id: categoryId, start_date: startDate, ...d, ...(nextAmount !== undefined ? { amount: nextAmount } : {}), updated_at: nowISO() }).eq('id', id).select('*, category:categories(*)').single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id: string) => { const { error } = await supabase.from('budgets').delete().eq('id', id); if (error) throw error; },
        onSuccess: inv,
    });
    return { create, update, remove };
};
