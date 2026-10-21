import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { wagmiAdapter, queryClient } from './config/walletConnect';
import { ThemeProvider } from './context/ThemeContext';
import { CurrencyProvider } from './context/CurrencyContext';
import App from './App.tsx';
import './index.css';
import { testFirestoreConnection } from './firebase';

// Verify Firestore connectivity on app boot
testFirestoreConnection();

createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={wagmiAdapter.wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
