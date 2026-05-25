import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDevMockData } from '@/features/shared/api';
import { calculateLiveBalance } from '@/features/wallets/balance';
import { calculateDashboardKPIs } from './money';
import { enrichGoal } from '@/features/goals/money';
import { getDashboardDateRange, getDayOfMonth, getMonthRange, getPreviousMonthRange, getShiftedMonthRange, monthLabel, toISODate } from '@/lib/date';

// ── Dashboard ─────────────────────────────────────────────────────
export const useDashboardKPIs = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['dashboard', 'kpis', params],
    queryFn: async () => {
        if (useDevMockData) {
            return { totalBalance: 10000, monthlyIncome: 4500, monthlyExpenses: 2800, savingsRate: 37.8, deltas: { income: 5.2, expenses: -2.1, savingsRate: 1.5 } };
        }
        const { from, to } = getDashboardDateRange(params);
        const { from: prevFrom, to: prevTo } = getPreviousMonthRange(from);
        const [{ data: accs }, { data: allTxs }, { data: curTxs }, { data: prevTxs }] = await Promise.all([
            supabase.from('wallets').select('id, balance').is('deleted_at', null),
            supabase.from('transactions').select('amount,type,wallet_id,to_wallet_id'),
            supabase.from('transactions').select('amount,type').gte('date', from).lte('date', to),
            supabase.from('transactions').select('amount,type').gte('date', prevFrom).lte('date', prevTo),
        ]);
        return calculateDashboardKPIs({
            wallets: accs || [],
            allTransactions: allTxs || [],
            currentTransactions: curTxs || [],
            previousTransactions: prevTxs || [],
        });
    },
});

export const useIncomeExpense = () => useQuery({
    queryKey: ['dashboard', 'income-expense'],
    queryFn: async () => {
        const now = new Date();
        return Promise.all(Array.from({ length: 6 }, async (_, i) => {
            const { from, to, start } = getShiftedMonthRange(now, -(5 - i));
            const label = monthLabel(start);
            const { data: txs } = await supabase.from('transactions').select('amount,type').gte('date', from).lte('date', to);
            const income = (txs || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0), expense = (txs || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
            return { label, income, expense };
        }));
    },
});

export const useNetWorth = () => useQuery({
    queryKey: ['dashboard', 'net-worth'],
    queryFn: async () => {
        const [{ data: accs }, { data: txs }] = await Promise.all([
            supabase.from('wallets').select('id, balance').is('deleted_at', null),
            supabase.from('transactions').select('amount,type,wallet_id,to_wallet_id'),
        ]);
        const base = calculateLiveBalance(accs || [], txs || []), now = new Date();
        return Array.from({ length: 12 }, (_, i) => {
            const { start } = getShiftedMonthRange(now, -(11 - i));
            return { label: monthLabel(start), netWorth: base };
        });
    },
});

export const useTrend = (period = 'month') => useQuery({
    queryKey: ['dashboard', 'trend', period],
    queryFn: async () => {
        if (useDevMockData) {
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
            const fromStr = toISODate(fromD), toStr = toISODate(toD);
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

export const useSpendingByCategory = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['dashboard', 'spending-by-category', params],
    queryFn: async () => {
        const { from, to } = getDashboardDateRange(params);
        const { data: txs } = await supabase.from('transactions').select('amount,category_id,category:categories(id,name,icon,color,parent_id)').eq('type', 'expense').gte('date', from).lte('date', to);
        const grouped: Record<string, any> = {};
        (txs || []).forEach(tx => { const key = tx.category_id || '__none__'; if (!grouped[key]) grouped[key] = { id: key, name: tx.category?.name || 'Uncategorized', icon: tx.category?.icon || 'CubeIcon', color: tx.category?.color || '#94a3b8', amount: 0 }; grouped[key].amount += Number(tx.amount); });
        return Object.values(grouped).sort((a, b) => b.amount - a.amount);
    },
});

export const useBudgetHealth = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['dashboard', 'budget-health', params],
    queryFn: async () => {
        if (useDevMockData) {
            return [
                { id: 'b1', amount: 500, spent: 450, percentage: 90, status: 'warning', category: { name: 'Food', icon: 'ShoppingCartIcon', color: '#f59e0b' } },
                { id: 'b2', amount: 300, spent: 150, percentage: 50, status: 'ok', category: { name: 'Transport', icon: 'TruckIcon', color: '#3b82f6' } },
                { id: 'b3', amount: 200, spent: 210, percentage: 105, status: 'over', category: { name: 'Entertainment', icon: 'FilmIcon', color: '#ec4899' } }
            ];
        }
        const { from, to } = getDashboardDateRange(params);
        const { data: budgets } = await supabase.from('budgets').select('*, category:categories(id,name,icon,color)');
        return Promise.all((budgets || []).map(async (b) => {
            const { data: txs } = await supabase.from('transactions').select('amount').eq('category_id', b.category_id).eq('type', 'expense').gte('date', from).lte('date', to);
            const spent = (txs || []).reduce((s, t) => s + Number(t.amount), 0), percentage = Number(b.amount) > 0 ? Math.round((spent / Number(b.amount)) * 100) : 0;
            return { ...b, spent, percentage, status: percentage < 80 ? 'ok' : percentage < 100 ? 'warning' : 'over' };
        }));
    },
});

export const useTopPayees = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['dashboard', 'top-payees', params],
    queryFn: async () => {
        const { from, to } = getDashboardDateRange(params);
        const { data: txs } = await supabase.from('transactions').select('amount,contact:contacts(id,name)').eq('type', 'expense').gte('date', from).lte('date', to);
        const grouped: Record<string, any> = {};
        (txs || []).forEach(tx => { if (!tx.contact) return; const key = tx.contact.id; if (!grouped[key]) grouped[key] = { id: key, name: tx.contact.name, amount: 0 }; grouped[key].amount += Number(tx.amount); });
        return Object.values(grouped).sort((a, b) => b.amount - a.amount).slice(0, 5);
    },
});

