import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, sepolia, arbitrum, defineChain } from '@reown/appkit/networks';
import { QueryClient } from '@tanstack/react-query';

// Reown / WalletConnect Project ID from environment variable
// Fallback to public demo ID for evaluation if env var is missing
export const projectId =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WALLETCONNECT_PROJECT_ID) ||
  'b56e18d47c72ab683b10814fe9495694';

// Query Client for React Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Custom Mezo Mainnet network definition
export const mezo = defineChain({
  id: 31612,
  caipNetworkId: 'eip155:31612',
  chainNamespace: 'eip155',
  name: 'Mezo',
  nativeCurrency: {
    decimals: 18,
    name: 'Bitcoin',
    symbol: 'BTC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.mezo.org', 'https://mezo.drpc.org'],
    },
  },
  blockExplorers: {
    default: { name: 'Mezo Explorer', url: 'https://explorer.mezo.org' },
  },
});

// Custom Mezo Matsnet (Testnet) network definition
export const mezoMatsnet = defineChain({
  id: 31611,
  caipNetworkId: 'eip155:31611',
  chainNamespace: 'eip155',
  name: 'Mezo Matsnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Bitcoin',
    symbol: 'BTC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.matsnet.mezo.org'],
    },
  },
  blockExplorers: {
    default: { name: 'Matsnet Explorer', url: 'https://explorer.matsnet.mezo.org' },
  },
});

export const networks = [mezo, mezoMatsnet, mainnet, arbitrum, sepolia] as const;

// AppKit Metadata for WalletConnect & Injected Wallets
export const metadata = {
  name: 'Cambio',
  description: 'Stablecoin payments and MUSD settlement on Mezo',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://cambio.finance',
  icons: [
    typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : 'https://cambio.finance/logo.png',
    'https://avatars.githubusercontent.com/u/179229932'
  ],
};

// Initialize Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [mezo, mezoMatsnet, mainnet, arbitrum, sepolia],
});

// Create and configure the AppKit instance with Apple-inspired light styling and analytics disabled
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [mezo, mezoMatsnet, mainnet, arbitrum, sepolia],
  projectId,
  metadata,
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#315EF7',
    '--w3m-border-radius-master': '1px',
    '--w3m-font-family': 'Plus Jakarta Sans, sans-serif',
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
});
