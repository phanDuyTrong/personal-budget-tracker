import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { buildTree, nowISO } from '@/features/shared/api';

const DEFAULT_EXPENSE_COLOR = '#64748b';

// ── Categories ────────────────────────────────────────────────────
export const useCategories = () => useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
        const { data, error } = await supabase.from('categories').select('*').order('name');
        if (error) throw error;
        return buildTree(data || []);
    },
});

export const useCategoryMutations = () => {
    const qc = useQueryClient();
    const inv = () => qc.invalidateQueries({ queryKey: ['categories'] });
    const create = useMutation({
        mutationFn: async (d: any) => {
            const { data: { user } } = await supabase.auth.getUser();
            const color = d.type === 'expense' ? DEFAULT_EXPENSE_COLOR : (d.color || null);
            const { data, error } = await supabase.from('categories').insert({ user_id: user.id, name: d.name, icon: d.icon || null, color, type: d.type, parent_id: d.parentId || null }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, parentId, ...d }: any) => {
            const color = d.type === 'expense' ? DEFAULT_EXPENSE_COLOR : (d.color || null);
            const { data, error } = await supabase.from('categories').update({ name: d.name, icon: d.icon || null, color, type: d.type, parent_id: parentId || null, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id: string) => {
            const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', id);
            if (count > 0) { const err = Object.assign(new Error(`${count} transaction(s) linked. Reassign before deleting.`), { code: 'LINKED_TRANSACTIONS', linkedCount: count }); throw err; }
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (error) throw error;
        }, onSuccess: inv,
    });
    const reassign = useMutation({
        mutationFn: async ({ id, newCategoryId }: any) => {
            await supabase.from('transactions').update({ category_id: newCategoryId || null }).eq('category_id', id);
            await supabase.from('transaction_splits').update({ category_id: newCategoryId || null }).eq('category_id', id);
        }, onSuccess: inv,
    });
    return { create, update, remove, reassign };
};
