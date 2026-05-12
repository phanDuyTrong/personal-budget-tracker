import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2, BrainCircuit } from 'lucide-react';
import { aiService } from '@/services/ai';
import { Button } from '@/components/ui/button';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function SmartChart({ transactions }) {
    const [insightData, setInsightData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchInsight = async () => {
        setLoading(true);
        try {
            // Mocking a backup basic insight to show quickly if AI fails or takes too long,
            // but ideally we wait for AI.
            const result = await aiService.getInsights(transactions);
            if (result) setInsightData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Auto-fetch if we have data
        if (transactions.length > 0 && !insightData) {
            // fetchInsight(); 
            // Note: To save API tokens, maybe we require a user click or debounce?
            // For "Premium" feel, let's do it automatically but only once per session/mount?
            // Or just let user click "Analyze".
        }
    }, [transactions]);

    if (transactions.length === 0) {
        return (
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    No transactions yet. Add some to get insights!
                </CardContent>
            </Card>
        )
    }

    const renderChart = () => {
        if (!insightData) return null;

        const { chartType, chartData } = insightData;

        if (chartType === 'pie') {
            return (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }} />
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        // Default to Bar
        return (
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.2)' }} contentStyle={{ borderRadius: '8px', border: 'none', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    return (
        <Card className="col-span-4 border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>AI Insights</CardTitle>
                        <CardDescription>
                            {insightData ? "Analysis based on your recent activity" : "Ask AI to analyze your spending habits"}
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchInsight} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
                        {insightData ? "Regenerate" : "Analyze"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-0">
                {insightData ? (
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                            <span className="font-semibold text-primary">Insight: </span>
                            {insightData.insight}
                        </div>
                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                            <h4 className="text-sm font-medium mb-4 text-center">{insightData.chartTitle}</h4>
                            {renderChart()}
                        </div>
                    </div>
                ) : (
                    <div className="h-[200px] flex items-center justify-center rounded-xl border border-dashed text-muted-foreground">
                        Click Analyze to generate chart
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
