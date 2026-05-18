import { useDisclosure } from "@heroui/use-disclosure";
import React, { useState, useMemo } from 'react';
import { useTripsWithCost, useTripTransactions, useTripMutations } from '@/features/trips/hooks';
import { useFormatAmount } from '@/hooks/useTranslation';
import { useWallets } from '@/features/wallets/hooks';
import { useCategories } from '@/features/categories/hooks';
import { useContacts } from '@/features/contacts/hooks';
import { useTransactionMutations } from '@/features/transactions/hooks';
import { TransactionModal } from '@/pages/Transactions';
import { format, differenceInDays, parseISO } from 'date-fns';
import { 
    GlobeAmericasIcon, 
    CalculatorIcon, 
    CalendarIcon, 
    BanknotesIcon,
    PlusIcon,
    TrashIcon,
    PencilIcon,
    ChevronRightIcon,
    MapPinIcon,
    MagnifyingGlassIcon,
    DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import {
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
} from 'recharts';

import { 
    Button,
    Input,
    Select,
    SelectItem,
    Autocomplete,
    AutocompleteItem,
    Skeleton,
    Modal as HeroModal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Chip,
    Tooltip,
} from "@heroui/react";

import { 
    AmountDisplay, 
    useToast,
    ConfirmModal,
    GlassCard,
    EmptyState,
    DatePicker as CustomDatePicker,
} from '@/components/ui';
import { viFilter } from '@/lib/filters';

const CHART_COLORS = ['#FF5722', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

const normalizeSearchText = (value = '') =>
    String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();

function flattenCategories(categories) {
    const flat = [];
    const walk = (nodes, level = 0, root = null) => {
        (nodes || []).forEach((category) => {
            const currentRoot = root || category;
            flat.push({
                ...category,
                level,
                root,
                level2Name: level === 0 ? category.name : category.name,
                label: (level > 0 ? '　' : '') + category.name,
                rootName: currentRoot?.name || category.name,
            });
            if (category.children) walk(category.children, level + 1, currentRoot);
        });
    };
    walk(categories);
    return flat;
}

function collectCategoryAndDescendantIds(categories, selectedId) {
    if (!selectedId || selectedId === 'all') return [];

    const findNode = (nodes) => {
        for (const node of nodes || []) {
            if (node.id === selectedId) return node;
            const childMatch = findNode(node.children);
            if (childMatch) return childMatch;
        }
        return null;
    };

    const collectIds = (node) => [
        node.id,
        ...((node.children || []).flatMap((child) => collectIds(child))),
    ];

    const selectedNode = findNode(categories);
    return selectedNode ? collectIds(selectedNode) : [selectedId];
}

function DonutChart({ data, total, formatAmount }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeItem = data[activeIndex] || data[0];

    if (data.length === 0) {
        return <EmptyState icon={GlobeAmericasIcon} title="Chưa có chi tiêu" description="Thêm giao dịch và gắn với chuyến đi này." />;
    }

    return (
        <div className="flex flex-col items-center gap-5">
            <div className="relative flex h-64 w-64 items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={96}
                            paddingAngle={3}
                            cornerRadius={9}
                            stroke="none"
                            onMouseEnter={(_, index) => setActiveIndex(index)}
                            isAnimationActive={false}
                        >
                            {data.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute h-32 w-32 rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06),0_18px_40px_rgba(0,0,0,0.08)] dark:bg-neutral-950 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_18px_40px_rgba(0,0,0,0.25)]" />
                <div className="pointer-events-none relative z-10 max-w-[130px] text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                        {activeItem?.name || 'Tổng'}
                    </p>
                    <p className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                        {formatAmount(activeItem?.value || total)}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                {data.map((item, index) => (
                    <button
                        key={item.name}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onFocus={() => setActiveIndex(index)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                            activeIndex === index
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-neutral-200 text-neutral-500 hover:border-primary/40 dark:border-neutral-800'
                        }`}
                    >
                        <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Trip Detail View ───────────────────────────────────────────────────────
function TripDetailView({ trip, onBack, formatAmount }) {
    const { data: transactions = [], isLoading } = useTripTransactions(trip.id);
    const { data: wallets = [] } = useWallets();
    const { data: categoryTree = [] } = useCategories();
    const { data: contacts = [] } = useContacts();
    const { remove } = useTransactionMutations();
    const toast = useToast();

    const [filters, setFilters] = useState({
        search: '',
        categoryId: 'all',
        walletId: 'all',
        contactId: 'all',
        sortDate: 'newest',
    });
    const [txModal, setTxModal] = useState(null);
    const [confirmTxDel, setConfirmTxDel] = useState(null);

    const flatCats = useMemo(() => flattenCategories(categoryTree), [categoryTree]);
    const categoryMap = useMemo(() => {
        const map = new Map();
        flatCats.forEach((cat) => map.set(cat.id, cat));
        return map;
    }, [flatCats]);
    const selectedCategoryIds = useMemo(
        () => collectCategoryAndDescendantIds(categoryTree, filters.categoryId),
        [categoryTree, filters.categoryId],
    );
    const expenseTransactions = useMemo(
        () => transactions.filter((tx) => tx.type === 'expense'),
        [transactions],
    );

    const filteredTransactions = useMemo(() => {
        const search = normalizeSearchText(filters.search);
        const rows = expenseTransactions.filter((tx) => {
            const matchesSearch = !search || [
                tx.description,
                tx.category?.name,
                tx.wallet?.name,
                tx.contact?.name,
                tx.amount,
                tx.date,
            ].filter(Boolean).some((value) => normalizeSearchText(value).includes(search));
            return (
                matchesSearch &&
                (selectedCategoryIds.length === 0 || selectedCategoryIds.includes(tx.category_id)) &&
                (filters.walletId === 'all' || tx.wallet_id === filters.walletId) &&
                (filters.contactId === 'all' || tx.contact_id === filters.contactId)
            );
        });
        return [...rows].sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            return filters.sortDate === 'oldest' ? dateDiff : -dateDiff;
        });
    }, [expenseTransactions, filters, selectedCategoryIds]);

    const kpis = useMemo(() => {
        const total = expenseTransactions.reduce((s, tx) => s + Number(tx.amount), 0);
        const filteredTotal = filteredTransactions.reduce((s, tx) => s + Number(tx.amount), 0);
        const days = Math.max(differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1, 1);
        return { total, filteredTotal, avg: days > 0 ? total / days : 0, days };
    }, [expenseTransactions, filteredTransactions, trip]);

    const categorySummary = useMemo(() => {
        const groups = {};
        expenseTransactions.forEach((tx) => {
            const category = categoryMap.get(tx.category_id);
            const name = category?.level2Name || tx.category?.name || 'Khác';
            groups[name] = (groups[name] || 0) + Number(tx.amount);
        });
        let cursor = 0;
        return Object.entries(groups)
            .map(([name, value], index) => {
                const size = kpis.total > 0 ? (value / kpis.total) * 360 : 0;
                const item = {
                    name,
                    value,
                    color: CHART_COLORS[index % CHART_COLORS.length],
                    midpoint: cursor + size / 2,
                };
                cursor += size;
                return item;
            })
            .sort((a, b) => b.value - a.value);
    }, [categoryMap, expenseTransactions, kpis.total]);

    const updateFilter = (key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: key === 'search' ? (value || '') : (value || 'all'),
        }));
    };

    const openCreateExpense = () => {
        setTxModal({
            amount: '',
            type: 'expense',
            walletId: '',
            categoryId: '',
            contactId: '',
            tripId: trip.id,
            description: '',
            date: format(new Date(), 'yyyy-MM-dd'),
        });
    };

    const handleDeleteTx = async () => {
        try {
            await remove.mutateAsync(confirmTxDel);
            toast('Đã xóa giao dịch.', 'success');
        } catch {
            toast('Lỗi khi xóa giao dịch.', 'error');
        }
        setConfirmTxDel(null);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 text-sm">
                <button onClick={onBack} className="text-primary font-semibold hover:underline">
                    Theo dõi du lịch
                </button>
                <ChevronRightIcon className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-900 dark:text-white font-bold">{trip.name}</span>
            </div>

            <div>
                <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white mb-1">{trip.name}</h1>
                <div className="flex flex-wrap items-center gap-4 text-neutral-500 text-sm">
                    {trip.destination && (
                        <span className="flex items-center gap-1">
                            <MapPinIcon className="w-4 h-4" />{trip.destination}
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        {format(parseISO(trip.start_date), 'dd/MM/yyyy')} → {format(parseISO(trip.end_date), 'dd/MM/yyyy')}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="flex items-center gap-6">
                    <div className="p-4 bg-primary/10 rounded-2xl text-primary shrink-0">
                        <BanknotesIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Tổng chi phí</p>
                        <h2 className="text-2xl font-black text-neutral-900 dark:text-white">{formatAmount(kpis.total)}</h2>
                    </div>
                </GlassCard>
                <GlassCard className="flex items-center gap-6">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-500 shrink-0">
                        <CalculatorIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Trung bình/ngày</p>
                        <h2 className="text-2xl font-black text-neutral-900 dark:text-white">{formatAmount(kpis.avg)}</h2>
                    </div>
                </GlassCard>
                <GlassCard className="flex items-center gap-6">
                    <div className="p-4 bg-green-500/10 rounded-2xl text-green-500 shrink-0">
                        <CalendarIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Thời gian</p>
                        <h2 className="text-2xl font-black text-neutral-900 dark:text-white">{kpis.days} ngày</h2>
                    </div>
                </GlassCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-8">
                <GlassCard>
                    <h3 className="font-black text-xl mb-6 tracking-tight text-neutral-900 dark:text-white">Phân tích danh mục</h3>
                    <DonutChart data={categorySummary} total={kpis.total} formatAmount={formatAmount} />
                </GlassCard>

                <GlassCard>
                    <div className="mb-5">
                        <h3 className="font-black text-xl tracking-tight text-neutral-900 dark:text-white">Tổng theo danh mục cấp 2</h3>
                        <p className="text-sm text-neutral-500">Nhóm chi phí theo danh mục con trong chuyến đi.</p>
                    </div>
                    {categorySummary.length === 0 ? (
                        <EmptyState icon={GlobeAmericasIcon} title="Chưa có dữ liệu" description="Các khoản chi sẽ hiện ở đây sau khi được gắn danh mục." />
                    ) : (
                        <div className="space-y-3">
                            {categorySummary.map((item) => (
                                <div key={item.name} className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-white/[0.03]">
                                    <div className="mb-2 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="font-bold text-neutral-900 dark:text-white">{item.name}</span>
                                        </div>
                                        <span className="font-black text-neutral-900 dark:text-white">{formatAmount(item.value)}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800">
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${kpis.total ? Math.min((item.value / kpis.total) * 100, 100) : 0}%`, backgroundColor: item.color }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </GlassCard>
            </div>

            <GlassCard className="!p-0 overflow-hidden">
                <div className="space-y-5 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h3 className="font-black text-xl tracking-tight text-neutral-900 dark:text-white">Danh sách chi tiêu</h3>
                            <p className="text-sm text-neutral-500">CRUD giao dịch đã gắn với chuyến đi này.</p>
                        </div>
                        <Button color="primary" startContent={<PlusIcon className="w-4 h-4" />} onPress={openCreateExpense}>
                            Thêm chi tiêu
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                        <Input
                            isClearable
                            placeholder="Tìm mô tả..."
                            startContent={<MagnifyingGlassIcon className="h-4 w-4 text-neutral-400" />}
                            value={filters.search}
                            onValueChange={(value) => updateFilter('search', value || '')}
                            variant="flat"
                        />
                        <Autocomplete
                            placeholder="Tài khoản"
                            defaultFilter={viFilter}
                            selectedKey={filters.walletId === 'all' ? null : filters.walletId}
                            onSelectionChange={(key) => updateFilter('walletId', key || 'all')}
                            variant="flat"
                        >
                            <AutocompleteItem key="all" textValue="Tất cả tài khoản">Tất cả tài khoản</AutocompleteItem>
                            {wallets.map((wallet) => <AutocompleteItem key={wallet.id} textValue={wallet.name}>{wallet.name}</AutocompleteItem>)}
                        </Autocomplete>
                        <Autocomplete
                            placeholder="Danh mục"
                            defaultFilter={viFilter}
                            selectedKey={filters.categoryId === 'all' ? null : filters.categoryId}
                            onSelectionChange={(key) => updateFilter('categoryId', key || 'all')}
                            variant="flat"
                        >
                            <AutocompleteItem key="all" textValue="Tất cả danh mục">Tất cả danh mục</AutocompleteItem>
                            {flatCats.map((cat) => <AutocompleteItem key={cat.id} textValue={cat.name}>{cat.label}</AutocompleteItem>)}
                        </Autocomplete>
                        <Autocomplete
                            placeholder="Người liên quan"
                            defaultFilter={viFilter}
                            selectedKey={filters.contactId === 'all' ? null : filters.contactId}
                            onSelectionChange={(key) => updateFilter('contactId', key || 'all')}
                            variant="flat"
                        >
                            <AutocompleteItem key="all" textValue="Tất cả người liên quan">Tất cả người liên quan</AutocompleteItem>
                            {contacts.map((contact) => <AutocompleteItem key={contact.id} textValue={contact.name}>{contact.name}</AutocompleteItem>)}
                        </Autocomplete>
                        <Select
                            selectedKeys={[filters.sortDate]}
                            onSelectionChange={(keys) => updateFilter('sortDate', Array.from(keys)[0])}
                            variant="flat"
                        >
                            <SelectItem key="newest">Mới nhất</SelectItem>
                            <SelectItem key="oldest">Cũ nhất</SelectItem>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
                            Tổng sau filter: {filteredTransactions.length} giao dịch
                        </span>
                        <span className="text-lg font-black text-primary">{formatAmount(kpis.filteredTotal)}</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table aria-label="Trip expense transactions" removeWrapper className="bg-transparent min-w-[980px]">
                        <TableHeader>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Ngày</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Tài khoản</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Số tiền</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Danh mục</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Người liên quan</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Mô tả</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4 text-right">Thao tác</TableColumn>
                        </TableHeader>
                        <TableBody
                            isLoading={isLoading}
                            emptyContent={<EmptyState icon={GlobeAmericasIcon} title="Không có chi tiêu" description="Thử đổi filter hoặc thêm giao dịch cho chuyến đi này." />}
                        >
                            {filteredTransactions.map((tx) => (
                                <TableRow key={tx.id} className="border-b border-neutral-200 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
                                    <TableCell className="py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-neutral-900 dark:text-white">{format(parseISO(tx.date), 'MMM d, yyyy')}</span>
                                            <span className="text-xs text-neutral-500">{format(parseISO(tx.date), 'EEEE')}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 text-sm font-bold text-neutral-700 dark:text-neutral-200">{tx.wallet?.name || '—'}</TableCell>
                                    <TableCell className="py-4"><AmountDisplay amount={tx.amount} type="expense" /></TableCell>
                                    <TableCell className="py-4">
                                        <Chip size="sm" variant="flat" style={{ backgroundColor: (tx.category?.color || '#737373') + '20', color: tx.category?.color || '#737373' }}>
                                            {tx.category?.name || 'Không phân loại'}
                                        </Chip>
                                    </TableCell>
                                    <TableCell className="py-4 text-sm text-neutral-600 dark:text-neutral-300">{tx.contact?.name || '—'}</TableCell>
                                    <TableCell className="py-4">
                                        <p className="max-w-[240px] truncate text-sm text-neutral-500" title={tx.description}>{tx.description || '—'}</p>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <Tooltip content="Chỉnh sửa">
                                                <Button isIconOnly size="sm" variant="light" onPress={() => setTxModal({ intent: 'edit', data: tx })}>
                                                    <PencilIcon className="h-4 w-4 text-neutral-400" />
                                                </Button>
                                            </Tooltip>
                                            <Tooltip content="Nhân bản">
                                                <Button isIconOnly size="sm" variant="light" onPress={() => setTxModal({ intent: 'duplicate', data: { ...tx, trip_id: trip.id } })}>
                                                    <DocumentDuplicateIcon className="h-4 w-4 text-neutral-400" />
                                                </Button>
                                            </Tooltip>
                                            <Tooltip color="danger" content="Xóa">
                                                <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => setConfirmTxDel(tx.id)}>
                                                    <TrashIcon className="h-4 w-4 text-neutral-400 hover:text-danger" />
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </GlassCard>

            {txModal && (
                <TransactionModal
                    open
                    onClose={() => setTxModal(null)}
                    transaction={txModal}
                />
            )}
            <ConfirmModal
                open={!!confirmTxDel}
                title="Xóa giao dịch"
                description="Giao dịch này sẽ bị xóa vĩnh viễn."
                onConfirm={handleDeleteTx}
                onCancel={() => setConfirmTxDel(null)}
            />
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function TravelTracker() {
    const formatAmount = useFormatAmount();
    const { data: trips = [], isLoading } = useTripsWithCost();
    const { create, update, remove } = useTripMutations();
    const toast = useToast();

    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [selectedTrip, setSelectedTrip] = useState(null); // for detail view
    const [editingTrip, setEditingTrip] = useState(null);   // null = create mode
    const [confirmDel, setConfirmDel] = useState(null);
    const [form, setForm] = useState({ name: '', destination: '', startDate: '', endDate: '' });

    const isEditMode = !!editingTrip;

    const openCreate = () => {
        setEditingTrip(null);
        setForm({ name: '', destination: '', startDate: '', endDate: '' });
        onOpen();
    };

    const openEdit = (trip) => {
        setEditingTrip(trip);
        setForm({
            name: trip.name,
            destination: trip.destination || '',
            startDate: trip.start_date,
            endDate: trip.end_date,
        });
        onOpen();
    };

    const handleSave = async () => {
        if (!form.name || !form.startDate || !form.endDate) {
            toast('Vui lòng điền đầy đủ thông tin.', 'error');
            return;
        }
        try {
            if (isEditMode) {
                await update.mutateAsync({ id: editingTrip.id, ...form });
                toast('Cập nhật chuyến đi thành công!', 'success');
            } else {
                await create.mutateAsync(form);
                toast('Tạo chuyến đi thành công!', 'success');
            }
            onOpenChange(false);
        } catch {
            toast('Có lỗi xảy ra, thử lại sau.', 'error');
        }
    };

    const handleDelete = async () => {
        try {
            await remove.mutateAsync(confirmDel);
            toast('Đã xóa chuyến đi.', 'success');
            if (selectedTrip?.id === confirmDel) setSelectedTrip(null);
        } catch {
            toast('Lỗi khi xóa.', 'error');
        }
        setConfirmDel(null);
    };

    const tripDuration = (trip) => {
        try {
            return Math.max(differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1, 1);
        } catch { return '—'; }
    };

    // Show detail view when a trip is selected
    if (selectedTrip) {
        return (
            <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
                <TripDetailView
                    trip={selectedTrip}
                    onBack={() => setSelectedTrip(null)}
                    formatAmount={formatAmount}
                />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white mb-1">Theo dõi du lịch</h1>
                    <p className="text-neutral-500">Quản lý và theo dõi chi tiêu các chuyến đi của bạn</p>
                </div>
                <Button color="primary" startContent={<PlusIcon className="w-4 h-4" />} onClick={openCreate} className="font-bold">
                    Thêm chuyến đi
                </Button>
            </div>

            {/* Trips Table */}
            <GlassCard className="!p-0 overflow-hidden overflow-x-auto">
                {isLoading ? (
                    <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                ) : trips.length === 0 ? (
                    <div className="p-12">
                        <EmptyState
                            icon={GlobeAmericasIcon}
                            title="Chưa có chuyến đi nào"
                            description='Nhấn "Thêm chuyến đi" để bắt đầu theo dõi chi tiêu du lịch.'
                        />
                    </div>
                ) : (
                    <Table
                        aria-label="Trips table"
                        removeWrapper
                        className="bg-transparent min-w-[640px]"
                    >
                        <TableHeader>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Tên chuyến đi</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Điểm đến</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Thời gian</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Số ngày</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4">Tổng chi phí</TableColumn>
                            <TableColumn className="bg-neutral-100/50 dark:bg-neutral-800/50 font-bold uppercase text-xs py-4 text-right">Thao tác</TableColumn>
                        </TableHeader>
                        <TableBody>
                            {trips.map(trip => (
                                <TableRow
                                    key={trip.id}
                                    className="border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedTrip(trip)}
                                >
                                    <TableCell className="py-4">
                                        <span className="font-bold text-neutral-900 dark:text-white">{trip.name}</span>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <span className="text-neutral-500 text-sm">{trip.destination || '—'}</span>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <span className="text-sm text-neutral-500">
                                            {format(parseISO(trip.start_date), 'dd/MM/yyyy')} → {format(parseISO(trip.end_date), 'dd/MM/yyyy')}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <Chip variant="flat" size="sm" color="default">{tripDuration(trip)} ngày</Chip>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <span className="font-black text-primary">{formatAmount(trip.total_cost)}</span>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                            <Tooltip content="Chỉnh sửa">
                                                <Button isIconOnly size="sm" variant="light" onClick={() => openEdit(trip)}>
                                                    <PencilIcon className="h-4 w-4 text-neutral-400" />
                                                </Button>
                                            </Tooltip>
                                            <Tooltip color="danger" content="Xóa">
                                                <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => setConfirmDel(trip.id)}>
                                                    <TrashIcon className="h-4 w-4 text-neutral-400 hover:text-danger" />
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </GlassCard>

            {/* Create / Edit Modal */}
            <HeroModal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" size="md">
                <ModalContent className="glass-modal backdrop-blur-2xl rounded-3xl">
                    <ModalHeader className="font-black text-2xl px-6 pt-6">
                        {isEditMode ? 'Chỉnh sửa chuyến đi' : 'Thêm chuyến đi mới'}
                    </ModalHeader>
                    <ModalBody className="px-6 py-4 space-y-4">
                        <Input
                            label="Tên chuyến đi"
                            placeholder="VD: Đi Đà Lạt tháng 6"
                            variant="flat"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            isRequired
                        />
                        <Input
                            label="Điểm đến"
                            placeholder="VD: Đà Lạt, Lâm Đồng"
                            variant="flat"
                            value={form.destination}
                            onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <CustomDatePicker
                                label="Ngày bắt đầu"
                                value={form.startDate}
                                onChange={(val) => setForm(p => ({ ...p, startDate: val || '' }))}
                            />
                            <CustomDatePicker
                                label="Ngày kết thúc"
                                value={form.endDate}
                                onChange={(val) => setForm(p => ({ ...p, endDate: val || '' }))}
                            />
                        </div>
                        {form.startDate && form.endDate && (
                            <p className="text-sm text-neutral-500 text-center">
                                🗓 {Math.max(differenceInDays(new Date(form.endDate), new Date(form.startDate)) + 1, 0)} ngày
                            </p>
                        )}
                    </ModalBody>
                    <ModalFooter className="px-6 pb-6 pt-2">
                        <Button variant="light" onClick={() => onOpenChange(false)}>Hủy</Button>
                        <Button
                            color="primary"
                            onClick={handleSave}
                            className="font-bold"
                            isLoading={create.isPending || update.isPending}
                        >
                            {isEditMode ? 'Lưu thay đổi' : 'Tạo chuyến đi'}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </HeroModal>

            {/* Confirm Delete */}
            <ConfirmModal
                open={!!confirmDel}
                title="Xóa chuyến đi"
                description="Chuyến đi sẽ bị xóa vĩnh viễn. Các giao dịch liên quan vẫn được giữ lại nhưng sẽ không còn gắn với chuyến đi này nữa."
                onConfirm={handleDelete}
                onCancel={() => setConfirmDel(null)}
            />
        </div>
    );
}
