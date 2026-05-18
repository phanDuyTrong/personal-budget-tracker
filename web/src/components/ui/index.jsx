// ── UI Bridge: wraps HeroUI v3 compound components with familiar APIs ──
import React, { createContext, useContext, useState, useCallback } from 'react';
export { DatePicker } from './DatePicker';
export { ErrorBoundary } from './ErrorBoundary';
import { DynamicIcon } from './DynamicIcon';
export { DynamicIcon };

import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useFormatAmount } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/settingsStore';
import { 
    Button as HeroButton, 
    Input as HeroInput, 
    Modal as HeroModal, 
    ModalContent, 
    ModalHeader, 
    ModalBody, 
    ModalFooter,

    Skeleton as HeroSkeleton,
    Chip
} from "@heroui/react";

// ── Toast ──────────────────────────────────────────────────────────
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const add = useCallback((message, type = 'info', options = 3500) => {
        const duration = typeof options === 'number' ? options : (options.duration ?? 3500);
        const id = Math.random().toString(36);
        setToasts(t => [...t, { id, message, type, actionLabel: options.actionLabel, onAction: options.onAction }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
    }, []);
    // FIX: was setToasts(t => setToasts(...)) — double nesting corrupted state
    const remove = (id) => setToasts(prev => prev.filter(x => x.id !== id));

    const iconColorMap = {
        success: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
        error:   { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
        info:    { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    };
    const icons = { 
        success: <CheckCircleIcon className="h-5 w-5" />, 
        error: <ExclamationCircleIcon className="h-5 w-5" />, 
        info: <InformationCircleIcon className="h-5 w-5" />,
    };

    return (
        <ToastCtx.Provider value={add}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] space-y-3 max-w-sm w-full pointer-events-none">
                {toasts.map(t => {
                    const { bg, color } = iconColorMap[t.type] || iconColorMap.info;
                    return (
                        <div 
                            key={t.id} 
                            className="pointer-events-auto flex items-center gap-4 p-4 rounded-[1.5rem] shadow-2xl glass-modal backdrop-blur-2xl animate-in slide-in-from-right-full duration-300"
                        >
                            {/* FIX: use inline style instead of dynamic Tailwind class (not compiled in v4) */}
                            <div style={{ background: bg, color }} className="p-2 rounded-xl shrink-0">
                                {icons[t.type]}
                            </div>
                            <span className="flex-1 font-bold text-sm text-neutral-900 dark:text-white tracking-tight">{t.message}</span>
                            {t.actionLabel && (
                                <button
                                    onClick={() => {
                                        t.onAction?.();
                                        remove(t.id);
                                    }}
                                    className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-black text-white transition-colors hover:bg-primary dark:bg-white dark:text-neutral-950"
                                >
                                    {t.actionLabel}
                                </button>
                            )}
                            <button onClick={() => remove(t.id)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors shrink-0">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastCtx.Provider>
    );
}
export const useToast = () => useContext(ToastCtx);

// ── ConfirmModal ───────────────────────────────────────────────────
export function ConfirmModal({ open, title, description, confirmLabel = 'Delete', onConfirm, onCancel, destructive = true }) {
    return (
        <HeroModal isOpen={open} onOpenChange={onCancel} backdrop="blur" size="sm">
            <ModalContent className="glass-modal backdrop-blur-2xl rounded-[2rem]">
                <ModalHeader className="font-black text-2xl px-8 pt-8">{title}</ModalHeader>
                <ModalBody className="px-8 py-4">
                    <p className="text-sm font-medium text-neutral-500 leading-relaxed">{description}</p>
                </ModalBody>
                <ModalFooter className="px-8 pb-8 pt-2">
                    <HeroButton variant="light" onPress={onCancel} className="font-bold">Cancel</HeroButton>
                    <HeroButton 
                        color={destructive ? "danger" : "primary"} 
                        onPress={onConfirm}
                        className="font-black px-8"
                    >
                        {confirmLabel}
                    </HeroButton>
                </ModalFooter>
            </ModalContent>
        </HeroModal>
    );
}

// ── Skeleton ──────────────────────────────────────────────────────
export function Skeleton({ className = "" }) {
    return <HeroSkeleton className={`rounded-xl ${className}`} />;
}
export function TableSkeleton({ rows = 5, cols = 6 }) {
    return (
        <div className="space-y-4 p-4">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-6">
                    {Array.from({ length: cols }).map((_, j) => <Skeleton key={j} className="h-5 flex-1" />)}
                </div>
            ))}
        </div>
    );
}

// ── EmptyState ────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            {Icon && (
                <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center bg-primary/5 text-primary/20 animate-pulse">
                    <Icon className="h-10 w-10" />
                </div>
            )}
            <div className="space-y-1">
                <p className="font-black text-xl tracking-tight text-neutral-900 dark:text-white">{title}</p>
                {description && <p className="text-sm font-medium text-neutral-400 max-w-xs mx-auto">{description}</p>}
            </div>
            {action && <div className="pt-4">{action}</div>}
        </div>
    );
}

