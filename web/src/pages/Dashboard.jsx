import { Progress as HeroProgress } from "@heroui/react";
import React, { useState, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import {
    useDashboardKPIs,
    useBudgetHealth,
    useTopCategories
} from '@/features/dashboard/hooks';
import { useCalculatedWallets } from '@/features/wallets/hooks';
import { useFormatAmount } from '@/hooks/useTranslation';
import { AmountDisplay, CategoryBadge , GlassCard } from '@/components/ui';
import {
    Skeleton,

    Select,

    Chip,
    Card, SelectItem } from "@heroui/react";
import {
    WalletIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    BanknotesIcon,
    ChartPieIcon,
    CalendarIcon,
    CreditCardIcon,
    ArrowUpIcon,
    ArrowDownIcon
} from '@heroicons/react/24/outline';
import { useSettingsStore } from '@/stores/settingsStore';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { getMonthRangeByParts, getVietnamDateParts } from '@/lib/date';

const PREDEFINED_WALLET_ORDER = ["Tài khoản", "Tiền mặt", "Tiết kiệm", "Vàng", "Chứng khoán", "Crypto", "Trading"];

// Framer Motion Variants
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export function Dashboard() {
    const fmt = useFormatAmount();
    const { hideBalances } = useSettingsStore();

    const todayParts = useMemo(() => getVietnamDateParts(), []);
    const [dashMonth, setDashMonth] = useState(todayParts.month - 1);
    const [dashYear, setDashYear] = useState(todayParts.year);

    const dateFilter = useMemo(() => {
        const { from, to } = getMonthRangeByParts(dashYear, dashMonth + 1);
        return { date_from: from, date_to: to };
    }, [dashMonth, dashYear]);

    const { data: kpis, isLoading: kpiLoading } = useDashboardKPIs(dateFilter);
    const { data: budgetHealth, isLoading: bhLoading } = useBudgetHealth(dateFilter);
    const [topCatLimit, setTopCatLimit] = useState("5");
    const { data: topCats, isLoading: tcLoading } = useTopCategories({ ...dateFilter, limit: Number(topCatLimit) });
    const { data: walletsRaw, isLoading: accLoading } = useCalculatedWallets();

    const wallets = useMemo(() => {
        const raw = walletsRaw || [];
        return [...raw].sort((a, b) => {
            const idxA = PREDEFINED_WALLET_ORDER.indexOf(a.name);
            const idxB = PREDEFINED_WALLET_ORDER.indexOf(b.name);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [walletsRaw]);

    const fmtMasked = (amount) => hideBalances ? '***' : fmt(amount);

    const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(i);
        return d.toLocaleString('en-US', { month: 'long' });
    });

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    return (
        <Motion.div
            className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Header & Filters */}
            <Motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">Overview</h1>
                    <p className="text-neutral-500">Your financial snapshot for this month</p>
                </div>

                <div className="flex items-center gap-3">
                    <Select
                        aria-label="Select month"
                        className="w-40"
                        selectedKeys={[`${dashMonth}`]}
                        onSelectionChange={(keys) => setDashMonth(Number(Array.from(keys)[0]))}
                        variant="flat"
                        startContent={<CalendarIcon className="w-4 h-4 text-neutral-400" />}
                    >
                        {months.map((m, i) => (
                            <SelectItem key={`${i}`} textValue={m}>{m}</SelectItem>
                        ))}
                    </Select>
                    <Select
                        aria-label="Select year"
                        className="w-32"
                        selectedKeys={[`${dashYear}`]}
                        onSelectionChange={(keys) => setDashYear(Number(Array.from(keys)[0]))}
                        variant="flat"
                    >
                        {years.map(y => (
                            <SelectItem key={`${y}`} textValue={`${y}`}>{y}</SelectItem>
                        ))}
                    </Select>
                </div>
            </Motion.div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <GlassCard className="relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                <WalletIcon className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total Balance</p>
                        </div>
                        {kpiLoading ? <Skeleton className="h-10 w-3/4 rounded-xl" /> : (
                            <p className="text-3xl font-black tabular-nums text-neutral-900 dark:text-white tracking-tight leading-none">
                                {fmtMasked(kpis?.totalBalance || 0)}
                            </p>
                        )}
                    </div>
                </GlassCard>

                <GlassCard className="relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-success/10 rounded-full blur-2xl group-hover:bg-success/20 transition-all" />
                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success shadow-inner">
                                <ArrowTrendingUpIcon className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Income</p>
                        </div>
                        {kpiLoading ? <Skeleton className="h-10 w-3/4 rounded-xl" /> : (
                            <p className="text-3xl font-black tabular-nums text-success tracking-tight leading-none">
                                +{fmtMasked(kpis?.monthlyIncome || 0)}
                            </p>
                        )}
                    </div>
                </GlassCard>

                <GlassCard className="relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-danger/10 rounded-full blur-2xl group-hover:bg-danger/20 transition-all" />
                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center text-danger shadow-inner">
                                <ArrowTrendingDownIcon className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Expenses</p>
                        </div>
                        {kpiLoading ? <Skeleton className="h-10 w-3/4 rounded-xl" /> : (
                            <p className="text-3xl font-black tabular-nums text-danger tracking-tight leading-none">
                                -{fmtMasked(kpis?.monthlyExpenses || 0)}
                            </p>
                        )}
                    </div>
                </GlassCard>

                <GlassCard className="relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-secondary/10 rounded-full blur-2xl group-hover:bg-secondary/20 transition-all" />
                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner">
                                <BanknotesIcon className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Savings Rate</p>
                        </div>
                        {kpiLoading ? <Skeleton className="h-10 w-3/4 rounded-xl" /> : (
                            <div className="flex items-end justify-between">
                                <p className="text-3xl font-black tabular-nums text-neutral-900 dark:text-white tracking-tight leading-none">
                                    {(kpis?.savingsRate || 0).toFixed(1)}%
                                </p>
                                {typeof kpis?.deltas?.savingsRate === 'number' && (
                                    <Chip
                                        size="sm"
                                        color={kpis.deltas.savingsRate > 0 ? "success" : "danger"}
                                        variant="flat"
                                        startContent={kpis.deltas.savingsRate > 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                                        className="h-6 font-black"
                                    >
                                        {Math.abs(kpis.deltas.savingsRate).toFixed(1)}%
                                    </Chip>
                                )}
                            </div>
                        )}
                    </div>
                </GlassCard>
            </div>

            {/* Trend Chart */}
            <TrendChart />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Budget Health */}
                <GlassCard className="xl:col-span-2 !p-0 flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-white/20 dark:border-neutral-800/20 flex items-center gap-3">
                        <div className="w-2 h-6 rounded-full bg-primary" />
                        <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Budget Health</h2>
                    </div>
                    <div className="px-6 pb-6 pt-4 space-y-6">
                        {bhLoading ? (
                            <div className="space-y-6">
                                {Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between"><Skeleton className="h-5 w-24 rounded-lg" /><Skeleton className="h-5 w-16 rounded-lg" /></div>
                                        <Skeleton className="h-2 w-full rounded-full" />
                                    </div>
                                ))}
                            </div>
                        ) : (!budgetHealth || budgetHealth.length === 0) ? (
                            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                                <ChartPieIcon className="w-16 h-16 mb-4 opacity-20" />
                                <p className="font-bold uppercase tracking-widest text-xs">No active budgets this period</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {budgetHealth.map((b, i) => {
                                    const percent = Math.min(b.percentage, 100);
                                    let barColor = "primary";
                                    if (b.percentage > 90) barColor = "danger";
                                    else if (b.percentage > 75) barColor = "warning";

                                    return (
                                        <Motion.div
                                            key={b.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                        >
                                            <div className="flex justify-between items-end mb-3">
                                                <div>
                                                    <span className="font-black text-neutral-900 dark:text-white text-lg tracking-tight block leading-tight">{b.category?.name || 'Unknown'}</span>
                                                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1 block">{b.percentage.toFixed(0)}% Utilized</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-neutral-900 dark:text-white tabular-nums">{fmtMasked(b.spent)}</span>
                                                    <span className="text-xs font-bold text-neutral-400 mx-2">/</span>
                                                    <span className="text-xs font-bold text-neutral-500">{fmtMasked(b.amount)}</span>
                                                </div>
                                            </div>
                                            <HeroProgress
                                                size="md"
                                                value={percent}
                                                color={barColor}
                                                aria-label={`${b.category?.name} budget`}
                                                className="shadow-sm"
                                            />
                                        </Motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </GlassCard>

                {/* Sidebar: Top Expenses & Wallets */}
                <div className="space-y-8 flex flex-col">

                    {/* Top Expenses */}
                    <GlassCard className="!p-0 flex flex-col h-fit overflow-hidden">
                        <div className="p-6 border-b border-white/20 dark:border-neutral-800/20 flex items-center justify-between">
                            <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">Top Expenses</h2>
                            <Select
                                className="w-28"
                                selectedKeys={[topCatLimit]}
                                onSelectionChange={(keys) => setTopCatLimit(Array.from(keys)[0])}
                                variant="flat"
                                size="sm"
                            >
                                <SelectItem key="5" textValue="Top 5">Top 5</SelectItem>
                                <SelectItem key="10" textValue="Top 10">Top 10</SelectItem>
                                <SelectItem key="20" textValue="Top 20">Top 20</SelectItem>
                                <SelectItem key="9999" textValue="All">All</SelectItem>
                            </Select>
                        </div>
                        <div className="px-6 pb-6 pt-4">
                            {tcLoading ? (
                                <div className="space-y-3">
                                    {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-2xl" />)}
                                </div>
                            ) : (!topCats || topCats.length === 0) ? (
                                <p className="text-center py-10 text-[10px] font-black text-neutral-400 uppercase tracking-widest">No expenses recorded</p>
                            ) : (
                                <div className="space-y-2">
                                    {topCats.slice(0, Number(topCatLimit)).map((cat, i) => (
                                        <div
                                            key={cat.id || i}
                                            className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/40 dark:hover:bg-white/5 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-black text-neutral-400 group-hover:text-primary transition-colors">
                                                    {i + 1}
                                                </div>
                                                <CategoryBadge category={cat} />
                                            </div>
                                            <AmountDisplay amount={cat.total} type="expense" className="font-black text-sm" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </GlassCard>

                    {/* Wallets Summary */}
                    <GlassCard className="!p-0 flex flex-col h-fit overflow-hidden">
                        <div className="p-6 border-b border-white/20 dark:border-neutral-800/20">
                            <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">Your Wallets</h2>
                        </div>
                        <div className="px-6 pb-6 pt-4 space-y-4">
                            {accLoading ? (
                                <div className="space-y-4">
                                    {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-3xl" />)}
                                </div>
                            ) : wallets.length === 0 ? (
                                <p className="text-center py-10 text-[10px] font-black text-neutral-400 uppercase tracking-widest">No wallets added</p>
                            ) : (
                                <div className="space-y-4">
                                    {wallets.map((acc, i) => {
                                        const gradients = [
                                            'from-blue-500 to-indigo-600',
                                            'from-emerald-400 to-teal-600',
                                            'from-rose-400 to-red-600',
                                            'from-amber-400 to-orange-500',
                                            'from-fuchsia-500 to-purple-600'
                                        ];
                                        const grad = gradients[i % gradients.length];

                                        return (
                                            <Motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.1 }}
                                                key={acc.id}
                                                className={`relative overflow-hidden rounded-[1.5rem] p-5 text-white shadow-lg bg-gradient-to-br ${grad} hover:scale-[1.02] transition-transform`}
                                            >
                                                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                                                <div className="absolute right-4 top-4 opacity-50">
                                                    <CreditCardIcon className="w-8 h-8" />
                                                </div>
                                                <div className="relative z-10">
                                                    <p className="font-black text-xs opacity-90 truncate max-w-[150px] tracking-widest uppercase mb-1">{acc.name}</p>
                                                    <p className="font-black text-2xl tabular-nums tracking-tight">
                                                        {fmtMasked(acc.liveBalance)}
                                                    </p>
                                                    <p className="text-[10px] font-bold opacity-60 uppercase mt-1 tracking-wider">{acc.type}</p>
                                                </div>
                                            </Motion.div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </GlassCard>

                </div>
            </div>
        </Motion.div>
    );
}
