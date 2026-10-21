import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Copy, 
  Check, 
  Share2, 
  Download, 
  ArrowRight, 
  Clock, 
  AlertCircle, 
  Wallet, 
  ExternalLink,
  PlusCircle,
  FileText,
  Sparkles,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { WalletState, PaymentRequest } from '../types';
import { shortenAddress, getExplorerAddressUrl } from '../utils/format';
import { 
  createShareableRequestUrl, 
  savePaymentRequestToStorage, 
  getStoredPaymentRequests,
  deleteStoredPaymentRequest,
  formatExpiryRemaining
} from '../utils/paymentRequest';
import { HalftonePattern } from './HalftonePattern';

interface RequestViewProps {
  wallet: WalletState;
  onConnectWallet: () => void;
  onOpenPaymentRequestPage?: (req: PaymentRequest) => void;
}

export const RequestView: React.FC<RequestViewProps> = ({
  wallet,
  onConnectWallet,
  onOpenPaymentRequestPage,
}) => {
  // Form State
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [expiryOption, setExpiryOption] = useState<'none' | '24h' | '7d' | '30d'>('7d');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Active Generated Request
  const [currentRequest, setCurrentRequest] = useState<PaymentRequest | null>(null);
  const [shareableUrl, setShareableUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Stored History
  const [recentRequests, setRecentRequests] = useState<PaymentRequest[]>([]);

  useEffect(() => {
    setRecentRequests(getStoredPaymentRequests());
  }, []);

  const quickAmounts = [10, 25, 50, 100, 250];

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
    setValidationError(null);
  };

  const getExpiryHours = (opt: 'none' | '24h' | '7d' | '30d'): number => {
    switch (opt) {
      case '24h': return 24;
      case '7d': return 168;
      case '30d': return 720;
      case 'none': return 0;
      default: return 0;
    }
  };

  const handleGenerateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!wallet.isConnected || !wallet.address) {
      setValidationError('Please connect your wallet first to set your receiving address.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError('Please enter a valid amount greater than 0.');
      return;
    }

    const newRequest: PaymentRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientAddress: wallet.address,
      recipientUsername: wallet.username ? `@${wallet.username}` : undefined,
      amount: numAmount,
      note: note.trim() || undefined,
      expiryHours: getExpiryHours(expiryOption),
      createdAt: Date.now(),
      status: 'active',
    };

    const url = createShareableRequestUrl(newRequest);
    setCurrentRequest(newRequest);
    setShareableUrl(url);

    // Persist to local storage
    savePaymentRequestToStorage(newRequest);
    setRecentRequests(getStoredPaymentRequests());
  };

  const handleCopyLink = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleShare = async () => {
    if (!shareableUrl || !currentRequest) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Cambio Payment Request: $${currentRequest.amount.toFixed(2)} MUSD`,
          text: `Payment request for $${currentRequest.amount.toFixed(2)} MUSD on Cambio (Mezo network)${currentRequest.note ? ` · ${currentRequest.note}` : ''}.`,
          url: shareableUrl,
        });
        setShareFeedback('Shared successfully');
        setTimeout(() => setShareFeedback(null), 2500);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
      setShareFeedback('Link copied to clipboard');
      setTimeout(() => setShareFeedback(null), 2500);
    }
  };

  const handleDownloadQr = () => {
    const canvas = document.getElementById('cambio-request-qr-canvas') as HTMLCanvasElement;
    if (!canvas || !currentRequest) return;
    
    try {
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `cambio-request-${currentRequest.amount}musd-${currentRequest.id.slice(-6)}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('Failed to download QR code image:', err);
    }
  };

  const handleResetForm = () => {
    setCurrentRequest(null);
    setShareableUrl('');
    setAmount('');
    setNote('');
    setValidationError(null);
  };

  const handleSelectRecent = (req: PaymentRequest) => {
    setCurrentRequest(req);
    const url = createShareableRequestUrl(req);
    setShareableUrl(url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRecent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteStoredPaymentRequest(id);
    setRecentRequests(getStoredPaymentRequests());
    if (currentRequest?.id === id) {
      setCurrentRequest(null);
      setShareableUrl('');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="border-b border-[#E2E2E0] dark:border-[#26262B] pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] dark:text-[#FFFFFF] font-sans">
          Request MUSD
        </h1>
        <p className="mt-1.5 text-sm text-[#555555] dark:text-[#A0A0A0] font-sans max-w-2xl">
          Create a payment request and share it with anyone who needs to pay you.
        </p>
      </div>

      {/* Main Grid: Form / Result */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column: Form Card */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative overflow-hidden bg-[#FFFFFF] dark:bg-[#141416] rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] p-6 sm:p-8 shadow-xs">
            {/* Corner Decorative Watermark */}
            <div className="absolute -right-8 -top-8 w-48 h-48 pointer-events-none opacity-[0.08] dark:opacity-[0.12]">
              <HalftonePattern variant="sphere" className="w-full h-full" />
            </div>

            <form onSubmit={handleGenerateRequest} className="relative z-10 space-y-5">
              {/* Recipient Address Banner */}
              <div className="p-3.5 rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
                    Receiving Address
                  </span>
                  {wallet.isConnected ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                      Disconnected
                    </span>
                  )}
                </div>

                {wallet.isConnected && wallet.address ? (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-xs sm:text-sm font-semibold text-[#111111] dark:text-[#FFFFFF] truncate">
                      {shortenAddress(wallet.address)}
                    </span>
                    <a
                      href={getExplorerAddressUrl(wallet.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] p-1 transition-colors"
                      title="View on Mezo Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-xs text-[#777777] dark:text-[#A0A0A0]">
                      Connect your wallet to receive MUSD payments.
                    </span>
                    <button
                      type="button"
                      onClick={onConnectWallet}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] text-xs font-semibold hover:opacity-90 transition-all shrink-0"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Connect Wallet</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Amount Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="request-amount" className="block text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] uppercase tracking-wider font-mono">
                    Requested Amount *
                  </label>
                  <span className="text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0]">
                    Settlement: MUSD
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg sm:text-xl font-mono text-[#777777] dark:text-[#A0A0A0] pointer-events-none select-none">
                    $
                  </span>
                  <input
                    id="request-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full pl-8 pr-20 py-3.5 rounded-2xl bg-white dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-xl sm:text-2xl font-bold font-mono text-[#111111] dark:text-[#FFFFFF] focus:outline-none focus:border-[#111111] dark:focus:border-[#FFFFFF] transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-[#777777] dark:text-[#A0A0A0] bg-[#F0F0EE] dark:bg-[#141416] px-2 py-1 rounded-md">
                    MUSD
                  </span>
                </div>

                {/* Quick Amount Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-mono uppercase text-[#777777] dark:text-[#A0A0A0] mr-1">
                    Presets:
                  </span>
                  {quickAmounts.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAmount(val)}
                      className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all duration-150 ${
                        amount === val.toString()
                          ? 'bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] border-[#111111] dark:border-[#FFFFFF]'
                          : 'bg-white dark:bg-[#1A1A1D] text-[#555555] dark:text-[#A0A0A0] border-[#E2E2E0] dark:border-[#26262B] hover:border-[#111111] dark:hover:border-[#FFFFFF]'
                      }`}
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note Field (Optional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="request-note" className="block text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] uppercase tracking-wider font-mono">
                    Note <span className="font-normal text-[#777777] dark:text-[#A0A0A0] lowercase">(optional)</span>
                  </label>
                  <span className="text-[10px] font-mono text-[#777777] dark:text-[#A0A0A0]">
                    {note.length}/100
                  </span>
                </div>
                <input
                  id="request-note"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Payment for design work"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-sm text-[#111111] dark:text-[#FFFFFF] placeholder:text-[#999999] dark:placeholder:text-[#666666] focus:outline-none focus:border-[#111111] dark:focus:border-[#FFFFFF] transition-all"
                />
              </div>

              {/* Request Expiry Field (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] uppercase tracking-wider font-mono">
                  Request Expiry
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'none', label: 'No expiry' },
                    { key: '24h', label: '24 Hours' },
                    { key: '7d', label: '7 Days' },
                    { key: '30d', label: '30 Days' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setExpiryOption(item.key as any)}
                      className={`px-3 py-2 text-xs font-mono rounded-xl border text-center transition-all ${
                        expiryOption === item.key
                          ? 'bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] border-[#111111] dark:border-[#FFFFFF] font-semibold shadow-xs'
                          : 'bg-white dark:bg-[#1A1A1D] text-[#777777] dark:text-[#A0A0A0] border-[#E2E2E0] dark:border-[#26262B] hover:border-[#111111] dark:hover:border-[#FFFFFF]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Validation Error Banner */}
              {validationError && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!wallet.isConnected}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] text-sm font-semibold tracking-wide shadow-sm hover:bg-[#262626] dark:hover:bg-[#EAEAEA] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Generate Payment Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Generated Result Card or Guide */}
        <div className="lg:col-span-5 space-y-6">
          {currentRequest && shareableUrl ? (
            <div className="relative overflow-hidden bg-[#FFFFFF] dark:bg-[#141416] rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] p-6 sm:p-7 shadow-sm space-y-5 animate-in fade-in zoom-in-95 duration-200">
              {/* Result Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E2E0] dark:border-[#26262B]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF]">
                    Request Ready
                  </span>
                </div>

                <button
                  onClick={handleResetForm}
                  className="text-[11px] font-mono text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] underline transition-colors"
                >
                  New Request
                </button>
              </div>

              {/* Amount & Memo Display */}
              <div className="text-center py-2 space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#777777] dark:text-[#A0A0A0]">
                  {currentRequest.recipientUsername ? (
                    <span>
                      <strong className="text-[#111111] dark:text-[#FFFFFF]">{currentRequest.recipientUsername}</strong> is requesting
                    </span>
                  ) : (
                    'Amount Requested'
                  )}
                </span>
                <div className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-[#111111] dark:text-[#FFFFFF]">
                  ${currentRequest.amount.toFixed(2)}{' '}
                  <span className="text-sm font-normal text-[#777777] dark:text-[#A0A0A0]">
                    MUSD
                  </span>
                </div>
                {currentRequest.note && (
                  <p className="text-xs text-[#555555] dark:text-[#A0A0A0] italic pt-1 max-w-xs mx-auto truncate">
                    “{currentRequest.note}”
                  </p>
                )}
                <div className="pt-1 text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0]">
                  {formatExpiryRemaining(currentRequest)}
                </div>
              </div>

              {/* Real Scannable QR Code */}
              <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] space-y-3">
                <div className="p-3 bg-white rounded-xl shadow-xs border border-[#E2E2E0]">
                  <QRCodeCanvas
                    id="cambio-request-qr-canvas"
                    value={shareableUrl}
                    size={172}
                    level="M"
                    marginSize={1}
                    fgColor="#111111"
                    bgColor="#FFFFFF"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0]">
                    Scan to view payment request
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#111111] dark:text-[#FFFFFF] hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download QR Code</span>
                  </button>
                </div>
              </div>

              {/* Shareable Link Box */}
              <div className="space-y-2">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
                  Shareable Payment Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareableUrl}
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-[#555555] dark:text-[#A0A0A0] truncate select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border flex items-center gap-1.5 transition-all shrink-0 ${
                      isCopied
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] border-[#111111] dark:border-[#FFFFFF] hover:opacity-90'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons: Native Share & View Payment Page */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#E2E2E0] dark:border-[#26262B] bg-white dark:bg-[#1A1A1D] hover:bg-[#F0F0EE] dark:hover:bg-[#222226] text-xs font-medium text-[#111111] dark:text-[#FFFFFF] transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Request</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onOpenPaymentRequestPage) {
                      onOpenPaymentRequestPage(currentRequest);
                    } else {
                      window.location.hash = `/pay?req=${encodeURIComponent(JSON.stringify({
                        id: currentRequest.id,
                        to: currentRequest.recipientAddress,
                        amt: currentRequest.amount,
                        note: currentRequest.note,
                        exp: currentRequest.expiryHours,
                        cat: currentRequest.createdAt
                      }))}`;
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#111111] dark:border-[#FFFFFF] bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] text-xs font-semibold hover:opacity-90 transition-all"
                >
                  <span>Preview Page</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {shareFeedback && (
                <div className="text-center text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                  {shareFeedback}
                </div>
              )}
            </div>
          ) : (
            /* Idle Information Card */
            <div className="bg-[#FFFFFF] dark:bg-[#141416] rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] p-6 sm:p-8 space-y-4 shadow-xs">
              <div className="w-10 h-10 rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] flex items-center justify-center text-[#111111] dark:text-[#FFFFFF]">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#111111] dark:text-[#FFFFFF] font-sans">
                  How Payment Requests Work
                </h2>
                <p className="text-xs text-[#555555] dark:text-[#A0A0A0] leading-relaxed">
                  Enter an amount and an optional note. Cambio generates a unique link and high-contrast QR code tied to your connected wallet on Mezo.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#E2E2E0]/60 dark:border-[#26262B]/60 text-xs font-mono text-[#777777] dark:text-[#A0A0A0]">
                <div className="flex items-start gap-2">
                  <span className="text-[#111111] dark:text-[#FFFFFF] font-bold">1.</span>
                  <span>Share the URL or download the scannable QR code.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#111111] dark:text-[#FFFFFF] font-bold">2.</span>
                  <span>Payer opens the link, connects their wallet, and completes the transfer.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#111111] dark:text-[#FFFFFF] font-bold">3.</span>
                  <span>Direct settlement into your Mezo address.</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Payment Requests List */}
          {recentRequests.length > 0 && (
            <div className="bg-[#FFFFFF] dark:bg-[#141416] rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] p-5 sm:p-6 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E2E0] dark:border-[#26262B]">
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#111111] dark:text-[#FFFFFF]">
                  Recent Requests ({recentRequests.length})
                </span>
                <span className="text-[10px] font-mono text-[#777777] dark:text-[#A0A0A0]">
                  Session History
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {recentRequests.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => handleSelectRecent(req)}
                    className="p-3 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-transparent hover:border-[#C8C8C5] dark:hover:border-[#3A3A40] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-[#111111] dark:text-[#FFFFFF]">
                          ${req.amount.toFixed(2)} MUSD
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] text-[#777777] dark:text-[#A0A0A0]">
                          {formatExpiryRemaining(req)}
                        </span>
                      </div>
                      {req.note && (
                        <p className="text-[11px] text-[#777777] dark:text-[#A0A0A0] truncate max-w-[180px]">
                          {req.note}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRecent(req.id, e)}
                        className="p-1 text-[#999999] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete request"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs text-[#777777] group-hover:text-[#111111] dark:group-hover:text-[#FFFFFF] transition-colors">
                        →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
