import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStore } from '@/services/store';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, ArrowRightLeft, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TransactionDialog() {
    const { t } = useLanguage();
    const { wallets, categories, people, settings, addTransaction } = useStore();
    const [open, setOpen] = useState(false);

    // Form State
    const [type, setType] = useState('expense'); // expense, income, transfer
    const [amount, setAmount] = useState('');
    const [isVND, setIsVND] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');

    // Category / Person
    const [mainCategory, setMainCategory] = useState('');
    const [subCategory, setSubCategory] = useState('');
    const [person, setPerson] = useState('');

    // Wallets
    const [fromWalletId, setFromWalletId] = useState(wallets[0]?.id || '');
    const [toWalletId, setToWalletId] = useState(wallets[1]?.id || '');

    // Derived Sub-categories
    const validSubCategories = categories.find(c => c.name === mainCategory)?.subCategories || [];

    // Reset sub-category when main changes
    useEffect(() => {
        if (!validSubCategories.includes(subCategory)) {
            setSubCategory('');
        }
    }, [mainCategory]);

    const handleSave = () => {
        if (!amount || !description) return;

        let finalAmount = parseFloat(amount);
        if (isVND) {
            finalAmount = finalAmount / settings.exchangeRate;
        }

        const newTx = {
            date: new Date(date).toISOString(),
            description,
            amount: finalAmount,
            type,
            fromWalletId,
            // Only add these if not transfer
            ...(type !== 'transfer' && {
                mainCategory,
                subCategory,
                person: person || null,
            }),
            // Only add if transfer
            ...(type === 'transfer' && {
                toWalletId
            })
        };

        addTransaction(newTx);
        setOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setAmount('');
        setDescription('');
        setMainCategory('');
        setSubCategory('');
        setPerson('');
        setDate(new Date().toISOString().split('T')[0]);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('addTransaction')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{t('addTransaction')}</DialogTitle>
                    <DialogDescription>
                        Manually enter a new transaction.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Type Selection */}
                    <div className="flex gap-2 p-1 bg-muted rounded-lg">
                        {['expense', 'income', 'transfer'].map((T) => (
                            <button
                                key={T}
                                onClick={() => setType(T)}
                                className={cn(
                                    "flex-1 px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-all",
                                    type === T ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {T}
                            </button>
                        ))}
                    </div>

                    {/* Amount & Currency */}
                    <div className="grid gap-2">
                        <Label htmlFor="amount">{t('amount')}</Label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="pl-9"
                                    placeholder="0.00"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsVND(!isVND)}
                                className={cn("w-16", isVND ? "border-primary text-primary" : "")}
                            >
                                {isVND ? 'VND' : 'USD'}
                            </Button>
                        </div>
                        {isVND && amount && (
                            <p className="text-xs text-muted-foreground">
                                ≈ ${(parseFloat(amount) / settings.exchangeRate).toFixed(2)} USD
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="grid gap-2">
                        <Label htmlFor="description">{t('description')}</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('description')}
                        />
                    </div>

                    {/* Date */}
                    <div className="grid gap-2">
                        <Label htmlFor="date">{t('date')}</Label>
                        <Input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    {/* Wallets */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>{t('from')}</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                value={fromWalletId}
                                onChange={(e) => setFromWalletId(e.target.value)}
                            >
                                {wallets.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        {type === 'transfer' && (
                            <div className="grid gap-2">
                                <Label>{t('to')}</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                    value={toWalletId}
                                    onChange={(e) => setToWalletId(e.target.value)}
                                >
                                    {wallets.filter(w => w.id !== fromWalletId).map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Categories - Only for Income/Expense */}
                    {type !== 'transfer' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>{t('category')}</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                        value={mainCategory}
                                        onChange={(e) => setMainCategory(e.target.value)}
                                    >
                                        <option value="">Select...</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>{t('subCategory')}</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                        value={subCategory}
                                        onChange={(e) => setSubCategory(e.target.value)}
                                        disabled={!mainCategory}
                                    >
                                        <option value="">Select...</option>
                                        {validSubCategories.map(sub => (
                                            <option key={sub} value={sub}>{sub}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Person */}
                            <div className="grid gap-2">
                                <Label>{t('person')}</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                    value={person}
                                    onChange={(e) => setPerson(e.target.value)}
                                >
                                    <option value="">(None)</option>
                                    {people.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSave}>{t('save')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
