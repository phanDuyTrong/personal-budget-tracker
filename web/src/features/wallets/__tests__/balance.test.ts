import { describe, expect, it } from 'vitest';
import { applyTransactionsToWallets, calculateLiveBalance } from '../balance';

describe('wallet balance math', () => {
    it('derives live balances from opening balance plus income, expense, and transfers', () => {
        const wallets = [
            { id: 'cash', name: 'Cash', balance: 100 },
            { id: 'bank', name: 'Bank', balance: 1000 },
        ];
        const transactions = [
            { type: 'income', wallet_id: 'bank', amount: 500 },
            { type: 'expense', wallet_id: 'cash', amount: 25 },
            { type: 'transfer', wallet_id: 'bank', to_wallet_id: 'cash', amount: 200 },
        ];

        const result = applyTransactionsToWallets(wallets, transactions);

        expect(result.find(wallet => wallet.id === 'cash')?.liveBalance).toBe(275);
        expect(result.find(wallet => wallet.id === 'bank')?.liveBalance).toBe(1300);
        expect(calculateLiveBalance(wallets, transactions)).toBe(1575);
    });

    it('ignores transactions for wallets outside the active wallet list', () => {
        const wallets = [{ id: 'active', balance: 50 }];
        const transactions = [
            { type: 'income', wallet_id: 'missing', amount: 1000 },
            { type: 'expense', wallet_id: 'active', amount: 10 },
        ];

        expect(applyTransactionsToWallets(wallets, transactions)[0].liveBalance).toBe(40);
    });
});
