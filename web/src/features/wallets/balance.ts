export type WalletLike = {
    id: string;
    balance?: number | string | null;
    [key: string]: unknown;
};

export type TransactionLike = {
    amount?: number | string | null;
    type?: string | null;
    wallet_id?: string | null;
    to_wallet_id?: string | null;
    [key: string]: unknown;
};

export type CalculatedWallet<T extends WalletLike = WalletLike> = T & { liveBalance: number };

export function applyTransactionsToWallets<T extends WalletLike>(wallets: T[] = [], transactions: TransactionLike[] = []): Array<CalculatedWallet<T>> {
    const balances: Record<string, CalculatedWallet<T>> = {};
    wallets.forEach(wallet => {
        balances[wallet.id] = {
            ...wallet,
            liveBalance: Number(wallet.balance) || 0,
        };
    });

    transactions.forEach(transaction => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.type === 'income' && transaction.wallet_id && balances[transaction.wallet_id]) {
            balances[transaction.wallet_id].liveBalance += amount;
        } else if (transaction.type === 'expense' && transaction.wallet_id && balances[transaction.wallet_id]) {
            balances[transaction.wallet_id].liveBalance -= amount;
        } else if (transaction.type === 'transfer') {
            if (transaction.wallet_id && balances[transaction.wallet_id]) balances[transaction.wallet_id].liveBalance -= amount;
            if (transaction.to_wallet_id && balances[transaction.to_wallet_id]) balances[transaction.to_wallet_id].liveBalance += amount;
        }
    });

    return Object.values(balances);
}

export function calculateLiveBalance(wallets: WalletLike[] = [], transactions: TransactionLike[] = []) {
    return applyTransactionsToWallets(wallets, transactions).reduce((sum, wallet) => sum + Number(wallet.liveBalance), 0);
}
