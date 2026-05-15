export function applyTransactionsToWallets(wallets = [], transactions = []) {
    const balances = {};
    wallets.forEach(wallet => {
        balances[wallet.id] = {
            ...wallet,
            liveBalance: Number(wallet.balance) || 0,
        };
    });

    transactions.forEach(transaction => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.type === 'income' && balances[transaction.wallet_id]) {
            balances[transaction.wallet_id].liveBalance += amount;
        } else if (transaction.type === 'expense' && balances[transaction.wallet_id]) {
            balances[transaction.wallet_id].liveBalance -= amount;
        } else if (transaction.type === 'transfer') {
            if (balances[transaction.wallet_id]) balances[transaction.wallet_id].liveBalance -= amount;
            if (balances[transaction.to_wallet_id]) balances[transaction.to_wallet_id].liveBalance += amount;
        }
    });

    return Object.values(balances);
}

export function calculateLiveBalance(wallets = [], transactions = []) {
    return applyTransactionsToWallets(wallets, transactions).reduce((sum, wallet) => sum + Number(wallet.liveBalance), 0);
}
