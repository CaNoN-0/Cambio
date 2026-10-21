import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Wallet, 
  Copy, 
  Check, 
  Clock, 
  AlertCircle, 
  ExternalLink, 
  ShieldCheck, 
  Send, 
  ArrowLeft,
  DollarSign,
  Loader2
} from 'lucide-react';
import { WalletState, PaymentRequest } from '../types';
import { shortenAddress, getExplorerAddressUrl } from '../utils/format';
import { isRequestExpired, formatExpiryRemaining } from '../utils/paymentRequest';
import { getUsernameForWallet, resolveUsername } from '../services/usernameRegistry';
import { ThemeToggle } from './ThemeToggle';
import { HalftonePattern } from './HalftonePattern';
import logoImage from '@/logo.png';

interface PaymentRequestPageProps {
  request: PaymentRequest;
  wallet: WalletState;
  onConnectWallet: () => void;
  onPayRequest: (request: PaymentRequest) => void;
  onGoToDashboard: () => void;
}

export const PaymentRequestPage: React.FC<PaymentRequestPageProps> = ({
  request,
  wallet,
  onConnectWallet,
  onPayRequest,
  onGoToDashboard,
}) => {
  const [copied, setCopied] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState<string>(request.recipientAddress || '');
  const [recipientUsername, setRecipientUsername] = useState<string | null>(
    request.recipientUsername || null
  );
  const [isResolving, setIsResolving] = useState<boolean>(!request.recipientAddress && !!request.recipientUsername);
  
  // Custom amount state when request was generated without a pre-set amount (e.g. general receive QR)
  const isFixedAmount = typeof request.amount === 'number' && request.amount > 0;
  const [enteredAmount, setEnteredAmount] = useState<string>(
    isFixedAmount ? request.amount.toString() : '10'
  );

  const effectiveAmount = isFixedAmount
    ? request.amount
    : parseFloat(enteredAmount) > 0
    ? parseFloat(enteredAmount)
    : 0;

  // Resolve recipient username or address
  useEffect(() => {
    let isCancelled = false;
    if (!recipientAddress && recipientUsername) {
      setIsResolving(true);
      resolveUsername(recipientUsername)
        .then((rec) => {
          if (!isCancelled && rec && rec.address) {
            setRecipientAddress(rec.address);
            if (rec.display) setRecipientUsername(rec.display.replace(/^@/, ''));
          }
          if (!isCancelled) setIsResolving(false);
        })
        .catch(() => {
          if (!isCancelled) setIsResolving(false);
        });
    } else if (!recipientUsername && recipientAddress) {
      getUsernameForWallet(recipientAddress).then((rec) => {
        if (!isCancelled && rec) {
          setRecipientUsername(rec.displayUsername || rec.username);
        }
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [recipientAddress, recipientUsername]);

  const expired = isRequestExpired(request);
  const isOwnRequest =
    wallet.isConnected &&
    wallet.address &&
    recipientAddress &&
    wallet.address.toLowerCase() === recipientAddress.toLowerCase();

  const handleCopyRecipient = () => {
    const textToCopy = recipientAddress || (recipientUsername ? `@${recipientUsername}` : '');
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePay = () => {
    if (effectiveAmount <= 0) return;
    onPayRequest({
      ...request,
      amount: effectiveAmount,
      recipientAddress: recipientAddress || request.recipientAddress,
      recipientUsername: recipientUsername || request.recipientUsername,
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F3] dark:bg-[#0C0C0D] text-[#111111] dark:text-[#F5F5F7] flex flex-col justify-between antialiased selection:bg-[#111111] selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-200">
      {/* Top Header matching landing page */}
      <header className="w-full shrink-0 border-b border-[#E2E2E0] dark:border-[#26262B] bg-[#FFFFFF]/80 dark:bg-[#111113]/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          <div 
            onClick={onGoToDashboard} 
            className="flex items-center gap-3 cursor-pointer group select-none"
            title="Open Cambio Dashboard"
          >
            <img
              src={logoImage}
              alt="Cambio Logo"
              className="w-9 h-9 object-contain dark:invert select-none transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-[16px] font-bold tracking-[0.12em] text-[#111111] dark:text-[#FFFFFF] uppercase leading-none font-sans">
              Cambio
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={onGoToDashboard}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-[#E2E2E0] dark:border-[#26262B] bg-white dark:bg-[#141416] hover:bg-[#F0F0EE] dark:hover:bg-[#1E1E22] text-[#111111] dark:text-[#FFFFFF] transition-all hover:border-[#111111] dark:hover:border-[#FFFFFF]"
            >
              <span>Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Payment Request Surface */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8 sm:py-14 flex flex-col justify-center">
        <div className="relative overflow-hidden bg-[#FFFFFF] dark:bg-[#141416] rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] p-6 sm:p-9 shadow-sm space-y-6">
          {/* Halftone Accent */}
          <div className="absolute -right-10 -top-10 w-44 h-44 pointer-events-none opacity-[0.08] dark:opacity-[0.12]">
            <HalftonePattern variant="sphere" className="w-full h-full" />
          </div>

          {/* Card Kicker & Status */}
          <div className="relative z-10 flex items-center justify-between text-xs font-sans">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
              MUSD Payment Request
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              expired
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${expired ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
              {expired ? 'Expired' : 'Active'}
            </span>
          </div>

          {/* Main Amount Section */}
          <div className="relative z-10 text-center py-2 space-y-2">
            <span className="text-xs sm:text-sm font-sans text-[#777777] dark:text-[#A0A0A0] block">
              {recipientUsername ? (
                <span>
                  Paying to <strong className="text-[#111111] dark:text-[#FFFFFF]">@{recipientUsername}</strong>
                </span>
              ) : recipientAddress ? (
                <span>
                  Paying to <strong className="text-[#111111] dark:text-[#FFFFFF]">{shortenAddress(recipientAddress)}</strong>
                </span>
              ) : (
                'Requested MUSD Payment'
              )}
            </span>

            {isFixedAmount ? (
              <div className="text-4xl sm:text-5xl font-bold font-mono tracking-tight text-[#111111] dark:text-[#FFFFFF]">
                ${request.amount.toFixed(2)}{' '}
                <span className="text-lg font-medium text-[#777777] dark:text-[#A0A0A0]">
                  MUSD
                </span>
              </div>
            ) : (
              /* Flexible Amount Input for general QR code payments */
              <div className="space-y-3 pt-1">
                <div className="relative max-w-xs mx-auto">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#777777] dark:text-[#A0A0A0] font-mono">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={enteredAmount}
                    onChange={(e) => setEnteredAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-18 py-3 text-3xl font-bold font-mono text-center rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] focus:border-[#111111] dark:focus:border-[#FFFFFF] text-[#111111] dark:text-[#FFFFFF] outline-none transition-all tabular-nums"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#777777] dark:text-[#A0A0A0] font-sans">
                    MUSD
                  </span>
                </div>

                {/* Preset Amount Badges */}
                <div className="flex items-center justify-center gap-2">
                  {['5', '10', '25', '50', '100'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setEnteredAmount(amt)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer ${
                        enteredAmount === amt
                          ? 'bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111]'
                          : 'bg-[#F0F0EE] dark:bg-[#1A1A1D] text-[#777777] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FFFFFF]'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs font-sans text-[#777777] dark:text-[#A0A0A0] pt-1">
              Settlement on Mezo Network (ID 31612)
            </p>
          </div>

          {/* Optional Note Card */}
          {request.note && (
            <div className="relative z-10 p-4 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
                Note from Recipient
              </span>
              <p className="text-sm font-sans text-[#111111] dark:text-[#FFFFFF] leading-relaxed">
                “{request.note}”
              </p>
            </div>
          )}

          {/* Recipient Details */}
          <div className="relative z-10 p-4 rounded-2xl bg-[#F0F0EE]/70 dark:bg-[#1A1A1D]/70 border border-[#E2E2E0] dark:border-[#26262B] space-y-2">
            <div className="flex items-center justify-between text-xs font-sans">
              <span className="font-semibold uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
                Pay To (Recipient)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyRecipient}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                {recipientAddress && (
                  <a
                    href={getExplorerAddressUrl(recipientAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] transition-colors"
                    title="View on Mezo Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {isResolving ? (
              <div className="flex items-center gap-2 text-xs text-[#777777] dark:text-[#A0A0A0]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Resolving recipient username...</span>
              </div>
            ) : recipientAddress ? (
              <div className="font-mono text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] break-all select-all">
                {recipientAddress}
              </div>
            ) : (
              <div className="font-sans text-xs font-medium text-[#777777] dark:text-[#A0A0A0]">
                @{recipientUsername}
              </div>
            )}
          </div>

          {/* Expiry Details */}
          {request.expiryHours && request.expiryHours > 0 ? (
            <div className="relative z-10 flex items-center justify-between text-xs font-sans text-[#777777] dark:text-[#A0A0A0] px-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatExpiryRemaining(request)}</span>
              </div>
              <span>ID: {request.id.slice(-8)}</span>
            </div>
          ) : null}

          {/* Primary Action Button */}
          <div className="relative z-10 pt-2 space-y-3 font-sans">
            {expired ? (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-center font-medium">
                This payment request has expired. Please ask the recipient for a new request.
              </div>
            ) : !wallet.isConnected ? (
              <button
                type="button"
                onClick={onConnectWallet}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] text-sm font-semibold tracking-wide shadow-sm hover:bg-[#262626] dark:hover:bg-[#EAEAEA] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet to Pay</span>
              </button>
            ) : isOwnRequest ? (
              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-xs text-center text-[#777777] dark:text-[#A0A0A0]">
                  This is your own receiving address ({shortenAddress(wallet.address)}).
                </div>
                <button
                  type="button"
                  onClick={onGoToDashboard}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-[#E2E2E0] dark:border-[#26262B] bg-white dark:bg-[#141416] text-xs font-semibold hover:border-[#111111] dark:hover:border-[#FFFFFF] transition-all cursor-pointer"
                >
                  <span>Go to Dashboard</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={effectiveAmount <= 0 || isResolving}
                onClick={handlePay}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] text-sm font-semibold tracking-wide shadow-sm hover:bg-[#262626] dark:hover:bg-[#EAEAEA] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {effectiveAmount > 0
                    ? `Pay $${effectiveAmount.toFixed(2)} MUSD`
                    : 'Enter an amount to Pay'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onGoToDashboard}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-sans text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Cambio Dashboard</span>
            </button>
          </div>

          {/* Footer Notice */}
          <div className="pt-2 border-t border-[#E2E2E0]/60 dark:border-[#26262B]/60 text-center font-sans">
            <span className="text-xs text-[#A0A0A0] dark:text-[#707070]">
              Mezo Network (Chain ID 31612) · Instant MUSD Settlement
            </span>
          </div>
        </div>
      </main>

      {/* Bottom Minimal Footer */}
      <footer className="w-full py-4 text-center text-xs font-sans text-[#A0A0A0] dark:text-[#707070]">
        Cambio MUSD Payment Protocol · Mezo Chain ID 31612
      </footer>
    </div>
  );
};
