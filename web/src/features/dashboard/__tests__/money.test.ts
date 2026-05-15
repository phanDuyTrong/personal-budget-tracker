import { describe, expect, it } from 'vitest';
import { calculateDashboardKPIs } from '../money';

describe('calculateDashboardKPIs', () => {
    it('calculates balances, current month values, and deltas versus the previous month', () => {
        const result = calculateDashboardKPIs({
            wallets: [
                { id: 'cash', balance: 100 },
                { id: 'bank', balance: 1000 },
            ],
            allTransactions: [
                { type: 'income', wallet_id: 'bank', amount: 500 },
                { type: 'expense', wallet_id: 'cash', amount: 25 },
                { type: 'transfer', wallet_id: 'bank', to_wallet_id: 'cash', amount: 200 },
            ],
            currentTransactions: [
                { type: 'income', amount: 1000 },
                { type: 'income', amount: 500 },
                { type: 'expense', amount: 600 },
                { type: 'transfer', amount: 200 },
            ],
            previousTransactions: [
                { type: 'income', amount: 1000 },
                { type: 'expense', amount: 500 },
            ],
        });

        expect(result.totalBalance).toBe(1575);
        expect(result.monthlyIncome).toBe(1500);
        expect(result.monthlyExpenses).toBe(600);
        expect(result.savingsRate).toBe(60);
        expect(result.deltas.income).toBe(50);
        expect(result.deltas.expenses).toBe(20);
        expect(result.deltas.savingsRate).toBe(10);
    });

    it('returns null deltas when previous month values are zero', () => {
        const result = calculateDashboardKPIs({
            currentTransactions: [
                { type: 'income', amount: 800 },
                { type: 'expense', amount: 200 },
            ],
            previousTransactions: [],
        });

        expect(result.savingsRate).toBe(75);
        expect(result.deltas.income).toBeNull();
        expect(result.deltas.expenses).toBeNull();
        expect(result.deltas.savingsRate).toBeNull();
    });
});
