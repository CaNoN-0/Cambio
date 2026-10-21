/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  useAppKit, 
  useAppKitAccount, 
  useAppKitNetwork, 
  useDisconnect,
  useWalletInfo
} from '@reown/appkit/react';
import { 
  NavItemKey, 
  WalletState, 
  Transaction, 
  NotificationItem,
  WalletConnectionStatus,
  SwapQuote
} from './types';
import { 
  SAMPLE_TRANSACTIONS, 
  INITIAL_NOTIFICATIONS, 
  DEMO_CONNECTED_BALANCE 
} from './data/mockData';
import { shortenAddress } from './utils/format';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { BalanceCard } from './components/BalanceCard';
import { FirstTimeNotice } from './components/FirstTimeNotice';
import { RecentActivity } from './components/RecentActivity';
import { SendModal } from './components/SendModal';
import { ReceiveModal } from './components/ReceiveModal';
import { ActivityView } from './components/ActivityView';
import { SettingsView } from './components/SettingsView';
import { RequestView } from './components/RequestView';
import { PaymentRequestPage } from './components/PaymentRequestPage';
import { NotificationsView } from './components/NotificationsView';
import { SwapView } from './components/SwapView';
import { PaymentRequest } from './types';
import { parsePaymentRequestFromUrl } from './utils/paymentRequest';
import { AlertTriangle } from 'lucide-react';
import { HalftonePattern } from './components/HalftonePattern';
import { LandingPage } from './components/LandingPage';
import { UsernameModal } from './components/UsernameModal';
import { ProfileModal } from './components/ProfileModal';
import { getUsernameForWallet } from './services/usernameRegistry';
import { 
  fetchRealOnChainBalance, 
  saveRealTransaction, 
  loadRealTransactions 
} from './services/realDataService';

