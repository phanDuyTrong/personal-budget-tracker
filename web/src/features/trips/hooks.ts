import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ── Trips ────────────────────────────────────────────────────────
export const useTrips = () => useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
        const { data, error } = await supabase.from('trips').select('*').order('start_date', { ascending: false });
        if (error) throw error;
        return data;
    },
});

export const useTripsWithCost = () => useQuery({
    queryKey: ['trips', 'with-cost'],
    queryFn: async () => {
        const { data: trips, error } = await supabase.from('trips').select('*').order('start_date', { ascending: false });
        if (error) throw error;
        if (!trips || trips.length === 0) return [];
        const tripIds = trips.map(t => t.id);
        const { data: txs } = await supabase.from('transactions')
            .select('trip_id, amount')
            .in('trip_id', tripIds)
            .eq('type', 'expense');
        const costMap: Record<string, number> = {};
        (txs || []).forEach(tx => {
            costMap[tx.trip_id] = (costMap[tx.trip_id] || 0) + Number(tx.amount);
        });
        return trips.map(t => ({ ...t, total_cost: costMap[t.id] || 0 }));
    },
});

export const useTripTransactions = (tripId: string | null | undefined) => useQuery({
    queryKey: ['transactions', 'trip', tripId],
    enabled: !!tripId,
    queryFn: async () => {
        const { data, error } = await supabase.from('transactions')
            .select('*, wallet:wallets!wallet_id(id,name), category:categories(id,name,icon,color,parent_id), contact:contacts(id,name)')
            .eq('trip_id', tripId)
            .order('date', { ascending: false });
        if (error) throw error;
        return data || [];
    },
});

export const useTripMutations = () => {
    const qc = useQueryClient();
    const inv = () => {
        qc.invalidateQueries({ queryKey: ['trips'] });
        qc.invalidateQueries({ queryKey: ['transactions'] });
    };
    const create = useMutation({
        mutationFn: async (d: any) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.from('trips').insert({ 
                user_id: user.id, 
                name: d.name,
                destination: d.destination || null,
                start_date: d.startDate, 
                end_date: d.endDate 
            }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, ...d }: any) => {
            const { data, error } = await supabase.from('trips').update({
                name: d.name,
                destination: d.destination || null,
                start_date: d.startDate,
                end_date: d.endDate,
            }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id: string) => {
            // Unlink transactions before deleting trip
            await supabase.from('transactions').update({ trip_id: null }).eq('trip_id', id);
            const { error } = await supabase.from('trips').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: inv,
    });
    return { create, update, remove };
};
