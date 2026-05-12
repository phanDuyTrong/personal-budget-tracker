import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { TransactionTable } from '@/components/TransactionTable';

const Transactions = () => {
    const { t } = useLanguage();

    return (
        <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
            <TransactionTable />
        </div>
    );
};

export default Transactions;
