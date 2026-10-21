import React, { useState } from 'react';
import { X, ChevronRight, Receipt } from 'lucide-react';
import { Transaction } from '../types';
import { TransactionRow } from './TransactionRow';
import { HalftonePattern } from './HalftonePattern';
import { SendPlaneIcon } from './SendPlaneIcon';
import { ReceivePlaneIcon } from './ReceivePlaneIcon';
import { useCurrency } from '../context/CurrencyContext';

interface RecentActivityProps {
  transactions: Transaction[];
  onViewAll: () => void;
  onSend: () => void;
  onReceive: () => void;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  transactions,
  onViewAll,
  onSend,
  onReceive,
}) => {
  const { preferredCurrency, formatTokenFiat } = useCurrency();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const selectedFiat = selectedTx
    ? formatTokenFiat(selectedTx.amount, selectedTx.currency || 'MUSD')
    : null;

  return (
    <div className="relative overflow-hidden bg-[#FFFFFF] dark:bg-[#141416] rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] p-6 sm:p-8 shadow-xs space-y-6 transition-all duration-300 hover:border-[#C8C8C5] dark:hover:border-[#3A3A40]">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-sans font-medium uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
            Audit & History
          </div>
          <div className="flex items-center gap-2.5 mt-0.5">
            <h2 className="text-lg sm:text-xl font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight font-sans">
              Recent Activity
            </h2>
            {transactions.length > 0 && (
              <span className="text-xs font-mono tabular-nums font-semibold text-[#111111] dark:text-[#FFFFFF] bg-[#F0F0EE] dark:bg-[#1A1A1D] px-2 py-0.5 rounded-md border border-[#E2E2E0] dark:border-[#26262B]">
                {transactions.length} RECORDS
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onViewAll}
          className="group flex items-center gap-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF] hover:underline transition-all duration-150 py-2 px-3.5 rounded-xl bg-[#F0F0EE] dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] cursor-pointer"
        >
          <span>View all</span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Content: Empty State vs Populated Rows */}
      {transactions.length === 0 ? (
        <div className="relative overflow-hidden py-14 sm:py-16 text-center flex flex-col items-center justify-center border border-[#E2E2E0] dark:border-[#26262B] rounded-2xl bg-[#F5F5F3]/50 dark:bg-[#111113]/50 p-6">
          {/* Halftone Sphere behind the empty state icon */}
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#161619] border border-[#E2E2E0] dark:border-[#26262B] flex items-center justify-center text-[#111111] dark:text-[#FFFFFF] shadow-xs relative z-10">
              <Receipt className="w-7 h-7 text-[#111111] dark:text-[#FFFFFF]" />
            </div>
            <HalftonePattern variant="sphere" className="absolute -inset-8 w-32 h-32 opacity-25 dark:opacity-30 pointer-events-none" />
          </div>

          <div className="text-xs font-sans font-medium uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">
            Settlement Ledger Empty
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight mt-1 font-sans">
            No transactions recorded yet
          </h3>
          <p className="text-sm text-[#777777] dark:text-[#A0A0A0] mt-1 max-w-sm leading-relaxed font-sans">
            Your transfer history and payment receipts will populate automatically once you initiate or receive MUSD.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onSend}
              className="group inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] text-sm font-semibold tracking-wide shadow-xs hover:shadow-sm hover:scale-[1.01] active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <SendPlaneIcon className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              <span>Send MUSD</span>
            </button>
            <button
              onClick={onReceive}
              className="group inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-[#1A1A1D] border border-[#E2E2E0] dark:border-[#26262B] hover:border-[#111111] dark:hover:border-[#FFFFFF] text-sm font-semibold text-[#111111] dark:text-[#FFFFFF] shadow-xs hover:shadow-sm hover:scale-[1.01] active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <ReceivePlaneIcon className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
              <span>Receive</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#E2E2E0] dark:divide-[#26262B] -mx-2 sm:-mx-3">
          {transactions.slice(0, 5).map((tx) => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              onClick={() => setSelectedTx(tx)}
            />
          ))}
        </div>
      )}

      {/* Transaction Detail Modal if clicked */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedTx(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-detail-title"
        >
          <div
            className="relative overflow-hidden bg-[#FFFFFF] dark:bg-[#141416] rounded-3xl border border-[#E2E2E0] dark:border-[#26262B] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Halftone accent in modal corner */}
            <HalftonePattern variant="corner" className="absolute right-0 top-0 w-32 h-32 opacity-15 dark:opacity-20 pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between pb-3 border-b border-[#E2E2E0] dark:border-[#26262B]">
              <div className="flex items-center gap-2">
                <span id="tx-detail-title" className="text-xs font-mono font-bold uppercase tracking-wider text-[#111111] dark:text-[#FFFFFF]">
                  Settlement Receipt
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#111111] dark:bg-[#FFFFFF]" />
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1.5 text-[#777777] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FFFFFF] rounded-xl hover:bg-[#F0F0EE] dark:hover:bg-[#1C1C1F] hover:rotate-90 transition-all duration-150"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative z-10 text-center py-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#777777] dark:text-[#A0A0A0]">
                {selectedTx.type === 'receive' ? 'Amount Received' : 'Amount Sent'}
              </div>
              <div className="font-mono text-3xl sm:text-4xl font-bold tabular-nums text-[#111111] dark:text-[#FFFFFF] mt-1">
                {selectedTx.type === 'receive' ? '+' : '-'}
                {selectedTx.amount.toFixed(2)}{' '}
                <span className="text-xs font-normal text-[#777777] dark:text-[#A0A0A0]">
                  {selectedTx.currency || 'MUSD'}
                </span>
              </div>
              {selectedFiat && (
                <div className="text-xs font-mono text-[#777777] dark:text-[#A0A0A0] mt-1">
                  ≈ {selectedFiat.formatted} {preferredCurrency}
                </div>
              )}
              <p className="text-xs text-[#777777] dark:text-[#A0A0A0] mt-1">
                {selectedTx.type === 'receive' ? 'From' : 'To'}{' '}
                <span className="font-semibold text-[#111111] dark:text-[#FFFFFF]">{selectedTx.counterparty}</span>
              </p>
            </div>

            <div className="relative z-10 space-y-2 text-xs bg-[#F0F0EE] dark:bg-[#1A1A1D] p-4 rounded-2xl border border-[#E2E2E0] dark:border-[#26262B]">
              <div className="flex justify-between py-1 border-b border-[#E2E2E0]/60 dark:border-[#26262B]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">Status</span>
                <span className="font-mono font-semibold text-[#111111] dark:text-[#FFFFFF] uppercase">
                  {selectedTx.status} (Simulated)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E2E0]/60 dark:border-[#26262B]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">Timestamp</span>
                <span className="font-mono text-[#111111] dark:text-[#FFFFFF]">{selectedTx.timestamp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E2E0]/60 dark:border-[#26262B]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">Address</span>
                <span className="font-mono text-[#111111] dark:text-[#FFFFFF] text-[11px]">{selectedTx.counterpartyAddress}</span>
              </div>
              {selectedTx.note && (
                <div className="flex justify-between py-1 border-b border-[#E2E2E0]/60 dark:border-[#26262B]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">Memo</span>
                  <span className="text-[#111111] dark:text-[#FFFFFF]">{selectedTx.note}</span>
                </div>
              )}
              {selectedTx.txHash && (
                <div className="flex justify-between py-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#777777] dark:text-[#A0A0A0]">Hash</span>
                  <span className="font-mono text-[11px] text-[#777777] dark:text-[#A0A0A0]">{selectedTx.txHash}</span>
                </div>
              )}
            </div>

            <p className="text-[10px] font-mono text-center text-[#777777] dark:text-[#A0A0A0] uppercase tracking-wider">
              Simulation record · Mezo ecosystem
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
