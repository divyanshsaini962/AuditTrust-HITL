import React from 'react';
import { LeaseAuditData, AuditLedgerLog } from '../types';
import { FileText, AlertTriangle, CheckCircle, Shield, ArrowRight, Activity, Clock, FileWarning } from 'lucide-react';

interface DashboardProps {
  leases: LeaseAuditData[];
  onSelectLease: (id: string) => void;
  auditLogs: AuditLedgerLog[];
}

export default function Dashboard({ leases, onSelectLease, auditLogs }: DashboardProps) {
  const totalLeases = leases.length;
  const inQueue = leases.filter(l => !l.signedOff).length;
  const completed = leases.filter(l => l.signedOff).length;
  
  const totalConfidence = leases.reduce((acc, lease) => {
    const fields = Object.values(lease.fields);
    if (fields.length === 0) return acc;
    const avgLeaseConf = fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length;
    return acc + avgLeaseConf;
  }, 0);
  const avgConfidence = totalLeases > 0 ? (totalConfidence / totalLeases).toFixed(1) : '0';

  const totalFlags = leases.reduce((acc, lease) => {
    const failedRules = lease.complianceRules.filter(r => r.status === 'failed').length;
    return acc + failedRules;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
        <h2 className="font-display text-2xl font-bold tracking-tight text-gray-950">
          Lease Compliance & HITL Command Center
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Overview of automated intake status, human oversight checks, and real-time compliance ledger logs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Analyzed</span>
            <div className="mt-1 font-display text-2xl font-bold text-gray-900">{totalLeases}</div>
            <span className="mt-1 text-xs text-emerald-600 flex items-center font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1"></span>
              Avg {leases.length > 0 ? leases[0].ocrQuality : 0}% OCR accuracy
            </span>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-gray-600">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Human Audit Queue</span>
            <div className="mt-1 font-display text-2xl font-bold text-gray-900">{inQueue}</div>
            <span className="mt-1 text-xs text-amber-600 flex items-center font-medium">
              <Clock className="h-3 w-3 mr-1" />
              Awaiting sign-off
            </span>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-amber-600 border border-amber-100">
            <AlertTriangle className="h-6 w-6 animate-pulse" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Completed & Sealed</span>
            <div className="mt-1 font-display text-2xl font-bold text-gray-900">{completed}</div>
            <span className="mt-1 text-xs text-gray-500 font-mono">
              Trace Ledger intact
            </span>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600 border border-emerald-100">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Avg AI Confidence</span>
            <div className="mt-1 font-display text-2xl font-bold text-gray-900">{avgConfidence}%</div>
            <span className="mt-1 text-xs text-red-600 flex items-center font-medium">
              <FileWarning className="h-3.5 w-3.5 mr-1" />
              {totalFlags} active legal violations
            </span>
          </div>
          <div className="rounded-lg bg-purple-50 p-3 text-purple-600 border border-purple-100">
            <Shield className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-gray-150 bg-gray-50 px-5 py-4 flex justify-between items-center">
            <h3 className="font-display font-semibold text-gray-900 text-sm tracking-tight">Active Human Triage Queue</h3>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">{inQueue} Pending</span>
          </div>

          <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
            {leases.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No leases currently in queue. Upload a text agreement or select a demo scenario to start auditing.
              </div>
            ) : (
              leases.map((lease) => {
                const failedCount = lease.complianceRules.filter(r => r.status === 'failed').length;
                const warningCount = lease.complianceRules.filter(r => r.status === 'warning').length;
                const lowConfFields = Object.values(lease.fields).filter(f => f.confidence < 90).length;

                return (
                  <div key={lease.id} className="p-5 hover:bg-gray-50 transition duration-150 flex items-center justify-between">
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-900">{lease.fileName}</span>
                        {lease.signedOff ? (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">Completed</span>
                        ) : failedCount > 0 ? (
                          <span className="rounded-full bg-red-50 border border-red-150 px-2.5 py-0.5 text-[10px] font-bold text-red-700 uppercase">Violation Flagged</span>
                        ) : (
                          <span className="rounded-full bg-amber-50 border border-amber-150 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 uppercase">Audit Required</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        <span>Size: <strong className="font-semibold text-gray-700">{lease.fileSize}</strong></span>
                        <span>•</span>
                        <span>Uploaded: <strong className="font-semibold text-gray-700">{lease.uploadDate.split(' ')[0]}</strong></span>
                        <span>•</span>
                        <span>AI Confidence: <strong className="font-semibold text-gray-700">{lease.classificationConfidence}%</strong></span>
                      </div>
                      
                      <div className="pt-2 flex flex-wrap gap-2">
                        {failedCount > 0 && (
                          <span className="inline-flex items-center rounded-sm bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 border border-red-100">
                            {failedCount} Compliance Breaches
                          </span>
                        )}
                        {lowConfFields > 0 && (
                          <span className="inline-flex items-center rounded-sm bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-100">
                            {lowConfFields} Low Confidence Fields
                          </span>
                        )}
                        {lease.documentType && (
                          <span className="inline-flex items-center rounded-sm bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
                            {lease.documentType}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <button
                        onClick={() => onSelectLease(lease.id)}
                        className={`inline-flex items-center space-x-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-xs transition duration-150 ${
                          lease.signedOff 
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                        }`}
                      >
                        <span>{lease.signedOff ? 'Review Audit' : 'Audit Document'}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
            <h3 className="font-display font-semibold text-gray-900 text-sm tracking-tight mb-4 flex items-center justify-between">
              <span>Auditing Stage Distribution</span>
              <Activity className="h-4 w-4 text-gray-400" />
            </h3>
            
            <div className="space-y-3">
              {[
                { name: '1. OCR & Intake', count: leases.length, color: 'bg-indigo-500' },
                { name: '2. Classification', count: leases.filter(l => l.classificationApproved).length, color: 'bg-blue-500' },
                { name: '3. Field Extraction', count: leases.filter(l => Object.values(l.fields).every(f => f.approved)).length, color: 'bg-amber-500' },
                { name: '4. Clause Tags', count: leases.filter(l => l.clauses.every(c => c.approved)).length, color: 'bg-pink-500' },
                { name: '5. Compliance Rules', count: leases.filter(l => l.complianceRules.every(r => r.approved)).length, color: 'bg-red-500' },
                { name: '6. Ledger Cross-Audit', count: leases.filter(l => l.ledgerReconciled).length, color: 'bg-emerald-500' },
                { name: '7. Final Sign-off', count: completed, color: 'bg-teal-500' }
              ].map((stage, idx) => {
                const percentage = totalLeases > 0 ? (stage.count / totalLeases) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-gray-600">{stage.name}</span>
                      <span className="text-gray-900 font-semibold">{stage.count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${stage.color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-gray-150 bg-gray-50 px-4 py-3 flex justify-between items-center">
              <h3 className="font-display font-semibold text-gray-900 text-xs tracking-tight uppercase">HITL Action Ledger Logs</h3>
              <span className="font-mono text-[9px] text-gray-400">SECURE TRAIL</span>
            </div>

            <div className="p-4 divide-y divide-gray-100 max-h-[300px] overflow-y-auto space-y-3">
              {auditLogs.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs font-mono">
                  No ledger events recorded yet. Human modifications will log here.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="pt-3 first:pt-0 text-xs space-y-1 font-sans">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-gray-800">{log.operator}</span>
                      <span className="font-mono text-[9px] text-gray-400">{log.timestamp.split('T')[1].substring(0, 8)}</span>
                    </div>
                    <p className="text-gray-600">
                      Approved/Modified <strong className="font-semibold text-gray-800">{log.label}</strong> to <code className="font-mono text-gray-900 bg-gray-100 px-1 rounded text-[11px]">{log.newValue}</code>
                    </p>
                    <div className="text-[10px] text-amber-700 bg-amber-50/50 p-1 px-1.5 rounded border border-amber-100/30">
                      <strong>Justification:</strong> {log.reason}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}