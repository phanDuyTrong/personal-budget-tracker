import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const ACCENT_COLORS = [
    { name: 'Coral', value: '#FF5722' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Pink', value: '#ec4899' },
];

function hexToHsl(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyAccentColor(color) {
    document.documentElement.style.setProperty('--color-primary-base', color);
    const hsl = hexToHsl(color);
    document.documentElement.style.setProperty('--heroui-primary', hsl);
    // HeroUI uses shades. For simplicity, we can set primary to 500
    document.documentElement.style.setProperty('--heroui-primary-500', hsl);
}

export function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
        html.classList.add('dark');
        html.dataset.theme = 'dark';
    } else if (theme === 'light') {
        html.classList.remove('dark');
        html.dataset.theme = 'light';
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.classList.toggle('dark', prefersDark);
        html.dataset.theme = prefersDark ? 'dark' : 'light';
    }
}

export const useSettingsStore = create(
    persist(
        (set) => ({
            language: 'en',
            currency: 'USD',
            exchangeRate: 26000,
            accentColor: '#FF5722',
            theme: 'light',
            hideBalances: false,
            walletOrder: [],
            budgetOrder: [],
            setLanguage: (language) => set({ language }),
            setCurrency: (currency) => set({ currency }),
            setExchangeRate: (exchangeRate) => set({ exchangeRate }),
            setAccentColor: (accentColor) => { applyAccentColor(accentColor); set({ accentColor }); },
            setTheme: (theme) => { applyTheme(theme); set({ theme }); },
            setHideBalances: (hideBalances) => set({ hideBalances }),
            setWalletOrder: (walletOrder) => set({ walletOrder }),
            setBudgetOrder: (budgetOrder) => set({ budgetOrder }),
        }),
        { name: 'bm-settings' }
    )
);
