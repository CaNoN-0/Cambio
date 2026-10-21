/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowUpRight, 
  Check, 
  AlertCircle, 
  Wallet, 
  AtSign, 
  Loader2, 
  ShieldCheck, 
  ArrowLeft,
  Search
} from 'lucide-react';
import { WalletState, Transaction } from '../types';
import { shortenAddress } from '../utils/format';
import { resolveUsername, getUsernameForWallet } from '../services/usernameRegistry';
import { HalftonePattern } from './HalftonePattern';
import { useCurrency } from '../context/CurrencyContext';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState;
  onSendComplete: (tx: Transaction) => void;
  onOpenConnectWallet: () => void;
  initialRecipient?: string;
  initialAmount?: string;
  initialMemo?: string;
}

export const SendModal: React.FC<SendModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onSendComplete,
  onOpenConnectWallet,
  initialRecipient,
  initialAmount,
  initialMemo,
}) => {
  const [recipientInput, setRecipientInput] = useState(initialRecipient || '');
  const [amount, setAmount] = useState(initialAmount || '');
  const [memo, setMemo] = useState(initialMemo || '');

  // Resolution state
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedRecipient, setResolvedRecipient] = useState<{
    address: string;
    display: string;
    isVerified: boolean;
  } | null>(null);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  // Flow step: 'form' | 'review' | 'success'
  const [step, setStep] = useState<'form' | 'review' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTx, setSuccessTx] = useState<Transaction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialRecipient !== undefined) setRecipientInput(initialRecipient);
      if (initialAmount !== undefined) setAmount(initialAmount);
      if (initialMemo !== undefined) setMemo(initialMemo);
      setStep('form');
      setSuccessTx(null);
      setFormError(null);
      setResolvedRecipient(null);
      setResolutionError(null);
    }
  }, [isOpen, initialRecipient, initialAmount, initialMemo]);

  // Real-time resolution effect
  useEffect(() => {
    if (!isOpen) return;
    const input = recipientInput.trim();
    if (!input) {
      setResolvedRecipient(null);
      setResolutionError(null);
      setIsResolving(false);
      return;
    }

    const timer = setTimeout(async () => {
      // If it looks like a hex Ethereum / Mezo address
      if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
        setIsResolving(true);
        try {
          const matchedUsername = await getUsernameForWallet(input);
          setResolvedRecipient({
            address: input,
            display: matchedUsername ? matchedUsername.displayUsername : shortenAddress(input),
            isVerified: true,
          });
          setResolutionError(null);
        } catch (e) {
          setResolvedRecipient({
            address: input,
            display: shortenAddress(input),
            isVerified: true,
          });
          setResolutionError(null);
        } finally {
          setIsResolving(false);
        }
        return;
      }

      // If it's a username (either with @ or alphanumeric handle)
      if (input.startsWith('@') || /^[a-zA-Z0-9_]{3,20}$/.test(input)) {
        setIsResolving(true);
        try {
          const resolved = await resolveUsername(input);
          if (resolved) {
            setResolvedRecipient(resolved);
            setResolutionError(null);
          } else {
            setResolvedRecipient(null);
            setResolutionError('Username not found');
          }
        } catch (err) {
          setResolvedRecipient(null);
          setResolutionError('Failed to resolve username');
        } finally {
          setIsResolving(false);
        }
        return;
      }

      // Otherwise if incomplete address
      if (input.startsWith('0x') && input.length < 42) {
        setResolvedRecipient(null);
        setResolutionError('Incomplete wallet address');
        return;
      }

      setResolvedRecipient(null);
      setResolutionError('Enter a valid @username or 0x wallet address');
    }, 250);

    return () => clearTimeout(timer);
  }, [recipientInput, isOpen]);

  if (!isOpen) return null;

  const { preferredCurrency, formatTokenFiat } = useCurrency();
  const numericAmount = parseFloat(amount) || 0;
  const fiatEstimate = numericAmount > 0 ? formatTokenFiat(numericAmount, 'MUSD', 1.0) : null;

  const handleQuickPercent = (pct: number) => {
    if (!wallet.isConnected) return;
    const calculated = (wallet.balanceMusd * pct).toFixed(2);
    setAmount(calculated);
    setFormError(null);
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.isConnected) {
      onOpenConnectWallet();
      return;
    }

    if (!recipientInput.trim()) {
      setFormError('Please enter a username or wallet address.');
      return;
    }

    if (!resolvedRecipient) {
      setFormError(resolutionError || 'Please provide a valid recipient before proceeding.');
      return;
    }

    if (numericAmount <= 0) {
      setFormError('Please specify an amount greater than 0.');
      return;
    }

    if (numericAmount > wallet.balanceMusd) {
      setFormError('Amount exceeds your available demo MUSD balance.');
      return;
    }

    setFormError(null);
    setStep('review');
  };

  const handleConfirmAndSend = () => {
    if (!resolvedRecipient) return;

    setIsSubmitting(true);
    setFormError(null);

    setTimeout(() => {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        type: 'send',
        amount: numericAmount,
        currency: 'MUSD',
        counterparty: resolvedRecipient.display,
        counterpartyAddress: resolvedRecipient.address,
        timestamp: 'Just now',
        status: 'completed',
        note: memo.trim() || undefined,
        txHash: `0x${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
        isDemo: true,
      };

      setIsSubmitting(false);
      setSuccessTx(newTx);
      setStep('success');
      onSendComplete(newTx);
    }, 500);
  };

  const handleResetAndClose = () => {
    setRecipientInput('');
    setAmount('');
    setMemo('');
    setStep('form');
    setSuccessTx(null);
    setFormError(null);
    setResolvedRecipient(null);
    setResolutionError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center sm:justify-end bg-black/60 dark:bg-black/80 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={isSubmitting ? undefined : handleResetAndClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-modal-title"
    >
      <div
        className="relative bg-[#FFFFFF] dark:bg-[#141416] w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] sm:rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] flex flex-col shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle halftone corner flourish */}
        <HalftonePattern variant="corner" className="absolute right-0 top-0 w-36 h-36 opacity-10 dark:opacity-15 pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-[#E2E2E0] dark:border-[#26262B]">
          <div className="flex items-center gap-3">
            {step === 'review' ? (
              <button
                type="button"
                onClick={() => setStep('form')}
                className="p-1.5 rounded-lg border border-[#E2E2E0] dark:border-[#26262B] hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] text-[#111111] dark:text-[#FFFFFF] transition-all"
                title="Back to edit"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] flex items-center justify-center shadow-xs">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 id="send-modal-title" className="text-base font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight font-sans">
                {step === 'review' ? 'Review transfer' : 'Send MUSD'}
              </h2>
            </div>
          </div>

          <button
            onClick={handleResetAndClose}
            disabled={isSubmitting}
            className="p-2 text-[#777777] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FFFFFF] rounded-xl hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] hover:rotate-90 transition-all duration-150 disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative z-10 p-6 flex-1 space-y-6">
          {step === 'success' && successTx ? (
            /* Success Receipt */
            <div className="py-8 text-center space-y-4">
              <div className="relative inline-block mx-auto">
                <div className="w-16 h-16 rounded-full bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] flex items-center justify-center relative z-10 shadow-xs">
                  <Check className="w-8 h-8" />
                </div>
                <HalftonePattern variant="sphere" className="absolute -inset-6 w-28 h-28 opacity-25 pointer-events-none" />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#777777] dark:text-[#A0A0A0]">
                  Payment Executed
                </span>
                <h3 className="text-2xl font-bold tracking-tight text-[#111111] dark:text-[#FFFFFF] font-mono mt-1">
                  ${successTx.amount.toFixed(2)} MUSD
                </h3>
                <p className="text-xs text-[#777777] dark:text-[#A0A0A0] mt-1 font-mono">
                  Transferred to {successTx.counterparty}
                </p>
              </div>

              <div className="bg-[#F0F0EE] dark:bg-[#1A1A1D] p-4 rounded-2xl border border-[#E2E2E0] dark:border-[#26262B] text-xs text-left space-y-2.5 mt-4 font-mono">
                <div className="flex justify-between">
                  <span className="text-[#777777] dark:text-[#A0A0A0]">RECIPIENT</span>
                  <span className="text-[#111111] dark:text-[#FFFFFF] font-semibold">{successTx.counterparty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777777] dark:text-[#A0A0A0]">DESTINATION</span>
                  <span className="text-[#111111] dark:text-[#FFFFFF] text-[11px]">{shortenAddress(successTx.counterpartyAddress)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777777] dark:text-[#A0A0A0]">NETWORK</span>
                  <span className="text-[#111111] dark:text-[#FFFFFF]">{wallet.networkName || 'MEZO'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777777] dark:text-[#A0A0A0]">STATUS</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">SETTLED (DEMO)</span>
                </div>
              </div>

              <button
                onClick={handleResetAndClose}
                className="w-full py-3.5 rounded-2xl bg-[#111111] hover:bg-[#262626] dark:bg-[#FFFFFF] dark:text-[#111111] dark:hover:bg-white/90 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all duration-150 shadow-xs active:scale-[0.98]"
              >
                Close Receipt
              </button>
            </div>
          ) : step === 'review' && resolvedRecipient ? (
            /* Review Recipient & Amount Stage */
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Highlight Card per spec */}
              <div className="p-5 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#777777] dark:text-[#A0A0A0]">
                  Recipient Verification
                </div>

                <div className="space-y-1">
                  <div className="text-base font-bold text-[#111111] dark:text-[#FFFFFF] font-sans flex items-center gap-1.5">
                    <span>Sending to</span>
                    <span className="text-[#111111] dark:text-[#FFFFFF] underline decoration-indigo-500 underline-offset-4">
                      {resolvedRecipient.display}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[#555555] dark:text-[#A0A0A0] break-all bg-white dark:bg-[#141416] p-2.5 rounded-xl border border-[#E2E2E0] dark:border-[#26262B]">
                    {resolvedRecipient.address}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Resolved through trusted Cambio username registry</span>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="p-4 rounded-2xl bg-[#F0F0EE]/80 dark:bg-[#1A1A1D]/80 border border-[#E2E2E0] dark:border-[#26262B] space-y-2 text-xs font-mono">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#777777] dark:text-[#A0A0A0]">AMOUNT</span>
                  <div className="text-right">
                    <span className="text-xl font-bold font-mono text-[#111111] dark:text-[#FFFFFF] block">
                      {numericAmount.toFixed(2)} MUSD
                    </span>
                    <span className="text-xs font-mono text-[#777777] dark:text-[#A0A0A0] block mt-0.5">
                      ≈ {fiatEstimate ? `${fiatEstimate.formatted} ${preferredCurrency}` : 'Price unavailable'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777777] dark:text-[#A0A0A0]">ESTIMATED FEE</span>
                  <span className="text-[#111111] dark:text-[#FFFFFF]">~0.001 MUSD</span>
                </div>
                {memo && (
                  <div className="flex justify-between border-t border-[#E2E2E0]/60 dark:border-[#26262B]/60 pt-1.5">
                    <span className="text-[#777777] dark:text-[#A0A0A0]">MEMO</span>
                    <span className="text-[#111111] dark:text-[#FFFFFF] font-sans truncate max-w-[200px]">{memo}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 px-4 rounded-xl border border-[#E2E2E0] dark:border-[#26262B] bg-white dark:bg-[#141416] hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] transition-all"
                >
                  Edit Transfer
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndSend}
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-[#111111] hover:bg-[#262626] dark:bg-[#FFFFFF] dark:text-[#111111] dark:hover:bg-white/90 text-white text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending MUSD...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Send</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Input Form Stage */
            <form onSubmit={handleProceedToReview} className="space-y-5">
              {!wallet.isConnected ? (
                <div className="p-4 rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] flex items-start gap-3 text-xs text-[#777777] dark:text-[#A0A0A0]">
                  <Wallet className="w-4 h-4 text-[#111111] dark:text-[#FFFFFF] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#111111] dark:text-[#FFFFFF] uppercase tracking-wide font-mono text-[11px]">Wallet Disconnected</span>
                    <p className="mt-0.5">
                      Connect your crypto wallet via WalletConnect to authorize transfers.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenConnectWallet();
                      }}
                      className="mt-2 text-[#111111] dark:text-[#FFFFFF] font-mono text-[11px] font-bold uppercase tracking-wider underline inline-flex items-center gap-1"
                    >
                      Connect Wallet →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">Debit Account</span>
                  <span className="font-mono font-semibold text-[#111111] dark:text-[#FFFFFF]">
                    {wallet.username ? `@${wallet.username}` : shortenAddress(wallet.address)}
                  </span>
                </div>
              )}

              {/* Recipient Input supporting username and address */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF]">
                    Recipient
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={recipientInput}
                    onChange={(e) => {
                      setRecipientInput(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Enter a username (e.g. @jomi) or wallet address"
                    className="w-full pl-4 pr-10 py-3 text-sm rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] hover:bg-[#EAEAEA] dark:hover:bg-[#202024] focus:bg-white dark:focus:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#C8C8C5] dark:hover:border-[#3A3A40] focus:border-[#111111] dark:focus:border-[#FFFFFF] text-[#111111] dark:text-[#FFFFFF] placeholder-[#777777]/70 dark:placeholder-[#A0A0A0]/60 transition-all duration-150 outline-none font-mono"
                  />

                  {isResolving ? (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#777777] dark:text-[#A0A0A0]" />
                  ) : resolvedRecipient ? (
                    <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  ) : recipientInput.trim() ? (
                    <AtSign className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#777777] dark:text-[#A0A0A0]" />
                  ) : null}
                </div>

                {/* Resolution Feedback Card */}
                {isResolving ? (
                  <div className="text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0] flex items-center gap-1.5 pt-0.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Resolving recipient through registry...</span>
                  </div>
                ) : resolvedRecipient ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono space-y-1 animate-in fade-in">
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Recipient found
                      </span>
                      <span>Verified</span>
                    </div>
                    <div className="text-xs font-bold text-[#111111] dark:text-[#FFFFFF]">
                      Sending to {resolvedRecipient.display}
                    </div>
                    <div className="text-[11px] text-[#555555] dark:text-[#A0A0A0] truncate">
                      {resolvedRecipient.address}
                    </div>
                  </div>
                ) : resolutionError && recipientInput.trim() ? (
                  <div className="text-[11px] font-mono text-red-600 dark:text-red-400 flex items-center gap-1 pt-0.5">
                    <AlertCircle className="w-3 h-3" />
                    <span>{resolutionError}</span>
                  </div>
                ) : null}
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF]">
                    Amount (MUSD)
                  </label>
                  <span className="text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0]">
                    AVAIL:{' '}
                    <span className="font-semibold text-[#111111] dark:text-[#FFFFFF] tabular-nums">
                      {wallet.isConnected ? `${wallet.balanceMusd.toFixed(2)} MUSD` : '0.00 MUSD'}
                    </span>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="0.00"
                    className="w-full px-4 py-3.5 text-2xl font-mono font-bold rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] hover:bg-[#EAEAEA] dark:hover:bg-[#202024] focus:bg-white dark:focus:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#C8C8C5] dark:hover:border-[#3A3A40] focus:border-[#111111] dark:focus:border-[#FFFFFF] text-[#111111] dark:text-[#FFFFFF] placeholder-[#777777]/70 dark:placeholder-[#A0A0A0]/60 transition-all duration-150 tabular-nums outline-none"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF] bg-white dark:bg-[#26262B] border border-[#E2E2E0] dark:border-[#3A3A40] px-2 py-1 rounded-md">
                      MUSD
                    </span>
                  </div>
                </div>

                {numericAmount > 0 && (
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0] px-1 pt-0.5">
                    <span>Estimated value</span>
                    <span className="font-semibold text-[#111111] dark:text-[#FFFFFF] tabular-nums">
                      ≈ {fiatEstimate ? `${fiatEstimate.formatted} ${preferredCurrency}` : 'Price unavailable'}
                    </span>
                  </div>
                )}

                {wallet.isConnected && (
                  <div className="flex items-center gap-2 pt-1">
                    {[
                      { label: '25%', val: 0.25 },
                      { label: '50%', val: 0.5 },
                      { label: 'Max', val: 1.0 },
                    ].map((btn) => (
                      <button
                        type="button"
                        key={btn.label}
                        onClick={() => handleQuickPercent(btn.val)}
                        className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-lg bg-white dark:bg-[#1C1C1F] hover:bg-[#111111] dark:hover:bg-[#FFFFFF] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#111111] dark:hover:border-[#FFFFFF] text-[#111111] dark:text-[#FFFFFF] hover:text-white dark:hover:text-[#111111] transition-all duration-150 active:scale-95 shadow-2xs"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Memo / Note Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF]">
                  Settlement Memo (Optional)
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="e.g. Protocol invoice, dinner share"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] hover:bg-[#EAEAEA] dark:hover:bg-[#202024] focus:bg-white dark:focus:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#C8C8C5] dark:hover:border-[#3A3A40] focus:border-[#111111] dark:focus:border-[#FFFFFF] text-[#111111] dark:text-[#FFFFFF] placeholder-[#777777]/70 dark:placeholder-[#A0A0A0]/60 transition-all duration-150 outline-none"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-600 dark:text-red-400 font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Proceed to Review Button */}
              <button
                type="submit"
                className="group w-full py-3.5 rounded-2xl bg-[#111111] hover:bg-[#262626] dark:bg-[#FFFFFF] dark:text-[#111111] dark:hover:bg-white/90 text-white text-xs font-semibold tracking-wide transition-all duration-150 shadow-xs active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {!wallet.isConnected ? (
                  <span>Connect Wallet to Send</span>
                ) : (
                  <>
                    <span>Review Transfer</span>
                    <ArrowUpRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
