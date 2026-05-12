import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrend } from '@/hooks/useApi';
import { useSettingsStore } from '@/stores/settingsStore';
import { useFormatAmount } from '@/hooks/useTranslation';
import { Skeleton } from '@/components/ui';
import { 
    ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { Tabs, Tab } from "@heroui/react";

const CustomTooltip = ({ active, payload, label, fmtMasked }) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-modal backdrop-blur-2xl p-6 rounded-[1.5rem] shadow-2xl min-w-[220px]">
                <p className="font-black mb-4 text-neutral-900 dark:text-white border-b border-white/10 dark:border-neutral-800/20 pb-3 tracking-tight">{label}</p>
                <div className="space-y-3">
                    {payload.map((entry, index) => (
                        <div key={index} className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                                <span className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">
                                    {entry.name}
                                </span>
                            </div>
                            <span className="font-black tabular-nums text-neutral-900 dark:text-white">
                                {fmtMasked(entry.value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export function TrendChart() {
    const [period, setPeriod] = useState('month'); // week | month | year
    const { data: trendData, isLoading } = useTrend(period);
    const { hideBalances } = useSettingsStore();
    const fmt = useFormatAmount();
    
    const fmtMasked = (amount) => hideBalances ? '***' : fmt(amount);
    const fmtAxis = (value) => {
        if (hideBalances) return '***';
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
        return value;
    };

    const periods = [
        { id: 'day', label: 'Daily' },
        { id: 'week', label: 'Weekly' },
        { id: 'month', label: 'Monthly' },
        { id: 'year', label: 'Yearly' }
    ];

    return (
        <div className="flex flex-col glass-card w-full rounded-[2.5rem] backdrop-blur-xl shadow-sm overflow-hidden">
            <div className="p-8 w-full text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-3">
                            <span className="w-2 h-6 rounded-full bg-primary inline-block"></span>
                            Cash Flow & Net Worth
                        </h2>
                        <p className="text-sm font-medium text-neutral-500 mt-1">Track your income, expenses, and overall balance over time</p>
                    </div>
                    
                    <Tabs
                        selectedKey={period}
                        onSelectionChange={setPeriod}
                        variant="flat"
                        size="md"
                        color="primary"
                        classNames={{ cursor: "dark:!bg-neutral-800" }}
                    >
                        {periods.map(p => (
                            <Tab key={p.id} title={p.label} />
                        ))}
                    </Tabs>
                </div>

                <div className="h-[380px] w-full">
                    {isLoading ? (
                        <div className="w-full h-full flex flex-col justify-end pt-10">
                            <Skeleton className="h-full w-full rounded-[2rem]" />
                        </div>
                    ) : (!trendData || trendData.length === 0) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 py-12">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4 opacity-20">
                                <span className="text-2xl">📊</span>
                            </div>
                            <p className="font-bold uppercase tracking-widest text-[10px]">Not enough data to display trend</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-neutral-100 dark:text-neutral-800/40" />
                                <XAxis 
                                    dataKey="label" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }} 
                                    className="text-neutral-400 uppercase tracking-widest"
                                    dy={15}
                                />
                                <YAxis 
                                    yAxisId="left"
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }}
                                    tickFormatter={fmtAxis}
                                    className="text-neutral-400"
                                    dx={-10}
                                />
                                <YAxis 
                                    yAxisId="right"
                                    orientation="right"
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fontWeight: 700, fill: 'currentColor' }}
                                    tickFormatter={fmtAxis}
                                    className="text-neutral-400"
                                    dx={10}
                                />
                                <Tooltip content={<CustomTooltip fmtMasked={fmtMasked} />} cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 8 }} />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36} 
                                    iconType="circle"
                                    wrapperStyle={{ paddingTop: '30px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }} 
                                />
                                
                                <Bar yAxisId="left" dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                                <Bar yAxisId="left" dataKey="expense" name="Expense" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={32} />
                                <Area 
                                    yAxisId="right"
                                    type="monotone" 
                                    dataKey="netWorth" 
                                    name="Net Worth" 
                                    stroke="var(--color-primary)" 
                                    strokeWidth={4}
                                    fill="url(#colorNetWorth)" 
                                    activeDot={{ r: 8, strokeWidth: 0, fill: 'var(--color-primary)' }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
