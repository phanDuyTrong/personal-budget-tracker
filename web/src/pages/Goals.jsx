import { Progress } from "@heroui/progress";
import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
    PlusIcon, 
    PencilIcon, 
    TrashIcon, 
    CheckBadgeIcon, 
    ExclamationTriangleIcon,
    ChevronDownIcon, 
    ChevronUpIcon,
    ArrowPathIcon,
    ArchiveBoxIcon as ArchiveIcon
} from '@heroicons/react/24/outline';
import { Button } from "@heroui/button";
import { Input as HeroInput } from "@heroui/input";
import { Select as HeroSelect, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { Card } from "@heroui/card";
import { useLocation, useNavigate } from 'react-router-dom';
import { useGoals, useGoalMutations } from '@/features/goals/hooks';
import { useWallets } from '@/features/wallets/hooks';
import { useTransactionMutations } from '@/features/transactions/hooks';
import { Modal, AmountInput, Field, EmptyState, ConfirmModal, GlassCard, DatePicker as CustomDatePicker } from '@/components/ui';
import { useToast } from '@/components/ui/useToast';
import { useFormatAmount } from '@/hooks/useTranslation';
import { parseMoneyInput } from '@/lib/money';
import { toISODate } from '@/lib/date';

function GoalModal({ open, onClose, goal, initialValues = null }) {
    const buildFormState = React.useCallback(() => {
        if (goal?.id) {
            return {
                name: goal.name,
                targetAmount: Number(goal.targetAmount),
                currentAmount: Number(goal.currentAmount),
                deadline: goal.deadline ? format(new Date(goal.deadline), 'yyyy-MM-dd') : '',
                walletId: goal.walletId || '',
            };
        }

        return {
            name: initialValues?.name || '',
            targetAmount: initialValues?.targetAmount || '',
            currentAmount: initialValues?.currentAmount || '',
            deadline: initialValues?.deadline || '',
            walletId: initialValues?.walletId || '',
        };
    }, [goal, initialValues]);
    const [form, setForm] = useState(buildFormState);
    const { create, update } = useGoalMutations();
    const { data: wallets = [] } = useWallets();
    const toast = useToast();
    const isEdit = !!goal?.id;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) await update.mutateAsync({ id: goal.id, ...form });
            else await create.mutateAsync(form);
            toast(`Goal ${isEdit ? 'updated' : 'created'}!`, 'success');
            onClose();
        } catch (err) {
            toast(err instanceof Error ? err.message : 'Error saving goal', 'error');
        }
    };

    const handleFormChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        setForm(buildFormState());
    }, [buildFormState]);

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Goal' : 'New Goal'}>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <HeroInput 
                    label="Goal Name"
                    placeholder="e.g. Emergency Fund" 
                    value={form.name} 
                    onChange={e => handleFormChange('name', e.target.value)} 
                    required 
                    variant="flat"
                />
                
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Target Amount">
                        <AmountInput placeholder="10000" value={form.targetAmount} onChange={e => handleFormChange('targetAmount', e.target.value)} required />
                    </Field>
                    <Field label="Current Amount">
                        <AmountInput placeholder="0.00" value={form.currentAmount} onChange={e => handleFormChange('currentAmount', e.target.value)} />
                    </Field>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Deadline">
                        <CustomDatePicker
                            value={form.deadline}
                            onChange={(val) => handleFormChange('deadline', val || '')}
                        />
                    </Field>
                    <HeroSelect 
                        label="Linked Wallet"
                        placeholder="None"
                        selectedKeys={form.walletId ? [form.walletId] : []}
                        onSelectionChange={keys => handleFormChange('walletId', Array.from(keys)[0])}
                        variant="flat"
                    >
                        {wallets.map(a => <SelectItem key={a.id} textValue={a.name}>{a.name}</SelectItem>)}
                    </HeroSelect>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <Button variant="light" onClick={onClose} isDisabled={create.isPending || update.isPending}>Cancel</Button>
                    <Button color="primary" type="submit" className="font-bold" isLoading={create.isPending || update.isPending}>{isEdit ? 'Save Changes' : 'Create Goal'}</Button>
                </div>
            </form>
        </Modal>
    );
}

