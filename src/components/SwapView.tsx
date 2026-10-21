import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowUpDown, 
  ChevronDown, 
  Settings2, 
  Info, 
  Clock, 
  AlertCircle, 
  Wallet, 
  RefreshCw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ShieldCheck,
  Check
} from 'lucide-react';
import { WalletState, SwapToken, SwapQuote } from '../types';
import { getTokensWithBalances, calculateSwapQuote } from '../services/swapService';
import { useLiveRates, calculateLivePairRate } from '../services/liveRatesService';
import { TokenSelectModal } from './TokenSelectModal';
import { SwapReviewModal } from './SwapReviewModal';
import { HalftonePattern } from './HalftonePattern';
import { useCurrency } from '../context/CurrencyContext';
import btcLogo from '@/btc.png';
import mezoLogo from '@/mezo.png';
import usdcLogo from '@/usdc.png';

interface SwapViewProps {
  wallet: WalletState;
  onConnectWallet: () => void;
  onOpenNetworks: () => void;
  onSwapCompleted?: (quote: SwapQuote) => void;
}

export const SwapView: React.FC<SwapViewProps> = ({
  wallet,
  onConnectWallet,
  onOpenNetworks,
  onSwapCompleted,
}) => {
  // Live rates polling every 15 seconds
  const { rates, isLoading: isRatesLoading, lastRefreshedAt, refreshRates, isLive } = useLiveRates(15000);

  // Available tokens on Mezo with live rates injected
  const tokens = useMemo(() => getTokensWithBalances(wallet, rates), [wallet, rates]);

  // Selected input and output tokens
  const [inputToken, setInputToken] = useState<SwapToken>(() => tokens[0] || {
    symbol: 'MUSD',
    name: 'Mezo USD',
    decimals: 18,
    balance: wallet.balanceMusd,
    usdPrice: 1.00,
    change24h: 0.00,
    icon: mezoLogo,
  });

  const [outputToken, setOutputToken] = useState<SwapToken>(() => tokens[1] || {
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 18,
    balance: 0.45,
    usdPrice: 82850.00,
    change24h: 1.25,
    icon: btcLogo,
  });

  // Amounts
  const [inputAmount, setInputAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showSlippageMenu, setShowSlippageMenu] = useState<boolean>(false);
  const [showInverseRate, setShowInverseRate] = useState<boolean>(false);
  const [rateFlash, setRateFlash] = useState<boolean>(false);

  // Modals
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Global Preferred Currency
  const { preferredCurrency, formatTokenFiat } = useCurrency();

  // Seconds since last refresh counter
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.max(0, Math.floor((Date.now() - lastRefreshedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastRefreshedAt]);

  // Visual pulse flash whenever rates refresh
  useEffect(() => {
    setRateFlash(true);
    const flashTimer = setTimeout(() => setRateFlash(false), 900);
    return () => clearTimeout(flashTimer);
  }, [lastRefreshedAt]);

  // Sync token prices and balances when wallet or rates update
  useEffect(() => {
    const updated = getTokensWithBalances(wallet, rates);
    const updatedIn = updated.find((t) => t.symbol === inputToken.symbol);
    const updatedOut = updated.find((t) => t.symbol === outputToken.symbol);
    if (updatedIn) setInputToken(updatedIn);
    if (updatedOut) setOutputToken(updatedOut);
  }, [wallet.balanceMusd, wallet.isConnected, rates]);

  // Numeric amount
  const numericInput = parseFloat(inputAmount) || 0;

  // Active Quote calculated with current live market rates
  const quote = useMemo(
    () => calculateSwapQuote(inputToken, outputToken, numericInput, slippage, rates),
    [inputToken, outputToken, numericInput, slippage, rates]
  );

  // Preferred Currency Fiat Values
  const inputFiat = inputToken.usdPrice && numericInput > 0
    ? formatTokenFiat(numericInput, inputToken.symbol, inputToken.usdPrice)
    : null;

  const outputFiat = outputToken.usdPrice && quote && quote.estimatedOutput > 0
    ? formatTokenFiat(quote.estimatedOutput, outputToken.symbol, outputToken.usdPrice)
    : null;

  // Live Pair conversion info
  const pairRate = useMemo(
    () => calculateLivePairRate(inputToken.symbol, outputToken.symbol, rates),
    [inputToken.symbol, outputToken.symbol, rates]
  );

  // Invert tokens (swap direction)
  const handleInvertTokens = () => {
    const prevInput = inputToken;
    const prevOutput = outputToken;
    setInputToken(prevOutput);
    setOutputToken(prevInput);
    if (quote && quote.estimatedOutput > 0) {
      setInputAmount(quote.estimatedOutput.toFixed(4));
    }
  };

  // Quick Amount Selectors
  const handleSetMax = () => {
    if (inputToken.balance > 0) {
      const maxVal = inputToken.isNative ? Math.max(0, inputToken.balance - 0.0001) : inputToken.balance;
      setInputAmount(maxVal.toString());
    }
  };

  const handleSetHalf = () => {
    if (inputToken.balance > 0) {
      setInputAmount((inputToken.balance / 2).toFixed(4));
    }
  };

  // Validation States
  const isWrongNetwork = wallet.isConnected && !wallet.isMezoNetwork;
  const isInsufficientBalance = wallet.isConnected && numericInput > inputToken.balance;
  const isAmountValid = numericInput > 0;
  const isPairValid = inputToken.symbol !== outputToken.symbol;

  // Format currency helpers
  const formatPrice = (val?: number) => {
    if (val === undefined || isNaN(val)) return '$0.00';
    if (val >= 1000) {
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (val >= 1) {
      return `$${val.toFixed(2)}`;
    }
    return `$${val.toFixed(4)}`;
  };

  const formatRate = (r: number) => {
    if (r >= 1000) return r.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (r >= 1) return r.toFixed(4);
    if (r >= 0.0001) return r.toFixed(6);
    return r.toFixed(8);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Page Header with Live Rates Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E2E2E0] dark:border-[#26262B]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#FFFFFF] font-sans">
              Swap tokens
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-[#555555] dark:text-[#A0A0A0] font-sans">
            Real-time market rates synced across Mezo, Coinbase, and Binance.
          </p>
        </div>

        {/* Live Status, Refresh & Slippage Pill */}
        <div className="flex items-center gap-2">
          {/* Manual Rates Refresh Button */}
          <button
            type="button"
            onClick={() => refreshRates()}
            disabled={isRatesLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium border border-[#E2E2E0] dark:border-[#26262B] bg-white dark:bg-[#141416] hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] text-[#555555] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Force refresh live rates"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isRatesLoading ? 'animate-spin' : ''}`} />
            <span>
              {isRatesLoading ? 'Syncing...' : secondsAgo < 5 ? 'Just updated' : `${secondsAgo}s ago`}
            </span>
          </button>

          {/* Slippage Settings Button */}
          <div className="relative">
            <button
              onClick={() => setShowSlippageMenu(!showSlippageMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium border border-[#E2E2E0] dark:border-[#26262B] bg-white dark:bg-[#141416] hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] transition-all"
              title="Slippage tolerance"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{slippage}%</span>
            </button>

            {/* Slippage popover */}
            {showSlippageMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#141416] rounded-2xl shadow-xl border border-[#E2E2E0] dark:border-[#26262B] p-3 text-xs z-30 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0] block">
                  Slippage Tolerance
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[0.1, 0.5, 1.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSlippage(s);
                        setShowSlippageMenu(false);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-mono text-center border transition-all ${
                        slippage === s
                          ? 'bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] border-[#111111] dark:border-[#FFFFFF]'
                          : 'bg-[#F5F5F3] dark:bg-[#1A1A1D] border-transparent text-[#777777] dark:text-[#A0A0A0] hover:border-[#E2E2E0] dark:hover:border-[#26262B]'
                      }`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Swap Interface Layout: Swap Card on Left, Live Rate Intelligence on Right */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 xl:col-span-7 relative overflow-hidden bg-white dark:bg-[#141416] rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] p-5 sm:p-7 shadow-xs space-y-4">
          {/* Halftone decorative corner accent */}
          <div className="absolute right-0 top-0 w-36 h-36 pointer-events-none opacity-5 dark:opacity-10">
            <HalftonePattern variant="corner" className="w-full h-full" />
          </div>

          {/* Section: "You pay" */}
          <div className="relative z-10 p-4 sm:p-4.5 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
                You pay
              </span>

              {/* Balance & Quick Buttons */}
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-[#777777] dark:text-[#A0A0A0]">Balance:</span>
                <span className="font-semibold text-[#111111] dark:text-[#FFFFFF]">
                  {inputToken.balance.toLocaleString('en-US', {
                    minimumFractionDigits: inputToken.decimals > 8 ? 4 : 2,
                    maximumFractionDigits: 6,
                  })}
                </span>
                {inputToken.balance > 0 && (
                  <div className="flex items-center gap-1 ml-1">
                    <button
                      type="button"
                      onClick={handleSetHalf}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-white dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] text-[#777777] hover:text-[#111111] dark:hover:text-[#FFFFFF] transition-all cursor-pointer"
                    >
                      HALF
                    </button>
                    <button
                      type="button"
                      onClick={handleSetMax}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] font-semibold transition-all hover:opacity-90 cursor-pointer"
                    >
                      MAX
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.0"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="w-full bg-transparent text-2xl sm:text-3xl font-bold font-mono text-[#111111] dark:text-[#FFFFFF] focus:outline-none placeholder:text-[#AAAAAA] dark:placeholder:text-[#555555]"
              />

              {/* Input Token Selector Button */}
              <button
                type="button"
                onClick={() => setIsInputModalOpen(true)}
                className="flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-xl bg-white dark:bg-[#202024] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#111111] dark:hover:border-[#FFFFFF] shadow-xs text-xs font-bold text-[#111111] dark:text-[#FFFFFF] transition-all shrink-0 cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] flex items-center justify-center font-mono text-[9px] overflow-hidden shrink-0">
                  {inputToken.icon ? (
                    <img src={inputToken.icon} alt={inputToken.symbol} className="w-full h-full object-cover" />
                  ) : inputToken.symbol === 'USDC' ? (
                    <img src={usdcLogo} alt={inputToken.symbol} className="w-full h-full object-cover" />
                  ) : inputToken.symbol === 'MUSD' || inputToken.symbol.toLowerCase().includes('mezo') ? (
                    <img src={mezoLogo} alt={inputToken.symbol} className="w-full h-full object-cover" />
                  ) : inputToken.symbol.toLowerCase().includes('btc') ? (
                    <img src={btcLogo} alt={inputToken.symbol} className="w-full h-full object-cover" />
                  ) : (
                    inputToken.symbol.slice(0, 2)
                  )}
                </div>
                <span>{inputToken.symbol}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#777777] dark:text-[#A0A0A0]" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0]">
              <span>
                {inputFiat
                  ? `≈ ${inputFiat.formatted} ${preferredCurrency}`
                  : `0.00 ${preferredCurrency}`}
              </span>
              <span className="text-[10px] text-[#999999] dark:text-[#666666]">
                1 {inputToken.symbol} = {formatPrice(inputToken.usdPrice)}
              </span>
            </div>
          </div>

          {/* Swap-Direction Button */}
          <div className="relative flex justify-center -my-2 z-20">
            <button
              type="button"
              onClick={handleInvertTokens}
              className="group p-2.5 rounded-2xl bg-white dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#111111] dark:hover:border-[#FFFFFF] shadow-sm text-[#111111] dark:text-[#FFFFFF] hover:rotate-180 transition-all duration-300 active:scale-90 cursor-pointer"
              aria-label="Invert swap tokens"
              title="Switch swap tokens"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>

          {/* Section: "You receive" */}
          <div className="relative z-10 p-4 sm:p-4.5 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
                You receive (Estimated)
              </span>

              {/* Output Balance */}
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-[#777777] dark:text-[#A0A0A0]">Balance:</span>
                <span className="font-semibold text-[#111111] dark:text-[#FFFFFF]">
                  {outputToken.balance.toLocaleString('en-US', {
                    minimumFractionDigits: outputToken.decimals > 8 ? 4 : 2,
                    maximumFractionDigits: 6,
                  })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="w-full text-2xl sm:text-3xl font-bold font-mono text-[#111111] dark:text-[#FFFFFF] truncate">
                {quote ? (
                  quote.estimatedOutput >= 1000
                    ? quote.estimatedOutput.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                    : quote.estimatedOutput.toFixed(6)
                ) : (
                  '0.0'
                )}
              </div>

              {/* Output Token Selector Button */}
              <button
                type="button"
                onClick={() => setIsOutputModalOpen(true)}
                className="flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-xl bg-white dark:bg-[#202024] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#111111] dark:hover:border-[#FFFFFF] shadow-xs text-xs font-bold text-[#111111] dark:text-[#FFFFFF] transition-all shrink-0 cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] flex items-center justify-center font-mono text-[9px] overflow-hidden shrink-0">
                  {outputToken.icon ? (
                    <img src={outputToken.icon} alt={outputToken.symbol} className="w-full h-full object-cover" />
                  ) : outputToken.symbol === 'USDC' ? (
                    <img src={usdcLogo} alt={outputToken.symbol} className="w-full h-full object-cover" />
                  ) : outputToken.symbol === 'MUSD' || outputToken.symbol.toLowerCase().includes('mezo') ? (
                    <img src={mezoLogo} alt={outputToken.symbol} className="w-full h-full object-cover" />
                  ) : outputToken.symbol.toLowerCase().includes('btc') ? (
                    <img src={btcLogo} alt={outputToken.symbol} className="w-full h-full object-cover" />
                  ) : (
                    outputToken.symbol.slice(0, 2)
                  )}
                </div>
                <span>{outputToken.symbol}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#777777] dark:text-[#A0A0A0]" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0]">
              <span>
                {outputFiat
                  ? `≈ ${outputFiat.formatted} ${preferredCurrency}`
                  : `0.00 ${preferredCurrency}`}
              </span>
              <span className="text-[10px] text-[#999999] dark:text-[#666666]">
                1 {outputToken.symbol} = {formatPrice(outputToken.usdPrice)}
              </span>
            </div>
          </div>

          {/* Details & Quote Accordion */}
          {quote && numericInput > 0 && (
            <div className="p-4 rounded-2xl bg-[#FAFAF9] dark:bg-[#161618] border border-[#E2E2E0] dark:border-[#26262B] space-y-2.5 text-xs font-mono animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#E2E2E0]/60 dark:border-[#26262B]/60">
                <div className="flex items-center gap-1.5 text-[#555555] dark:text-[#A0A0A0]">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Execution Rate (Live)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#111111] dark:text-[#FFFFFF]">
                    1 {inputToken.symbol} = {formatRate(quote.exchangeRate)} {outputToken.symbol}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowInverseRate(!showInverseRate)}
                    className="text-[10px] text-[#777777] hover:text-[#111111] dark:hover:text-[#FFFFFF] underline"
                  >
                    ⇄
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#777777] dark:text-[#A0A0A0]">Network Fee</span>
                <span className="text-[#111111] dark:text-[#FFFFFF]">{quote.networkFee}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#777777] dark:text-[#A0A0A0]">Price Impact</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{quote.priceImpact}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#777777] dark:text-[#A0A0A0]">Minimum Received</span>
                <span className="text-[#111111] dark:text-[#FFFFFF] font-semibold">
                  {quote.minReceived.toFixed(6)} {outputToken.symbol}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#E2E2E0]/40 dark:border-[#26262B]/40 text-[10px] text-[#888888] dark:text-[#666666]">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Oracle Feed: {rates[inputToken.symbol]?.source || 'Mezo Consolidated'}</span>
                </div>
                <span>Auto-refreshes every 15s</span>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="pt-2">
            {!wallet.isConnected ? (
              <button
                type="button"
                onClick={onConnectWallet}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] text-sm font-semibold tracking-wide shadow-sm hover:bg-[#262626] dark:hover:bg-[#EAEAEA] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </button>
            ) : isWrongNetwork ? (
              <button
                type="button"
                onClick={onOpenNetworks}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-amber-600 text-white text-sm font-semibold tracking-wide hover:bg-amber-700 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Switch to Mezo Network</span>
              </button>
            ) : !isPairValid ? (
              <button
                disabled
                className="w-full py-4 rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] text-[#777777] dark:text-[#A0A0A0] text-sm font-semibold tracking-wide cursor-not-allowed"
              >
                Select Different Tokens
              </button>
            ) : !isAmountValid ? (
              <button
                disabled
                className="w-full py-4 rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] text-[#777777] dark:text-[#A0A0A0] text-sm font-semibold tracking-wide cursor-not-allowed"
              >
                Enter an Amount
              </button>
            ) : isInsufficientBalance ? (
              <button
                disabled
                className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-semibold tracking-wide cursor-not-allowed"
              >
                Insufficient {inputToken.symbol} Balance
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] text-sm font-semibold tracking-wide shadow-sm hover:bg-[#262626] dark:hover:bg-[#EAEAEA] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Review Swap at Live Rate</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Protocol Intelligence & Settlement Safeguards */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-3.5">
          {/* Direct Settlement & Non-Custodial Safety Card */}
          <div className="p-4 sm:p-4.5 rounded-2xl bg-white dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] space-y-1.5 shadow-xs text-xs font-mono text-[#777777] dark:text-[#A0A0A0]">
            <span className="font-semibold text-xs text-[#111111] dark:text-[#FFFFFF] block">
              Direct Settlement
            </span>
            <p className="text-[11px] leading-relaxed">
              Swaps on Mezo settle directly into your connected non-custodial address with transparent oracle execution.
            </p>
          </div>

          {/* Slippage & Auto-routing Card */}
          <div className="p-4 sm:p-4.5 rounded-2xl bg-white dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] space-y-1.5 shadow-xs text-xs font-mono text-[#777777] dark:text-[#A0A0A0]">
            <span className="font-semibold text-xs text-[#111111] dark:text-[#FFFFFF] block">
              Slippage & Routing Protection
            </span>
            <p className="text-[11px] leading-relaxed">
              Live quote safeguards you from unexpected slippage by enforcing minimum received thresholds on execution.
            </p>
          </div>
        </div>
      </div>

      {/* Input Token Selector Modal with Live Rates */}
      <TokenSelectModal
        isOpen={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
        tokens={tokens}
        selectedToken={inputToken}
        onSelectToken={(token) => setInputToken(token)}
        disabledTokenSymbol={outputToken.symbol}
        title="Pay with"
      />

      {/* Output Token Selector Modal with Live Rates */}
      <TokenSelectModal
        isOpen={isOutputModalOpen}
        onClose={() => setIsOutputModalOpen(false)}
        tokens={tokens}
        selectedToken={outputToken}
        onSelectToken={(token) => setOutputToken(token)}
        disabledTokenSymbol={inputToken.symbol}
        title="Receive"
      />

      {/* Quote Review Modal */}
      {quote && (
        <SwapReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          quote={quote}
          onConfirmSwap={(q) => {
            if (onSwapCompleted) {
              onSwapCompleted(q);
            }
          }}
          onRefreshQuote={() => {
            refreshRates();
          }}
        />
      )}
    </div>
  );
};