// ── AmountDisplay ─────────────────────────────────────────────────
export function AmountDisplay({ amount, type, className = '' }) {
    const fmt = useFormatAmount();
    const formatted = fmt(Math.abs(amount));
    const colorMap = { income: 'text-success', expense: 'text-danger' };
    const color = colorMap[type] || '';
    return (
        <span className={`font-black tabular-nums tracking-tight ${color} ${className}`}>
            {type === 'expense' ? '-' : type === 'income' ? '+' : ''}{formatted}
        </span>
    );
}

// ── CategoryBadge ─────────────────────────────────────────────────
export function CategoryBadge({ category, parent }) {
    if (!category) return <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Uncategorized</span>;
    return (
        <div className="flex items-center gap-2">
            <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: category.color + '20', color: category.color }}
            >
                <DynamicIcon name={category.icon} className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
                {parent && <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">{parent.name}</span>}
                <span className="text-xs font-black text-neutral-900 dark:text-white tracking-tight leading-none">
                    {category.name}
                </span>
            </div>
        </div>
    );
}

// ── Modal ─────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
    return (
        <HeroModal 
            isOpen={open} 
            onOpenChange={onClose} 
            backdrop="blur" 
            size={size}
            scrollBehavior="inside"
        >
            <ModalContent className="glass-modal backdrop-blur-2xl rounded-[2rem] max-h-[90vh]">
                {title && (
                    <ModalHeader className="font-black text-2xl px-8 pt-8 tracking-tight">{title}</ModalHeader>
                )}
                <ModalBody className="px-8 py-4">
                    {children}
                </ModalBody>
            </ModalContent>
        </HeroModal>
    );
}

// ── Field ─────────────────────────────────────────────────────────
export function Field({ label, error, children }) {
    return (
        <div className="space-y-2">
            {label && <label className="text-xs font-black text-neutral-500 uppercase tracking-widest px-1">{label}</label>}
            {children}
            {error && <p className="text-[10px] font-bold text-danger px-1 uppercase tracking-wider">{error}</p>}
        </div>
    );
}

// ── Input ─────────────────────────────────────────────────────────
export function Input({ className = '', onChange, value, ...props }) {
    return (
        <HeroInput
            value={value}
            onValueChange={v => onChange && onChange({ target: { value: v } })}
            variant="flat"
            className={className}
            {...props}
        />
    );
}

// ── AmountInput ───────────────────────────────────────────────────
export function AmountInput({ value, onChange, className = '', ...props }) {
    const { currency } = useSettingsStore();
    const formatValue = (val) => {
        if (!val && val !== 0 && val !== '0') return '';
        if (typeof val === 'string' && val.endsWith('.')) return val;
        const num = Number(val);
        if (isNaN(num)) return val;
        if (currency === 'VND') return new Intl.NumberFormat('vi-VN').format(Math.round(num));
        return new Intl.NumberFormat('en-US').format(num);
    };
    const handleChange = (e) => {
        let raw = e.target.value;
        if (currency === 'VND') raw = raw.replace(/[^\d]/g, '');
        else {
            raw = raw.replace(/[^\d.]/g, '');
            const parts = raw.split('.');
            if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
        }
        onChange && onChange({ ...e, target: { ...e.target, value: raw } });
    };
    return (
        <HeroInput
            type="text" 
            inputMode="decimal" 
            value={formatValue(value)} 
            onValueChange={v => handleChange({ target: { value: v } })}
            variant="flat"
            className={className}
            startContent={<span className="text-xs font-black text-neutral-400">{currency === 'VND' ? '₫' : '$'}</span>}
            {...props} 
        />
    );
}

// ── Textarea ──────────────────────────────────────────────────────
import { Textarea as HeroTextarea } from "@heroui/react";
export function Textarea({ className = '', ...props }) {
    return (
        <HeroTextarea
            variant="flat"
            className={className}
            {...props}
        />
    );
}

// ── Button ────────────────────────────────────────────────────────
export function Button({ variant = 'primary', size = 'md', className = '', children, loading, onClick, ...props }) {
    const colorMap = {
        primary: "primary",
        destructive: "danger",
        success: "success",
    };
    const variantMap = {
        primary: "solid",
        outline: "bordered",
        ghost: "light",
        secondary: "flat",
    };
    
    return (
        <HeroButton
            color={colorMap[variant] || "default"}
            variant={variantMap[variant] || "solid"}
            size={size}
            isLoading={loading}
            onPress={onClick}
            className={`font-black tracking-tight ${className}`}
            {...props}
        >
            {children}
        </HeroButton>
    );
}

// ── GlassCard ───────────────────────────────────────────────────────
export function GlassCard({ children, className = '' }) {
    return (
        <div className={`glass-card backdrop-blur-xl rounded-3xl p-6 shadow-sm transition-all ${className}`}>
            {children}
        </div>
    );
}

// ── Badge ─────────────────────────────────────────────────────────
export function Badge({ children, variant = 'primary', className = '' }) {
    const colorMap = {
        primary: "primary",
        success: "success",
        danger: "danger",
        secondary: "default",
    };
    return (
        <Chip 
            size="sm" 
            color={colorMap[variant] || "default"} 
            variant="flat" 
            className={`font-black uppercase text-[10px] h-5 ${className}`}
        >
            {children}
        </Chip>
    );
}
