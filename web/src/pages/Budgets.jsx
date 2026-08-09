import { Progress } from "@heroui/progress";
import React, { useEffect, useState, useMemo } from 'react';
import { format, startOfMonth, getMonth, getYear } from 'date-fns';
import { 
    PlusIcon, 
    PencilIcon, 
    TrashIcon, 
    ArchiveBoxIcon, 
    Squares2X2Icon, 
    ListBulletIcon, 
    EllipsisVerticalIcon 
} from '@heroicons/react/24/outline';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from "@heroui/button";
import { Input as HeroInput } from "@heroui/input";
import { Select as HeroSelect, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { Tooltip } from "@heroui/tooltip";
import { Tabs, Tab } from "@heroui/tabs";
import { Chip } from "@heroui/chip";
import { useBudgets, useBudgetMutations } from '@/features/budgets/hooks';
import { useCategories } from '@/features/categories/hooks';
import { useSettingsStore } from '@/stores/settingsStore';
import { Modal, AmountInput, Field, EmptyState, ConfirmModal, DatePicker as CustomDatePicker , GlassCard } from '@/components/ui';
import { useToast } from '@/components/ui/useToast';
import { useFormatAmount } from '@/hooks/useTranslation';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TransactionModal } from '@/pages/Transactions';
import { toISODate } from '@/lib/date';

function getErrorMessage(err, fallback = 'Error saving budget') {
    return err instanceof Error && err.message ? err.message : fallback;
}

function BudgetModal({ open, onClose, budget }) {
    const buildFormState = React.useCallback(() => budget ? { categoryId: budget.category_id || budget.categoryId, amount: Number(budget.amount), period: budget.period, rollover: budget.rollover, startDate: format(new Date(budget.start_date || budget.startDate), 'yyyy-MM-dd') } : { categoryId: '', amount: '', period: 'monthly', rollover: false, startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd') }, [budget]);
    const [form, setForm] = useState(buildFormState);
    const { create, update } = useBudgetMutations();
    const { data: categoryTree = [] } = useCategories();
    const toast = useToast();
    const isEdit = !!budget;

    const flatCats = useMemo(() => {
        const flat = [];
        const traverse = (cats, level = 0) => {
            cats.forEach(c => {
                flat.push({ ...c, label: (level > 0 ? '　' : '') + c.name });
                if (c.children) traverse(c.children, level + 1);
            });
        };
        traverse(categoryTree);
        return flat;
    }, [categoryTree]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) await update.mutateAsync({ id: budget.id, ...form });
            else await create.mutateAsync(form);
            toast(`Budget ${isEdit ? 'updated' : 'created'}!`, 'success');
            onClose();
        } catch (err) { toast(getErrorMessage(err), 'error'); }
    };

    const handleFormChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        setForm(buildFormState());
    }, [buildFormState]);

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Budget' : 'New Budget'}>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <HeroSelect 
                    label="Category"
                    placeholder="Select category"
                    selectedKeys={form.categoryId ? [form.categoryId] : []}
                    onSelectionChange={keys => handleFormChange('categoryId', Array.from(keys)[0])}
                    variant="flat"
                    required
                >
                    {flatCats.map(cat => <SelectItem key={cat.id} textValue={cat.name}>{cat.label}</SelectItem>)}
                </HeroSelect>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Limit Amount">
                        <AmountInput placeholder="0.00" value={form.amount} onChange={e => handleFormChange('amount', e.target.value)} required />
                    </Field>
                    <HeroSelect 
                        label="Period"
                        selectedKeys={[form.period]} 
                        onSelectionChange={keys => handleFormChange('period', Array.from(keys)[0])}
                        variant="flat"
                    >
                        <SelectItem key="monthly" textValue="Monthly">Monthly</SelectItem>
                        <SelectItem key="weekly" textValue="Weekly">Weekly</SelectItem>
                        <SelectItem key="biweekly" textValue="Biweekly">Biweekly</SelectItem>
                    </HeroSelect>
                </div>

                <Field label="Start Date">
                    <CustomDatePicker value={form.startDate} onChange={(val) => handleFormChange('startDate', val)} />
                </Field>

                <div className="flex items-center gap-2">
                    <input type="checkbox" id="rollover" checked={form.rollover} onChange={e => handleFormChange('rollover', e.target.checked)} className="rounded border-neutral-300 dark:border-neutral-700 bg-transparent text-primary focus:ring-primary" />
                    <label htmlFor="rollover" className="text-sm text-neutral-500 font-medium">Rollover unused budget to next period</label>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <Button variant="light" onClick={onClose}>Cancel</Button>
                    <Button color="primary" type="submit" className="font-bold" isLoading={create.isPending || update.isPending}>{isEdit ? 'Save Changes' : 'Create Budget'}</Button>
                </div>
            </form>
        </Modal>
    );
}

