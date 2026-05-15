import { calculateLiveBalance, type TransactionLike, type WalletLike } from '@/features/wallets/balance';

export type DashboardKPIInput = {
    wallets?: WalletLike[];
    allTransactions?: TransactionLike[];
    currentTransactions?: TransactionLike[];
    previousTransactions?: TransactionLike[];
};

function sumByType(transactions: TransactionLike[] = [], type: string) {
    return transactions
        .filter(transaction => transaction.type === type)
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
}

function percentageDelta(current: number, previous: number) {
    return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

export function calculateDashboardKPIs({
    wallets = [],
    allTransactions = [],
    currentTransactions = [],
    previousTransactions = [],
}: DashboardKPIInput) {
    const income = sumByType(currentTransactions, 'income');
    const expenses = sumByType(currentTransactions, 'expense');
    const previousIncome = sumByType(previousTransactions, 'income');
    const previousExpenses = sumByType(previousTransactions, 'expense');
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    const previousSavingsRate = previousIncome > 0 ? ((previousIncome - previousExpenses) / previousIncome) * 100 : 0;

    return {
        totalBalance: calculateLiveBalance(wallets, allTransactions),
        monthlyIncome: income,
        monthlyExpenses: expenses,
        savingsRate: Math.round(savingsRate * 10) / 10,
        deltas: {
            income: percentageDelta(income, previousIncome),
            expenses: percentageDelta(expenses, previousExpenses),
            savingsRate: previousSavingsRate !== 0 ? savingsRate - previousSavingsRate : null,
        },
    };
}
