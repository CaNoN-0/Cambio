import React, { useState } from 'react';
import { X, Search, Check } from 'lucide-react';
import { SwapToken } from '../types';
import btcLogo from '@/btc.png';
import mezoLogo from '@/mezo.png';
import usdcLogo from '@/usdc.png';

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: SwapToken[];
  selectedToken: SwapToken;
  onSelectToken: (token: SwapToken) => void;
  disabledTokenSymbol?: string;
  title?: string;
}

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  tokens,
  selectedToken,
  onSelectToken,
  disabledTokenSymbol,
  title = 'Select a token',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#141416] rounded-3xl shadow-2xl border border-[#E2E2E0] dark:border-[#26262B] p-5 sm:p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#E2E2E0] dark:border-[#26262B]">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight">
              {title}
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live rates
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#777777] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FFFFFF] hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] transition-all"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#777777] dark:text-[#A0A0A0]" />
          <input
            type="text"
            placeholder="Search by token name or symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F5F3] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] text-xs font-sans text-[#111111] dark:text-[#FFFFFF] placeholder:text-[#999999] dark:placeholder:text-[#666666] focus:outline-none focus:border-[#111111] dark:focus:border-[#FFFFFF] transition-all"
            autoFocus
          />
        </div>

        {/* Tokens List */}
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {filteredTokens.length > 0 ? (
            filteredTokens.map((token) => {
              const isSelected = selectedToken.symbol === token.symbol;
              const isDisabled = disabledTokenSymbol === token.symbol;

              return (
                <button
                  key={token.symbol}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      onSelectToken(token);
                      onClose();
                    }
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-150 text-left ${
                    isSelected
                      ? 'bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] border-[#111111] dark:border-[#FFFFFF]'
                      : isDisabled
                      ? 'opacity-40 border-transparent cursor-not-allowed'
                      : 'border-transparent hover:bg-[#F0F0EE] dark:hover:bg-[#1A1A1D] hover:border-[#E2E2E0] dark:hover:border-[#26262B] cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Token Icon avatar */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs uppercase overflow-hidden shrink-0 ${
                        isSelected
                          ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#111111]'
                          : 'bg-[#F0F0EE] dark:bg-[#202024] text-[#111111] dark:text-[#FFFFFF] border border-[#E2E2E0] dark:border-[#26262B]'
                      }`}
                    >
                      {token.icon ? (
                        <img
                          src={token.icon}
                          alt={token.symbol}
                          className="w-full h-full object-cover"
                        />
                      ) : token.symbol === 'USDC' ? (
                        <img
                          src={usdcLogo}
                          alt={token.symbol}
                          className="w-full h-full object-cover"
                        />
                      ) : token.symbol === 'MUSD' || token.symbol.toLowerCase().includes('mezo') ? (
                        <img
                          src={mezoLogo}
                          alt={token.symbol}
                          className="w-full h-full object-cover"
                        />
                      ) : token.symbol.toLowerCase().includes('btc') ? (
                        <img
                          src={btcLogo}
                          alt={token.symbol}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        token.symbol.slice(0, 3)
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm tracking-tight">
                          {token.symbol}
                        </span>
                        {token.isNative && (
                          <span className={`text-[9px] font-mono px-1 rounded uppercase ${
                            isSelected ? 'bg-white/20' : 'bg-[#E2E2E0] dark:bg-[#26262B]'
                          }`}>
                            Native
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[11px] block truncate max-w-[130px] sm:max-w-[160px] ${
                          isSelected ? 'text-white/80 dark:text-black/70' : 'text-[#777777] dark:text-[#A0A0A0]'
                        }`}>
                          {token.name}
                        </span>
                        {token.usdPrice !== undefined && (
                          <span className={`text-[10px] font-mono ${
                            isSelected ? 'text-white/70 dark:text-black/60' : 'text-[#555555] dark:text-[#888888]'
                          }`}>
                            • ${token.usdPrice > 10 ? token.usdPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : token.usdPrice.toFixed(3)}
                          </span>
                        )}
                        {token.change24h !== undefined && token.change24h !== 0 && (
                          <span className={`text-[9px] font-mono font-medium px-1 py-0.2 rounded ${
                            token.change24h >= 0 
                              ? (isSelected ? 'bg-emerald-400/30 text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')
                              : (isSelected ? 'bg-rose-400/30 text-white' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400')
                          }`}>
                            {token.change24h >= 0 ? '+' : ''}{token.change24h}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Balance on right */}
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-semibold block">
                      {token.balance.toLocaleString('en-US', {
                        minimumFractionDigits: token.decimals > 8 ? 4 : 2,
                        maximumFractionDigits: 6,
                      })}
                    </span>
                    <span className={`text-[10px] font-mono block ${
                      isSelected ? 'text-white/70 dark:text-black/60' : 'text-[#777777] dark:text-[#A0A0A0]'
                    }`}>
                      {token.usdPrice ? `~$${(token.balance * token.usdPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-[#777777] dark:text-[#A0A0A0] font-mono">
              No matching tokens found
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="pt-2 border-t border-[#E2E2E0]/60 dark:border-[#26262B]/60 text-center">
          <span className="text-[10px] font-mono text-[#777777] dark:text-[#A0A0A0]">
            Tokens supported on Mezo Network (31612)
          </span>
        </div>
      </div>
    </div>
  );
};
