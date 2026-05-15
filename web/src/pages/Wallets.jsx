import React, { useState } from 'react';
import { 
    PlusIcon, 
    PencilIcon, 
    TrashIcon, 
    WalletIcon, 
    CreditCardIcon, 
    ArchiveBoxIcon, 
    ArrowTrendingUpIcon, 
    BanknotesIcon, 
    CurrencyDollarIcon 
} from '@heroicons/react/24/outline';
import { 
    Button, 
    Input as HeroInput, 
    Select as HeroSelect, 

    Skeleton,
    Tooltip,
    Modal as HeroModal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter, SelectItem } from "@heroui/react";
import { useCalculatedWallets, useWalletMutations } from '@/features/wallets/hooks';
import { 
    Modal, 
    AmountInput, 
    Field, 
    EmptyState, 
    ConfirmModal, 
    useToast 
, GlassCard } from '@/components/ui';
import { useFormatAmount } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/settingsStore';

const WALLET_TYPES = [
    { value: 'checking', label: 'Checking', icon: WalletIcon },
    { value: 'savings', label: 'Savings', icon: ArchiveBoxIcon },
    { value: 'cash', label: 'Cash', icon: BanknotesIcon },
    { value: 'credit', label: 'Credit Card', icon: CreditCardIcon },
    { value: 'investment', label: 'Investment', icon: ArrowTrendingUpIcon },
    { value: 'other', label: 'Other', icon: CurrencyDollarIcon },
];

function WalletModal({ open, onClose, wallet }) {
    const isEdit = !!wallet;
    const [form, setForm] = useState(isEdit
        ? { name: wallet.name, type: wallet.type || 'checking', balance: String(wallet.balance ?? 0) }
        : { name: '', type: 'checking', balance: '0' }
    );
    const { create, update } = useWalletMutations();
    const toast = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { name: form.name, type: form.type };
            if (isEdit) await update.mutateAsync({ id: wallet.id, ...payload });
            else await create.mutateAsync({ ...payload, balance: parseFloat(form.balance) || 0 });
            toast(`Wallet ${isEdit ? 'updated' : 'created'}!`, 'success');
            onClose();
        } catch (err) { toast(err.message || 'Error', 'error'); }
    };

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? `Edit "${wallet.name}"` : 'New Wallet'}>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <HeroInput 
                    label="Wallet Name"
                    placeholder="e.g. Main Checking" 
                    value={form.name} 
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                    required 
                    variant="flat"
                />

                <HeroSelect
                    label="Wallet Type"
                    selectedKeys={[form.type]}
                    onSelectionChange={keys => setForm(f => ({ ...f, type: Array.from(keys)[0] }))}
                    variant="flat"
                >
                    {WALLET_TYPES.map(t => <SelectItem key={t.value} textValue={t.label}>{t.label}</SelectItem>)}
                </HeroSelect>

                <Field label="Opening Balance">
                    <AmountInput
                        value={form.balance}
                        onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                        isDisabled={isEdit}
                        required={!isEdit}
                    />
                    {isEdit && (
                        <p className="mt-2 text-xs font-medium text-neutral-500">
                            Opening balance is locked after creation; live balance comes from transactions.
                        </p>
                    )}
                </Field>

                <div className="flex gap-2 justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <Button variant="light" onClick={onClose}>Cancel</Button>
                    <Button color="primary" type="submit" className="font-bold">{isEdit ? 'Save Changes' : 'Create Wallet'}</Button>
                </div>
            </form>
        </Modal>
    );
}

