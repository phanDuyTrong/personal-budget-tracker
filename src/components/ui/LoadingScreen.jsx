import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground z-50">
            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium text-muted-foreground">Loading your finances...</p>
            </div>
        </div>
    );
};
