/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ArrowDownLeft, 
  Share2, 
  Wallet, 
  AtSign, 
  PlusCircle, 
  Sparkles,
  ExternalLink,
  Download,
  QrCode,
  Link as LinkIcon,
  Scan,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { WalletState } from '../types';
import { shortenAddress, getExplorerAddressUrl } from '../utils/format';
import { HalftonePattern } from './HalftonePattern';
import { useCurrency } from '../context/CurrencyContext';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState;
  onOpenConnectWallet: () => void;
  onOpenCreateUsername?: () => void;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onOpenConnectWallet,
  onOpenCreateUsername,
}) => {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState('');
  const [isAmountMode, setIsAmountMode] = useState(false);
  const [qrMode, setQrMode] = useState<'address' | 'link'>('address');
  const [showSimulatedScan, setShowSimulatedScan] = useState(false);

  const { preferredCurrency, formatTokenFiat } = useCurrency();

  if (!isOpen) return null;

  // Active receiving address: connected wallet address or standard fallback demo address
  const fallbackAddress = '0x71C8342fc2F87007708b450702d8b5F08b51B98E';
  const effectiveAddress = wallet.isConnected && wallet.address ? wallet.address : fallbackAddress;
  const isUsingFallback = !wallet.isConnected || !wallet.address;

  const recipientIdentifier = wallet.username ? `@${wallet.username}` : effectiveAddress;

  const parsedAmt = parseFloat(requestedAmount);
  const fiatEstimate = !isNaN(parsedAmt) && parsedAmt > 0
    ? formatTokenFiat(parsedAmt, 'MUSD', 1.0)
    : null;

  // Web payment link URL (compatible with standard browser cameras)
  const paymentLink = `${typeof window !== 'undefined' ? window.location.origin : ''}${
    typeof window !== 'undefined' ? window.location.pathname : ''
  }#pay?to=${encodeURIComponent(recipientIdentifier)}${
    !isNaN(parsedAmt) && parsedAmt > 0 ? `&amt=${parsedAmt}` : ''
  }`;

  // Standard EVM / EIP-681 URI (compatible with MetaMask, Rainbow, Trust Wallet, Coinbase Wallet)
  const evmUriValue = !isNaN(parsedAmt) && parsedAmt > 0
    ? `ethereum:${effectiveAddress}?value=${parsedAmt}`
    : `ethereum:${effectiveAddress}`;

  // Dynamic QR code value based on user mode
  const qrCodeValue = qrMode === 'link' ? paymentLink : evmUriValue;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(effectiveAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleCopyUsername = () => {
    if (wallet.username) {
      navigator.clipboard.writeText(`@${wallet.username}`);
      setCopiedUsername(true);
      setTimeout(() => setCopiedUsername(false), 2000);
    }
  };

  const handleCopyPaymentLink = () => {
    navigator.clipboard.writeText(paymentLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(qrCodeValue);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleDownloadQr = () => {
    const canvas = document.getElementById('cambio-receive-qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    try {
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      const id = wallet.username || effectiveAddress.slice(0, 8);
      downloadLink.download = `cambio-receive-${id}${requestedAmount ? `-${requestedAmount}musd` : ''}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('Failed to download QR code', err);
    }
  };

  const handleTestPaymentLink = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = paymentLink.split('#')[1] || 'pay';
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center sm:justify-end bg-black/60 dark:bg-black/80 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receive-modal-title"
    >
      <div
        className="relative bg-[#FFFFFF] dark:bg-[#141416] w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] sm:rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] flex flex-col shadow-2xl overflow-y-auto font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle halftone corner flourish */}
        <HalftonePattern variant="corner" className="absolute right-0 top-0 w-36 h-36 opacity-10 dark:opacity-15 pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-[#E2E2E0] dark:border-[#26262B]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] flex items-center justify-center shadow-xs">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 id="receive-modal-title" className="text-base font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight font-sans">
                Receive MUSD
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#777777] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FFFFFF] rounded-xl hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] hover:rotate-90 transition-all duration-150 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 p-6 flex-1 space-y-5">
          {/* Disconnected state notice with connect action */}
          {isUsingFallback && (
            <div className="p-3.5 rounded-2xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] flex items-center justify-between gap-3 font-sans">
              <div className="flex items-center gap-2.5 min-w-0">
                <Wallet className="w-4 h-4 text-[#777777] dark:text-[#A0A0A0] shrink-0" />
                <span className="text-xs text-[#777777] dark:text-[#A0A0A0] truncate">
                  Wallet disconnected · Showing functional preview address
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenConnectWallet();
                }}
                className="px-3 py-1.5 rounded-xl bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] text-xs font-semibold shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
              >
                Connect Wallet
              </button>
            </div>
          )}

          {/* Username Card (if registered) */}
          {wallet.username && (
            <div className="p-4 rounded-2xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] space-y-2">
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="font-semibold uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
                  Cambio Username
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                  Verified Mezo Alias
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-[#111111] dark:text-[#FFFFFF]">
                  @{wallet.username}
                </span>

                <button
                  type="button"
                  onClick={handleCopyUsername}
                  className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#111111] dark:hover:border-[#FFFFFF] text-[#111111] dark:text-[#FFFFFF] text-xs font-sans font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  {copiedUsername ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#777777] dark:text-[#A0A0A0]" />
                      <span>Copy username</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Functional Scannable QR Code presentation */}
          <div className="flex flex-col items-center justify-center p-5 sm:p-6 bg-[#F0F0EE] dark:bg-[#1A1A1D] rounded-2xl border border-[#E2E2E0] dark:border-[#26262B] transition-all duration-200 space-y-4 font-sans">
            {/* QR Target Switcher: EVM Wallet Address vs Web Payment Link */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] text-xs">
              <button
                type="button"
                onClick={() => setQrMode('address')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  qrMode === 'address'
                    ? 'bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] shadow-2xs'
                    : 'text-[#777777] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FFFFFF]'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Wallet App (EVM)</span>
              </button>
              <button
                type="button"
                onClick={() => setQrMode('link')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  qrMode === 'link'
                    ? 'bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] shadow-2xs'
                    : 'text-[#777777] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FFFFFF]'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Web Payment Link</span>
              </button>
            </div>

            {/* Dynamic Functional QR Canvas */}
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-[#E2E2E0] flex items-center justify-center">
              <QRCodeCanvas
                id="cambio-receive-qr-canvas"
                value={qrCodeValue}
                size={200}
                level="M"
                marginSize={2}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            </div>

            {/* Status & Action Controls */}
            <div className="text-center space-y-3 w-full max-w-sm">
              <div className="text-center font-sans">
                <span className="text-xs uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0] block">
                  {qrMode === 'address'
                    ? 'Scannable by MetaMask, Rainbow, Trust Wallet & Web3 apps'
                    : 'Scannable by phone camera to open web checkout'}
                </span>
                {parsedAmt > 0 && (
                  <div className="mt-1 font-semibold text-sm text-[#111111] dark:text-[#FFFFFF] tabular-nums font-mono">
                    <div>REQUESTING {parsedAmt.toFixed(2)} MUSD</div>
                    <div className="text-xs text-[#777777] dark:text-[#A0A0A0] font-normal mt-0.5">
                      ≈ {fiatEstimate ? `${fiatEstimate.formatted} ${preferredCurrency}` : 'Price unavailable'}
                    </div>
                  </div>
                )}
              </div>

              {/* QR Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 font-sans">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#141416] hover:bg-[#F0F0EE] dark:hover:bg-[#202024] border border-[#E2E2E0] dark:border-[#26262B] text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] transition-all cursor-pointer shadow-2xs"
                  title="Download high-resolution QR code image"
                >
                  <Download className="w-3.5 h-3.5 text-[#777777] dark:text-[#A0A0A0]" />
                  <span>Download QR</span>
                </button>

                <button
                  type="button"
                  onClick={qrMode === 'link' ? handleCopyPaymentLink : handleCopyAddress}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#141416] hover:bg-[#F0F0EE] dark:hover:bg-[#202024] border border-[#E2E2E0] dark:border-[#26262B] text-xs font-semibold text-[#111111] dark:text-[#FFFFFF] transition-all cursor-pointer shadow-2xs"
                >
                  {qrMode === 'link' ? (
                    copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Link Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#777777] dark:text-[#A0A0A0]" />
                        <span>Copy Link</span>
                      </>
                    )
                  ) : (
                    copiedAddress ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Address Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#777777] dark:text-[#A0A0A0]" />
                        <span>Copy Address</span>
                      </>
                    )
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSimulatedScan(!showSimulatedScan)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                    showSimulatedScan 
                      ? 'bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] border-[#111111] dark:border-[#FFFFFF]' 
                      : 'bg-white dark:bg-[#141416] hover:bg-[#F0F0EE] dark:hover:bg-[#202024] border-[#E2E2E0] dark:border-[#26262B] text-[#111111] dark:text-[#FFFFFF]'
                  }`}
                  title="Test what scanners decode from this QR code"
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span>{showSimulatedScan ? 'Hide Scanner Test' : 'Test QR Code'}</span>
                </button>
              </div>

              {/* Interactive Scanner Verification Panel */}
              {showSimulatedScan && (
                <div className="p-4 rounded-xl bg-white dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] text-left space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Scanner Decoded Payload
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPayload}
                      className="text-[11px] font-mono text-[#111111] dark:text-[#FFFFFF] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedPayload ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F0F0EE] dark:bg-[#1A1A1D] font-mono text-xs text-[#111111] dark:text-[#FFFFFF] break-all border border-[#E2E2E0] dark:border-[#26262B]">
                    {qrCodeValue}
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[#777777] dark:text-[#A0A0A0]">
                      Format: {qrMode === 'address' ? 'Standard EIP-681 EVM URI' : 'Direct HTTPS Web Link'}
                    </span>
                    <button
                      type="button"
                      onClick={handleTestPaymentLink}
                      className="font-bold text-[#111111] dark:text-[#FFFFFF] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Simulate Pay</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Destination Address & Copy Button */}
          <div className="space-y-1.5 font-sans">
            <div className="flex items-center justify-between text-xs">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF]">
                Destination Wallet Address
              </label>
              <span className="text-xs uppercase text-[#777777] dark:text-[#A0A0A0]">
                {wallet.walletName || 'MEZO NETWORK'}
              </span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B]">
              <span className="font-mono text-xs text-[#111111] dark:text-[#FFFFFF] break-all flex-1 selection:bg-black/10 dark:selection:bg-white/20">
                {effectiveAddress}
              </span>
              <button
                onClick={handleCopyAddress}
                className="shrink-0 p-2 rounded-lg bg-white dark:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#111111] dark:hover:border-[#FFFFFF] text-[#111111] dark:text-[#FFFFFF] transition-all duration-150 cursor-pointer flex items-center gap-1.5 text-xs font-sans font-medium"
                title="Copy wallet address"
              >
                {copiedAddress ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#777777] dark:text-[#A0A0A0]" />
                    <span className="text-xs">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Request Specific Amount Toggle */}
          <div className="pt-2 border-t border-[#E2E2E0] dark:border-[#26262B] space-y-3 font-sans">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF]">
                Specific Amount Parameter (Optional)
              </span>
              <button
                type="button"
                onClick={() => {
                  if (isAmountMode) {
                    setRequestedAmount('');
                  }
                  setIsAmountMode(!isAmountMode);
                }}
                className="text-xs uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF] hover:underline font-semibold cursor-pointer"
              >
                {isAmountMode ? 'Clear Amount' : '+ Add Amount'}
              </button>
            </div>

            {isAmountMode && (
              <div className="space-y-2 animate-in fade-in duration-150">
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 text-sm font-sans rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] hover:bg-[#EAEAEA] dark:hover:bg-[#202024] focus:bg-white dark:focus:bg-[#141416] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#C8C8C5] dark:hover:border-[#3A3A40] focus:border-[#111111] dark:focus:border-[#FFFFFF] text-[#111111] dark:text-[#FFFFFF] transition-all duration-150 tabular-nums outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#777777] dark:text-[#A0A0A0]">
                    MUSD
                  </span>
                </div>

                {parsedAmt > 0 && (
                  <div className="flex items-center justify-between text-xs font-mono text-[#777777] dark:text-[#A0A0A0] px-1 pt-0.5">
                    <span>Estimated fiat value</span>
                    <span className="font-semibold text-[#111111] dark:text-[#FFFFFF] tabular-nums">
                      ≈ {fiatEstimate ? `${fiatEstimate.formatted} ${preferredCurrency}` : 'Price unavailable'}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleCopyPaymentLink}
              className="group w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#111111] hover:bg-[#262626] dark:bg-[#FFFFFF] dark:text-[#111111] dark:hover:bg-white/90 text-white text-xs font-semibold uppercase tracking-wider transition-all duration-150 shadow-xs active:scale-[0.98] cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Payment Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Copy Shareable Link</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs font-sans text-center text-[#777777] dark:text-[#A0A0A0] uppercase tracking-wider">
            Verified destination address on the Mezo ecosystem
          </p>
        </div>
      </div>
    </div>
  );
};
