import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { TransactionInput } from '@/components/TransactionInput';
import { useLanguage } from '@/contexts/LanguageContext';

export function AIAssistant() {
    const { t } = useLanguage();

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        size="icon"
                        className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-105"
                        aria-label={t('aiTransaction')}
                    >
                        <Sparkles className="h-6 w-6 text-primary-foreground animate-pulse" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] sm:w-[400px] p-0 mr-4 mb-2 border-none shadow-2xl bg-transparent" side="top" align="end">
                    <TransactionInput className="border-none shadow-none bg-card" />
                </PopoverContent>
            </Popover>
        </div>
    );
}
