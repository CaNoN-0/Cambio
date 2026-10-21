import React from 'react';
import { Eye, EyeOff, Wallet, Loader2 } from 'lucide-react';
import { WalletState } from '../types';
import { shortenAddress } from '../utils/format';
import { HalftonePattern } from './HalftonePattern';
import { SendPlaneIcon } from './SendPlaneIcon';
import { ReceivePlaneIcon } from './ReceivePlaneIcon';
import { useCurrency } from '../context/CurrencyContext';

interface BalanceCardProps {
  wallet: WalletState;
  isMasked: boolean;
  onToggleMask: () => void;
  onSend: () => void;
  onReceive: () => void;
  onConnectWallet: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  wallet,
  isMasked,
  onToggleMask,
  onSend,
  onReceive,
  onConnectWallet,
}) => {
  const { preferredCurrency, formatTokenFiat, rateStatus } = useCurrency();

  const formattedBalance = wallet.isConnected
    ? wallet.balanceMusd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00';

  const fiatEstimate = wallet.isConnected
    ? formatTokenFiat(wallet.balanceMusd, 'MUSD', 1.0)
    : null;

  return (
    <div className="relative overflow-hidden bg-[#FFFFFF] dark:bg-[#141416] rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] p-6 sm:p-9 shadow-xs transition-all duration-300 hover:border-[#C8C8C5] dark:hover:border-[#3A3A40]">
      {/* Editorial Halftone Sphere Watermark in corner */}
      <div className="absolute -right-12 -top-12 w-64 h-64 sm:w-80 sm:h-80 pointer-events-none opacity-[0.14] dark:opacity-[0.18]">
        <HalftonePattern variant="sphere" className="w-full h-full" />
      </div>

      {/* Top row: Label & Visibility Toggle */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-sans font-medium uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
            Total Balance
          </span>
        </div>

        <button
          onClick={onToggleMask}
          className="p-1.5 text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] rounded-xl hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] transition-all duration-150 cursor-pointer"
          aria-label={isMasked ? 'Reveal balance' : 'Hide balance'}
          title={isMasked ? 'Reveal balance' : 'Hide balance'}
        >
          {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Balance Display */}
      <div className="relative z-10 mt-5">
        {isMasked ? (
          <div className="text-4xl sm:text-6xl font-bold tracking-tight text-[#111111] dark:text-[#FFFFFF] font-mono py-1 select-none">
            ••••••••
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-bold tracking-tight text-[#111111] dark:text-[#FFFFFF] font-mono tabular-nums leading-none">
                {formattedBalance}
              </span>
              <span className="text-base sm:text-lg font-sans font-bold text-[#777777] dark:text-[#A0A0A0] ml-1 tracking-wider uppercase">
                MUSD
              </span>
            </div>

            {/* Subtitle Fiat Estimate */}
            {wallet.isConnected && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs sm:text-sm font-mono text-[#777777] dark:text-[#A0A0A0]">
                <span>≈</span>
                <span className="font-semibold text-[#111111] dark:text-[#FFFFFF] tabular-nums">
                  {fiatEstimate ? fiatEstimate.formatted : 'Price unavailable'}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
                  {preferredCurrency}
                </span>
                {rateStatus === 'stale' && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans ml-1">
                    (cached)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connection status line */}
      <div className="relative z-10 mt-4 flex items-center gap-2 text-xs sm:text-sm text-[#777777] dark:text-[#A0A0A0] font-sans">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            wallet.isConnected ? 'bg-[#111111] dark:bg-[#FFFFFF]' : 'bg-[#A0A0A0]'
          }`}
        />
        {wallet.isConnected ? (
          <span>
            Connected via <strong className="text-[#111111] dark:text-[#FFFFFF] font-mono">{shortenAddress(wallet.address)}</strong> · {wallet.isDemoBalance ? 'Demo MUSD simulation mode.' : 'Real Data · Live settlement on Mezo.'}
          </span>
        ) : wallet.status === 'connecting' ? (
          <span className="flex items-center gap-1.5 font-sans text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#111111] dark:text-[#FFFFFF]" />
            Awaiting wallet approval...
          </span>
        ) : (
          <span className="text-xs font-sans">
            Wallet disconnected · Connect via WalletConnect to test transfers.
          </span>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="relative z-10 mt-8 pt-6 border-t border-[#E2E2E0] dark:border-[#26262B] flex flex-wrap items-center gap-3 sm:gap-4">
        <button
          onClick={onSend}
          className="group flex-1 min-w-[140px] flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#111111] dark:bg-[#FFFFFF] hover:bg-[#262626] dark:hover:bg-white/90 text-white dark:text-[#111111] text-sm font-semibold tracking-wide transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer"
        >
          <SendPlaneIcon className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          <span>Send MUSD</span>
        </button>

        <button
          onClick={onReceive}
          className="group flex-1 min-w-[140px] flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white dark:bg-[#1A1A1D] hover:bg-[#F0F0EE] dark:hover:bg-[#242428] text-[#111111] dark:text-[#FFFFFF] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#C8C8C5] dark:hover:border-[#3A3A40] text-sm font-semibold tracking-wide transition-all duration-200 shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer"
        >
          <ReceivePlaneIcon className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
          <span>Receive</span>
        </button>

        {!wallet.isConnected && (
          <button
            onClick={onConnectWallet}
            className="group w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] hover:bg-[#E2E2E0] dark:hover:bg-[#26262B] text-[#111111] dark:text-[#FFFFFF] text-sm font-semibold transition-all duration-200 active:scale-[0.98] border border-[#E2E2E0] dark:border-[#26262B] cursor-pointer"
          >
            <Wallet className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
            <span className="font-sans text-xs uppercase tracking-wider font-semibold">Connect</span>
          </button>
        )}
      </div>
    </div>
  );
};