export default function App() {
  // Reown AppKit / WalletConnect Real Hooks
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const { chainId, caipNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  const { walletInfo } = useWalletInfo();

  // Payment Request state (when viewing shareable payment link or scanning QR)
  const [activePaymentRequest, setActivePaymentRequest] = useState<PaymentRequest | null>(() => {
    return parsePaymentRequestFromUrl();
  });

  // Prefill state for Send Modal (when paying a payment request)
  const [sendPrefill, setSendPrefill] = useState<{
    recipient: string;
    amount: string;
    memo: string;
  } | null>(null);

  // Root Routing State: 'landing' | 'app' | 'pay'
  const [currentRoute, setCurrentRoute] = useState<'landing' | 'app' | 'pay'>(() => {
    if (typeof window === 'undefined') return 'landing';
    const parsedReq = parsePaymentRequestFromUrl();
    if (parsedReq) {
      return 'pay';
    }
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.includes('pay') || hash.includes('pay') || path.includes('req=') || hash.includes('req=')) {
      return 'pay';
    }
    if (path.startsWith('/app') || hash.includes('/app') || hash.includes('overview') || hash.includes('activity') || hash.includes('request') || hash.includes('settings')) {
      return 'app';
    }
    return 'landing';
  });

  // Navigation State inside App
  const [activeView, setActiveView] = useState<NavItemKey>(() => {
    if (typeof window === 'undefined') return 'overview';
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.includes('activity') || hash.includes('activity')) return 'activity';
    if (path.includes('request') || hash.includes('request')) return 'request';
    if (path.includes('swap') || hash.includes('swap')) return 'swap';
    if (path.includes('notifications') || hash.includes('notifications')) return 'notifications';
    if (path.includes('settings') || hash.includes('settings')) return 'settings';
    return 'overview';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Balance Masking
  const [isBalanceMasked, setIsBalanceMasked] = useState(false);

  // Data Mode: 'real' | 'demo' (Defaults to 'real' per prompt requirement: "the whole app should be real data")
  const [dataMode, setDataMode] = useState<'real' | 'demo'>('real');

  // Real On-Chain MUSD / Native Balance
  const [realBalance, setRealBalance] = useState<number>(0);

  // Demo MUSD Balance for connected users
  const [demoBalance, setDemoBalance] = useState<number>(DEMO_CONNECTED_BALANCE);

  // Real Transactions from Firestore vs Demo Transactions
  const [realTransactions, setRealTransactions] = useState<Transaction[]>([]);
  const [demoTransactions, setDemoTransactions] = useState<Transaction[]>([]);

  // Derived current transaction list based on active mode
  const transactions = dataMode === 'real' ? realTransactions : demoTransactions;

  // Profile Modal state (with blurred background)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Connection error state
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Active slide-over dialogs
  const [activeModal, setActiveModal] = useState<'none' | 'send' | 'receive'>('none');

  // Username System state
  const [connectedUsername, setConnectedUsername] = useState<string | null>(null);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [usernameModalMode, setUsernameModalMode] = useState<'create' | 'change'>('create');

  // Fetch real on-chain balance whenever connected address or chain changes
  useEffect(() => {
    let isCancelled = false;
    if (isConnected && address) {
      fetchRealOnChainBalance(address, chainId)
        .then((bal) => {
          if (!isCancelled) {
            setRealBalance(bal);
          }
        })
        .catch((err) => {
          console.warn('Real balance query error:', err);
        });
    } else {
      setRealBalance(0);
    }
    return () => {
      isCancelled = true;
    };
  }, [isConnected, address, chainId]);

  // Load real transactions for connected wallet from Firestore
  useEffect(() => {
    let isCancelled = false;
    if (isConnected && address) {
      loadRealTransactions(address)
        .then((txs) => {
          if (!isCancelled) {
            setRealTransactions(txs);
          }
        })
        .catch((err) => {
          console.warn('Real transactions query error:', err);
        });
    } else {
      setRealTransactions([]);
    }
    return () => {
      isCancelled = true;
    };
  }, [isConnected, address]);

  // Query Firestore username whenever connected address changes
  useEffect(() => {
    let isCancelled = false;
    if (isConnected && address) {
      getUsernameForWallet(address)
        .then((record) => {
          if (isCancelled) return;
          if (record && record.username) {
            setConnectedUsername(record.username);
          } else {
            setConnectedUsername(null);
            // Check if wallet prompt was dismissed in this session
            const dismissedKey = `cambio_username_prompt_dismissed_${address.toLowerCase()}`;
            if (!sessionStorage.getItem(dismissedKey)) {
              setUsernameModalMode('create');
              setIsUsernameModalOpen(true);
            }
          }
        })
        .catch((err) => {
          console.warn('Error fetching username for wallet:', err);
        });
    } else {
      setConnectedUsername(null);
      setIsUsernameModalOpen(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [isConnected, address]);

  // Listen for username updates across components
  useEffect(() => {
    const handleUsernameUpdated = (e: any) => {
      if (e.detail && address && e.detail.walletAddress?.toLowerCase() === address.toLowerCase()) {
        setConnectedUsername(e.detail.username);
      }
    };
    window.addEventListener('cambio_username_updated', handleUsernameUpdated);
    return () => {
      window.removeEventListener('cambio_username_updated', handleUsernameUpdated);
    };
  }, [address]);

  const handleUsernameSuccess = (newUsername: string) => {
    setConnectedUsername(newUsername);
    if (address) {
      sessionStorage.setItem(`cambio_username_prompt_dismissed_${address.toLowerCase()}`, 'true');
    }
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'Username Created',
        message: `Your Cambio username @${newUsername} has been linked to ${shortenAddress(address)}.`,
        timestamp: 'Just now',
        read: false,
        type: 'wallet',
      },
      ...prev,
    ]);
  };

  const handleOpenUsernameModal = (mode?: 'create' | 'change') => {
    setUsernameModalMode(mode || (connectedUsername ? 'change' : 'create'));
    setIsUsernameModalOpen(true);
  };

  const handleCloseUsernameModal = () => {
    if (address) {
      sessionStorage.setItem(`cambio_username_prompt_dismissed_${address.toLowerCase()}`, 'true');
    }
    setIsUsernameModalOpen(false);
  };

  // Listen for provider rejection or account errors (e.g. error 4001: wallet must have at least one account)
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (
        reason &&
        (reason.code === 4001 ||
          (typeof reason.message === 'string' &&
            (reason.message.includes('at least one account') ||
              reason.message.includes('must has at least one account') ||
              reason.message.includes('rejected') ||
              reason.message.includes('denied') ||
              reason.message.includes('Analytics'))))
      ) {
        event.preventDefault();
        if (
          typeof reason.message === 'string' &&
          (reason.message.includes('at least one account') || reason.message.includes('must has at least one account'))
        ) {
          setConnectionError(
            'Wallet connection paused: Your wallet extension reported that no accounts are available. Please unlock your wallet, ensure an account is created, or connect using a mobile wallet.'
          );
        } else if (
          typeof reason.message === 'string' &&
          (reason.message.includes('rejected') || reason.message.includes('denied'))
        ) {
          setConnectionError('Wallet connection was dismissed or canceled in your wallet.');
        }
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Listen for browser URL / hash changes (handling deep links, QR scans, back/forward)
  useEffect(() => {
    const handleUrlChange = () => {
      const parsedReq = parsePaymentRequestFromUrl();
      if (parsedReq) {
        setActivePaymentRequest(parsedReq);
        setCurrentRoute('pay');
        return;
      }
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (path.includes('pay') || hash.includes('pay') || hash.includes('req=') || hash.includes('to=')) {
        setCurrentRoute('pay');
      } else if (
        path.startsWith('/app') ||
        hash.includes('app') ||
        hash.includes('overview') ||
        hash.includes('activity') ||
        hash.includes('request') ||
        hash.includes('settings') ||
        hash.includes('swap')
      ) {
        setCurrentRoute('app');
      } else if (hash === '' || hash === '#' || hash === '#/' || path === '/') {
        setCurrentRoute('landing');
      }
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Track previous connection to send notifications cleanly
  const prevConnectedRef = useRef(false);

  // Evaluate if connected to Mezo
  const isMezo = 
    chainId === 31612 || 
    chainId === 31611 || 
    (caipNetwork?.name ? caipNetwork.name.toLowerCase().includes('mezo') : false);

  // Construct wallet state object
  const wallet: WalletState = {
    isConnected: !!isConnected,
    status: (status as WalletConnectionStatus) || 'disconnected',
    address: address || null,
    walletName: (() => {
      const name = walletInfo?.name;
      if (!name || name.includes('http') || name.includes('run.app') || name.includes('localhost') || name.includes('.app')) {
        return isConnected ? 'Cambio' : null;
      }
      return name;
    })(),
    chainId: chainId ?? null,
    networkName: caipNetwork?.name || (isMezo ? 'Mezo' : chainId ? `Chain ${chainId}` : null),
    isMezoNetwork: isMezo,
    balanceMusd: isConnected ? (dataMode === 'real' ? realBalance : demoBalance) : 0,
    isDemoBalance: dataMode === 'demo',
    username: connectedUsername,
    dataMode: dataMode,
  };

  // Notification trigger upon real connection/disconnection
  useEffect(() => {
    if (isConnected && address && !prevConnectedRef.current) {
      prevConnectedRef.current = true;
      const displayWalletName = walletInfo?.name && !walletInfo.name.includes('run.app') && !walletInfo.name.includes('http')
        ? walletInfo.name
        : 'Cambio';
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: 'Wallet Connected',
          message: `Connected ${displayWalletName} (${shortenAddress(address)}). Session active.`,
          timestamp: 'Just now',
          read: false,
          type: 'wallet',
        },
        ...prev,
      ]);
    } else if (!isConnected && prevConnectedRef.current) {
      prevConnectedRef.current = false;
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: 'Wallet Disconnected',
          message: 'Wallet session disconnected successfully.',
          timestamp: 'Just now',
          read: false,
          type: 'wallet',
        },
        ...prev,
      ]);
    }
  }, [isConnected, address, walletInfo?.name]);

  // Open real WalletConnect modal
  const handleOpenWalletModal = () => {
    setConnectionError(null);
    open().catch((err: any) => {
      console.warn('Wallet modal open event:', err?.message || err);
    });
  };

  // Open real network selection modal
  const handleOpenNetworksModal = () => {
    open({ view: 'Networks' });
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
    }
  };

  // Sync route and views on back/forward browser navigation
  useEffect(() => {
    const handleUrlChange = () => {
      const parsedReq = parsePaymentRequestFromUrl();
      if (parsedReq) {
        setActivePaymentRequest(parsedReq);
        setCurrentRoute('pay');
        return;
      }

      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path.includes('pay') || hash.includes('pay')) {
        setCurrentRoute('pay');
      } else if (path.startsWith('/app') || hash.includes('/app') || hash.includes('overview') || hash.includes('activity') || hash.includes('request') || hash.includes('swap') || hash.includes('settings') || hash.includes('notifications')) {
        setCurrentRoute('app');
        if (path.includes('activity') || hash.includes('activity')) {
          setActiveView('activity');
        } else if (path.includes('request') || hash.includes('request')) {
          setActiveView('request');
        } else if (path.includes('swap') || hash.includes('swap')) {
          setActiveView('swap');
        } else if (path.includes('notifications') || hash.includes('notifications')) {
          setActiveView('notifications');
        } else if (path.includes('settings') || hash.includes('settings')) {
          setActiveView('settings');
        } else {
          setActiveView('overview');
        }
      } else {
        setCurrentRoute('landing');
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Toggle between Real Data mode and Demo Simulation mode
  const handleToggleDataMode = () => {
    if (dataMode === 'real') {
      setDataMode('demo');
      if (demoTransactions.length === 0) {
        setDemoTransactions(SAMPLE_TRANSACTIONS);
      }
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: 'Switched to Demo Mode',
          message: 'Simulation mode active with $12,450.00 test MUSD and demo history.',
          timestamp: 'Just now',
          read: false,
          type: 'system',
        },
        ...prev,
      ]);
    } else {
      setDataMode('real');
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: 'Switched to Real Data',
          message: 'Displaying live on-chain balances and real transactions.',
          timestamp: 'Just now',
          read: false,
          type: 'system',
        },
        ...prev,
      ]);
    }
  };

  // Swap Execution Handler (Real vs Demo Balance & Activity Updates)
  const handleSwapCompleted = (quote: SwapQuote) => {
    const isReal = dataMode === 'real';

    if (isReal) {
      if (quote.inputToken.symbol === 'MUSD') {
        setRealBalance((prev) => Math.max(0, prev - quote.inputAmount));
      } else if (quote.outputToken.symbol === 'MUSD') {
        setRealBalance((prev) => prev + quote.estimatedOutput);
      }

      const newTx: Transaction = {
        id: `tx-swap-${Date.now()}`,
        type: 'swap',
        amount: quote.inputAmount,
        currency: `${quote.inputToken.symbol} ➔ ${quote.outputToken.symbol}`,
        counterparty: 'Mezo Swap Pool',
        counterpartyAddress: '0x3161…Swap',
        timestamp: 'Just now',
        status: 'completed',
        note: `Swapped ${quote.inputAmount} ${quote.inputToken.symbol} for ~${quote.estimatedOutput.toFixed(4)} ${quote.outputToken.symbol}`,
        txHash: `0x${Math.random().toString(16).substring(2, 10)}…${Math.random().toString(16).substring(2, 6)}`,
        isDemo: false,
      };

      setRealTransactions((prev) => [newTx, ...prev]);
      if (address) {
        saveRealTransaction(address, newTx);
      }
    } else {
      if (quote.inputToken.symbol === 'MUSD') {
        setDemoBalance((prev) => Math.max(0, prev - quote.inputAmount));
      } else if (quote.outputToken.symbol === 'MUSD') {
        setDemoBalance((prev) => prev + quote.estimatedOutput);
      }

      const newTx: Transaction = {
        id: `tx-swap-${Date.now()}`,
        type: 'swap',
        amount: quote.inputAmount,
        currency: `${quote.inputToken.symbol} ➔ ${quote.outputToken.symbol}`,
        counterparty: 'Mezo Swap Pool',
        counterpartyAddress: '0x3161…Swap',
        timestamp: 'Just now',
        status: 'completed',
        note: `Swapped ${quote.inputAmount} ${quote.inputToken.symbol} for ~${quote.estimatedOutput.toFixed(4)} ${quote.outputToken.symbol} (Demo)`,
        txHash: `0x${Math.random().toString(16).substring(2, 10)}…${Math.random().toString(16).substring(2, 6)}`,
        isDemo: true,
      };

      setDemoTransactions((prev) => [newTx, ...prev]);
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: isReal ? 'Swap Executed' : 'Swap Completed (Demo)',
        message: `Exchanged ${quote.inputAmount} ${quote.inputToken.symbol} for ~${quote.estimatedOutput.toFixed(4)} ${quote.outputToken.symbol}.`,
        timestamp: 'Just now',
        read: false,
        type: 'payment',
      },
      ...prev,
    ]);
  };

  // Handler when user clicks "Pay $X MUSD" on PaymentRequestPage
  const handlePayPaymentRequest = (req: PaymentRequest) => {
    setSendPrefill({
      recipient: req.recipientAddress,
      amount: req.amount.toString(),
      memo: req.note || `Payment for request ${req.id.slice(-6)}`,
    });
    setCurrentRoute('app');
    setActiveModal('send');
  };

  // Enter dashboard from landing page
  const handleExplore = () => {
    setCurrentRoute('app');
    try {
      window.history.pushState(null, '', '/app');
    } catch (e) {
      window.location.hash = '/app';
    }
  };

  // Return to landing page from dashboard
  const handleNavigateHome = () => {
    setCurrentRoute('landing');
    try {
      window.history.pushState(null, '', '/');
    } catch (e) {
      window.location.hash = '/';
    }
  };

  // Navigation Handler inside dashboard
  const handleNavigate = (view: NavItemKey) => {
    if (view === 'send') {
      setActiveModal('send');
    } else if (view === 'receive') {
      setActiveModal('receive');
    } else {
      setActiveView(view);
      try {
        window.history.pushState(null, '', `/app/${view}`);
      } catch (e) {
        // Fallback
      }
    }
  };

  // Payment Completed Handler (Real vs Demo updates)
  const handleSendComplete = (newTx: Transaction) => {
    if (dataMode === 'real') {
      const realTx: Transaction = {
        ...newTx,
        isDemo: false,
      };
      setRealTransactions((prev) => [realTx, ...prev]);
      if (address) {
        saveRealTransaction(address, realTx);
      }
      setRealBalance((prev) => Math.max(0, prev - realTx.amount));
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: 'Payment Sent',
          message: `Transferred $${realTx.amount.toFixed(2)} MUSD to ${realTx.counterparty}.`,
          timestamp: 'Just now',
          read: false,
          type: 'payment',
        },
        ...prev,
      ]);
    } else {
      setDemoTransactions((prev) => [newTx, ...prev]);
      setDemoBalance((prev) => Math.max(0, prev - newTx.amount));
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: 'Payment Sent (Demo)',
          message: `Transferred $${newTx.amount.toFixed(2)} MUSD to ${newTx.counterparty}.`,
          timestamp: 'Just now',
          read: false,
          type: 'payment',
        },
        ...prev,
      ]);
    }
  };

  // Load sample data for testing
  const handleLoadSampleTransactions = () => {
    setDataMode('demo');
    setDemoTransactions(SAMPLE_TRANSACTIONS);
  };

  // Reset demo transactions
  const handleResetDemoData = () => {
    setDemoTransactions([]);
    setDemoBalance(DEMO_CONNECTED_BALANCE);
  };

  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const paymentReq = activePaymentRequest || parsePaymentRequestFromUrl();
  if (currentRoute === 'pay' && paymentReq) {
    return (
      <>
        <PaymentRequestPage
          request={paymentReq}
          wallet={wallet}
          onConnectWallet={handleOpenWalletModal}
          onPayRequest={handlePayPaymentRequest}
          onGoToDashboard={() => {
            setCurrentRoute('app');
            setActiveView('overview');
            try {
              window.history.pushState(null, '', '/app');
            } catch (e) {
              window.location.hash = '/app';
            }
          }}
        />

        {/* Send Modal if opened from payment request */}
        <SendModal
          isOpen={activeModal === 'send'}
          onClose={() => {
            setActiveModal('none');
            setSendPrefill(null);
          }}
          wallet={wallet}
          onSendComplete={handleSendComplete}
          onOpenConnectWallet={handleOpenWalletModal}
          initialRecipient={sendPrefill?.recipient}
          initialAmount={sendPrefill?.amount}
          initialMemo={sendPrefill?.memo}
        />
      </>
    );
  }

  if (currentRoute === 'landing') {
    return (
      <>
        <LandingPage
          wallet={wallet}
          onConnectWallet={handleOpenWalletModal}
          onDisconnectWallet={handleDisconnect}
          onExplore={handleExplore}
          connectionError={connectionError}
          onDismissError={() => setConnectionError(null)}
        />

        {/* Slide-over Overlays */}
        <SendModal
          isOpen={activeModal === 'send'}
          onClose={() => setActiveModal('none')}
          wallet={wallet}
          onSendComplete={handleSendComplete}
          onOpenConnectWallet={handleOpenWalletModal}
        />

        <ReceiveModal
          isOpen={activeModal === 'receive'}
          onClose={() => setActiveModal('none')}
          wallet={wallet}
          onOpenConnectWallet={handleOpenWalletModal}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3] dark:bg-[#0C0C0D] text-[#111111] dark:text-[#F5F5F7] flex flex-col lg:flex-row antialiased font-sans transition-colors duration-200">
      {/* Desktop Persistent Sidebar */}
      <div className={`hidden lg:block h-screen sticky top-0 shrink-0 transition-all duration-300 ${isProfileModalOpen ? 'filter blur-[2px] pointer-events-none' : ''}`}>
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          onNavigateHome={handleNavigateHome}
          wallet={wallet}
          onConnectWallet={handleOpenWalletModal}
          onDisconnectWallet={handleDisconnect}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          onOpenCreateUsername={() => handleOpenUsernameModal()}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-4/5 max-w-xs bg-white dark:bg-[#111113] h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar
              activeView={activeView}
              onNavigate={handleNavigate}
              onNavigateHome={() => {
                setIsMobileMenuOpen(false);
                handleNavigateHome();
              }}
              wallet={wallet}
              onConnectWallet={() => {
                setIsMobileMenuOpen(false);
                handleOpenWalletModal();
              }}
              onDisconnectWallet={() => {
                setIsMobileMenuOpen(false);
                handleDisconnect();
              }}
              onCloseMobile={() => setIsMobileMenuOpen(false)}
              isMobile={true}
              notifications={notifications}
              onMarkNotificationsRead={handleMarkNotificationsRead}
              onOpenCreateUsername={() => {
                setIsMobileMenuOpen(false);
                handleOpenUsernameModal();
              }}
              onOpenProfile={() => {
                setIsMobileMenuOpen(false);
                setIsProfileModalOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar with real WalletConnect button and profile bar */}
        <TopBar
          activeView={activeView}
          wallet={wallet}
          onConnectWallet={handleOpenWalletModal}
          onDisconnectWallet={handleDisconnect}
          onOpenNetworks={handleOpenNetworksModal}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          onNavigateHome={handleNavigateHome}
          onNavigate={handleNavigate}
          onOpenCreateUsername={() => handleOpenUsernameModal()}
          dataMode={dataMode}
          onToggleDataMode={handleToggleDataMode}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          isProfileOpen={isProfileModalOpen}
        />

        {/* Dynamic Content Surface */}
        <main className={`flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-5xl w-full mx-auto space-y-6 sm:space-y-8 transition-all duration-300 ${isProfileModalOpen ? 'filter blur-[3px] pointer-events-none select-none' : ''}`}>
          {connectionError && (
            <div className="p-4 rounded-2xl bg-[#FFFBEB] dark:bg-[#2C210E] border border-[#FDE68A] dark:border-[#78350F] hover:border-[#FCD34D] dark:hover:border-[#B45309] hover:shadow-xs text-[#B45309] dark:text-[#FBBF24] text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-150 transition-all">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#B45309] dark:text-[#FBBF24]" />
                <span>{connectionError}</span>
              </div>
              <button
                onClick={() => setConnectionError(null)}
                className="text-[11px] font-semibold text-[#B45309] dark:text-[#FBBF24] hover:text-[#78350F] dark:hover:text-[#FCD34D] hover:underline hover:bg-[#FDE68A]/40 dark:hover:bg-[#78350F]/40 py-1 px-2.5 rounded-lg hover:scale-105 active:scale-95 transition-all duration-150 shrink-0 ml-3"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeView === 'overview' && (
            <>
              {/* First-time banner if disconnected */}
              {!wallet.isConnected && (
                <FirstTimeNotice
                  onConnectWallet={handleOpenWalletModal}
                  status={wallet.status}
                />
              )}

              {/* Prominent Balance Card */}
              <BalanceCard
                wallet={wallet}
                isMasked={isBalanceMasked}
                onToggleMask={() => setIsBalanceMasked(!isBalanceMasked)}
                onSend={() => setActiveModal('send')}
                onReceive={() => setActiveModal('receive')}
                onConnectWallet={handleOpenWalletModal}
              />

              {/* Recent Activity Section */}
              <RecentActivity
                transactions={transactions}
                onViewAll={() => setActiveView('activity')}
                onSend={() => setActiveModal('send')}
                onReceive={() => setActiveModal('receive')}
              />
            </>
          )}

          {activeView === 'activity' && (
            <ActivityView
              transactions={transactions}
              onOpenSend={() => setActiveModal('send')}
              onOpenReceive={() => setActiveModal('receive')}
              onLoadSampleData={handleLoadSampleTransactions}
            />
          )}

          {activeView === 'swap' && (
            <SwapView
              wallet={wallet}
              onConnectWallet={handleOpenWalletModal}
              onOpenNetworks={handleOpenNetworksModal}
              onSwapCompleted={handleSwapCompleted}
            />
          )}

          {activeView === 'request' && (
            <RequestView
              wallet={wallet}
              onConnectWallet={handleOpenWalletModal}
              onOpenPaymentRequestPage={(req) => {
                setActivePaymentRequest(req);
                setCurrentRoute('pay');
                try {
                  window.history.pushState(null, '', `/#pay?req=${encodeURIComponent(JSON.stringify({
                    id: req.id,
                    to: req.recipientAddress,
                    amt: req.amount,
                    note: req.note,
                    exp: req.expiryHours,
                    cat: req.createdAt
                  }))}`);
                } catch (e) {}
              }}
            />
          )}

          {activeView === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              onMarkAllRead={handleMarkNotificationsRead}
              onClearAll={() => setNotifications([])}
              onMarkSingleRead={(id) => {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === id ? { ...n, read: true } : n))
                );
              }}
              onNavigate={handleNavigate}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              wallet={wallet}
              isMasked={isBalanceMasked}
              onToggleMask={() => setIsBalanceMasked(!isBalanceMasked)}
              onOpenNetworks={handleOpenNetworksModal}
              onDisconnectWallet={handleDisconnect}
              onConnectWallet={handleOpenWalletModal}
              onResetSimulation={handleResetDemoData}
              onOpenCreateUsername={() => handleOpenUsernameModal(connectedUsername ? 'change' : 'create')}
              dataMode={dataMode}
              onToggleDataMode={handleToggleDataMode}
            />
          )}
        </main>
      </div>

      {/* Slide-over Overlays */}
      <SendModal
        isOpen={activeModal === 'send'}
        onClose={() => {
          setActiveModal('none');
          setSendPrefill(null);
        }}
        wallet={wallet}
        onSendComplete={handleSendComplete}
        onOpenConnectWallet={handleOpenWalletModal}
        initialRecipient={sendPrefill?.recipient}
        initialAmount={sendPrefill?.amount}
        initialMemo={sendPrefill?.memo}
      />

      <ReceiveModal
        isOpen={activeModal === 'receive'}
        onClose={() => setActiveModal('none')}
        wallet={wallet}
        onOpenConnectWallet={handleOpenWalletModal}
        onOpenCreateUsername={() => handleOpenUsernameModal('create')}
      />

      {/* Unique Username Claim / Update Modal Dialog */}
      {wallet.address && (
        <UsernameModal
          isOpen={isUsernameModalOpen}
          onClose={handleCloseUsernameModal}
          walletAddress={wallet.address}
          currentUsername={connectedUsername}
          mode={usernameModalMode}
          onSuccess={handleUsernameSuccess}
        />
      )}

      {/* Connected Wallet Profile Modal with Deep Blurred Background */}
      {wallet.address && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          wallet={wallet}
          dataMode={dataMode}
          onToggleDataMode={handleToggleDataMode}
          onDisconnectWallet={handleDisconnect}
          onOpenNetworks={handleOpenNetworksModal}
          onOpenCreateUsername={() => {
            setIsProfileModalOpen(false);
            handleOpenUsernameModal(connectedUsername ? 'change' : 'create');
          }}
          transactionCount={transactions.length}
        />
      )}
    </div>
  );
}
