import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ── Helpers ───────────────────────────────────────────────────────
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

function buildTree(categories) {
    const map = {};
    categories.forEach(c => { map[c.id] = { ...c, children: [] }; });
    const roots = [];
    categories.forEach(c => {
        if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id]);
        else if (!c.parent_id) roots.push(map[c.id]);
    });
    return roots;
}

function nowISO() { return new Date().toISOString(); }

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
        if (isLocalhost) {
            return [
                { id: 'w1', name: 'Main Checking', type: 'checking', liveBalance: 5500, balance: 5500, color: '#3b82f6' },
                { id: 'w2', name: 'Savings Account', type: 'savings', liveBalance: 6000, balance: 6000, color: '#10b981' },
                { id: 'w3', name: 'Credit Card', type: 'credit', liveBalance: -1500, balance: -1500, color: '#ef4444' }
            ];
        }
        const { data: wallets, error: accError } = await supabase.from('wallets').select('*').is('deleted_at', null).order('name');
        if (accError) throw accError;
        const { data: txs, error: txError } = await supabase.from('transactions').select('amount, type, wallet_id, to_wallet_id');
        if (txError) throw txError;
        const balances = {};
        wallets.forEach(acc => { balances[acc.id] = { ...acc, liveBalance: Number(acc.balance) || 0 }; });
        (txs || []).forEach(tx => {
            const amt = Number(tx.amount) || 0;
            switch (tx.type) {
                case 'income': if (balances[tx.wallet_id]) balances[tx.wallet_id].liveBalance += amt; break;
                case 'expense': if (balances[tx.wallet_id]) balances[tx.wallet_id].liveBalance -= amt; break;
                case 'transfer':
                    if (balances[tx.wallet_id]) balances[tx.wallet_id].liveBalance -= amt;
                    if (balances[tx.to_wallet_id]) balances[tx.to_wallet_id].liveBalance += amt;
                    break;
            }
        });
        return Object.values(balances);
    },
});

export const useWalletMutations = () => {
    const qc = useQueryClient();
    const inv = () => qc.invalidateQueries({ queryKey: ['wallets'] });
    const create = useMutation({
        mutationFn: async (d) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.from('wallets').insert({ user_id: user.id, name: d.name, type: d.type || 'checking', balance: parseFloat(d.balance) || 0 }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, ...d }) => {
            const { data, error } = await supabase.from('wallets').update({ name: d.name, type: d.type || 'checking', balance: parseFloat(d.balance) || 0, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id) => { const { error } = await supabase.from('wallets').update({ deleted_at: nowISO() }).eq('id', id); if (error) throw error; },
        onSuccess: inv,
    });
    return { create, update, remove };
};

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
        mutationFn: async (d) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.from('categories').insert({ user_id: user.id, name: d.name, icon: d.icon || null, color: d.color || null, type: d.type, parent_id: d.parentId || null }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, parentId, ...d }) => {
            const { data, error } = await supabase.from('categories').update({ name: d.name, icon: d.icon || null, color: d.color || null, type: d.type, parent_id: parentId || null, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id) => {
            const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', id);
            if (count > 0) { const err = new Error(`${count} transaction(s) linked. Reassign before deleting.`); err.code = 'LINKED_TRANSACTIONS'; err.linkedCount = count; throw err; }
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (error) throw error;
        }, onSuccess: inv,
    });
    const reassign = useMutation({
        mutationFn: async ({ id, newCategoryId }) => {
            await supabase.from('transactions').update({ category_id: newCategoryId || null }).eq('category_id', id);
            await supabase.from('transaction_splits').update({ category_id: newCategoryId || null }).eq('category_id', id);
        }, onSuccess: inv,
    });
    return { create, update, remove, reassign };
};

