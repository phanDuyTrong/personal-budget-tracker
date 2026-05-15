import React from 'react';
import {
    useDashboardKPIs,
    useBudgetHealth,
    useTopCategories
} from '@/features/dashboard/hooks';
import { useCalculatedWallets } from '@/features/wallets/hooks';
import { useFormatAmount } from '@/hooks/useTranslation';
import { TermBox, TermInputPrompt, AsciiProgressBar, AsciiSparkline } from '@/components/terminal';

export function TerminalDashboard() {
    const fmt = useFormatAmount();
    
    const dashMonth = new Date().getMonth();
    const dashYear = new Date().getFullYear();

    const dateFilter = React.useMemo(() => {
        const from = new Date(dashYear, dashMonth, 1).toISOString().split('T')[0];
        const to = new Date(dashYear, dashMonth + 1, 0).toISOString().split('T')[0];
        return { date_from: from, date_to: to };
    }, [dashMonth, dashYear]);

    const { data: kpis, isLoading: kpiLoading } = useDashboardKPIs(dateFilter);
    const { data: budgetHealth, isLoading: bhLoading } = useBudgetHealth(dateFilter);
    const { data: topCats, isLoading: tcLoading } = useTopCategories(dateFilter);
    const { data: walletsRaw, isLoading: accLoading } = useCalculatedWallets();

    const wallets = walletsRaw || [];

    const loadingText = "LOADING_DATA...................";

    return (
        <div className="space-y-6">
            
            {/* Command Input Simulation */}
            <TermInputPrompt 
                command={`./start_dashboard --month=${dashMonth + 1} --year=${dashYear}`} 
                className="mb-6" 
            />

            {/* Grid Layout (Tmux splits) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* KPI WINDOW */}
                <TermBox title="SYSTEM_METRICS">
                    {kpiLoading ? <p>{loadingText}</p> : (
                        <div className="space-y-2 uppercase">
                            <div className="flex border-b border-[var(--color-term-muted)] py-1">
                                <span className="w-1/2">{'>>'} TOTAL_FUNDS</span>
                                <span className="w-1/2 text-right">{fmt(kpis?.totalBalance || 0)}</span>
                            </div>
                            <div className="flex border-b border-[var(--color-term-muted)] py-1">
                                <span className="w-1/2" style={{ color: 'var(--color-term-secondary)' }}>{'>>'} INFLOW_RATE</span>
                                <span className="w-1/2 text-right">+{fmt(kpis?.monthlyIncome || 0)}</span>
                            </div>
                            <div className="flex border-b border-[var(--color-term-muted)] py-1">
                                <span className="w-1/2" style={{ color: 'var(--color-term-error)' }}>{'>>'} DRAIN_RATE</span>
                                <span className="w-1/2 text-right">-{fmt(kpis?.monthlyExpenses || 0)}</span>
                            </div>
                            <div className="flex py-1">
                                <span className="w-1/2">{'>>'} EFFICIENCY</span>
                                <span className="w-1/2 text-right">
                                    {(kpis?.savingsRate || 0).toFixed(1)}%
                                    {kpis?.deltas?.savingsRate > 0 ? ' [UP]' : ' [DN]'}
                                </span>
                            </div>
                        </div>
                    )}
                </TermBox>

                {/* WALLETS WINDOW */}
                <TermBox title="ACTIVE_NODES">
                    {accLoading ? <p>{loadingText}</p> : (
                        <div className="space-y-2 uppercase max-h-[160px] overflow-y-auto w-full pr-2">
                            {wallets.length === 0 ? <p>ERR_NO_NODES_FOUND</p> : wallets.map((acc, i) => (
                                <div key={acc.id} className="flex justify-between items-center text-sm border-b border-dashed border-[var(--color-term-muted)] pb-1 mb-1">
                                    <span>#{String(i).padStart(2, '0')} {acc.name.substring(0, 15).padEnd(15, ' ')}</span>
                                    <span>
                                        {acc.type === 'cash' ? '[CASH]' : '[BANK]'} 
                                        <span className="ml-4 tabular-nums w-24 inline-block text-right">{fmt(acc.liveBalance)}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </TermBox>

                {/* BUDGET HEALTH WINDOW */}
                <TermBox title="RESOURCE_ALLOCATION" className="lg:col-span-2">
                    {bhLoading ? <p>{loadingText}</p> : (
                        <div className="font-mono text-sm space-y-3">
                            {(!budgetHealth || budgetHealth.length === 0) ? <p>WARNING: RESOURCE PARAMETERS UNDEFINED</p> : budgetHealth.map(b => {
                                let color = 'var(--color-term-primary)';
                                if (b.percentage >= 90) color = 'var(--color-term-error)';
                                else if (b.percentage >= 75) color = 'var(--color-term-secondary)';

                                return (
                                    <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <div className="w-32 truncate uppercase">{b.category?.name || 'UNKNOWN'}</div>
                                        <div className="flex-1 flex items-center">
                                            <AsciiProgressBar current={b.spent} max={Number(b.amount)} width={30} color={color} />
                                        </div>
                                        <div className="w-32 text-right tabular-nums whitespace-nowrap" style={{ color }}>
                                            {fmt(b.spent)} / {fmt(Number(b.amount))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </TermBox>

                {/* TOP CATEGORIES WINDOW */}
                <TermBox title="PROCESS_DRAIN" className="lg:col-span-2">
                    {tcLoading ? <p>{loadingText}</p> : (
                        <div className="space-y-2 uppercase text-sm">
                            {(topCats || []).length === 0 ? <p>NO_PROCESS_LOGS_FOUND</p> : (topCats || []).map((cat, i) => (
                                <div key={cat.id} className="flex items-center gap-4 border-b border-dotted border-[var(--color-term-muted)] py-1 hover:bg-[var(--color-term-primary)] hover:text-[var(--color-term-bg)] cursor-crosshair transition-none">
                                    <span className="w-6">[0{i+1}]</span>
                                    <span className="w-32 truncate">{cat.name}</span>
                                    <span className="flex-1 text-[var(--color-term-secondary)] text-center tracking-widest">
                                       <AsciiSparkline data={cat.sparkline} />
                                    </span>
                                    <span className="w-24 text-right tabular-nums text-[var(--color-term-error)]">{fmt(cat.total)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </TermBox>

            </div>
        </div>
    );
}
