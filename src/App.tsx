import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Workbench from './components/Workbench';
import { LeaseAuditData, AuditLedgerLog, AuditField } from './types';
import { Sparkles, Upload, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function App() {
  const [leases, setLeases] = useState<LeaseAuditData[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [currentOperator, setCurrentOperator] = useState<string>('D. Saini (Lead Lease Auditor)');
  const [auditLogs, setAuditLogs] = useState<AuditLedgerLog[]>([]);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [customLeaseText, setCustomLeaseText] = useState<string>('');
  const [customFileName, setCustomFileName] = useState<string>('');
  const [apiWarning, setApiWarning] = useState<string | null>(null);

  // Fetch data from MongoDB on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [leasesRes, logsRes] = await Promise.all([
          fetch('/api/leases'),
          fetch('/api/logs')
        ]);
        if (leasesRes.ok) setLeases(await leasesRes.json());
        if (logsRes.ok) setAuditLogs(await logsRes.json());
      } catch (err) {
        console.error("Failed to load initial data from MongoDB:", err);
      }
    };
    fetchData();
  }, []);

  const selectedLease = leases.find((l) => l.id === selectedLeaseId);

  // Sync helper functions
  const syncLeaseUpdate = async (updatedLease: LeaseAuditData) => {
    try {
      await fetch(`/api/leases/${updatedLease.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLease)
      });
    } catch (err) {
      console.error("Failed to sync lease update to DB:", err);
    }
  };

  const syncLog = async (newLog: AuditLedgerLog) => {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
    } catch (err) {
      console.error("Failed to sync log to DB:", err);
    }
  };

  const addLog = (
    stage: number, fieldId: string, label: string, action: AuditLedgerLog['action'],
    originalValue: string, newValue: string, reason: string
  ) => {
    const newLog: AuditLedgerLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      stage, fieldId, label, action, operator: currentOperator,
      originalValue: originalValue.toString(), newValue: newValue.toString(), reason
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    syncLog(newLog); // Persist to DB
  };

  // --- REFACTORED STATE UPDATERS (Removed side-effects from setState callbacks) ---

  const handleApproveField = (fieldId: string) => {
    if (!selectedLease) return;

    let updatedLease = { ...selectedLease };

    if (fieldId === 'ocrText') {
      addLog(1, 'ocrText', 'OCR Legibility', 'approve', 'Unverified', 'Legibility Confirmed', 'Verified scan quality is standard');
      updatedLease = { ...updatedLease, ocrValidated: true, ocrValidatedBy: currentOperator, ocrValidatedTime: new Date().toISOString() };
    } else if (fieldId === 'documentType') {
      addLog(2, 'documentType', 'Document Category', 'approve', updatedLease.documentType, updatedLease.documentType, 'Confirmed classification category');
      updatedLease = { ...updatedLease, classificationApproved: true, classificationApprovedBy: currentOperator, classificationApprovedTime: new Date().toISOString() };
    } else {
      const targetField = updatedLease.fields[fieldId as keyof typeof updatedLease.fields] as AuditField<any>;
      if (targetField) {
        addLog(3, fieldId, targetField.label, 'approve', targetField.originalValue.toString(), targetField.value.toString(), 'Certified extracted value matches document source');
        updatedLease.fields = {
          ...updatedLease.fields,
          [fieldId]: { ...targetField, approved: true, approvedValue: targetField.value, modifiedBy: currentOperator, timestamp: new Date().toISOString() }
        };
      }
    }

    setLeases(prev => prev.map(l => l.id === selectedLease.id ? updatedLease : l));
    syncLeaseUpdate(updatedLease);
  };

  const handleUpdateField = (fieldId: string, value: string | number, reason: string) => {
    if (!selectedLease) return;

    const targetField = selectedLease.fields[fieldId as keyof typeof selectedLease.fields] as AuditField<any>;
    if (targetField) {
      addLog(3, fieldId, targetField.label, 'modify', targetField.value.toString(), value.toString(), reason);
      
      const updatedFields = {
        ...selectedLease.fields,
        [fieldId]: { ...targetField, value, approvedValue: value, approved: true, modifiedBy: currentOperator, timestamp: new Date().toISOString(), reason }
      };
      
      const updatedLease = { ...selectedLease, fields: updatedFields };
      setLeases(prev => prev.map(l => l.id === selectedLease.id ? updatedLease : l));
      syncLeaseUpdate(updatedLease);
    }
  };

  const handleApproveClause = (clauseId: string) => {
    if (!selectedLease) return;

    const clause = selectedLease.clauses.find(c => c.id === clauseId);
    if (clause) {
      addLog(4, clauseId, `Clause: ${clause.name}`, 'approve', 'Unaudited', 'Audited', 'Verified legal parameters of clause');
    }

    const updatedClauses = selectedLease.clauses.map(c => c.id === clauseId ? { ...c, approved: true } : c);
    const updatedLease = { ...selectedLease, clauses: updatedClauses };

    setLeases(prev => prev.map(l => l.id === selectedLease.id ? updatedLease : l));
    syncLeaseUpdate(updatedLease);
  };

  const handleResolveRule = (ruleId: string, justification: string) => {
    if (!selectedLease) return;

    const rule = selectedLease.complianceRules.find(r => r.id === ruleId);
    if (rule) {
      addLog(5, ruleId, `Rule: ${rule.ruleName}`, 'override_compliance', rule.status.toUpperCase(), 'RESOLVED', justification);
    }

    const updatedRules = selectedLease.complianceRules.map(r => 
      r.id === ruleId ? { ...r, approved: true, status: 'passed' as const, justification, reviewerId: currentOperator, timestamp: new Date().toISOString() } : r
    );
    
    const updatedLease = { ...selectedLease, complianceRules: updatedRules };
    setLeases(prev => prev.map(l => l.id === selectedLease.id ? updatedLease : l));
    syncLeaseUpdate(updatedLease);
  };

  const handleReconcileLedger = (notes: string) => {
    if (!selectedLease) return;

    addLog(6, 'ledgerEntries', 'Financial Ledger Reconciliation', 'reconcile', 'Pending Check', 'Reconciled', notes || 'Reconciliation comments verified');
    
    const updatedEntries = selectedLease.ledgerEntries.map(e => ({ ...e, status: 'reconciled' as const }));
    const updatedLease = { ...selectedLease, ledgerReconciled: true, ledgerNotes: notes, ledgerEntries: updatedEntries };
    
    setLeases(prev => prev.map(l => l.id === selectedLease.id ? updatedLease : l));
    syncLeaseUpdate(updatedLease);
  };

  const handleSignOff = (signatureName: string) => {
    if (!selectedLease) return;

    addLog(7, 'signOff', 'Document Sign-Off', 'sign_off', 'Awaiting Reviewer Sign-Off', `Sealed by ${signatureName}`, 'Final digital signature applied.');
    
    const updatedLease = { ...selectedLease, signedOff: true, signedBy: signatureName, signedTime: new Date().toISOString(), status: 'completed' as const };
    
    setLeases(prev => prev.map(l => l.id === selectedLease.id ? updatedLease : l));
    syncLeaseUpdate(updatedLease);
  };

  const handleProcessCustomLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLeaseText.trim()) return;

    setIsProcessing(true);
    setApiWarning(null);

    const title = customFileName.trim() || 'Custom_Lease_Intake.txt';

    try {
      const response = await fetch('/api/audit-lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaseText: customLeaseText, fileName: title })
      });

      if (!response.ok) throw new Error('Server returned an error status.');

      const result = await response.json();
      
      if (result.warning) setApiWarning(result.warning);

      if (result.data) {
        setLeases((prev) => [result.data, ...prev]);
        setSelectedLeaseId(result.data.id);
        
        setCustomLeaseText('');
        setCustomFileName('');
        
        addLog(1, result.data.id, title, 'flag_unreadable', 'Unprocessed', 'Intake Analysis Successful', 'Automated AI pipeline completed lease parsing');
      }
    } catch (err: any) {
      console.error(err);
      setApiWarning(`Audit Request failed: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSandboxTemplate = (type: 'demo' | 'standard') => {
    if (type === 'demo') {
      setCustomFileName('Fictional_Demo_Residential_Lease_Agreement.pdf');
      setCustomLeaseText(`FICTIONAL DEMO RESIDENTIAL LEASE AGREEMENT
FOR SOFTWARE TESTING AND DEMONSTRATION ONLY - NOT A LEGAL FORM

Landlord | Harborview Property Management LLC (Fictional)
Tenant(s) | Jordan Taylor and Casey Morgan (Fictional)
Property | 1458 Sample Avenue, Unit 4B, Demo City, NY 10001 (Fictional)
Lease Term | 12 months
Start Date | August 1, 2026
End Date | July 31, 2027
Monthly Rent | $2,450
Security Deposit | $2,450
Rent Due | 1st day of each month

1. PREMISES AND TERM
The Landlord leases the residential premises identified above to the Tenant for a fixed term beginning August 1, 2026 and ending July 31, 2027.

2. RENT
Tenant shall pay monthly rent of $2,450, due on the first day of each calendar month. No change to monthly rent is effective unless documented in writing and acknowledged by the appropriate parties.

3. SECURITY DEPOSIT
Tenant shall pay a security deposit of $2,450 before possession. The deposit will be handled and returned subject to applicable law and lawful deductions. This demo provision is not intended to state the requirements of any particular jurisdiction.

4. LATE PAYMENT
For this fictional software test, a $75 late fee may be assessed when rent remains unpaid after the fifth day of the month. This provision is intentionally included for review and should not be interpreted as legally valid in any jurisdiction.

4.2 OCCUPANCY AND ASSISTANCE-ANIMAL REVIEW
Only the named tenants may occupy the premises permanently unless prior written approval is provided. Requests involving disability-related accommodations or assistance animals will be considered under applicable law and property procedures. Any automated review of this clause is preliminary and must be routed to a qualified human reviewer before a compliance conclusion is made.

5. PETS
No pets are permitted without written approval and any required pet addendum. Assistance animals are not treated as pets where applicable law provides otherwise. Accommodation questions must be escalated for appropriate human review.

6. MAINTENANCE AND REPAIRS
Tenant shall keep the premises reasonably clean and promptly report conditions requiring repair. Landlord shall address maintenance responsibilities as required by the lease and applicable law.

7. ENTRY
Landlord may enter the premises for lawful purposes such as inspection, repair, maintenance, or emergency response, subject to applicable notice requirements. The exact notice period is intentionally not specified so the audit software can flag it for human review.

8. ADDENDUM (INTENTIONAL TEST INCONSISTENCY)
For software testing purposes only, this fictional addendum states that monthly rent is $2,400. This intentionally conflicts with Section 2, which states $2,450. The expected system behavior is to identify the discrepancy and route it to a human reviewer rather than automatically deciding which amount is correct.

9. HUMAN OVERSIGHT
Any AI-generated extraction, classification, risk flag, clause interpretation, or suggested finding is preliminary. Flagged clauses and material discrepancies must be reviewed by a human before a final audit report is approved.

10. SIGNATURES
The fictional parties acknowledge this document solely as a synthetic demonstration artifact. It does not create a real tenancy or legal obligation.

Fictional Landlord Signature: ____________________   Date: __________
Fictional Tenant Signature: ______________________   Date: __________
Fictional Tenant Signature: ______________________   Date: __________

DEMO SOFTWARE TEST KEY
Keep this page separate from the lease pages for a blind software test.

Test Item | Expected Behavior
Rent | Extract $2,450 from the main lease.
Deposit | Extract $2,450.
Lease dates | Extract Aug. 1, 2026 through Jul. 31, 2027.
Rent discrepancy | Flag $2,450 vs. $2,400 for human review.
Clause 4.2 | Route compliance-sensitive language to human review; no final legal conclusion.
Entry clause | Flag unspecified notice period for human review.
Late fee | Extract $75; route jurisdiction-dependent validity to human review.
Assistance animals | Recognize sensitive language and require human review.
Final report | Do not finalize flagged findings until reviewer approval.

Important: This synthetic document intentionally contains test conditions. It is not legal advice, a valid lease template, or a statement of Fair Housing or state-specific compliance requirements.`);
    } else {
      setCustomFileName('Residential_Apt_12B_Lease.txt');
      setCustomLeaseText(`RESIDENTIAL LEASE AGREEMENT\nLANDLORD: Plaza Apartments LLC\nTENANT: Elizabeth Vance\nMONTHLY RENT: $1,400.00\nSECURITY DEPOSIT: $1,400.00\nSTART DATE: 2026-09-01\nEND DATE: 2027-08-31`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header currentOperator={currentOperator} onOperatorChange={setCurrentOperator} isProcessing={isProcessing} />
      <main className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full space-y-6">
        {apiWarning && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start space-x-3 shadow-xs">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block mb-1">Audit Notice / Pipeline Update</strong>
              {apiWarning}
            </div>
            <button onClick={() => setApiWarning(null)} className="text-amber-800 font-bold hover:text-amber-950 text-xs ml-auto">Dismiss</button>
          </div>
        )}
        {selectedLeaseId && selectedLease ? (
          <Workbench 
            lease={selectedLease}
            onBack={() => setSelectedLeaseId(null)}
            onUpdateField={handleUpdateField}
            onApproveField={handleApproveField}
            onApproveClause={handleApproveClause}
            onResolveRule={handleResolveRule}
            onReconcileLedger={handleReconcileLedger}
            onSignOff={handleSignOff}
            operatorName={currentOperator}
          />
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs relative overflow-hidden">
              <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 bg-emerald-500/10 rounded-full blur-xl"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4 mb-4 gap-4">
                <div>
                  <h3 className="font-display font-bold text-gray-950 text-base flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    <span>Live AI Auditing Sandbox (Gemini Ingest)</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Type, paste, or select a lease template below to run an automated audit through our 7-stage compliance framework.
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleLoadSandboxTemplate('demo')}
                    className="px-2.5 py-1.5 border border-gray-200 text-gray-600 hover:text-gray-950 rounded text-xs font-semibold bg-gray-50/50"
                  >
                    Load Fictional Demo Check
                  </button>
                  <button 
                    onClick={() => handleLoadSandboxTemplate('standard')}
                    className="px-2.5 py-1.5 border border-gray-200 text-gray-600 hover:text-gray-950 rounded text-xs font-semibold bg-gray-50/50"
                  >
                    Load Standard Clean
                  </button>
                </div>
              </div>

              <form onSubmit={handleProcessCustomLease} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Document Title / ID</label>
                    <input 
                      type="text"
                      placeholder="e.g. Fictional_Demo.txt"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2.5 bg-white focus:outline-hidden focus:border-emerald-600 font-mono"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Upload File</label>
                    <input
                      type="file"
                      accept=".txt,.md,.csv,.pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCustomFileName(file.name);
                          if (file.name.toLowerCase().endsWith('.pdf')) {
                            setCustomLeaseText('Extracting PDF text...');
                            try {
                              const arrayBuffer = await file.arrayBuffer();
                              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                              let fullText = '';
                              for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const textContent = await page.getTextContent();
                                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                                fullText += pageText + '\n\n';
                              }
                              setCustomLeaseText(fullText.trim());
                            } catch (err) {
                              setCustomLeaseText('Error extracting text from PDF. Please check console.');
                            }
                          } else {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const text = ev.target?.result;
                              if (typeof text === 'string') setCustomLeaseText(text);
                            };
                            reader.readAsText(file);
                          }
                        }
                      }}
                      className="w-full text-[11px] border border-gray-200 rounded-lg p-1.5 bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Agreement text to audit</label>
                  <textarea
                    placeholder="Paste lease clauses, rent amounts, dates, or full agreement text..."
                    value={customLeaseText}
                    onChange={(e) => setCustomLeaseText(e.target.value)}
                    className="w-full h-32 text-xs border border-gray-200 rounded-lg p-3 bg-white focus:outline-hidden focus:border-emerald-600 font-mono leading-relaxed"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] text-gray-400">
                    Processing uses standard <strong className="font-semibold">gemini-3.5-flash</strong> model.
                  </span>
                  <button
                    type="submit"
                    disabled={isProcessing || !customLeaseText.trim()}
                    className="inline-flex items-center space-x-1.5 rounded-lg px-4 py-2.5 bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-md hover:shadow-lg transition duration-150 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{isProcessing ? 'Auditing with AI...' : 'Analyze Document'}</span>
                  </button>
                </div>
              </form>
            </div>
            <Dashboard leases={leases} onSelectLease={setSelectedLeaseId} auditLogs={auditLogs} />
          </div>
        )}
      </main>
    </div>
  );
}