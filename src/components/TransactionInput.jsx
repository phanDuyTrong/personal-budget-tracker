import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/services/store';
import { aiService } from '@/services/ai';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export function TransactionInput({ className }) {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { wallets, addTransaction } = useStore();
    const [preview, setPreview] = useState(null);
    const { t } = useLanguage();

    const handleParse = async () => {
        if (!input.trim()) return;
        setLoading(true);
        setPreview(null);
        try {
            const result = await aiService.parseTransaction(input, wallets);

            // Resolve wallet names to IDs
            const fromWallet = wallets.find(w => w.name.toLowerCase() === result.fromWalletName?.toLowerCase());
            const toWallet = wallets.find(w => w.name.toLowerCase() === result.toWalletName?.toLowerCase());

            setPreview({
                ...result,
                fromWalletId: fromWallet?.id || wallets[0].id, // Fallback
                toWalletId: toWallet?.id
            });
        } catch (error) {
            console.error(error);
            alert(`Failed to understand transaction. Error: ${error.message || "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (preview) {
            addTransaction(preview);
            setInput('');
            setPreview(null);
        }
    }

    return (
        <Card className={cn("w-full relative overflow-hidden border-primary/20 bg-card/50 backdrop-blur-sm", className)}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                    {t('aiTransaction')}
                </CardTitle>
                <CardDescription>
                    {t('transactionInputPlaceholder')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="relative">
                    <Textarea
                        placeholder={t('inputPlaceholder')}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="pr-12 resize-none min-h-[80px] bg-background/50 focus:bg-background transition-colors"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleParse();
                            }
                        }}
                    />
                    <Button
                        size="icon"
                        className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
                        onClick={handleParse}
                        disabled={loading || !input}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    </Button>
                </div>

                {/* Preview Section */}
                {preview && (
                    <div className="rounded-lg border bg-muted/50 p-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                                <p className="font-semibold text-lg flex items-center gap-2">
                                    {preview.type === 'expense' ? '-' : '+'}${preview.amount}
                                    <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {preview.category}
                                    </span>
                                </p>
                                <p className="text-sm text-muted-foreground">{preview.description}</p>
                            </div>
                        </div>

                        <Button className="w-full" onClick={handleConfirm}>
                            {t('confirmTransaction')}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
