import React, { useState } from 'react';
import { useStore } from '@/services/store';
import { Plus, Trash2, Edit2, Save, ChevronUp, ChevronDown } from 'lucide-react';

export const WalletManager = () => {
    const { wallets, addWallet, updateWallet, deleteWallet, walletOrder, updateWalletOrder } = useStore();
    const [isAdding, setIsAdding] = useState(false);
    const [newWallet, setNewWallet] = useState({ name: '', type: 'bank', balance: 0 });

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    const sortedWallets = [...wallets].sort((a, b) => {
        const indexA = walletOrder.indexOf(a.id);
        const indexB = walletOrder.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    const handleMoveUp = (index) => {
        if (index === 0) return;
        const currentOrder = sortedWallets.map(w => w.id);
        const newOrder = [...currentOrder];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        updateWalletOrder(newOrder);
    };

    const handleMoveDown = (index) => {
        if (index === sortedWallets.length - 1) return;
        const currentOrder = sortedWallets.map(w => w.id);
        const newOrder = [...currentOrder];
        [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
        updateWalletOrder(newOrder);
    };

    const handleAdd = () => {
        if (!newWallet.name) return;
        addWallet(newWallet);
        setNewWallet({ name: '', type: 'bank', balance: 0 });
        setIsAdding(false);
    };

    const startEdit = (wallet) => {
        setEditingId(wallet.id);
        setEditForm(wallet);
    };

    const saveEdit = () => {
        updateWallet(editingId, {
            name: editForm.name,
            type: editForm.type,
            balance: parseFloat(editForm.balance)
        });
        setEditingId(null);
    };

    return (
        <div className="space-y-4">
            {!isAdding && (
                <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 text-primary font-medium hover:underline">
                    <Plus className="h-4 w-4" /> Add New Wallet
                </button>
            )}

            {isAdding && (
                <div className="border border-border bg-card text-card-foreground p-4 rounded space-y-3 animate-in fade-in">
                    <h4 className="font-semibold text-foreground">New Wallet</h4>
                    <div className="grid gap-2 sm:grid-cols-3">
                        <input
                            placeholder="Wallet Name"
                            className="p-2 border border-input rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            value={newWallet.name}
                            onChange={e => setNewWallet({ ...newWallet, name: e.target.value })}
                        />
                        <select
                            className="p-2 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            value={newWallet.type}
                            onChange={e => setNewWallet({ ...newWallet, type: e.target.value })}
                        >
                            <option value="bank">Bank Account</option>
                            <option value="cash">Cash</option>
                            <option value="credit">Credit Card</option>
                            <option value="e-wallet">E-Wallet</option>
                        </select>
                        <input
                            type="number"
                            placeholder="Initial Balance"
                            className="p-2 border border-input rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            value={newWallet.balance}
                            onChange={e => setNewWallet({ ...newWallet, balance: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsAdding(false)} className="px-3 py-1 text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                        <button onClick={handleAdd} className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">Save</button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {sortedWallets.map((wallet, index) => (
                    <div key={wallet.id} className="flex items-center justify-between p-3 border border-border bg-card rounded hover:bg-accent/50 transition-colors">
                        {editingId === wallet.id ? (
                            <div className="flex gap-2 flex-1 items-center flex-wrap">
                                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="p-1 border border-input rounded bg-background text-foreground w-full sm:w-1/3 focus:outline-none focus:ring-2 focus:ring-ring" />
                                <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className="p-1 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                                    <option value="bank">Bank</option>
                                    <option value="cash">Cash</option>
                                    <option value="credit">Credit</option>
                                    <option value="e-wallet">E-Wallet</option>
                                </select>
                                <input type="number" value={editForm.balance} onChange={e => setEditForm({ ...editForm, balance: e.target.value })} className="p-1 border border-input rounded bg-background text-foreground w-24 focus:outline-none focus:ring-2 focus:ring-ring" />
                                <button onClick={saveEdit} className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"><Save className="h-4 w-4" /></button>
                                <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <div className="font-medium text-foreground">{wallet.name}</div>
                                    <div className="text-sm text-muted-foreground">{wallet.id} • {wallet.type}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(wallet.balance)}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="p-1 hover:bg-muted rounded disabled:opacity-50"><ChevronUp className="h-4 w-4 text-muted-foreground" /></button>
                                        <button onClick={() => handleMoveDown(index)} disabled={index === sortedWallets.length - 1} className="p-1 hover:bg-muted rounded disabled:opacity-50"><ChevronDown className="h-4 w-4 text-muted-foreground" /></button>
                                        <button onClick={() => startEdit(wallet)} className="p-1 hover:bg-muted rounded"><Edit2 className="h-4 w-4 text-muted-foreground" /></button>
                                        <button onClick={() => deleteWallet(wallet.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
