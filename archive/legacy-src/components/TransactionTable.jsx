import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStore } from '@/services/store';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Trash2, Check, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { TransactionDialog } from '@/components/TransactionDialog';

export function TransactionTable() {
    const { t } = useLanguage();
    const { transactions, updateTransaction, deleteTransaction, wallets, transactionsLoading } = useStore();
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    const paginatedTransactions = transactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const startEdit = (transaction) => {
        setEditingId(transaction.id);
        setEditForm({ ...transaction });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = () => {
        updateTransaction(editingId, editForm);
        setEditingId(null);
        setEditForm({});
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this transaction?')) {
            deleteTransaction(id);
        }
    };

    const handleChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const getWalletName = (id) => {
        if (!id) return '-';
        const wallet = wallets.find(w => w.id === id);
        return wallet ? wallet.name : id;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{t('transactions')}</h2>
                <TransactionDialog />
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('date')}</TableHead>
                            <TableHead>{t('description')}</TableHead>
                            <TableHead>{t('category')}</TableHead>
                            <TableHead>{t('subCategory')}</TableHead>
                            <TableHead>{t('person')}</TableHead>
                            <TableHead>{t('amount')}</TableHead>
                            <TableHead>{t('wallet')}</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactionsLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Loading transactions...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : paginatedTransactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                    No transactions found. Add your first transaction!
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedTransactions.map((tx) => (
                                <TableRow key={tx.id}>
                                    {editingId === tx.id ? (
                                        <>
                                            <TableCell>
                                                <Input
                                                    type="date"
                                                    value={editForm.date ? editForm.date.split('T')[0] : ''}
                                                    onChange={(e) => handleChange('date', e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={editForm.description}
                                                    onChange={(e) => handleChange('description', e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={editForm.mainCategory || ''}
                                                    onChange={(e) => handleChange('mainCategory', e.target.value)}
                                                    placeholder="Main"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={editForm.subCategory || ''}
                                                    onChange={(e) => handleChange('subCategory', e.target.value)}
                                                    placeholder="Sub"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={editForm.person || ''}
                                                    onChange={(e) => handleChange('person', e.target.value)}
                                                    placeholder="Person"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={editForm.amount}
                                                    onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                                                />
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {getWalletName(tx.fromWalletId)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="icon" variant="ghost" onClick={saveEdit} className="h-8 w-8 text-green-500">
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-8 w-8 text-red-500">
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell>{format(new Date(tx.date), 'MMM dd, yyyy')}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell>{tx.mainCategory || tx.category}</TableCell>
                                            <TableCell>{tx.subCategory}</TableCell>
                                            <TableCell>{tx.person || '-'}</TableCell>
                                            <TableCell className={tx.type === 'expense' ? 'text-red-500 font-medium' : tx.type === 'income' ? 'text-green-500 font-medium' : 'text-blue-500 font-medium'}>
                                                {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : '⇄ '}${tx.amount.toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                {tx.type === 'transfer'
                                                    ? `${getWalletName(tx.fromWalletId)} → ${getWalletName(tx.toWalletId)} `
                                                    : getWalletName(tx.fromWalletId || tx.toWalletId)
                                                }
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="icon" variant="ghost" onClick={() => startEdit(tx)} className="h-8 w-8">
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(tx.id)} className="h-8 w-8 text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-end items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
