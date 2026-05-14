import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, startOfWeek, startOfMonth, startOfYear, parseISO, isSameDay } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

export function TrendChart({ transactions }) {
    const { t } = useLanguage();
    const [period, setPeriod] = useState('month'); // 'week', 'month', 'year'

    const chartData = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        // Group transactions by the selected period
        const grouped = transactions.reduce((acc, tx) => {
            if (tx.type === 'transfer') return acc; // Ignore internal transfers

            const date = parseISO(tx.date);
            let periodKey;
            let displayLabel;

            if (period === 'week') {
                const start = startOfWeek(date, { weekStartsOn: 1 });
                periodKey = format(start, 'yyyy-MM-dd');
                displayLabel = format(start, 'MMM dd');
            } else if (period === 'month') {
                const start = startOfMonth(date);
                periodKey = format(start, 'yyyy-MM');
                displayLabel = format(start, 'MMM yyyy');
            } else { // year
                const start = startOfYear(date);
                periodKey = format(start, 'yyyy');
                displayLabel = format(start, 'yyyy');
            }

            if (!acc[periodKey]) {
                acc[periodKey] = { label: displayLabel, periodKey, income: 0, expense: 0, sortDate: parseISO(periodKey).getTime() };
            }

            const amount = parseFloat(tx.amount);
            if (tx.type === 'income') {
                acc[periodKey].income += amount;
            } else if (tx.type === 'expense') {
                acc[periodKey].expense += amount;
            }

            return acc;
        }, {});

        // Convert to array and sort chronologically (oldest to newest for the chart)
        return Object.values(grouped).sort((a, b) => a.sortDate - b.sortDate);
    }, [transactions, period]);

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>{t('financialTrends') || 'Financial Trends'}</CardTitle>
                <div className="flex gap-2">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-md border bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    >
                        <option value="week">Weekly</option>
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                    </select>
                </div>
            </CardHeader>
            <CardContent>
                {chartData.length > 0 ? (
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="label" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" name="Income" />
                                <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" name="Expense" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Not enough data to show trends.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
