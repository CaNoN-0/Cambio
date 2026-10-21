export type NavItemKey = 'overview' | 'send' | 'receive' | 'request' | 'swap' | 'activity' | 'notifications' | 'settings';

export interface SwapToken {
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  isNative?: boolean;
  usdPrice?: number;
  icon?: string;
  change24h?: number;
  source?: string;
  lastUpdated?: number;
}

export interface SwapQuote {
  inputToken: SwapToken;
  outputToken: SwapToken;
  inputAmount: number;
  estimatedOutput: number;
  exchangeRate: number; // 1 input = X output
  inverseRate?: number; // 1 output = X input
  networkFee: string;
  priceImpact: string;
  minReceived: number;
  slippagePct: number;
  quoteExpirySeconds: number;
  createdAt: number;
  isDemoQuote: boolean;
  isLiveRate?: boolean;
  source?: string;
}

export interface PaymentRequest {
  id: string;
  recipientAddress: string;
  recipientUsername?: string;
  amount: number;
  note?: string;
  expiryHours?: number; // 0 = no expiry, or hours (e.g. 24, 168, 720)
  createdAt: number;
  status?: 'active' | 'expired' | 'completed';
}

export type WalletConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface WalletState {
  isConnected: boolean;
  status: WalletConnectionStatus;
  address: string | null;
  walletName: string | null;
  chainId: number | string | null;
  networkName: string | null;
  isMezoNetwork: boolean;
  balanceMusd: number;
  isDemoBalance: boolean;
  username?: string | null;
  dataMode?: 'real' | 'demo';
}

export interface UsernameRecord {
  username: string; // normalized lowercase without @
  displayUsername: string; // e.g. @jomi
  walletAddress: string; // 0x...
  createdAt: number;
  updatedAt?: number;
  signature?: string;
  isVerified: boolean;
}

export interface UsernameCheckResult {
  available: boolean;
  normalized: string;
  display: string;
  error?: string;
  ownerAddress?: string;
}

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'request' | 'swap';
  amount: number;
  currency: string;
  counterparty: string;
  counterpartyAddress: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
  note?: string;
  txHash?: string;
  isDemo?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'system' | 'payment' | 'wallet';
}

export type FiatCurrencyCode = 'USD' | 'NGN' | 'EUR' | 'GBP' | 'CAD' | 'GHS' | 'KES' | 'ZAR';

export interface SupportedCurrency {
  code: FiatCurrencyCode;
  name: string;
  symbol: string;
  flag: string;
  locale: string;
  decimals: number;
}

