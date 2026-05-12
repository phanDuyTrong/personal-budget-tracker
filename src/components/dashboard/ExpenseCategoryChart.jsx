import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';

const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'
];

export function ExpenseCategoryChart({ transactions }) {
    const { t } = useLanguage();

    const chartData = useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        const expenses = transactions.filter(tx => tx.type === 'expense');

        const categoryTotals = expenses.reduce((acc, tx) => {
            const cat = tx.category || 'Other';
            if (!acc[cat]) {
                acc[cat] = 0;
            }
            acc[cat] += parseFloat(tx.amount);
            return acc;
        }, {});

        const data = Object.keys(categoryTotals).map(key => ({
            name: key,
            value: categoryTotals[key]
        }));

        // Sort by value descending
        return data.sort((a, b) => b.value - a.value).slice(0, 10); // Show top 10 categories
    }, [transactions]);

    return (
        <Card className="col-span-1 border-none shadow-none bg-transparent lg:col-span-2">
            <CardHeader className="px-0 pt-0">
                <CardTitle>{t('expensesByCategory') || 'Expenses By Category'}</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                {chartData.length > 0 ? (
                    <div className="h-[300px] w-full rounded-xl border bg-card p-4 shadow-sm">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => `$${value.toFixed(2)}`}
                                    contentStyle={{ borderRadius: '8px', border: 'none', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[300px] rounded-xl border border-dashed flex items-center justify-center text-muted-foreground">
                        No expenses recorded yet.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
