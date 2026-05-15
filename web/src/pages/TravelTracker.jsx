import { useDisclosure } from "@heroui/use-disclosure";
import React, { useState, useMemo } from 'react';
import { useTripsWithCost, useTripTransactions, useTripMutations } from '@/features/trips/hooks';
import { useFormatAmount } from '@/hooks/useTranslation';
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
} from '@heroicons/react/24/outline';
import { 
    PieChart, 
    Pie, 
    Cell, 
    ResponsiveContainer, 
    Tooltip as RechartsTooltip, 
    Legend
} from 'recharts';

import { 
    Button,
    Input,
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

const CHART_COLORS = ['#FF5722', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

// ─── Trip Detail View ───────────────────────────────────────────────────────
function TripDetailView({ trip, onBack, formatAmount }) {
    const { data: transactions = [], isLoading } = useTripTransactions(trip.id);

    const kpis = useMemo(() => {
        const total = transactions.reduce((s, tx) => s + Number(tx.amount), 0);
        const days = Math.max(differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1, 1);
        return { total, avg: days > 0 ? total / days : 0, days };
    }, [transactions, trip]);

    const pieData = useMemo(() => {
        const groups = {};
        transactions.forEach(tx => {
            const name = tx.category?.name || 'Khác';
            groups[name] = (groups[name] || 0) + Number(tx.amount);
        });
        return Object.entries(groups).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [transactions]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
                <button onClick={onBack} className="text-primary font-semibold hover:underline">
                    Theo dõi du lịch
                </button>
                <ChevronRightIcon className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-900 dark:text-white font-bold">{trip.name}</span>
            </div>

            {/* Trip Info */}
            <div>
                <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white mb-1">{trip.name}</h1>
                <div className="flex items-center gap-4 text-neutral-500 text-sm">
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card bg-primary text-white border-none shadow-xl shadow-primary/20 p-8 rounded-3xl relative overflow-hidden flex flex-col justify-end min-h-[140px]">
                    <BanknotesIcon className="absolute -right-6 -top-6 w-28 h-28 opacity-10 rotate-12" />
                    <p className="text-white/80 font-medium mb-1 uppercase tracking-wider text-xs">Tổng chi phí</p>
                    <h2 className="text-3xl font-black tracking-tight">{formatAmount(kpis.total)}</h2>
                </div>
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

            {/* Charts & Expenses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassCard>
                    <h3 className="font-black text-xl mb-6 tracking-tight">Phân tích danh mục</h3>
                    {pieData.length === 0 ? (
                        <EmptyState icon={GlobeAmericasIcon} title="Chưa có chi tiêu" description="Thêm giao dịch và gắn với chuyến đi này." />
                    ) : (
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} innerRadius={70} outerRadius={100} paddingAngle={6} dataKey="value">
                                        {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', background: 'var(--tooltip-bg, rgba(255,255,255,0.95))' }}
                                        formatter={(val) => formatAmount(val)}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </GlassCard>

                <GlassCard className="flex flex-col">
                    <h3 className="font-black text-xl mb-6 tracking-tight">Danh sách chi tiêu</h3>
                    {isLoading ? (
                        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
                    ) : transactions.length === 0 ? (
                        <EmptyState icon={GlobeAmericasIcon} title="Chưa có giao dịch" description="Gắn giao dịch với chuyến đi này để xem chi tiết." />
                    ) : (
                        <div className="space-y-3 overflow-y-auto flex-1 max-h-[360px] pr-1">
                            {transactions.map(tx => (
                                <div key={tx.id} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50/50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 hover:scale-[1.01] transition-transform">
                                    <div>
                                        <p className="font-bold text-sm text-neutral-900 dark:text-white">{tx.description || tx.category?.name || '—'}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase">{format(parseISO(tx.date), 'dd MMM yyyy')}</span>
                                            {tx.category && (
                                                <Chip size="sm" variant="flat" className="h-4 text-[9px]" style={{ backgroundColor: tx.category.color + '20', color: tx.category.color }}>
                                                    {tx.category.name}
                                                </Chip>
                                            )}
                                        </div>
                                    </div>
                                    <AmountDisplay amount={tx.amount} type="expense" className="font-black text-sm" />
                                </div>
                            ))}
                        </div>
                    )}
                </GlassCard>
            </div>
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
