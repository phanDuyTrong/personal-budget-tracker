import React, { useState, useEffect, useContext } from 'react';
import { supabase } from './supabase';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// Initial fallback data for UI before DB load
const initialData = {
    wallets: [],
    transactions: [],
    categories: [],
    people: [],
    settings: { baseCurrency: 'USD', exchangeRate: 25000, hideBalances: false },
    walletOrder: []
};

const StoreContext = React.createContext(null);

export function StoreProvider({ children }) {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(true);
    const [transactionsLoading, setTransactionsLoading] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            setTransactionsLoading(true);
            const [
                { data: wallets },
                { data: transactions },
                { data: appData }
            ] = await Promise.all([
                supabase.from('wallets').select('*').order('name'),
                supabase.from('transactions').select('*').order('date', { ascending: false }),
                supabase.from('app_data').select('*')
            ]);

            // Parse app_data (key-value store)
            const categories = appData?.find(d => d.key === 'categories')?.value || [];
            const people = appData?.find(d => d.key === 'people')?.value || [];
            const settings = appData?.find(d => d.key === 'settings')?.value || initialData.settings;
            const walletOrder = appData?.find(d => d.key === 'walletOrder')?.value || [];

            setData({
                wallets: wallets || [],
                transactions: transactions || [],
                categories,
                people,
                settings,
                walletOrder
            });
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
            setTransactionsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Realtime Subscriptions
        const channels = supabase.channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'wallets' },
                (payload) => {
                    // Simple approach: Refetch or Optimistic update. 
                    // For perfect sync without refetching, we need robust reducer logic.
                    // Given <1000 items, refetching everything is actually robust and fast enough for MVP.
                    // But let's try to be smart for smooth UI.

                    if (payload.eventType === 'INSERT') {
                        setData(prev => ({ ...prev, wallets: [...prev.wallets, payload.new] }));
                    } else if (payload.eventType === 'UPDATE') {
                        setData(prev => ({ ...prev, wallets: prev.wallets.map(w => w.id === payload.new.id ? payload.new : w) }));
                    } else if (payload.eventType === 'DELETE') {
                        setData(prev => ({ ...prev, wallets: prev.wallets.filter(w => w.id !== payload.old.id) }));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'transactions' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setData(prev => ({ ...prev, transactions: [payload.new, ...prev.transactions] }));
                    } else if (payload.eventType === 'UPDATE') {
                        setData(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === payload.new.id ? payload.new : t) }));
                    } else if (payload.eventType === 'DELETE') {
                        setData(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== payload.old.id) }));
                    }
                }
            )
            .on( // Listen to ALL app_data changes
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_data' },
                (payload) => {
                    // Just refetch app_data parts to be safe with JSONB
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channels);
        };
    }, []);


    const addTransaction = async (tx) => {
        // 1. Insert Transaction
        // Remove ID to let DB generate UUID, or generate one here? DB default is uuid_generate_v4()
        const { id, ...txData } = tx;

        // Ensure numeric amount
        const amount = parseFloat(tx.amount);

        const payload = {
            ...txData,
            amount: amount,
            date: tx.date // Ensure ISO string
        };

        // Optimistic Update (Optional, but Realtime is fast so maybe skip?)
        // Let's rely on Realtime for "Seamless" proof, but for "Instant" feel, optimistic is best.
        // We'll trust Supabase Realtime speed for now to keep code simple.

        const { error } = await supabase.from('transactions').insert([payload]);
        if (error) {
            console.error("Error adding transaction:", error);
            alert("Failed to add transaction: " + error.message);
            return;
        }

        // 2. Update Wallet Balance manually (Since we don't have DB triggers set up yet)
        if (tx.type === 'expense') {
            await updateWalletBalance(tx.fromWalletId, -amount);
        } else if (tx.type === 'income') {
            await updateWalletBalance(tx.toWalletId || tx.fromWalletId, amount);
        } else if (tx.type === 'transfer') {
            await updateWalletBalance(tx.fromWalletId, -amount);
            await updateWalletBalance(tx.toWalletId, amount);
        }
    };

    const updateWalletBalance = async (walletId, delta) => {
        // Get current balance first to be safe, or utilize RPC. 
        // For now, strict read-modify-write.
        const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', walletId).single();
        if (wallet) {
            const newBalance = parseFloat(wallet.balance) + delta;
            await supabase.from('wallets').update({ balance: newBalance }).eq('id', walletId);
        }
    };

    const updateTransaction = async (id, updatedFields) => {
        // Note: Complex balance operational logic (reverting old, applying new) is skipped for MVP
        await supabase.from('transactions').update(updatedFields).eq('id', id);
    };

    const deleteTransaction = async (id) => {
        await supabase.from('transactions').delete().eq('id', id);
    };

    const addWallet = async (wallet) => {
        // ID is text in our schema, let user define or generate?
        // Schema says: id text primary key.
        // Let's generate a simple ID if not provided, or let user input short code.
        // For now, auto-generate standard ID
        const id = wallet.id || 'w' + Date.now();
        const payload = { ...wallet, id, balance: parseFloat(wallet.balance) || 0 };

        const { error } = await supabase.from('wallets').insert([payload]);
        if (error) {
            console.error("Error adding wallet:", error);
            alert("Failed to add wallet: " + error.message);
        }
    };

    const updateWallet = async (id, fields) => {
        const { error } = await supabase.from('wallets').update(fields).eq('id', id);
        if (error) {
            console.error("Error updating wallet:", error);
            alert("Failed to update wallet: " + error.message);
        }
    };

    const deleteWallet = async (id) => {
        // Warning: This might break transactions referencing this wallet. 
        // Real app should check constrained or cascade delete.
        // Postgres references will block delete if transactions exist unless cascade is set.
        // Our table definition didn't specify ON DELETE CASCADE explicitly, so it might fail.
        // Let's catch error.
        const { error } = await supabase.from('wallets').delete().eq('id', id);
        if (error) {
            console.error("Error deleting wallet:", error);
            alert("Failed to delete wallet (it might be used in transactions): " + error.message);
        }
    };

    const updateCategories = async (newCategories) => {
        // newCategories is an array of objects
        // We store it as JSONB in app_data key='categories'
        const { error } = await supabase.from('app_data').upsert({ key: 'categories', value: newCategories });
        if (error) {
            console.error("Error updating categories:", error);
        }
    };

    const updatePeople = async (newPeople) => {
        // newPeople is an array of strings
        const { error } = await supabase.from('app_data').upsert({ key: 'people', value: newPeople });
        if (error) {
            console.error("Error updating people:", error);
        }
    };

    const updateSettings = async (newSettings) => {
        const { error } = await supabase.from('app_data').upsert({ key: 'settings', value: newSettings });
        if (error) {
            console.error("Error updating settings:", error);
        }
    };

    const updateWalletOrder = async (newOrder) => {
        const { error } = await supabase.from('app_data').upsert({ key: 'walletOrder', value: newOrder });
        if (error) {
            console.error("Error updating wallet order:", error);
        }
    };

    const generateSampleData = () => {
        alert("Please use the SQL Editor in Supabase to insert sample data.");
    };

    const resetData = () => {
        // Dangerous op
    };

    const value = {
        wallets: data.wallets || [],
        transactions: data.transactions || [],
        categories: data.categories || [], // Default empty, loaded from DB
        people: data.people || [],
        settings: data.settings,
        walletOrder: data.walletOrder || [],
        loading,
        transactionsLoading,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addWallet,
        updateWallet,
        deleteWallet,
        updateCategories,
        updatePeople,
        updateSettings,
        updateWalletOrder,
        generateSampleData,
    };

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <StoreContext.Provider value={value}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
}
