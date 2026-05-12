import React from 'react';
import { useDebts } from '@/hooks/useApi';
import { EmptyState, AmountDisplay , GlassCard } from '@/components/ui';
import { UsersIcon, ExclamationCircleIcon, ArrowUpRightIcon, ArrowDownLeftIcon } from '@heroicons/react/24/outline';
import { useSettingsStore } from '@/stores/settingsStore';
import { 
    Skeleton, 
    Table, 
    TableHeader, 
    TableColumn, 
    TableBody, 
    TableRow, 
    TableCell,
    Chip,
    Card
} from "@heroui/react";

export function Debts() {
    const { data: debts = [], isLoading, error } = useDebts();
    const { currency } = useSettingsStore();

    if (isLoading) {
         return (
             <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto">
                <Skeleton className="h-10 w-48 rounded-lg" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                </div>
                <Skeleton className="h-64 rounded-3xl" />
            </div>
         );
    }

    if (error) {
        return (
            <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
                <div className="p-6 bg-danger/10 text-danger rounded-3xl flex items-center gap-4 border border-danger/20">
                    <ExclamationCircleIcon className="h-6 w-6" />
                    <div>
                        <h3 className="font-black text-neutral-900 dark:text-white tracking-tight">Error loading debts</h3>
                        <p className="text-sm opacity-90">{error.message}</p>
                        <p className="text-xs mt-1 font-bold uppercase tracking-widest opacity-60">Check database migrations for is_debt column</p>
                    </div>
                </div>
            </div>
        );
    }

    const totalOwedToYou = debts.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);
    const totalYouOwe = debts.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            <div>
                <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">Debts & Loans</h1>
                <p className="text-neutral-500">Manage what you owe and what is owed to you</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-primary text-white p-8 rounded-[2rem] shadow-xl shadow-primary/20 relative overflow-hidden flex flex-col justify-end min-h-[160px]">
                    <ArrowDownLeftIcon className="absolute -right-6 -top-6 w-32 h-32 opacity-20 rotate-12" />
                    <p className="text-white/80 font-black uppercase tracking-widest text-xs mb-1">People Owe You</p>
                    <h2 className="text-4xl font-black tabular-nums">
                        <AmountDisplay amount={totalOwedToYou} type="income" className="!text-white" />
                    </h2>
                </div>
                
                <div className="bg-danger text-white p-8 rounded-[2rem] shadow-xl shadow-danger/20 relative overflow-hidden flex flex-col justify-end min-h-[160px]">
                    <ArrowUpRightIcon className="absolute -right-6 -top-6 w-32 h-32 opacity-20 -rotate-12" />
                    <p className="text-white/80 font-black uppercase tracking-widest text-xs mb-1">You Owe People</p>
                    <h2 className="text-4xl font-black tabular-nums">
                        <AmountDisplay amount={totalYouOwe} type="expense" className="!text-white" />
                    </h2>
                </div>
            </div>

            <GlassCard className="p-0 overflow-hidden">
                {debts.length === 0 ? (
                    <EmptyState icon={UsersIcon} title="No active debts" description="When you add transactions marked as 'Debt', their balances will appear here." />
                ) : (
                    <Table 
                        aria-label="Debts table"
                        removeWrapper
                        className="bg-transparent"
                    >
                        <TableHeader>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 text-[10px] font-black text-neutral-500 uppercase tracking-widest py-4 px-6">Contact</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 text-[10px] font-black text-neutral-500 uppercase tracking-widest py-4 px-6">Records</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 text-[10px] font-black text-neutral-500 uppercase tracking-widest py-4 px-6 text-right">Outstanding Balance</TableColumn>
                        </TableHeader>
                        <TableBody>
                            {debts.map((debt) => (
                                <TableRow key={debt.id} className="border-b border-white/10 dark:border-neutral-800/20 hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                                    <TableCell className="py-5 px-6 font-black text-neutral-900 dark:text-white tracking-tight">{debt.name}</TableCell>
                                    <TableCell className="py-5 px-6">
                                        <Chip size="sm" variant="flat" className="font-bold text-[10px] uppercase">
                                            {debt.debtTxs.length} records
                                        </Chip>
                                    </TableCell>
                                    <TableCell className="py-5 px-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-lg font-black tabular-nums ${debt.balance > 0 ? 'text-primary' : debt.balance < 0 ? 'text-danger' : 'text-neutral-500'}`}>
                                                {debt.balance > 0 ? '+' : ''}{currency === 'VND' ? `${debt.balance.toLocaleString()} ₫` : `$${debt.balance.toFixed(2)}`}
                                            </span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mt-0.5">
                                                {debt.balance > 0 ? 'Owes you' : debt.balance < 0 ? 'You owe' : 'Settled'}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </GlassCard>
        </div>
    );
}