// ── Transactions ─────────────────────────────────────────────────
export const useTransactions = (params = {}) => useQuery({
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

export const useAllTransactions = (params = {}) => useQuery({
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
    const invAll = () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['wallets'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
    const create = useMutation({
        mutationFn: async (d) => {
            const { data: { user } } = await supabase.auth.getUser();
            const amt = parseFloat(d.amount);
            const { data: tx, error } = await supabase.from('transactions').insert({ user_id: user.id, wallet_id: d.walletId || null, category_id: d.categoryId || null, contact_id: d.contactId || null, amount: amt, type: d.type, description: d.description || null, date: d.date, is_recurring: !!d.isRecurring, is_debt: !!d.isDebt, to_wallet_id: d.type === 'transfer' ? (d.toWalletId || null) : null }).select().single();
            if (error) throw error; return tx;
        }, onSuccess: invAll,
    });
    const update = useMutation({
        mutationFn: async ({ id, ...d }) => {
            const { data: existing } = await supabase.from('transactions').select('*').eq('id', id).single();
            const amt = d.amount !== undefined ? parseFloat(d.amount) : Number(existing.amount);
            const newType = d.type || existing.type;
            const { data: tx, error } = await supabase.from('transactions').update({ wallet_id: d.walletId !== undefined ? (d.walletId || null) : existing.wallet_id, category_id: d.categoryId !== undefined ? (d.categoryId || null) : existing.category_id, contact_id: d.contactId !== undefined ? (d.contactId || null) : existing.contact_id, amount: amt, type: newType, description: d.description !== undefined ? d.description : existing.description, date: d.date || existing.date, is_reviewed: d.isReviewed !== undefined ? d.isReviewed : existing.is_reviewed, is_debt: d.isDebt !== undefined ? d.isDebt : existing.is_debt, to_wallet_id: newType === 'transfer' ? (d.toWalletId !== undefined ? (d.toWalletId || null) : existing.to_wallet_id) : null, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return tx;
        }, onSuccess: invAll,
    });
    const remove = useMutation({
        mutationFn: async (id) => { const { error } = await supabase.from('transactions').delete().eq('id', id); if (error) throw error; },
        onSuccess: invAll,
    });
    const setSplits = useMutation({
        mutationFn: async ({ id, splits }) => {
            await supabase.from('transaction_splits').delete().eq('transaction_id', id);
            if (splits.length > 0) { const { error } = await supabase.from('transaction_splits').insert(splits.map(s => ({ transaction_id: id, category_id: s.categoryId || null, amount: parseFloat(s.amount), note: s.note || null }))); if (error) throw error; }
        }, onSuccess: invAll,
    });
    const toggleReview = useMutation({
        mutationFn: async (id) => {
            const { data: tx } = await supabase.from('transactions').select('is_reviewed').eq('id', id).single();
            const { error } = await supabase.from('transactions').update({ is_reviewed: !tx.is_reviewed }).eq('id', id);
            if (error) throw error;
        }, onSuccess: invAll,
    });
    return { create, update, remove, setSplits, toggleReview };
};

// ── Budgets ───────────────────────────────────────────────────────
export const useBudgets = () => useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
        const { data: budgets, error } = await supabase.from('budgets').select('*, category:categories(id,name,icon,color)').order('created_at', { ascending: false });
        if (error) throw error;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        return Promise.all((budgets || []).map(async (b) => {
            const { data: txs } = await supabase.from('transactions').select('amount').eq('category_id', b.category_id).eq('type', 'expense').gte('date', startOfMonth).lte('date', endOfMonth);
            const spent = (txs || []).reduce((s, t) => s + Number(t.amount), 0);
            return { ...b, spent };
        }));
    },
});

export const useBudgetMutations = () => {
    const qc = useQueryClient();
    const inv = () => qc.invalidateQueries({ queryKey: ['budgets'] });
    const create = useMutation({
        mutationFn: async (d) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.from('budgets').insert({ user_id: user.id, category_id: d.categoryId, amount: parseFloat(d.amount), period: d.period, rollover: !!d.rollover, start_date: d.startDate }).select('*, category:categories(*)').single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, categoryId, startDate, ...d }) => {
            const { data, error } = await supabase.from('budgets').update({ category_id: categoryId, start_date: startDate, ...d, updated_at: nowISO() }).eq('id', id).select('*, category:categories(*)').single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id) => { const { error } = await supabase.from('budgets').delete().eq('id', id); if (error) throw error; },
        onSuccess: inv,
    });
    return { create, update, remove };
};

// ── Goals ─────────────────────────────────────────────────────────
function enrichGoal(g) {
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
        const balances = {};
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
    const inv = () => qc.invalidateQueries({ queryKey: ['contacts'] });
    const create = useMutation({
        mutationFn: async (d) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.from('contacts').insert({ user_id: user.id, name: d.name, email: d.email || null, phone: d.phone || null }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const update = useMutation({
        mutationFn: async ({ id, ...d }) => {
            const { data, error } = await supabase.from('contacts').update({ name: d.name, email: d.email || null, phone: d.phone || null, updated_at: nowISO() }).eq('id', id).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id) => {
            await supabase.from('transactions').update({ contact_id: null }).eq('contact_id', id);
            const { error } = await supabase.from('contacts').delete().eq('id', id);
            if (error) throw error; return true;
        }, onSuccess: inv,
    });
    return { create, update, remove };
};

// ── Dashboard ─────────────────────────────────────────────────────
function dateRange(query) {
    const now = new Date();
    const from = query.date_from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = query.date_to || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { from, to };
}

export const useDashboardKPIs = (params = {}) => useQuery({
    queryKey: ['dashboard', 'kpis', params],
    queryFn: async () => {
        if (isLocalhost) {
            return { totalBalance: 10000, monthlyIncome: 4500, monthlyExpenses: 2800, savingsRate: 37.8, deltas: { income: 5.2, expenses: -2.1, savingsRate: 1.5 } };
        }
        const { from, to } = dateRange(params);
        const now = new Date(from);
        const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const prevTo = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        const [{ data: accs }, { data: allTxs }, { data: curTxs }, { data: prevTxs }] = await Promise.all([
            supabase.from('wallets').select('id, balance').is('deleted_at', null),
            supabase.from('transactions').select('amount,type,wallet_id,to_wallet_id'),
            supabase.from('transactions').select('amount,type').gte('date', from).lte('date', to),
            supabase.from('transactions').select('amount,type').gte('date', prevFrom).lte('date', prevTo),
        ]);
        const activeWalletIds = new Set((accs || []).map(a => a.id));
        let liveBalance = (accs || []).reduce((s, a) => s + Number(a.balance), 0);
        (allTxs || []).forEach(t => {
            const amt = Number(t.amount) || 0;
            if (t.type === 'income' && activeWalletIds.has(t.wallet_id)) liveBalance += amt;
            else if (t.type === 'expense' && activeWalletIds.has(t.wallet_id)) liveBalance -= amt;
            else if (t.type === 'transfer') { if (activeWalletIds.has(t.wallet_id)) liveBalance -= amt; if (activeWalletIds.has(t.to_wallet_id)) liveBalance += amt; }
        });
        const income = (curTxs || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const expenses = (curTxs || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const pIncome = (prevTxs || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const pExpenses = (prevTxs || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
        const prevSavingsRate = pIncome > 0 ? ((pIncome - pExpenses) / pIncome) * 100 : 0;
        return { totalBalance: liveBalance, monthlyIncome: income, monthlyExpenses: expenses, savingsRate: Math.round(savingsRate * 10) / 10, deltas: { income: pIncome > 0 ? ((income - pIncome) / pIncome) * 100 : null, expenses: pExpenses > 0 ? ((expenses - pExpenses) / pExpenses) * 100 : null, savingsRate: prevSavingsRate !== 0 ? savingsRate - prevSavingsRate : null } };
    },
});

export const useIncomeExpense = () => useQuery({
    queryKey: ['dashboard', 'income-expense'],
    queryFn: async () => {
        const now = new Date();
        return Promise.all(Array.from({ length: 6 }, async (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const from = d.toISOString().split('T')[0], to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0], label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            const { data: txs } = await supabase.from('transactions').select('amount,type').gte('date', from).lte('date', to);
            const income = (txs || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0), expense = (txs || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
            return { label, income, expense };
        }));
    },
});

export const useNetWorth = () => useQuery({
    queryKey: ['dashboard', 'net-worth'],
    queryFn: async () => {
        const { data: accs } = await supabase.from('wallets').select('balance').is('deleted_at', null);
        const base = (accs || []).reduce((s, a) => s + Number(a.balance), 0), now = new Date();
        return Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1), label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            return { label, netWorth: base };
        });
    },
});

export const useTrend = (period = 'month') => useQuery({
    queryKey: ['dashboard', 'trend', period],
    queryFn: async () => {
        if (isLocalhost) {
            return [
                { label: 'Jan', income: 3000, expense: 2000, netWorth: 5000, dateForSort: new Date(2026, 0, 1) },
                { label: 'Feb', income: 3200, expense: 2100, netWorth: 6100, dateForSort: new Date(2026, 1, 1) },
                { label: 'Mar', income: 4500, expense: 2800, netWorth: 7800, dateForSort: new Date(2026, 2, 1) },
                { label: 'Apr', income: 4000, expense: 2500, netWorth: 9300, dateForSort: new Date(2026, 3, 1) },
                { label: 'May', income: 4500, expense: 2800, netWorth: 10000, dateForSort: new Date(2026, 4, 1) }
            ];
        }
        const now = new Date();
        let points = 6; if (period === 'day') points = 14; if (period === 'week') points = 12; if (period === 'month') points = 6; if (period === 'year') points = 5;
        const [{ data: accs }, { data: allTxs }] = await Promise.all([supabase.from('wallets').select('id, balance').is('deleted_at', null), supabase.from('transactions').select('date,amount,type,wallet_id,to_wallet_id')]);
        const activeWalletIds = new Set((accs || []).map(a => a.id)), baseNetWorth = (accs || []).reduce((s, a) => s + Number(a.balance), 0);
        return Array.from({ length: points }, (_, i) => {
            let fromD, toD, label;
            if (period === 'day') { fromD = new Date(now); fromD.setDate(now.getDate() - (points - 1 - i)); fromD.setHours(0,0,0,0); toD = new Date(fromD); label = `${fromD.getDate()}/${fromD.getMonth() + 1}`; }
            else if (period === 'week') { const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() - (points - 1 - i) * 7); const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); fromD = startOfWeek; toD = endOfWeek; label = `${fromD.getDate()}/${fromD.getMonth() + 1}`; }
            else if (period === 'month') { fromD = new Date(now.getFullYear(), now.getMonth() - (points - 1 - i), 1); toD = new Date(fromD.getFullYear(), fromD.getMonth() + 1, 0); label = fromD.toLocaleString('default', { month: 'short', year: '2-digit' }); }
            else { fromD = new Date(now.getFullYear() - (points - 1 - i), 0, 1); toD = new Date(fromD.getFullYear(), 11, 31); label = fromD.getFullYear().toString(); }
            const fromStr = fromD.toISOString().split('T')[0], toStr = toD.toISOString().split('T')[0];
            const periodTxs = (allTxs || []).filter(t => t.date >= fromStr && t.date <= toStr);
            const income = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0), expense = periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
            const upToTxs = (allTxs || []).filter(t => t.date <= toStr);
            let netWorth = baseNetWorth;
            upToTxs.forEach(t => {
                const amt = Number(t.amount) || 0;
                if (t.type === 'income' && activeWalletIds.has(t.wallet_id)) netWorth += amt;
                else if (t.type === 'expense' && activeWalletIds.has(t.wallet_id)) netWorth -= amt;
                else if (t.type === 'transfer') { if (activeWalletIds.has(t.wallet_id)) netWorth -= amt; if (activeWalletIds.has(t.to_wallet_id)) netWorth += amt; }
            });
            return { label, income, expense, netWorth, dateForSort: fromD };
        }).sort((a, b) => a.dateForSort - b.dateForSort);
    },
});

export const useSpendingByCategory = (params = {}) => useQuery({
    queryKey: ['dashboard', 'spending-by-category', params],
    queryFn: async () => {
        const { from, to } = dateRange(params);
        const { data: txs } = await supabase.from('transactions').select('amount,category_id,category:categories(id,name,icon,color,parent_id)').eq('type', 'expense').gte('date', from).lte('date', to);
        const grouped = {};
        (txs || []).forEach(tx => { const key = tx.category_id || '__none__'; if (!grouped[key]) grouped[key] = { id: key, name: tx.category?.name || 'Uncategorized', icon: tx.category?.icon || 'CubeIcon', color: tx.category?.color || '#94a3b8', amount: 0 }; grouped[key].amount += Number(tx.amount); });
        return Object.values(grouped).sort((a, b) => b.amount - a.amount);
    },
});

export const useBudgetHealth = (params = {}) => useQuery({
    queryKey: ['dashboard', 'budget-health', params],
    queryFn: async () => {
        if (isLocalhost) {
            return [
                { id: 'b1', amount: 500, spent: 450, percentage: 90, status: 'warning', category: { name: 'Food', icon: 'ShoppingCartIcon', color: '#f59e0b' } },
                { id: 'b2', amount: 300, spent: 150, percentage: 50, status: 'ok', category: { name: 'Transport', icon: 'TruckIcon', color: '#3b82f6' } },
                { id: 'b3', amount: 200, spent: 210, percentage: 105, status: 'over', category: { name: 'Entertainment', icon: 'FilmIcon', color: '#ec4899' } }
            ];
        }
        const { from, to } = dateRange(params);
        const { data: budgets } = await supabase.from('budgets').select('*, category:categories(id,name,icon,color)');
        return Promise.all((budgets || []).map(async (b) => {
            const { data: txs } = await supabase.from('transactions').select('amount').eq('category_id', b.category_id).eq('type', 'expense').gte('date', from).lte('date', to);
            const spent = (txs || []).reduce((s, t) => s + Number(t.amount), 0), percentage = Number(b.amount) > 0 ? Math.round((spent / Number(b.amount)) * 100) : 0;
            return { ...b, spent, percentage, status: percentage < 80 ? 'ok' : percentage < 100 ? 'warning' : 'over' };
        }));
    },
});

export const useTopPayees = (params = {}) => useQuery({
    queryKey: ['dashboard', 'top-payees', params],
    queryFn: async () => {
        const { from, to } = dateRange(params);
        const { data: txs } = await supabase.from('transactions').select('amount,contact:contacts(id,name)').eq('type', 'expense').gte('date', from).lte('date', to);
        const grouped = {};
        (txs || []).forEach(tx => { if (!tx.contact) return; const key = tx.contact.id; if (!grouped[key]) grouped[key] = { id: key, name: tx.contact.name, amount: 0 }; grouped[key].amount += Number(tx.amount); });
        return Object.values(grouped).sort((a, b) => b.amount - a.amount).slice(0, 5);
    },
});

export const useCashFlowWaterfall = (params = {}) => useQuery({
    queryKey: ['dashboard', 'cashflow-waterfall', params],
    queryFn: async () => {
        const { from, to } = dateRange(params);
        const [{ data: accs }, { data: allTxs }] = await Promise.all([supabase.from('wallets').select('id, balance').is('deleted_at', null), supabase.from('transactions').select('date,amount,type,wallet_id,to_wallet_id')]);
        const activeWalletIds = new Set((accs || []).map(a => a.id)), baseNetWorth = (accs || []).reduce((s, a) => s + Number(a.balance), 0);
        let currentNetWorth = baseNetWorth;
        (allTxs || []).forEach(t => {
            const amt = Number(t.amount) || 0;
            if (t.type === 'income' && activeWalletIds.has(t.wallet_id)) currentNetWorth += amt;
            else if (t.type === 'expense' && activeWalletIds.has(t.wallet_id)) currentNetWorth -= amt;
            else if (t.type === 'transfer') { if (activeWalletIds.has(t.wallet_id)) currentNetWorth -= amt; if (activeWalletIds.has(t.to_wallet_id)) currentNetWorth += amt; }
        });
        const txsAfterStart = (allTxs || []).filter(t => t.date >= from);
        let incAfterStart = 0, expAfterStart = 0;
        txsAfterStart.forEach(t => {
            const amt = Number(t.amount) || 0;
            if (t.type === 'income' && activeWalletIds.has(t.wallet_id)) incAfterStart += amt;
            else if (t.type === 'expense' && activeWalletIds.has(t.wallet_id)) expAfterStart += amt;
            else if (t.type === 'transfer') { if (activeWalletIds.has(t.wallet_id) && !activeWalletIds.has(t.to_wallet_id)) expAfterStart += amt; if (!activeWalletIds.has(t.wallet_id) && activeWalletIds.has(t.to_wallet_id)) incAfterStart += amt; }
        });
        const openingBalance = currentNetWorth - incAfterStart + expAfterStart, periodTxs = (allTxs || []).filter(t => t.date >= from && t.date <= to);
        let income = 0, expense = 0;
        periodTxs.forEach(t => {
            const amt = Number(t.amount) || 0;
            if (t.type === 'income' && activeWalletIds.has(t.wallet_id)) income += amt;
            else if (t.type === 'expense' && activeWalletIds.has(t.wallet_id)) expense += amt;
            else if (t.type === 'transfer') { if (activeWalletIds.has(t.wallet_id) && !activeWalletIds.has(t.to_wallet_id)) expense += amt; if (!activeWalletIds.has(t.wallet_id) && activeWalletIds.has(t.to_wallet_id)) income += amt; }
        });
        const closingBalance = openingBalance + income - expense;
        return [{ name: 'Opening', amount: openingBalance, type: 'balance' }, { name: 'Income', amount: income, type: 'income' }, { name: 'Expense', amount: expense, type: 'expense' }, { name: 'Closing', amount: closingBalance, type: 'balance' }];
    },
});

export const useDailySpend = (params = {}) => useQuery({
    queryKey: ['dashboard', 'daily-spend', params],
    queryFn: async () => {
        const now = new Date(), from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const { data: txs } = await supabase.from('transactions').select('amount,date').eq('type', 'expense').gte('date', from).lte('date', to);
        const dailyMap = {}; (txs || []).forEach(tx => { const d = new Date(tx.date).getDate(); dailyMap[d] = (dailyMap[d] || 0) + Number(tx.amount); });
        const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const result = Array.from({ length: days }, (_, i) => ({ day: i + 1, amount: dailyMap[i + 1] || 0 }));
        return result.map((r, i) => { const window = result.slice(Math.max(0, i - 6), i + 1), avg = window.reduce((s, x) => s + x.amount, 0) / window.length; return { ...r, rollingAvg: Math.round(avg * 100) / 100 }; });
    },
});

export const useTopCategories = (params = {}) => useQuery({
    queryKey: ['dashboard', 'top-categories', params],
    queryFn: async () => {
        if (isLocalhost) {
            const limit = params.limit || 5;
            const mockCats = [
                { id: 'c1', name: 'Food & Dining', icon: 'ShoppingCartIcon', color: '#f59e0b', total: 850, sparkline: [700, 800, 850] },
                { id: 'c2', name: 'Housing', icon: 'HomeIcon', color: '#6366f1', total: 1200, sparkline: [1200, 1200, 1200] },
                { id: 'c3', name: 'Transportation', icon: 'TruckIcon', color: '#3b82f6', total: 350, sparkline: [300, 320, 350] },
                { id: 'c4', name: 'Entertainment', icon: 'FilmIcon', color: '#ec4899', total: 200, sparkline: [150, 180, 200] },
                { id: 'c5', name: 'Shopping', icon: 'ShoppingBagIcon', color: '#8b5cf6', total: 180, sparkline: [100, 250, 180] }
            ];
            return mockCats.slice(0, limit);
        }
        const limit = params.limit || 5;
        const { from, to } = dateRange(params), refDate = new Date(from);
        const { data: txs } = await supabase.from('transactions').select('amount,category_id,category:categories(id,name,icon,color,parent_id)').eq('type', 'expense').gte('date', from).lte('date', to);
        const grouped = {}; (txs || []).forEach(tx => { if (!tx.category_id) return; if (!grouped[tx.category_id]) grouped[tx.category_id] = { ...tx.category, total: 0, sparkline: [] }; grouped[tx.category_id].total += Number(tx.amount); });
        const topItems = Object.values(grouped).sort((a, b) => b.total - a.total).slice(0, limit);
        return Promise.all(topItems.map(async (cat) => {
            const sparkline = await Promise.all(Array.from({ length: 3 }, async (_, i) => {
                const d = new Date(refDate.getFullYear(), refDate.getMonth() - (2 - i), 1), mFrom = d.toISOString().split('T')[0], mTo = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
                const { data: ts } = await supabase.from('transactions').select('amount').eq('category_id', cat.id).eq('type', 'expense').gte('date', mFrom).lte('date', mTo);
                return (ts || []).reduce((s, t) => s + Number(t.amount), 0);
            }));
            return { ...cat, sparkline };
        }));
    },
});

export const useGoalsProgress = () => useQuery({
    queryKey: ['dashboard', 'goals-progress'],
    queryFn: async () => {
        const { data, error } = await supabase.from('goals').select('*, wallet:wallets(id,name)').eq('status', 'active');
        if (error) throw error;
        return (data || []).map(enrichGoal);
    },
});

// ── Trips ────────────────────────────────────────────────────────
export const useTrips = () => useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
        const { data, error } = await supabase.from('trips').select('*').order('start_date', { ascending: false });
        if (error) throw error;
        return data;
    },
});

export const useTripMutations = () => {
    const qc = useQueryClient();
    const inv = () => qc.invalidateQueries({ queryKey: ['trips'] });
    const create = useMutation({
        mutationFn: async (d) => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.from('trips').insert({ 
                user_id: user.id, 
                name: d.name, 
                start_date: d.startDate, 
                end_date: d.endDate 
            }).select().single();
            if (error) throw error; return data;
        }, onSuccess: inv,
    });
    const remove = useMutation({
        mutationFn: async (id) => { const { error } = await supabase.from('trips').delete().eq('id', id); if (error) throw error; },
        onSuccess: inv,
    });
    return { create, remove };
};
