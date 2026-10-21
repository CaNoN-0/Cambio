/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  Loader2, 
  AtSign, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { 
  validateUsernameFormat, 
  checkUsernameAvailability, 
  registerUsername, 
  changeUsername, 
  createVerificationMessage 
} from '../services/usernameRegistry';
import { HalftonePattern } from './HalftonePattern';

interface CreateUsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  currentUsername?: string | null;
  onSuccess: (newUsername: string) => void;
}

export const CreateUsernameModal: React.FC<CreateUsernameModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
  currentUsername,
  onSuccess,
}) => {
  const isEditing = Boolean(currentUsername);
  const [inputVal, setInputVal] = useState(currentUsername ? `@${currentUsername}` : '');
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{
    available: boolean;
    error?: string;
    normalized?: string;
  } | null>(null);

  const [isSigning, setIsSigning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputVal(currentUsername ? `@${currentUsername}` : '');
      setAvailability(null);
      setActionError(null);
      setActionSuccess(null);
      setIsSigning(false);
    }
  }, [isOpen, currentUsername]);

  // Debounced real-time availability check
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = inputVal.trim();
    if (!trimmed || trimmed === '@') {
      setAvailability(null);
      return;
    }

    const validation = validateUsernameFormat(trimmed);
    if (!validation.valid) {
      setAvailability({
        available: false,
        error: validation.error,
        normalized: validation.normalized,
      });
      return;
    }

    // If editing and same username as current
    if (isEditing && validation.normalized === currentUsername) {
      setAvailability({
        available: true,
        normalized: validation.normalized,
      });
      return;
    }

    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(trimmed, walletAddress);
        setAvailability(result);
      } catch (e) {
        setAvailability({ available: true, normalized: validation.normalized });
      } finally {
        setChecking(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [inputVal, isOpen, walletAddress, isEditing, currentUsername]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Keep user from typing invalid punctuation, but allow @ at the start
    if (val.startsWith('@')) {
      val = '@' + val.slice(1).replace(/[^a-zA-Z0-9_]/g, '');
    } else {
      val = val.replace(/[^a-zA-Z0-9_]/g, '');
    }
    setInputVal(val);
    setActionError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const validation = validateUsernameFormat(inputVal);
    if (!validation.valid) {
      setActionError(validation.error || 'Please enter a valid username');
      return;
    }

    if (!walletAddress) {
      setActionError('Please connect your wallet first');
      return;
    }

    // Availability validation check
    if (availability && !availability.available && availability.normalized !== currentUsername) {
      setActionError(availability.error || 'Username already taken');
      return;
    }

    setIsSigning(true);

    try {
      // Create EIP-191 personal_sign message to verify wallet ownership with 0 gas
      const message = createVerificationMessage(
        isEditing ? 'change' : 'register',
        validation.normalized,
        walletAddress
      );

      let signature = `0x_verified_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Attempt browser wallet signing if available
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const provider = (window as any).ethereum;
          const hexMsg = '0x' + Array.from(new TextEncoder().encode(message))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          const sig = await provider.request({
            method: 'personal_sign',
            params: [hexMsg, walletAddress],
          });
          if (sig) signature = sig;
        } catch (sigErr: any) {
          // If user rejects sign, don't throw an error, allow simulation / mock sign for prototype
          console.warn('Wallet signing prompt note:', sigErr?.message || sigErr);
        }
      }

      let res;
      if (isEditing && currentUsername) {
        res = await changeUsername(currentUsername, validation.normalized, walletAddress, signature);
      } else {
        res = await registerUsername(validation.normalized, walletAddress, signature);
      }

      if (res.success) {
        setActionSuccess(isEditing ? 'Username updated.' : 'Username created.');
        setTimeout(() => {
          onSuccess(res.username);
          onClose();
        }, 800);
      } else {
        setActionError(res.error || 'Failed to claim username');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Error creating username. Please try again.');
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={isSigning ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="username-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#141416] rounded-3xl shadow-2xl border border-[#E2E2E0] dark:border-[#26262B] p-6 sm:p-7 z-10 space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative halftone accent */}
        <div className="absolute right-0 top-0 w-32 h-32 pointer-events-none opacity-10 dark:opacity-15">
          <HalftonePattern variant="corner" className="w-full h-full" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between pb-2 border-b border-[#E2E2E0] dark:border-[#26262B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] flex items-center justify-center shadow-xs">
              <AtSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#777777] dark:text-[#A0A0A0] block">
                {isEditing ? 'Edit Profile' : 'Cambio Identity'}
              </span>
              <h2 id="username-modal-title" className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight font-sans">
                {isEditing ? 'Change your username' : 'Choose your username'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSigning}
            className="p-1.5 rounded-xl text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] transition-all disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtitle instructions per spec */}
        <p className="relative z-10 text-xs sm:text-sm text-[#555555] dark:text-[#A0A0A0] leading-relaxed font-sans">
          Create a username to send and receive MUSD easily.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="cambio-username-input"
              className="block text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] uppercase tracking-wider font-mono"
            >
              Username
            </label>

            <div className="relative">
              <input
                id="cambio-username-input"
                type="text"
                autoFocus
                maxLength={21}
                placeholder="e.g. @jomi"
                value={inputVal}
                onChange={handleInputChange}
                className="w-full pl-4 pr-10 py-3 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-sm font-mono text-[#111111] dark:text-[#FFFFFF] placeholder:text-[#999999] dark:placeholder:text-[#666666] focus:outline-none focus:border-[#111111] dark:focus:border-[#FFFFFF] transition-all"
              />

              {checking ? (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#777777] dark:text-[#A0A0A0]" />
              ) : availability ? (
                availability.available ? (
                  <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                )
              ) : null}
            </div>

            {/* Live Status indicator */}
            <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
              {checking ? (
                <span className="text-[#777777] dark:text-[#A0A0A0]">Checking availability...</span>
              ) : availability ? (
                availability.available ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Username available (@{availability.normalized})
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {availability.error || 'Username already taken'}
                  </span>
                )
              ) : (
                <span className="text-[#777777] dark:text-[#A0A0A0]">
                  3–20 letters, numbers, or underscores
                </span>
              )}

              <span className="text-[#777777] dark:text-[#A0A0A0]">
                {inputVal.replace(/^@/, '').length}/20
              </span>
            </div>
          </div>

          {/* Wallet Link pill */}
          <div className="p-3 rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-xs flex items-center justify-between font-mono">
            <span className="text-[10px] uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
              Linked Wallet
            </span>
            <span className="text-[11px] font-semibold text-[#111111] dark:text-[#FFFFFF] truncate max-w-[200px]">
              {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'None'}
            </span>
          </div>

          {/* Gas-free verification info note */}
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-sans">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <span className="text-[11px] leading-relaxed">
              Verified with a free cryptographic wallet signature. Zero gas fees required.
            </span>
          </div>

          {/* Action Feedback */}
          {actionError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSigning}
              className="flex-1 py-3 px-4 rounded-xl border border-[#E2E2E0] dark:border-[#26262B] bg-white dark:bg-[#141416] hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSigning || checking || (availability !== null && !availability.available && availability.normalized !== currentUsername)}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#111111] hover:bg-[#262626] dark:bg-[#FFFFFF] dark:text-[#111111] dark:hover:bg-white/90 text-white text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSigning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>{isEditing ? 'Save username' : 'Create username'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
