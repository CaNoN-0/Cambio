import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { 
  normalizeUsername, 
  validateUsernameRules, 
  checkUsernameAvailability, 
  registerUsername, 
  changeUsername,
  requestWalletOwnershipSignature
} from '../services/usernameService';
import { shortenAddress } from '../utils/format';

interface UsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  currentUsername?: string | null;
  mode?: 'create' | 'change';
  onSuccess: (newUsername: string) => void;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
  currentUsername,
  mode = 'create',
  onSuccess,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [availabilityState, setAvailabilityState] = useState<{
    checked: boolean;
    available?: boolean;
    error?: string;
  }>({ checked: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signingNotice, setSigningNotice] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize input
  useEffect(() => {
    if (isOpen) {
      setInputVal(currentUsername ? `@${currentUsername}` : '');
      setAvailabilityState({ checked: false });
      setSubmitError(null);
      setSigningNotice(false);
      setSuccessMessage(null);
    }
  }, [isOpen, currentUsername]);

  // Debounced live availability check
  useEffect(() => {
    const raw = inputVal.trim();
    const normalized = normalizeUsername(raw);

    if (!normalized) {
      setAvailabilityState({ checked: false });
      return;
    }

    // If changing and same as current, indicate valid
    if (mode === 'change' && currentUsername && normalized === normalizeUsername(currentUsername)) {
      setAvailabilityState({ checked: true, available: true });
      return;
    }

    const validation = validateUsernameRules(normalized);
    if (!validation.isValid) {
      setAvailabilityState({
        checked: true,
        available: false,
        error: validation.error,
      });
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(normalized);
        setAvailabilityState({
          checked: true,
          available: result.available,
          error: result.error,
        });
      } catch (e) {
        setAvailabilityState({ checked: false });
      } finally {
        setIsChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputVal, mode, currentUsername]);

  if (!isOpen) return null;

  const normalized = normalizeUsername(inputVal);
  const isInputEmpty = !normalized;
  const isAvailable = availabilityState.checked && availabilityState.available;
  const isSameAsCurrent = mode === 'change' && currentUsername && normalized === normalizeUsername(currentUsername);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validation = validateUsernameRules(normalized);
    if (!validation.isValid) {
      setSubmitError(validation.error || 'Please enter a valid username.');
      return;
    }

    if (isSameAsCurrent) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setSigningNotice(true);

    try {
      // 1. Request wallet ownership signature (EIP-191 personal_sign)
      const signature = await requestWalletOwnershipSignature(walletAddress, normalized);
      setSigningNotice(false);

      let savedUsername: string;
      if (mode === 'change' && currentUsername) {
        savedUsername = await changeUsername(walletAddress, currentUsername, normalized, signature);
        setSuccessMessage('Username updated.');
      } else {
        savedUsername = await registerUsername(walletAddress, normalized, signature);
        setSuccessMessage('Username created.');
      }

      setTimeout(() => {
        onSuccess(savedUsername);
        onClose();
      }, 1000);
    } catch (err: any) {
      setSigningNotice(false);
      setSubmitError(err.message || 'Failed to save username. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-[#FFFFFF] dark:bg-[#141416] rounded-3xl shadow-2xl border border-[#E2E2E0] dark:border-[#26262B] p-6 sm:p-8 z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight font-sans">
              {mode === 'change' ? 'Change your username' : 'Choose your username'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#777777] dark:text-[#A0A0A0] leading-relaxed font-sans">
              Create a username to send and receive MUSD easily.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] transition-all disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Linked Wallet Context */}
        <div className="p-3.5 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] flex items-center justify-between text-xs font-mono">
          <span className="text-[#777777] dark:text-[#A0A0A0]">Linked Wallet</span>
          <span className="font-semibold text-[#111111] dark:text-[#FFFFFF]">
            {shortenAddress(walletAddress)}
          </span>
        </div>

        {/* Success Confirmation Toast */}
        {successMessage ? (
          <div className="p-4 rounded-2xl bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] flex items-center gap-3 animate-in fade-in duration-200">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div className="font-sans font-semibold text-sm">
              {successMessage}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input field */}
            <div className="space-y-2">
              <label htmlFor="username-input" className="block text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] uppercase tracking-wider font-mono">
                Username
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-mono font-medium text-[#777777] dark:text-[#A0A0A0] select-none pointer-events-none">
                  @
                </span>
                <input
                  id="username-input"
                  type="text"
                  autoFocus
                  disabled={isSubmitting}
                  maxLength={21}
                  placeholder="e.g. jomi"
                  value={inputVal.startsWith('@') ? inputVal.slice(1) : inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    setSubmitError(null);
                  }}
                  className="w-full pl-9 pr-10 py-3.5 rounded-2xl bg-white dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-base font-mono font-semibold text-[#111111] dark:text-[#FFFFFF] placeholder:text-[#AAAAAA] dark:placeholder:text-[#666666] focus:outline-none focus:border-[#111111] dark:focus:border-[#FFFFFF] transition-all disabled:opacity-50"
                />

                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  {isChecking ? (
                    <Loader2 className="w-4 h-4 text-[#777777] dark:text-[#A0A0A0] animate-spin" />
                  ) : availabilityState.checked ? (
                    isAvailable ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )
                  ) : null}
                </div>
              </div>

              {/* Status & Availability message */}
              <div className="min-h-[20px] text-[11px] font-mono">
                {isChecking ? (
                  <span className="text-[#777777] dark:text-[#A0A0A0]">
                    Checking availability...
                  </span>
                ) : availabilityState.checked ? (
                  isAvailable ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Username available
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">
                      {availabilityState.error || 'Username already taken'}
                    </span>
                  )
                ) : (
                  <span className="text-[#777777] dark:text-[#A0A0A0]">
                    3–20 characters. Letters, numbers, and underscores.
                  </span>
                )}
              </div>
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Signing notice */}
            {signingNotice && (
              <div className="p-3.5 rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-xs text-[#555555] dark:text-[#A0A0A0] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#111111] dark:text-[#FFFFFF] shrink-0 animate-pulse" />
                <span>Please confirm the signature in your wallet...</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={isSubmitting || isInputEmpty || (availabilityState.checked && !isAvailable)}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] text-sm font-semibold tracking-wide shadow-sm hover:bg-[#262626] dark:hover:bg-[#EAEAEA] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{signingNotice ? 'Awaiting Signature...' : 'Reserving Username...'}</span>
                  </>
                ) : (
                  <span>{mode === 'change' ? 'Update username' : 'Create username'}</span>
                )}
              </button>

              {mode === 'create' && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-full py-2.5 text-xs text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] font-mono transition-colors"
                >
                  I'll do this later
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
