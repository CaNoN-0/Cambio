import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowRight, 
  ArrowDown, 
  Clock, 
  AlertTriangle, 
  Check, 
  Loader2, 
  ExternalLink,
  ShieldAlert,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { SwapQuote, Transaction } from '../types';
import { HalftonePattern } from './HalftonePattern';
import btcLogo from '@/btc.png';
import mezoLogo from '@/mezo.png';
import usdcLogo from '@/usdc.png';
import { useCurrency } from '../context/CurrencyContext';

interface SwapReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: SwapQuote;
  onConfirmSwap: (quote: SwapQuote) => void;
  onRefreshQuote: () => void;
}

export const SwapReviewModal: React.FC<SwapReviewModalProps> = ({
  isOpen,
  onClose,
  quote,
  onConfirmSwap,
  onRefreshQuote,
}) => {
  const { preferredCurrency, formatTokenFiat } = useCurrency();
  const [secondsRemaining, setSecondsRemaining] = useState(quote.quoteExpirySeconds);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const inputFiat = formatTokenFiat(
    quote.inputAmount,
    quote.inputToken.symbol,
    quote.inputToken.usdPrice
  );
  const outputFiat = formatTokenFiat(
    quote.estimatedOutput,
    quote.outputToken.symbol,
    quote.outputToken.usdPrice
  );

  // Expiry countdown timer
  useEffect(() => {
    if (!isOpen || isSuccess || isConfirming) return;
    setSecondsRemaining(quote.quoteExpirySeconds);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          onRefreshQuote();
          return quote.quoteExpirySeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, quote.createdAt, isSuccess, isConfirming]);

  if (!isOpen) return null;

  const handleExecute = () => {
    setIsConfirming(true);
    // Simulate wallet signature & protocol interaction delay
    setTimeout(() => {
      setIsConfirming(false);
      setIsSuccess(true);
      onConfirmSwap(quote);
    }, 1400);
  };

  const handleFinish = () => {
    setIsSuccess(false);
    setIsConfirming(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={isConfirming ? undefined : onClose}
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#141416] rounded-3xl shadow-2xl border border-[#E2E2E0] dark:border-[#26262B] p-6 sm:p-8 z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Halftone watermark */}
        <div className="absolute right-0 top-0 w-36 h-36 pointer-events-none opacity-5 dark:opacity-10">
          <HalftonePattern variant="corner" className="w-full h-full" />
        </div>

        {isSuccess ? (
          /* Success Screen */
          <div className="relative z-10 py-6 text-center space-y-5 animate-in fade-in duration-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Check className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight font-sans">
                Swap Completed (Demo)
              </h3>
              <p className="text-xs sm:text-sm text-[#777777] dark:text-[#A0A0A0] max-w-sm mx-auto leading-relaxed">
                Swapped {quote.inputAmount} {quote.inputToken.symbol} for ~{quote.estimatedOutput.toFixed(6)} {quote.outputToken.symbol}. Your balances have been updated locally.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-xs font-mono text-[#777777] dark:text-[#A0A0A0] space-y-1 text-left">
              <div className="flex justify-between">
                <span>Settlement Asset:</span>
                <span className="text-[#111111] dark:text-[#FFFFFF] font-semibold">{quote.outputToken.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span>Protocol:</span>
                <span className="text-[#111111] dark:text-[#FFFFFF] font-semibold">Mezo Swap Router (Simulated)</span>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-2xl bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] text-sm font-semibold tracking-wide hover:bg-[#262626] dark:hover:bg-[#EAEAEA] transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          /* Review Screen */
          <div className="relative z-10 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E2E0] dark:border-[#26262B]">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#111111] dark:text-[#FFFFFF] font-sans">
                  Review Swap
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Prototype Preview
                </span>
              </div>
              <button
                disabled={isConfirming}
                onClick={onClose}
                className="p-1.5 rounded-xl text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] transition-all"
                aria-label="Close review"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Token Exchange Cards Display */}
            <div className="p-4 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] space-y-3">
              {/* You Pay row */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#777777] dark:text-[#A0A0A0] block">
                    You Pay
                  </span>
                  <span className="text-xl font-bold font-mono text-[#111111] dark:text-[#FFFFFF] block">
                    {quote.inputAmount} {quote.inputToken.symbol}
                  </span>
                  {inputFiat && (
                    <span className="text-[11px] text-[#777777] dark:text-[#A0A0A0] font-mono block mt-0.5">
                      ≈ {inputFiat.formatted} {preferredCurrency}
                    </span>
                  )}
                </div>
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#202024] border border-[#E2E2E0] dark:border-[#26262B] flex items-center justify-center font-mono font-bold text-xs overflow-hidden shrink-0">
                  {quote.inputToken.icon ? (
                    <img src={quote.inputToken.icon} alt={quote.inputToken.symbol} className="w-full h-full object-cover" />
                  ) : quote.inputToken.symbol === 'USDC' ? (
                    <img src={usdcLogo} alt={quote.inputToken.symbol} className="w-full h-full object-cover" />
                  ) : quote.inputToken.symbol === 'MUSD' || quote.inputToken.symbol.toLowerCase().includes('mezo') ? (
                    <img src={mezoLogo} alt={quote.inputToken.symbol} className="w-full h-full object-cover" />
                  ) : quote.inputToken.symbol.toLowerCase().includes('btc') ? (
                    <img src={btcLogo} alt={quote.inputToken.symbol} className="w-full h-full object-cover" />
                  ) : (
                    quote.inputToken.symbol.slice(0, 3)
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-[#E2E2E0] dark:bg-[#26262B] flex items-center justify-center text-[#777777] dark:text-[#A0A0A0]">
                  <ArrowDown className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* You Receive row */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#777777] dark:text-[#A0A0A0] block">
                    You Receive (Estimated)
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 block">
                    ~{quote.estimatedOutput.toFixed(6)} {quote.outputToken.symbol}
                  </span>
                  {outputFiat && (
                    <span className="text-[11px] text-[#777777] dark:text-[#A0A0A0] font-mono block mt-0.5">
                      ≈ {outputFiat.formatted} {preferredCurrency}
                    </span>
                  )}
                </div>
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#202024] border border-[#E2E2E0] dark:border-[#26262B] flex items-center justify-center font-mono font-bold text-xs overflow-hidden shrink-0">
                  {quote.outputToken.icon ? (
                    <img src={quote.outputToken.icon} alt={quote.outputToken.symbol} className="w-full h-full object-cover" />
                  ) : quote.outputToken.symbol === 'USDC' ? (
                    <img src={usdcLogo} alt={quote.outputToken.symbol} className="w-full h-full object-cover" />
                  ) : quote.outputToken.symbol === 'MUSD' || quote.outputToken.symbol.toLowerCase().includes('mezo') ? (
                    <img src={mezoLogo} alt={quote.outputToken.symbol} className="w-full h-full object-cover" />
                  ) : quote.outputToken.symbol.toLowerCase().includes('btc') ? (
                    <img src={btcLogo} alt={quote.outputToken.symbol} className="w-full h-full object-cover" />
                  ) : (
                    quote.outputToken.symbol.slice(0, 3)
                  )}
                </div>
              </div>
            </div>

            {/* Key Swap Parameters Breakdown */}
            <div className="p-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#777777] dark:text-[#A0A0A0] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Execution Rate
                </span>
                <span className="text-[#111111] dark:text-[#FFFFFF] font-semibold">
                  1 {quote.inputToken.symbol} ≈ {quote.exchangeRate >= 1000 ? quote.exchangeRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : quote.exchangeRate.toFixed(6)} {quote.outputToken.symbol}
                </span>
              </div>

              {quote.inputToken.usdPrice && quote.outputToken.usdPrice && (
                <div className="flex items-center justify-between text-[11px] text-[#888888] dark:text-[#666666]">
                  <span>Total Value (USD)</span>
                  <span>
                    ~${(quote.inputAmount * quote.inputToken.usdPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[#777777] dark:text-[#A0A0A0]">Slippage Tolerance</span>
                <span className="text-[#111111] dark:text-[#FFFFFF]">{quote.slippagePct}%</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#777777] dark:text-[#A0A0A0]">Minimum Received</span>
                <span className="text-[#111111] dark:text-[#FFFFFF] font-semibold">
                  {quote.minReceived >= 1000 ? quote.minReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : quote.minReceived.toFixed(6)} {quote.outputToken.symbol}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#777777] dark:text-[#A0A0A0]">Network Fee</span>
                <span className="text-[#111111] dark:text-[#FFFFFF]">{quote.networkFee}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#777777] dark:text-[#A0A0A0]">Price Impact</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{quote.priceImpact}</span>
              </div>
            </div>

            {/* Quote Expiry Indicator */}
            <div className="flex items-center justify-between px-1 text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Live rate locks in {secondsRemaining}s</span>
              </div>
              <button
                type="button"
                onClick={onRefreshQuote}
                className="flex items-center gap-1 hover:text-[#111111] dark:hover:text-[#FFFFFF] underline transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-emerald-500" />
                <span>Sync Latest Rate</span>
              </button>
            </div>

            {/* Prototype Mode Warning Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Prototype Environment Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                A live Mezo DEX router contract is required for on-chain liquidity routing. Confirming here executes an interactive local demonstration with updated demo balances.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isConfirming}
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl border border-[#E2E2E0] dark:border-[#26262B] bg-white dark:bg-[#141416] hover:bg-[#F0F0EE] dark:hover:bg-[#1E1E22] text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] transition-all"
              >
                Back
              </button>

              <button
                type="button"
                disabled={isConfirming}
                onClick={handleExecute}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] text-xs font-semibold tracking-wide hover:bg-[#262626] dark:hover:bg-[#EAEAEA] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <span>Confirm Swap</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
