import React, { useCallback, useState } from 'react';
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { ToastContext } from './toast-context';

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const add = useCallback((message, type = 'info', options = 3500) => {
        const duration = typeof options === 'number' ? options : (options.duration ?? 3500);
        const id = Math.random().toString(36);
        setToasts((current) => [
            ...current,
            { id, message, type, actionLabel: options.actionLabel, onAction: options.onAction },
        ]);
        setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), duration);
    }, []);

    const remove = (id) => setToasts((current) => current.filter((item) => item.id !== id));

    const iconColorMap = {
        success: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
        error: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
        info: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    };

    const icons = {
        success: <CheckCircleIcon className="h-5 w-5" />,
        error: <ExclamationCircleIcon className="h-5 w-5" />,
        info: <InformationCircleIcon className="h-5 w-5" />,
    };

    return (
        <ToastContext.Provider value={add}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] w-full max-w-sm space-y-3 pointer-events-none">
                {toasts.map((toast) => {
                    const { bg, color } = iconColorMap[toast.type] || iconColorMap.info;
                    return (
                        <div
                            key={toast.id}
                            className="pointer-events-auto flex items-center gap-4 rounded-[1.5rem] p-4 shadow-2xl glass-modal backdrop-blur-2xl animate-in slide-in-from-right-full duration-300"
                        >
                            <div style={{ background: bg, color }} className="p-2 rounded-xl shrink-0">
                                {icons[toast.type]}
                            </div>
                            <span className="flex-1 text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                                {toast.message}
                            </span>
                            {toast.actionLabel && (
                                <button
                                    onClick={() => {
                                        toast.onAction?.();
                                        remove(toast.id);
                                    }}
                                    className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-black text-white transition-colors hover:bg-primary dark:bg-white dark:text-neutral-950"
                                >
                                    {toast.actionLabel}
                                </button>
                            )}
                            <button
                                onClick={() => remove(toast.id)}
                                className="shrink-0 text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