export function Wallets() {
    const [modal, setModal] = useState(null); // null | 'new' | wallet object
    const [confirmDel, setConfirmDel] = useState(null);
    const { data: walletsRaw = [], isLoading } = useCalculatedWallets();
    const { remove } = useWalletMutations();
    const toast = useToast();
    const fmt = useFormatAmount();
    const { hideBalances, walletOrder } = useSettingsStore();

    const fmtMasked = (amount) => hideBalances ? '***' : fmt(amount);

    const handleDelete = async (wallet) => {
        try {
            await remove.mutateAsync(wallet.id);
            toast('Wallet removed', 'success');
        } catch { toast('Error deleting wallet', 'error'); }
        setConfirmDel(null);
    };

    const wallets = [...walletsRaw].sort((a, b) => {
        const indexA = walletOrder?.indexOf(a.id) ?? -1;
        const indexB = walletOrder?.indexOf(b.id) ?? -1;
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    const totalBalance = wallets.reduce((s, a) => s + Number(a.liveBalance), 0);

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">Wallets</h1>
                    <p className="text-neutral-500">Manage your bank accounts, wallets, and cards</p>
                </div>
                <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onClick={() => setModal('new')} className="font-bold">
                    New Wallet
                </Button>
            </div>

            {/* Total Balance Card */}
            {wallets.length > 0 && (
                <div className="bg-primary text-white p-8 rounded-[2rem] shadow-xl shadow-primary/20 relative overflow-hidden flex flex-col justify-end min-h-[160px]">
                    <WalletIcon className="absolute -right-8 -top-8 w-48 h-48 opacity-10 rotate-12" />
                    <p className="text-white/80 font-bold uppercase tracking-widest text-xs mb-1">Total Balance (all wallets)</p>
                    <h2 className="text-4xl font-black tabular-nums">{fmtMasked(totalBalance)}</h2>
                    <p className="text-sm font-medium opacity-60 mt-2">{wallets.length} active wallet{wallets.length !== 1 ? 's' : ''}</p>
                </div>
            )}

            {/* Wallet Grid */}
            {isLoading ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
                </div>
            ) : wallets.length === 0 ? (
                <EmptyState icon={WalletIcon} title="No wallets yet"
                    description="Add your checking accounts, credit cards, and cash wallets to start tracking your finances."
                    action={<Button color="primary" onClick={() => setModal('new')} startContent={<PlusIcon className="h-4 w-4" />}>Add First Wallet</Button>} />
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {wallets.map(acc => {
                        const typeInfo = WALLET_TYPES.find(t => t.value === acc.type) || WALLET_TYPES[0];
                        const isNegative = Number(acc.liveBalance) < 0;
                        const Icon = typeInfo.icon;
                        
                        return (
                            <GlassCard key={acc.id} className="group relative flex flex-col justify-between min-h-[160px]">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-primary/10 dark:bg-primary/20">
                                        <Icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Tooltip content="Edit">
                                            <Button isIconOnly size="sm" variant="light" onClick={() => setModal(acc)}>
                                                <PencilIcon className="h-4 w-4 text-neutral-400" />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content="Delete" color="danger">
                                            <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => setConfirmDel(acc)}>
                                                <TrashIcon className="h-4 w-4 text-neutral-400 hover:text-danger" />
                                            </Button>
                                        </Tooltip>
                                    </div>
                                </div>
                                <div className="mt-4 flex-1">
                                    <h3 className="font-black text-lg truncate text-neutral-900 dark:text-white leading-tight">{acc.name}</h3>
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1 inline-block opacity-60">
                                        {typeInfo.label}
                                    </span>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/20 dark:border-neutral-800/20">
                                    <p className={`text-2xl font-black tabular-nums ${isNegative ? 'text-danger' : 'text-neutral-900 dark:text-white'}`}>
                                        {fmtMasked(acc.liveBalance)}
                                    </p>
                                </div>
                            </GlassCard>
                        );
                    })}
                </div>
            )}

            {modal && (
                <WalletModal open onClose={() => setModal(null)} wallet={modal === 'new' ? null : modal} />
            )}
            <ConfirmModal
                open={!!confirmDel}
                title={`Remove "${confirmDel?.name}"?`}
                description="The wallet will be hidden. Transactions linked to it are preserved."
                onConfirm={() => handleDelete(confirmDel)}
                onCancel={() => setConfirmDel(null)}
            />
        </div>
    );
}
