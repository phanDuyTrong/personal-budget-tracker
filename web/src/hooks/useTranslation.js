import { useSettingsStore } from '@/stores/settingsStore';
import translations from '@/lib/i18n';

// Returns translated string for a dot-notation key, e.g. useT()('nav.dashboard')
export function useT() {
    const { language } = useSettingsStore();
    return (key) => {
        const parts = key.split('.');
        let val = translations[language];
        for (const p of parts) {
            val = val?.[p];
            if (val === undefined) break;
        }
        // Fallback to English
        if (val === undefined) {
            let fallback = translations.en;
            for (const p of parts) { fallback = fallback?.[p]; }
            return fallback ?? key;
        }
        return val;
    };
}

// Format a currency amount based on user settings — NO conversion, raw storage
export function useFormatAmount() {
    const { currency } = useSettingsStore();
    return (amount) => {
        if (amount === null || amount === undefined) return '—';
        const num = Number(amount);
        if (currency === 'VND') {
            return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Math.round(num));
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
    };
}
