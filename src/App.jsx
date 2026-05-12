import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { LanguageProvider } from '@/contexts/LanguageContext';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import Settings from '@/pages/Settings';

import { StoreProvider } from '@/services/store';

function App() {
  return (
    <LanguageProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </LanguageProvider>
  );
}

export default App;
