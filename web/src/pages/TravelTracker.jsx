import { useDisclosure } from "@heroui/use-disclosure";
import React, { useState, useMemo } from 'react';
import { useAllTransactions, useTrips, useTripMutations, useCategories } from '@/hooks/useApi';
import { useT, useFormatAmount } from '@/hooks/useTranslation';
import { format, differenceInDays, parseISO, isWithinInterval } from 'date-fns';
import { 
    GlobeAmericasIcon, 
    CalculatorIcon, 
    CalendarIcon, 
    BanknotesIcon,
    PlusIcon,
    TrashIcon
} from '@heroicons/react/24/outline';
import { 
    PieChart, 
    Pie, 
    Cell, 
    ResponsiveContainer, 
    Tooltip, 
    Legend
} from 'recharts';

import { 
    Select, 

    Button,
    Input,
    Skeleton,
    Modal as HeroModal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,

    Chip, SelectItem } from "@heroui/react";

import { 
    AmountDisplay, 
    useToast 
, GlassCard } from '@/components/ui';


export function TravelTracker() {
    const t = useT();
    const formatAmount = useFormatAmount();
    const { data: categories = [] } = useCategories();
    const { data: transactions = [], isLoading: isTxLoading } = useAllTransactions({ type: 'expense' });
    const { data: trips = [], isLoading: isTripsLoading } = useTrips();
    const { create: createTrip, remove: removeTrip } = useTripMutations();
    const toast = useToast();
    
    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const [selectedTripId, setSelectedTripId] = useState('all');
    const [newTrip, setNewTrip] = useState({ name: '', startDate: '', endDate: '' });

    // 1. Identify "Du lịch" (Travel) category and its sub-categories
    const travelCategoryIds = useMemo(() => {
        const findTravel = (nodes) => {
            for (const node of nodes) {
                if (node.name.toLowerCase().includes('du lịch') || node.name.toLowerCase().includes('travel')) {
                    return node;
                }
                if (node.children) {
                    const found = findTravel(node.children);
                    if (found) return found;
                }
            }
            return null;
        };

        const travelNode = findTravel(categories);
        if (!travelNode) return new Set();

        const ids = new Set();
        const collectIds = (node) => {
            ids.add(node.id);
            if (node.children) node.children.forEach(collectIds);
        };
        collectIds(travelNode);
        return ids;
    }, [categories]);

    // 2. Filter transactions that belong to Travel category
    const travelTransactions = useMemo(() => {
        return transactions.filter(tx => travelCategoryIds.has(tx.category_id));
    }, [transactions, travelCategoryIds]);

    // 3. Filter transactions based on selected trip's timeframe
    const filteredTransactions = useMemo(() => {
        if (selectedTripId === 'all') return travelTransactions;
        
        const trip = trips.find(t => t.id === selectedTripId);
        if (!trip) return [];

        const start = parseISO(trip.start_date);
        const end = parseISO(trip.end_date);

        return travelTransactions.filter(tx => {
            const txDate = parseISO(tx.date);
            return isWithinInterval(txDate, { start, end });
        });
    }, [travelTransactions, trips, selectedTripId]);

    // KPI Calculations
    const kpis = useMemo(() => {
        if (filteredTransactions.length === 0) return { total: 0, avg: 0, days: 0 };
        
        const total = filteredTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
        
        let days = 1;
        if (selectedTripId !== 'all') {
            const trip = trips.find(t => t.id === selectedTripId);
            days = Math.max(differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1, 1);
        } else {
            const dates = filteredTransactions.map(tx => parseISO(tx.date));
            days = Math.max(differenceInDays(new Date(Math.max(...dates)), new Date(Math.min(...dates))) + 1, 1);
        }
        
        return { total, avg: total / days, days };
    }, [filteredTransactions, selectedTripId, trips]);

    // Chart Data: Sub-category Breakdown
    const subCategoryData = useMemo(() => {
        const groups = {};
        filteredTransactions.forEach(tx => {
            const catName = tx.category?.name || 'Other';
            groups[catName] = (groups[catName] || 0) + Number(tx.amount);
        });
        return Object.entries(groups)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredTransactions]);

    const handleCreateTrip = async () => {
        try {
            await createTrip.mutateAsync(newTrip);
            onOpenChange(false);
            setNewTrip({ name: '', startDate: '', endDate: '' });
            toast("Trip created successfully!", "success");
        } catch (err) {
            toast("Error creating trip", "error");
        }
    };

    if (isTxLoading || isTripsLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-1/4 rounded-lg" /><Skeleton className="h-64 rounded-3xl" /></div>;

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2 text-neutral-900 dark:text-white">{t('travel.title')}</h1>
                    <p className="text-neutral-500">Track and manage your travel expenses</p>
                </div>
                <div className="flex gap-2">
                    <Select 
                        className="w-full md:w-72"
                        placeholder="Select a trip"
                        selectedKeys={[selectedTripId]}
                        onSelectionChange={keys => setSelectedTripId(Array.from(keys)[0])}
                        variant="flat"
                    >
                        <SelectItem key="all">All Time</SelectItem>
                        {trips.map(trip => (
                            <SelectItem key={trip.id} textValue={trip.name}>
                                {trip.name} ({format(parseISO(trip.start_date), 'dd/MM')} - {format(parseISO(trip.end_date), 'dd/MM')})
                            </SelectItem>
                        ))}
                    </Select>
                    <Button isIconOnly color="primary" onClick={onOpen}>
                        <PlusIcon className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card bg-primary dark:bg-primary-500/20 text-white border-none shadow-xl shadow-primary/20 dark:shadow-none p-8 rounded-3xl relative overflow-hidden flex flex-col justify-end min-h-[160px]">
                    <BanknotesIcon className="absolute -right-6 -top-6 w-32 h-32 opacity-10 rotate-12" />
                    <p className="text-white/80 font-medium mb-1 uppercase tracking-wider text-xs">{t('travel.totalCost')}</p>
                    <h2 className="text-4xl font-black tracking-tight">{formatAmount(kpis.total)}</h2>
                </div>
                
                <GlassCard className="flex items-center gap-6">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-500 shrink-0">
                        <CalculatorIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">{t('travel.dailyAvg')}</p>
                        <h2 className="text-2xl font-black text-neutral-900 dark:text-white">{formatAmount(kpis.avg)}</h2>
                    </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-6">
                    <div className="p-4 bg-green-500/10 rounded-2xl text-green-500 shrink-0">
                        <CalendarIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">{t('travel.tripDuration')}</p>
                        <h2 className="text-2xl font-black text-neutral-900 dark:text-white">{kpis.days} {t('travel.days')}</h2>
                    </div>
                </GlassCard>
            </div>

            {/* Charts & Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassCard>
                    <h3 className="font-black text-xl mb-8 tracking-tight">Category Breakdown</h3>
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={subCategoryData} innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                                    {subCategoryData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={[`#FF5722`, '#10b981', '#6366f1', '#f59e0b', '#ec4899'][index % 5]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '16px', 
                                        border: 'none', 
                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                        background: 'var(--tooltip-bg, rgba(255,255,255,0.95))'
                                    }} 
                                    formatter={(val) => formatAmount(val)} 
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                <GlassCard className="flex flex-col">
                    <h3 className="font-black text-xl mb-8 tracking-tight">Expenses</h3>
                    <div className="space-y-3 overflow-y-auto pr-2 flex-1 max-h-[320px]">
                        {filteredTransactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                                <GlobeAmericasIcon className="w-12 h-12 mb-4 opacity-20" />
                                <p>No transactions in this period</p>
                            </div>
                        ) : (
                            filteredTransactions.map(tx => (
                                <div key={tx.id} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50/50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 hover:scale-[1.01] transition-transform">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm text-neutral-900 dark:text-white">{tx.description || tx.category?.name}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase">{format(parseISO(tx.date), 'dd MMM yyyy')}</span>
                                            <Chip size="xs" variant="flat" className="h-4 text-[9px]" style={{ backgroundColor: tx.category?.color + '20', color: tx.category?.color }}>
                                                {tx.category?.name}
                                            </Chip>
                                        </div>
                                    </div>
                                    <AmountDisplay amount={tx.amount} type="expense" className="font-black text-sm" />
                                </div>
                            ))
                        )}
                    </div>
                </GlassCard>
            </div>

            {/* Add Trip Modal */}
            <HeroModal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" size="md">
                <ModalContent className="glass-modal backdrop-blur-2xl rounded-3xl">
                    <ModalHeader className="font-black text-2xl px-6 pt-6">New Trip Period</ModalHeader>
                    <ModalBody className="px-6 py-4 space-y-4">
                        <Input 
                            label="Trip Name"
                            placeholder="e.g. Summer Vacation 2024"
                            variant="flat"
                            value={newTrip.name}
                            onChange={e => setNewTrip({...newTrip, name: e.target.value})}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Start Date"
                                type="date"
                                variant="flat"
                                value={newTrip.startDate}
                                onChange={e => setNewTrip({...newTrip, startDate: e.target.value})}
                            />
                            <Input 
                                label="End Date"
                                type="date"
                                variant="flat"
                                value={newTrip.endDate}
                                onChange={e => setNewTrip({...newTrip, endDate: e.target.value})}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 pb-6 pt-2">
                        <Button variant="light" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button color="primary" onClick={handleCreateTrip} className="font-bold">Create Trip</Button>
                    </ModalFooter>
                </ModalContent>
            </HeroModal>
        </div>
    );
}
