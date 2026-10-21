import { Transaction, NotificationItem, WalletState } from '../types';

export const INITIAL_WALLET_STATE: WalletState = {
  isConnected: false,
  status: 'disconnected',
  address: null,
  walletName: null,
  chainId: null,
  networkName: null,
  isMezoNetwork: false,
  balanceMusd: 0,
  isDemoBalance: true,
};

export const DEMO_CONNECTED_BALANCE = 12450.00;

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-demo-001',
    type: 'receive',
    amount: 1250.00,
    currency: 'MUSD',
    counterparty: 'Elena Rostova',
    counterpartyAddress: '0x32A4…8B11',
    timestamp: 'Today, 2:45 PM',
    status: 'completed',
    note: 'Consulting invoice #1042',
    txHash: '0x8f2a…4c19',
    isDemo: true,
  },
  {
    id: 'tx-demo-002',
    type: 'send',
    amount: 320.00,
    currency: 'MUSD',
    counterparty: 'Marcus Vance',
    counterpartyAddress: '0x99F1…22C8',
    timestamp: 'Yesterday, 11:15 AM',
    status: 'completed',
    note: 'Team lunch split',
    txHash: '0x1b4e…92df',
    isDemo: true,
  },
  {
    id: 'tx-demo-003',
    type: 'receive',
    amount: 4500.00,
    currency: 'MUSD',
    counterparty: 'Aura Design Studio',
    counterpartyAddress: '0x44D9…77E0',
    timestamp: 'Oct 14, 2026',
    status: 'completed',
    note: 'Design sprint milestone',
    txHash: '0x77c2…519a',
    isDemo: true,
  },
  {
    id: 'tx-demo-004',
    type: 'send',
    amount: 85.50,
    currency: 'MUSD',
    counterparty: 'Cloud Hosting Node',
    counterpartyAddress: '0x66B0…13A2',
    timestamp: 'Oct 12, 2026',
    status: 'completed',
    note: 'Infrastructure subscription',
    txHash: '0x33e5…81bf',
    isDemo: true,
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'WalletConnect Ready',
    message: 'Connect your real crypto wallet via QR code or browser extension to test Cambio.',
    timestamp: 'Just now',
    read: false,
    type: 'wallet',
  },
];
