// ── UI Bridge: wraps HeroUI v3 compound components with familiar APIs ──
import React from 'react';
export { DatePicker } from './DatePicker';
export { ErrorBoundary } from './ErrorBoundary';
import { DynamicIcon } from './DynamicIcon';
export { DynamicIcon };
export { ToastProvider } from './Toast';

import { useFormatAmount } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button as HeroButton } from "@heroui/button";
import { Input as HeroInput, Textarea as HeroTextarea } from "@heroui/input";
import { Modal as HeroModal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Skeleton as HeroSkeleton } from "@heroui/skeleton";
import { Chip } from "@heroui/chip";

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
