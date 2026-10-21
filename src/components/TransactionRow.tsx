import React from 'react';
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
import { Transaction } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface TransactionRowProps {
  transaction: Transaction;
  onClick?: () => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, onClick }) => {
  const { formatTokenFiat } = useCurrency();
  const isReceive = transaction.type === 'receive';
  const isSwap = transaction.type === 'swap';

  const fiatEstimate = formatTokenFiat(
    transaction.amount,
    transaction.currency || 'MUSD'
  );

  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between p-4 sm:px-5 hover:bg-[#F0F0EE] dark:hover:bg-[#1A1A1D] border border-transparent hover:border-[#E2E2E0] dark:border-[#26262B] hover:shadow-2xs rounded-2xl cursor-pointer transition-all duration-150"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      aria-label={`${transaction.type} ${transaction.amount} with ${transaction.counterparty}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Type Icon Container */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-150 group-hover:scale-105 ${
            isReceive
              ? 'bg-[#111111] text-white dark:bg-[#FFFFFF] dark:text-[#111111] border-[#111111] dark:border-[#FFFFFF]'
              : isSwap
              ? 'bg-[#EAEAEA] dark:bg-[#202024] border-[#111111]/30 dark:border-white/30 text-[#111111] dark:text-white'
              : 'bg-[#F0F0EE] dark:bg-[#1E1E22] border-[#E2E2E0] dark:border-[#26262B] text-[#111111] dark:text-[#F5F5F7]'
          }`}
        >
          {isSwap ? (
            <ArrowLeftRight className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" />
          ) : isReceive ? (
            <ArrowDownLeft className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" />
          ) : (
            <ArrowUpRight className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" />
          )}
        </div>

        {/* Counterparty & Timestamp */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm sm:text-base text-[#111111] dark:text-[#FFFFFF] tracking-tight truncate">
              {transaction.counterparty}
            </span>
            {transaction.note && (
              <span className="hidden sm:inline text-xs sm:text-sm text-[#777777] dark:text-[#A0A0A0] truncate max-w-[200px]">
                · {transaction.note}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#777777] dark:text-[#A0A0A0] mt-0.5">
            <span className="font-mono text-xs">{transaction.timestamp}</span>
            <span className="font-mono text-xs text-[#A0A0A0] dark:text-[#707070]">
              · {transaction.counterpartyAddress}
            </span>
          </div>
        </div>
      </div>

      {/* Amount and Status */}
      <div className="text-right shrink-0 ml-4">
        <div className="font-bold font-mono text-base sm:text-lg tabular-nums text-[#111111] dark:text-[#FFFFFF]">
          {isSwap ? '⇄ ' : isReceive ? '+' : '-'}
          {transaction.amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })}{' '}
          <span className="text-xs font-normal font-mono text-[#777777] dark:text-[#A0A0A0]">
            {transaction.currency || 'MUSD'}
          </span>
        </div>
        {fiatEstimate && (
          <div className="text-[11px] font-mono text-[#777777] dark:text-[#A0A0A0] tabular-nums mt-0.5">
            ≈ {fiatEstimate.formatted}
          </div>
        )}
        <div className="text-xs font-sans font-medium uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0] mt-0.5 flex items-center justify-end gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#111111] dark:bg-[#FFFFFF]" />
          <span>{transaction.status}</span>
        </div>
      </div>
    </div>
  );
};
