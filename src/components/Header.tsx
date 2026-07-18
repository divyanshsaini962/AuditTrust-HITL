import React from 'react';
import { ShieldCheck, User } from 'lucide-react';

interface HeaderProps {
  currentOperator: string;
  onOperatorChange: (operator: string) => void;
  isProcessing: boolean;
}

const AUDITORS = [
  'D. Saini (Lead Lease Auditor)',
  'A. Vance (Compliance Expert)',
  'R. Chen (Legal Counsel)',
  'S. Jenkins (Operations Manager)'
];

export default function Header({ currentOperator, onOperatorChange, isProcessing }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-xs">
      <div className="flex items-center space-x-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-gray-900">
            AuditTrust <span className="text-emerald-600 font-normal">HITL</span>
          </h1>
          <p className="text-xs text-gray-500 font-mono">AI-POWERED LEASE AUDITING PLATFORM</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {isProcessing && (
          <div className="flex items-center space-x-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 animate-pulse border border-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Pipeline Processing...</span>
          </div>
        )}

        <div className="flex items-center space-x-3 rounded-lg border border-gray-200 bg-gray-50 p-1.5 px-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-gray-600">
            <User className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Active Human Operator</div>
            <select
              value={currentOperator}
              onChange={(e) => onOperatorChange(e.target.value)}
              className="bg-transparent font-sans text-xs font-semibold text-gray-700 outline-hidden cursor-pointer"
            >
              {AUDITORS.map((auditor) => (
                <option key={auditor} value={auditor}>
                  {auditor}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}