function UpdateAmountModal({ open, onClose, goal }) {
    const [amount, setAmount] = useState('');
    const [mode, setMode] = useState('add');
    const [logTransaction, setLogTransaction] = useState(!!goal?.walletId);
    const [transactionDate, setTransactionDate] = useState(toISODate(new Date()));
    const { updateAmount } = useGoalMutations();
    const { create: createTransaction } = useTransactionMutations();
    const toast = useToast();
    const fmt = useFormatAmount();
    const currentAmount = Number(goal?.currentAmount || 0);
    const enteredAmount = amount === '' ? 0 : parseMoneyInput(amount);
    const previewAmount = mode === 'add' ? currentAmount + enteredAmount : enteredAmount;
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateAmount.mutateAsync({ id: goal.id, currentAmount: amount, mode });
            if (mode === 'add' && logTransaction && goal?.walletId) {
                await createTransaction.mutateAsync({
                    amount,
                    type: 'income',
                    walletId: goal.walletId,
                    categoryId: '',
                    contactId: '',
                    tripId: '',
                    description: `Contribution to ${goal.name}`,
                    date: transactionDate,
                    isRecurring: false,
                    isDebt: false,
                    toWalletId: '',
                });
            }
            toast(
                mode === 'add'
                    ? (logTransaction && goal?.walletId ? 'Contribution added and transaction logged!' : 'Contribution added!')
                    : 'Progress updated!',
                'success',
            );
            onClose();
        }
        catch (err) { toast(err instanceof Error ? err.message : 'Error updating amount', 'error'); }
    };
    return (
        <Modal open={open} onClose={onClose} title="Update Goal Progress" size="sm">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <HeroSelect
                    label="Mode"
                    selectedKeys={[mode]}
                    onSelectionChange={keys => setMode(Array.from(keys)[0])}
                    variant="flat"
                >
                    <SelectItem key="add" textValue="Add contribution">Add contribution</SelectItem>
                    <SelectItem key="set" textValue="Set exact total">Set exact total</SelectItem>
                </HeroSelect>
                <Field label="Current Amount">
                    <AmountInput
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder={mode === 'add' ? 'How much did you add?' : 'Set current total'}
                        required
                    />
                </Field>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        Preview
                    </p>
                    <p className="mt-2 text-lg font-black text-neutral-900 dark:text-white">
                        {fmt(currentAmount)} → {fmt(previewAmount)}
                    </p>
                    {goal?.walletId && (
                        <p className="mt-1 text-xs text-neutral-500">
                            This goal is linked to a wallet, so you can log the matching transaction from the Transactions or Budget flow.
                        </p>
                    )}
                </div>
                {goal?.walletId && mode === 'add' && (
                    <div className="space-y-4 rounded-2xl border border-success/15 bg-success/5 p-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="log-goal-transaction"
                                checked={logTransaction}
                                onChange={(e) => setLogTransaction(e.target.checked)}
                                className="rounded border-neutral-300 dark:border-neutral-700 bg-transparent text-primary focus:ring-primary"
                            />
                            <label htmlFor="log-goal-transaction" className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                Also log a matching transaction to the linked wallet
                            </label>
                        </div>
                        {logTransaction && (
                            <Field label="Transaction Date">
                                <CustomDatePicker
                                    value={transactionDate}
                                    onChange={(value) => setTransactionDate(value || toISODate(new Date()))}
                                />
                            </Field>
                        )}
                    </div>
                )}
                <div className="flex gap-2 justify-end pt-4">
                    <Button variant="light" onClick={onClose} isDisabled={updateAmount.isPending || createTransaction.isPending}>Cancel</Button>
                    <Button color="primary" type="submit" className="font-bold" isLoading={updateAmount.isPending || createTransaction.isPending}>
                        {mode === 'add' ? 'Add Contribution' : 'Save Total'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export function Goals() {
    const location = useLocation();
    const navigate = useNavigate();
    const [modal, setModal] = useState(null);
    const [updateModal, setUpdateModal] = useState(null);
    const [confirmDel, setConfirmDel] = useState(null);
    const [showArchived, setShowArchived] = useState(false);
    const toast = useToast();
    const fmt = useFormatAmount();
    const queryClient = useQueryClient();
    const routePrefillGoal = location.state?.prefillGoal || null;

    const {
        data: visibleGoals = [],
        isLoading,
        isError: isVisibleGoalsError,
        error: visibleGoalsError,
    } = useGoals({ excludeStatus: 'archived' });
    const {
        data: archivedGoals = [],
        isError: isArchivedGoalsError,
        error: archivedGoalsError,
    } = useGoals({ status: 'archived' });
    const { data: wallets = [] } = useWallets();
    const { remove, update } = useGoalMutations();
    const walletNameById = React.useMemo(
        () => Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name])),
        [wallets],
    );
    const goalsErrorMessage =
        (visibleGoalsError instanceof Error && visibleGoalsError.message) ||
        (archivedGoalsError instanceof Error && archivedGoalsError.message) ||
        'Could not load goals.';

    const handleDelete = async () => { try { await remove.mutateAsync(confirmDel); toast('Deleted', 'success'); } catch (err) { toast(err instanceof Error ? err.message : 'Error deleting goal', 'error'); } setConfirmDel(null); };
    const handleArchive = async (g) => {
        const nextStatus = g.status === 'archived' ? 'active' : 'archived';
        try {
            await update.mutateAsync({ id: g.id, status: nextStatus });
            toast(nextStatus === 'archived' ? 'Goal archived' : 'Goal restored', 'success');
        } catch (err) {
            toast(err instanceof Error ? err.message : 'Error updating goal', 'error');
        }
    };

    const handleGoalModalClose = React.useCallback(() => {
        setModal(null);
        if (routePrefillGoal) {
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location.pathname, navigate, routePrefillGoal]);

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">Goals</h1>
                    <p className="text-neutral-500">Track your financial milestones</p>
                </div>
                <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onClick={() => setModal('new')} className="font-bold">
                    New Goal
                </Button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}
                </div>
            ) : isVisibleGoalsError || isArchivedGoalsError ? (
                <EmptyState
                    icon={ExclamationTriangleIcon}
                    title="Could not load goals"
                    description={goalsErrorMessage}
                    action={
                        <Button color="primary" onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['goals'] });
                            queryClient.invalidateQueries({ queryKey: ['wallets'] });
                        }}>
                            Reload
                        </Button>
                    }
                />
            ) : visibleGoals.length === 0 ? (
                <EmptyState icon={CheckBadgeIcon} title="No active goals" description="Set a financial goal to start tracking your progress." action={<Button color="primary" onClick={() => setModal('new')} startContent={<PlusIcon className="h-4 w-4" />}>Create Goal</Button>} />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleGoals.map(g => {
                        const isCompleted = g.percentage >= 100;
                        const statusColor = isCompleted ? "success" : "primary";
                        const walletName = g.wallet?.name || walletNameById[g.walletId];
                        
                        return (
                            <GlassCard key={g.id} className="flex flex-col space-y-6 group relative">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-xl text-neutral-900 dark:text-white tracking-tight truncate leading-tight">{g.name}</h3>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-neutral-400 font-bold text-[10px] uppercase tracking-widest">
                                            {walletName && (
                                                <>
                                                    <ArchiveIcon className="h-3 w-3" />
                                                    {walletName}
                                                </>
                                            )}
                                            {!walletName && (
                                                <span className="text-warning">
                                                    Link a wallet to connect this goal with transactions
                                                </span>
                                            )}
                                            {g.status === 'completed' && (
                                                <Chip size="sm" color="success" variant="flat" className="h-5">
                                                    Completed
                                                </Chip>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Tooltip content="Edit">
                                            <Button isIconOnly size="sm" variant="light" onClick={() => setModal(g)}>
                                                <PencilIcon className="h-4 w-4 text-neutral-400" />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content="Delete" color="danger">
                                            <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => setConfirmDel(g.id)}>
                                                <TrashIcon className="h-4 w-4 text-neutral-400 hover:text-danger" />
                                            </Button>
                                        </Tooltip>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-end justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-3xl font-black text-neutral-900 dark:text-white tabular-nums leading-none">
                                                {fmt(g.currentAmount)}
                                            </span>
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-2">
                                                Target: {fmt(g.targetAmount)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`text-2xl font-black ${isCompleted ? 'text-success' : 'text-primary'}`}>{g.percentage}%</span>
                                            {g.daysLeft !== null && (
                                                <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${g.daysLeft < 30 ? 'text-danger' : 'text-neutral-400'}`}>
                                                    {g.daysLeft} days left
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <Progress 
                                        value={g.percentage} 
                                        color={statusColor} 
                                        size="md" 
                                        className="shadow-inner"
                                    />

                                    {g.requiredMonthlySaving && !isCompleted && (
                                        <div className="bg-primary/5 rounded-2xl p-3 border border-primary/10">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest text-center">
                                                Need to save {fmt(g.requiredMonthlySaving)} per month
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-white/20 dark:border-neutral-800/20">
                                    <Button 
                                        variant="flat" 
                                        color="primary" 
                                        className="flex-1 font-bold" 
                                        size="sm"
                                        startContent={<ArrowPathIcon className="h-4 w-4" />}
                                        onClick={() => setUpdateModal(g)}
                                    >
                                        Add Contribution
                                    </Button>
                                    {g.walletId ? (
                                        <Button
                                            variant="light"
                                            size="sm"
                                            className="font-bold"
                                            onClick={() => navigate('/transactions', {
                                                state: {
                                                    openTransaction: {
                                                        amount: '',
                                                        type: 'income',
                                                        walletId: g.walletId,
                                                        categoryId: '',
                                                        contactId: '',
                                                        tripId: '',
                                                        description: `Contribution to ${g.name}`,
                                                        date: toISODate(new Date()),
                                                        isRecurring: false,
                                                        isDebt: false,
                                                        toWalletId: '',
                                                    },
                                                },
                                            })}
                                        >
                                            Log Transaction
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="light"
                                            size="sm"
                                            className="font-bold"
                                            onClick={() => setModal({ mode: 'edit', goal: g })}
                                        >
                                            Link Wallet
                                        </Button>
                                    )}
                                    <Button 
                                        variant="light" 
                                        size="sm"
                                        className="font-bold text-neutral-400"
                                        onClick={() => handleArchive(g)}
                                        isLoading={update.isPending}
                                    >
                                        Archive
                                    </Button>
                                </div>
                            </GlassCard>
                        );
                    })}
                </div>
            )}

            {/* Archived Section */}
            {archivedGoals.length > 0 && (
                <div className="pt-8 space-y-6">
                    <button 
                        onClick={() => setShowArchived(s => !s)} 
                        className="flex items-center gap-2 group"
                    >
                        <h2 className="text-xl font-black text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors tracking-tight uppercase tracking-widest text-sm">
                            Archived Goals ({archivedGoals.length})
                        </h2>
                        {showArchived ? <ChevronUpIcon className="h-4 w-4 text-neutral-400" /> : <ChevronDownIcon className="h-4 w-4 text-neutral-400" />}
                    </button>
                    
                    {showArchived && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {archivedGoals.map(g => (
                                <GlassCard key={g.id} className="p-5 opacity-60 hover:opacity-100 transition-opacity">
                                    <h4 className="font-black text-neutral-900 dark:text-white truncate">{g.name}</h4>
                                    <p className="text-xs font-bold text-neutral-400 mt-1 uppercase tracking-widest">{fmt(g.currentAmount)} / {fmt(g.targetAmount)}</p>
                                    <Button 
                                        variant="light" 
                                        size="sm" 
                                        color="primary" 
                                        className="mt-3 font-bold px-0 h-auto min-w-0" 
                                        onClick={() => handleArchive(g)}
                                        isLoading={update.isPending}
                                    >
                                        Restore Goal
                                    </Button>
                                </GlassCard>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {modal === 'new' && <GoalModal open onClose={handleGoalModalClose} />}
            {!modal && routePrefillGoal && <GoalModal open onClose={handleGoalModalClose} initialValues={routePrefillGoal} />}
            {modal?.mode === 'new' && <GoalModal open onClose={handleGoalModalClose} initialValues={modal.initialValues} />}
            {modal?.mode === 'edit' && <GoalModal open onClose={handleGoalModalClose} goal={modal.goal} />}
            {modal && modal !== 'new' && !modal?.mode && <GoalModal open onClose={handleGoalModalClose} goal={modal} />}
            {updateModal && <UpdateAmountModal key={updateModal.id} open onClose={() => setUpdateModal(null)} goal={updateModal} />}
            <ConfirmModal open={!!confirmDel} title="Delete Goal" description="This goal will be permanently deleted." onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
        </div>
    );
}
