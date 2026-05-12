import { Progress } from "@heroui/react";
import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
    PlusIcon, 
    PencilIcon, 
    TrashIcon, 
    CheckBadgeIcon, 
    ChevronDownIcon, 
    ChevronUpIcon,
    ArrowPathIcon,
    ArchiveBoxIcon as ArchiveIcon
} from '@heroicons/react/24/outline';
import { 
    Button, 
    Input as HeroInput, 
    Select as HeroSelect, 

    Skeleton,
    Tooltip,

    Chip,
    Card, SelectItem } from "@heroui/react";
import { useGoals, useGoalMutations, useWallets } from '@/hooks/useApi';
import { Modal, AmountInput, Field, EmptyState, ConfirmModal, useToast , GlassCard } from '@/components/ui';
import { useFormatAmount } from '@/hooks/useTranslation';

function GoalModal({ open, onClose, goal }) {
    const [form, setForm] = useState(goal ? { name: goal.name, targetAmount: Number(goal.targetAmount), currentAmount: Number(goal.currentAmount), deadline: goal.deadline ? format(new Date(goal.deadline), 'yyyy-MM-dd') : '', walletId: goal.walletId || '' } : { name: '', targetAmount: '', currentAmount: '', deadline: '', walletId: '' });
    const { create, update } = useGoalMutations();
    const { data: wallets = [] } = useWallets();
    const toast = useToast();
    const isEdit = !!goal;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) await update.mutateAsync({ id: goal.id, ...form });
            else await create.mutateAsync(form);
            toast(`Goal ${isEdit ? 'updated' : 'created'}!`, 'success');
            onClose();
        } catch (err) { toast(err.response?.data?.error?.message || 'Error', 'error'); }
    };

    const handleFormChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
                        <HeroInput 
                            type="date"
                            value={form.deadline} 
                            onChange={e => handleFormChange('deadline', e.target.value)} 
                            variant="flat"
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
                    <Button variant="light" onClick={onClose}>Cancel</Button>
                    <Button color="primary" type="submit" className="font-bold">{isEdit ? 'Save Changes' : 'Create Goal'}</Button>
                </div>
            </form>
        </Modal>
    );
}

function UpdateAmountModal({ open, onClose, goal }) {
    const [amount, setAmount] = useState(Number(goal?.currentAmount) || 0);
    const { updateAmount } = useGoalMutations();
    const toast = useToast();
    const handleSubmit = async (e) => {
        e.preventDefault();
        try { await updateAmount.mutateAsync({ id: goal.id, currentAmount: amount }); toast('Amount updated!', 'success'); onClose(); }
        catch { toast('Error', 'error'); }
    };
    return (
        <Modal open={open} onClose={onClose} title="Update Progress" size="sm">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <Field label="Current Amount">
                    <AmountInput value={amount} onChange={e => setAmount(e.target.value)} required />
                </Field>
                <div className="flex gap-2 justify-end pt-4">
                    <Button variant="light" onClick={onClose}>Cancel</Button>
                    <Button color="primary" type="submit" className="font-bold">Update</Button>
                </div>
            </form>
        </Modal>
    );
}

export function Goals() {
    const [modal, setModal] = useState(null);
    const [updateModal, setUpdateModal] = useState(null);
    const [confirmDel, setConfirmDel] = useState(null);
    const [showArchived, setShowArchived] = useState(false);
    const toast = useToast();
    const fmt = useFormatAmount();

    const { data: activeGoals = [], isLoading } = useGoals({ status: 'active' });
    const { data: archivedGoals = [] } = useGoals({ status: 'archived' });
    const { remove, update } = useGoalMutations();

    const handleDelete = async () => { try { await remove.mutateAsync(confirmDel); toast('Deleted', 'success'); } catch { toast('Error', 'error'); } setConfirmDel(null); };
    const handleArchive = (g) => update.mutateAsync({ id: g.id, status: g.status === 'archived' ? 'active' : 'archived' });

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
            ) : activeGoals.length === 0 ? (
                <EmptyState icon={CheckBadgeIcon} title="No active goals" description="Set a financial goal to start tracking your progress." action={<Button color="primary" onClick={() => setModal('new')} startContent={<PlusIcon className="h-4 w-4" />}>Create Goal</Button>} />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeGoals.map(g => {
                        const isCompleted = g.percentage >= 100;
                        const statusColor = isCompleted ? "success" : "primary";
                        
                        return (
                            <GlassCard key={g.id} className="flex flex-col space-y-6 group relative">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-xl text-neutral-900 dark:text-white tracking-tight truncate leading-tight">{g.name}</h3>
                                        {g.wallet && (
                                            <div className="flex items-center gap-1.5 mt-1 text-neutral-400 font-bold text-[10px] uppercase tracking-widest">
                                                <ArchiveIcon className="h-3 w-3" />
                                                {g.wallet.name}
                                            </div>
                                        )}
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
                                        Update Progress
                                    </Button>
                                    <Button 
                                        variant="light" 
                                        size="sm" 
                                        className="font-bold text-neutral-400"
                                        onClick={() => handleArchive(g)}
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
                                    >
                                        Restore Goal
                                    </Button>
                                </GlassCard>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {modal === 'new' && <GoalModal open onClose={() => setModal(null)} />}
            {modal && modal !== 'new' && <GoalModal open onClose={() => setModal(null)} goal={modal} />}
            {updateModal && <UpdateAmountModal open onClose={() => setUpdateModal(null)} goal={updateModal} />}
            <ConfirmModal open={!!confirmDel} title="Delete Goal" description="This goal will be permanently deleted." onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
        </div>
    );
}
