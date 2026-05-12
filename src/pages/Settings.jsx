import React, { useState } from 'react';
import { CategoryManager } from '@/components/settings/CategoryManager';
import { WalletManager } from '@/components/settings/WalletManager';
import { PersonManager } from '@/components/settings/PersonManager';
import { useStore } from '@/services/store';
import { Wallet, Tag, Users, Settings as SettingsIcon, Save } from 'lucide-react';

export const Settings = () => {
    const { settings, updateSettings } = useStore();
    const [activeTab, setActiveTab] = useState('categories');
    const [tempSettings, setTempSettings] = useState(settings);

    const handleSaveSettings = () => {
        updateSettings(tempSettings);
        alert('Settings saved!');
    };

    const tabs = [
        { id: 'categories', label: 'Categories', icon: Tag, component: <CategoryManager /> },
        { id: 'wallets', label: 'Wallets', icon: Wallet, component: <WalletManager /> },
        { id: 'people', label: 'People', icon: Users, component: <PersonManager /> },
        {
            id: 'general', label: 'General', icon: SettingsIcon, component: (
                <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Base Currency</label>
                        <input
                            className="w-full p-2 border rounded bg-background"
                            value={tempSettings?.baseCurrency || 'USD'}
                            onChange={e => setTempSettings({ ...tempSettings, baseCurrency: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Exchange Rate (to VND for example)</label>
                        <input
                            type="number"
                            className="w-full p-2 border rounded bg-background"
                            value={tempSettings?.exchangeRate || 25000}
                            onChange={e => setTempSettings({ ...tempSettings, exchangeRate: parseFloat(e.target.value) })}
                        />
                    </div>
                    <button onClick={handleSaveSettings} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                        <Save className="h-4 w-4" /> Save General Settings
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="container max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your finances preferences and data.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar Navigation for Settings */}
                <aside className="w-full md:w-64 flex-shrink-0">
                    <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors whitespace-nowrap ${activeTab === tab.id
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'hover:bg-muted text-foreground'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Content Area */}
                <div className="flex-1 bg-card rounded-lg border shadow-sm p-6">
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold">{tabs.find(t => t.id === activeTab).label}</h2>
                    </div>
                    {tabs.find(t => t.id === activeTab).component}
                </div>
            </div>
        </div>
    );
};

export default Settings;
