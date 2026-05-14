import React from 'react';
import { useStore } from '@/services/store';
import { useLanguage } from '@/contexts/LanguageContext';
import { SmartChart } from '@/components/dashboard/SmartChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { ExpenseCategoryChart } from '@/components/dashboard/ExpenseCategoryChart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Eye, EyeOff, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';

export default function Dashboard() {
    const { wallets, transactions, walletOrder, settings, updateSettings, updateWalletOrder } = useStore();
    const { t } = useLanguage();
    const [isRearranging, setIsRearranging] = React.useState(false);

    const sortedWallets = [...wallets].sort((a, b) => {
        const indexA = walletOrder?.indexOf(a.id) ?? -1;
        const indexB = walletOrder?.indexOf(b.id) ?? -1;
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);

    const toggleVisibility = () => {
        updateSettings({ ...settings, hideBalances: !settings?.hideBalances });
    };

    const handleMoveLeft = (index) => {
        if (index === 0) return;
        const currentOrder = sortedWallets.map(w => w.id);
        const newOrder = [...currentOrder];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        updateWalletOrder(newOrder);
    };

    const handleMoveRight = (index) => {
        if (index === sortedWallets.length - 1) return;
        const currentOrder = sortedWallets.map(w => w.id);
        const newOrder = [...currentOrder];
        [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
        updateWalletOrder(newOrder);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Hero Section */}
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-6">
                    {/* Total Balance */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-muted-foreground text-sm font-medium uppercase tracking-wider">{t('totalBalance')}</h2>
                            <button onClick={toggleVisibility} className="text-muted-foreground hover:text-foreground transition-colors">
                                {settings?.hideBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <div className="text-4xl md:text-5xl font-bold tracking-tighter">
                            {settings?.hideBalances ? '******' : `$${totalBalance.toLocaleString()}`}
                        </div>
                    </div>

                    {/* Wallets Header */}
                    <div className="flex items-center justify-between pt-4">
                        <h3 className="text-lg font-semibold">Wallets</h3>
                        <button
                            onClick={() => setIsRearranging(!isRearranging)}
                            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full transition-colors ${isRearranging ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                        >
                            <Settings2 className="h-4 w-4" />
                            Rearrange
                        </button>
                    </div>

                    {/* Wallets Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {sortedWallets.map((w, index) => (
                            <Card key={w.id} className="bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors relative group">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">{w.name}</CardTitle>
                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {settings?.hideBalances ? '***' : `$${w.balance.toLocaleString()}`}
                                    </div>
                                    <p className="text-xs text-muted-foreground capitalize">{w.type}</p>
                                </CardContent>

                                {/* Overlay for rearranging */}
                                {isRearranging && (
                                    <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] flex items-center justify-center gap-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleMoveLeft(index)} disabled={index === 0} className="p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50 hover:bg-primary/90 shadow-sm transition-transform active:scale-95">
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleMoveRight(index)} disabled={index === sortedWallets.length - 1} className="p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50 hover:bg-primary/90 shadow-sm transition-transform active:scale-95">
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                </div>

            </div>

            {/* Financial Trends */}
            <div className="pt-6">
                <TrendChart transactions={transactions} />
            </div>

            {/* Insights & Recent */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6 pb-12">
                <div className="lg:col-span-2 space-y-6">
                    <ExpenseCategoryChart transactions={transactions} />
                    <SmartChart transactions={transactions} />
                </div>

                <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm h-fit">
                    <h3 className="text-lg font-semibold">{t('recentTransactions')}</h3>
                    <div className="space-y-3">
                        {transactions.slice(0, 5).map(t => (
                            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors">
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">{t.description}</span>
                                    <span className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                        {new Date(t.date).toLocaleDateString()}
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1">{t.category}</Badge>
                                    </span>
                                </div>
                                <div className={`font-bold text-sm ${t.type === 'expense' ? 'text-destructive' : 'text-emerald-500'}`}>
                                    {t.type === 'expense' ? '-' : '+'}${parseFloat(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