export function Budgets() {
    const today = new Date();
    const [month, setMonthIdx] = useState(getMonth(today));
    const [year, setYearIdx] = useState(getYear(today));

    const [modal, setModal] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [confirmDel, setConfirmDel] = useState(null);
    const [transactionModal, setTransactionModal] = useState(null);
    const toast = useToast();
    const { budgetOrder, setBudgetOrder } = useSettingsStore();

    const { data: budgets = [], isLoading } = useBudgets({ month: month + 1, year });
    const { remove } = useBudgetMutations();
    const fmt = useFormatAmount();

    const sortedBudgets = useMemo(() => {
        if (!budgets || budgets.length === 0) return [];
        const sorted = [...budgets];
        sorted.sort((a, b) => {
            const idxA = budgetOrder.indexOf(a.id);
            const idxB = budgetOrder.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
        return sorted;
    }, [budgets, budgetOrder]);

    const budgetSummary = useMemo(() => {
        const totalBudget = sortedBudgets.reduce((sum, budget) => sum + Number(budget.amount || 0), 0);
        const totalSpent = sortedBudgets.reduce((sum, budget) => sum + Number(budget.spent || 0), 0);
        const totalRemaining = Math.max(totalBudget - totalSpent, 0);
        const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

        return {
            totalBudget,
            totalSpent,
            totalRemaining,
            totalPct,
        };
    }, [sortedBudgets]);

    const handleDragEnd = (result) => {
        if (!result.destination) return;
        const items = Array.from(sortedBudgets);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setBudgetOrder(items.map(b => b.id));
    };

    const handleDelete = async () => {
        try { await remove.mutateAsync(confirmDel); toast('Budget deleted', 'success'); } catch (err) { toast(getErrorMessage(err, 'Error deleting budget'), 'error'); }
        setConfirmDel(null);
    };

    const openBudgetExpense = (budget) => {
        setTransactionModal({
            amount: '',
            type: 'expense',
            walletId: '',
            categoryId: budget.category_id || budget.categoryId || '',
            contactId: '',
            tripId: '',
            description: '',
            date: toISODate(new Date()),
            isRecurring: false,
            isDebt: false,
            toWalletId: '',
        });
    };

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">Budgets</h1>
                    <p className="text-neutral-500">Track and manage your spending limits</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        <HeroSelect 
                            className="w-32" 
                            selectedKeys={[String(month)]} 
                            onSelectionChange={keys => setMonthIdx(Number(Array.from(keys)[0]))}
                            variant="flat"
                        >
                            {Array.from({ length: 12 }).map((_, i) => (
                                <SelectItem key={String(i)} textValue={format(new Date(2000, i, 1), 'MMMM')}>{format(new Date(2000, i, 1), 'MMMM')}</SelectItem>
                            ))}
                        </HeroSelect>
                        <HeroSelect 
                            className="w-24" 
                            selectedKeys={[String(year)]} 
                            onSelectionChange={keys => setYearIdx(Number(Array.from(keys)[0]))}
                            variant="flat"
                        >
                            {Array.from({ length: 5 }).map((_, i) => {
                                const y = new Date().getFullYear() - 2 + i;
                                return <SelectItem key={String(y)} textValue={String(y)}>{y}</SelectItem>;
                            })}
                        </HeroSelect>
                    </div>
                    
                    <Tabs 
                        selectedKey={viewMode} 
                        onSelectionChange={setViewMode} 
                        variant="flat"
                        size="md"
                        classNames={{ cursor: "dark:!bg-neutral-800" }}
                    >
                        <Tab key="grid" title={<Squares2X2Icon className="h-5 w-5" />} />
                        <Tab key="table" title={<ListBulletIcon className="h-5 w-5" />} />
                    </Tabs>

                    <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onClick={() => setModal('new')} className="font-bold">
                        Add Budget
                    </Button>
                </div>
            </div>

            {!isLoading && sortedBudgets.length > 0 && (
                <GlassCard className="px-5 py-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-neutral-500">
                                Budget Overview
                            </p>
                            <h2 className="mt-2 text-xl font-black text-neutral-900 dark:text-white">
                                {fmt(budgetSummary.totalSpent)} / {fmt(budgetSummary.totalBudget)}
                            </h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                You have used {budgetSummary.totalPct}% of your full budget pool this period.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                            <div className="rounded-2xl border border-black/5 bg-neutral-100/70 px-4 py-3 dark:border-white/10 dark:bg-neutral-900/70">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Total budget</p>
                                <p className="mt-2 text-lg font-black text-neutral-900 dark:text-white">
                                    {fmt(budgetSummary.totalBudget)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-black/5 bg-neutral-100/70 px-4 py-3 dark:border-white/10 dark:bg-neutral-900/70">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Spent</p>
                                <p className="mt-2 text-lg font-black text-neutral-900 dark:text-white">
                                    {fmt(budgetSummary.totalSpent)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-black/5 bg-neutral-100/70 px-4 py-3 dark:border-white/10 dark:bg-neutral-900/70">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Remaining</p>
                                <p className="mt-2 text-lg font-black text-neutral-900 dark:text-white">
                                    {fmt(budgetSummary.totalRemaining)}
                                </p>
                            </div>
                        </div>
                    </div>
                </GlassCard>
            )}

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-3xl" />)}
                </div>
            ) : sortedBudgets.length === 0 ? (
                <EmptyState icon={ArchiveBoxIcon} title="No budgets yet" description="Create your first budget to start tracking your spending." action={<Button color="primary" onClick={() => setModal('new')} startContent={<PlusIcon className="h-4 w-4" />}>Create Budget</Button>} />
            ) : viewMode === 'grid' ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="budgets" direction="horizontal" isDropDisabled={false}>
                        {(provided) => (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" {...provided.droppableProps} ref={provided.innerRef}>
                                {sortedBudgets.map((b, index) => {
                                    const pct = Number(b.amount) > 0 ? Math.min(Math.round((b.spent / Number(b.amount)) * 100), 100) : 0;
                                    let statusColor = '#10b981'; // green
                                    let statusColorName = "success";
                                    if (pct >= 100) { statusColor = '#ef4444'; statusColorName = "danger"; }
                                    else if (pct >= 80) { statusColor = '#f59e0b'; statusColorName = "warning"; }

                                    return (
                                        <Draggable key={b.id} draggableId={b.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    style={provided.draggableProps.style}
                                                    className={snapshot.isDragging ? 'z-50' : ''}
                                                >
                                                    <GlassCard className={`relative space-y-6 group ${snapshot.isDragging ? 'shadow-2xl scale-105 rotate-1 ring-4 ring-primary/20' : ''}`}>
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    {...provided.dragHandleProps}
                                                                    className="cursor-grab rounded-full border border-black/5 bg-neutral-100/80 p-1 text-neutral-400 transition-colors hover:text-neutral-600 dark:border-white/10 dark:bg-neutral-900/80 dark:hover:text-neutral-200"
                                                                >
                                                                    <EllipsisVerticalIcon className="h-5 w-5" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-black text-lg text-neutral-900 dark:text-white leading-tight tracking-tight">{b.category?.name}</h3>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <Chip size="xs" variant="flat" className="h-4 text-[9px] font-black uppercase">{b.period}</Chip>
                                                                        {b.rollover && <Chip size="xs" color="primary" variant="solid" className="h-4 text-[9px] font-black">ROLLOVER</Chip>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button isIconOnly size="sm" variant="light" onClick={() => setModal(b)}>
                                                                    <PencilIcon className="h-4 w-4 text-neutral-400" />
                                                                </Button>
                                                                <Button isIconOnly size="sm" variant="light" color="primary" onClick={() => openBudgetExpense(b)}>
                                                                    <PlusIcon className="h-4 w-4" />
                                                                </Button>
                                                                <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => setConfirmDel(b.id)}>
                                                                    <TrashIcon className="h-4 w-4 text-neutral-400 hover:text-danger" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-center gap-6 pt-2">
                                                            <div className="w-32 h-32 relative">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <PieChart>
                                                                        <Pie
                                                                            data={[{ name: 'Spent', value: Number(b.spent) }, { name: 'Remaining', value: Math.max(Number(b.amount) - Number(b.spent), 0) }]}
                                                                            dataKey="value"
                                                                            innerRadius={35}
                                                                            outerRadius={55}
                                                                            startAngle={90}
                                                                            endAngle={-270}
                                                                            stroke="none"
                                                                            paddingAngle={4}
                                                                        >
                                                                            <Cell fill={statusColor} />
                                                                            <Cell fill="rgba(0,0,0,0.05)" />
                                                                        </Pie>
                                                                    </PieChart>
                                                                </ResponsiveContainer>
                                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                                    <span className="text-xl font-black" style={{ color: statusColor }}>{pct}%</span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="w-full space-y-2 text-center">
                                                                <div className="flex flex-col">
                                                                    <span className="text-2xl font-black text-neutral-900 dark:text-white tabular-nums">{fmt(b.spent)}</span>
                                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">spent of {fmt(Number(b.amount))}</span>
                                                                </div>
                                                                <Progress 
                                                                    value={pct} 
                                                                    color={statusColorName} 
                                                                    size="sm" 
                                                                    className="max-w-md mx-auto"
                                                                />
                                                            </div>
                                                        </div>
                                                    </GlassCard>
                                                </div>
                                            )}
                                        </Draggable>
                                        );
                                    })}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            ) : (
                <GlassCard className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-neutral-100/50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Category</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Period</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Limit</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Spent</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Progress</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10 dark:divide-neutral-800/20">
                                {sortedBudgets.map(b => {
                                    const pct = Number(b.amount) > 0 ? Math.min(Math.round((b.spent / Number(b.amount)) * 100), 100) : 0;
                                    let statusColor = "success";
                                    if (pct >= 100) statusColor = "danger";
                                    else if (pct >= 80) statusColor = "warning";

                                    return (
                                        <tr key={b.id} className="hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-neutral-900 dark:text-white tracking-tight">{b.category?.name}</span>
                                                    {b.rollover && <Chip size="xs" color="primary" variant="flat" className="h-4 text-[8px] font-black">ROLLOVER</Chip>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <Chip size="sm" variant="flat" className="font-bold text-[10px] uppercase">{b.period}</Chip>
                                            </td>
                                            <td className="px-6 py-5 text-right font-bold text-neutral-900 dark:text-white">{fmt(Number(b.amount))}</td>
                                            <td className="px-6 py-5 text-right font-black tabular-nums" style={{ color: `var(--heroui-${statusColor})` }}>{fmt(b.spent)}</td>
                                            <td className="px-6 py-5 text-right w-48">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[10px] font-black" style={{ color: `var(--heroui-${statusColor})` }}>{pct}%</span>
                                                    <Progress value={pct} color={statusColor} size="xs" className="w-24" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button isIconOnly size="sm" variant="light" onClick={() => setModal(b)}>
                                                        <PencilIcon className="h-4 w-4 text-neutral-400" />
                                                    </Button>
                                                    <Button isIconOnly size="sm" variant="light" color="primary" onClick={() => openBudgetExpense(b)}>
                                                        <PlusIcon className="h-4 w-4" />
                                                    </Button>
                                                    <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => setConfirmDel(b.id)}>
                                                        <TrashIcon className="h-4 w-4 text-neutral-400 hover:text-danger" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            )}

            {modal === 'new' && <BudgetModal open onClose={() => setModal(null)} />}
            {modal && modal !== 'new' && <BudgetModal open onClose={() => setModal(null)} budget={modal} />}
            {transactionModal && <TransactionModal open onClose={() => setTransactionModal(null)} transaction={transactionModal} />}
            <ConfirmModal open={!!confirmDel} title="Delete Budget" description="This budget will be deleted. Transactions will not be affected." onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
        </div>
    );
}