export const useCashFlowWaterfall = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['dashboard', 'cashflow-waterfall', params],
    queryFn: async () => {
        const { from, to } = getDashboardDateRange(params);
        const [{ data: accs }, { data: allTxs }] = await Promise.all([supabase.from('wallets').select('id, balance').is('deleted_at', null), supabase.from('transactions').select('date,amount,type,wallet_id,to_wallet_id')]);
        const activeWalletIds = new Set((accs || []).map(a => a.id)), currentNetWorth = calculateLiveBalance(accs || [], allTxs || []);
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

export const useDailySpend = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['dashboard', 'daily-spend', params],
    queryFn: async () => {
        const { from, to, end } = getMonthRange();
        const { data: txs } = await supabase.from('transactions').select('amount,date').eq('type', 'expense').gte('date', from).lte('date', to);
        const dailyMap = {}; (txs || []).forEach(tx => { const d = getDayOfMonth(tx.date); dailyMap[d] = (dailyMap[d] || 0) + Number(tx.amount); });
        const days = end.getDate();
        const result = Array.from({ length: days }, (_, i) => ({ day: i + 1, amount: dailyMap[i + 1] || 0 }));
        return result.map((r, i) => { const window = result.slice(Math.max(0, i - 6), i + 1), avg = window.reduce((s, x) => s + x.amount, 0) / window.length; return { ...r, rollingAvg: Math.round(avg * 100) / 100 }; });
    },
});

export const useTopCategories = (params: Record<string, any> = {}) => useQuery({
    queryKey: ['dashboard', 'top-categories', params],
    queryFn: async () => {
        if (useDevMockData) {
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
        const { from, to } = getDashboardDateRange(params), refDate = new Date(from);
        const { data: txs } = await supabase.from('transactions').select('amount,category_id,category:categories(id,name,icon,color,parent_id)').eq('type', 'expense').gte('date', from).lte('date', to);
        const grouped: Record<string, any> = {}; (txs || []).forEach(tx => { if (!tx.category_id) return; if (!grouped[tx.category_id]) grouped[tx.category_id] = { ...tx.category, total: 0, sparkline: [] }; grouped[tx.category_id].total += Number(tx.amount); });
        const topItems = Object.values(grouped).sort((a, b) => b.total - a.total).slice(0, limit);
        return Promise.all(topItems.map(async (cat) => {
            const sparkline = await Promise.all(Array.from({ length: 3 }, async (_, i) => {
                const { from: mFrom, to: mTo } = getShiftedMonthRange(refDate, -(2 - i));
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
