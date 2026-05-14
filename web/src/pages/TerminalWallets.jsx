import React from 'react';
import { useCalculatedWallets, useWalletMutations } from '@/hooks/useApi';
import { useFormatAmount } from '@/hooks/useTranslation';
import { TermBox, TermInputPrompt, TermButton } from '@/components/terminal';

export function TerminalWallets() {
    const { data: walletsRaw = [], isLoading } = useCalculatedWallets();
    const fmt = useFormatAmount();
    const { remove } = useWalletMutations();

    const wallets = walletsRaw || [];
    const totalBalance = wallets.reduce((s, a) => s + Number(a.liveBalance), 0);

    const handleDelete = async (id) => {
        if (window.confirm('CONFIRM_DELETE?')) {
            try {
                await remove.mutateAsync(id);
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <div className="space-y-6">
            <TermInputPrompt 
                command="./list_nodes --type=all" 
                className="mb-6" 
            />

            <TermBox title="NET_LIQUIDITY">
                <div className="text-2xl font-bold">
                    {fmt(totalBalance)}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--color-term-secondary)' }}>
                    {wallets.length} ACTIVE_NODES_FOUND
                </div>
            </TermBox>

            <TermBox title="NODE_REGISTRY">
                {isLoading ? (
                    <p>SCANNING_NODES...................</p>
                ) : wallets.length === 0 ? (
                    <p>ERR: NO_NODES_CONFIGURED</p>
                ) : (
                    <table className="w-full text-left uppercase text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-term-muted)]">
                                <th className="py-2 font-normal">ID</th>
                                <th className="py-2 font-normal">DESIGNATION</th>
                                <th className="py-2 font-normal">PROTOCOL</th>
                                <th className="py-2 font-normal text-right">CAPACITY</th>
                                <th className="py-2 font-normal text-center">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {wallets.map((wallet, i) => (
                                <tr key={wallet.id} className="border-b border-dashed border-[var(--color-term-muted)] hover:bg-[var(--color-term-primary)] hover:text-[var(--color-term-bg)] cursor-crosshair transition-none">
                                    <td className="py-2">0x{String(i).padStart(2, '0')}</td>
                                    <td className="py-2">{wallet.name.substring(0, 20)}</td>
                                    <td className="py-2">[{wallet.type.toUpperCase()}]</td>
                                    <td className="py-2 text-right tabular-nums">{fmt(wallet.liveBalance)}</td>
                                    <td className="py-2 text-center space-x-2">
                                        <button 
                                            className="bg-transparent border-none focus:outline-none cursor-pointer"
                                            onClick={(e) => { e.stopPropagation(); alert('EDIT_NODE_WIP'); }}
                                        >
                                            [MOD]
                                        </button>
                                        <button 
                                            className="bg-transparent border-none focus:outline-none cursor-pointer"
                                            style={{ color: 'var(--color-term-error)' }}
                                            onClick={(e) => { e.stopPropagation(); handleDelete(wallet.id); }}
                                        >
                                            [DEL]
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </TermBox>

            <div className="flex justify-end gap-4 mt-6">
                 <TermButton onClick={() => alert('ADD_NODE_WIP')} className="text-lg">
                    REGISTER_NEW_NODE
                 </TermButton>
            </div>
        </div>
    );
}
