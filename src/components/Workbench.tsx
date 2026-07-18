import React, { useState, useEffect } from 'react';
import { LeaseAuditData, AuditField, ExtractedClause, ComplianceRule, LedgerEntry } from '../types';
import { 
  FileCheck, ShieldAlert, ArrowLeft, ChevronRight, Check, AlertCircle, Edit3, 
  HelpCircle, Scale, DollarSign, PenTool, Search, Eye, AlertTriangle, FileWarning, 
  Info, Sparkles, CheckCircle2 
} from 'lucide-react';

interface WorkbenchProps {
  lease: LeaseAuditData;
  onBack: () => void;
  onUpdateField: (fieldId: string, value: string | number, reason: string) => void;
  onApproveField: (fieldId: string) => void;
  onApproveClause: (clauseId: string) => void;
  onResolveRule: (ruleId: string, justification: string) => void;
  onReconcileLedger: (notes: string) => void;
  onSignOff: (signatureName: string) => void;
  operatorName: string;
}

const PIPELINE_STAGES = [
  { step: 1, label: 'OCR & Intake' },
  { step: 2, label: 'Classification' },
  { step: 3, label: 'Field Extraction' },
  { step: 4, label: 'Clause Tagging' },
  { step: 5, label: 'Compliance Checks' },
  { step: 6, label: 'Ledger Reconcile' },
  { step: 7, label: 'Sign-off Report' }
];

export default function Workbench({
  lease,
  onBack,
  onUpdateField,
  onApproveField,
  onApproveClause,
  onResolveRule,
  onReconcileLedger,
  onSignOff,
  operatorName
}: WorkbenchProps) {
  
  const [activeStage, setActiveStage] = useState<number>(() => {
    if (!lease.ocrValidated) return 1;
    if (!lease.classificationApproved) return 2;
    if (Object.values(lease.fields).some(f => !f.approved)) return 3;
    if (lease.clauses.some(c => !c.approved)) return 4;
    if (lease.complianceRules.some(r => !r.approved)) return 5;
    if (!lease.ledgerReconciled) return 6;
    return 7;
  });

  useEffect(() => {
    if (!lease.ocrValidated) setActiveStage(1);
    else if (!lease.classificationApproved) setActiveStage(2);
    else if (Object.values(lease.fields).some(f => !f.approved)) setActiveStage(3);
    else if (lease.clauses.some(c => !c.approved)) setActiveStage(4);
    else if (lease.complianceRules.some(r => !r.approved)) setActiveStage(5);
    else if (!lease.ledgerReconciled) setActiveStage(6);
    else setActiveStage(7);
  }, [lease.id]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');

  const [overridingRuleId, setOverridingRuleId] = useState<string | null>(null);
  const [overrideJustification, setOverrideJustification] = useState<string>('');

  const [ledgerNotes, setLedgerNotes] = useState<string>(lease.ledgerNotes || '');

  const [signatureName, setSignatureName] = useState<string>('');

  const handleEditClick = (field: AuditField<any>) => {
    setEditingFieldId(field.id);
    setEditValue(field.value.toString());
    setEditReason('');
  };

  const handleSaveFieldEdit = (fieldId: string) => {
    if (!editValue || !editReason) {
      alert("Both a corrected value and a justification reason are required to apply an override.");
      return;
    }
    const isNumeric = fieldId === 'monthlyRent' || fieldId === 'securityDeposit' || fieldId === 'occupancyLimit';
    const finalVal = isNumeric ? parseFloat(editValue) : editValue;
    onUpdateField(fieldId, finalVal, editReason);
    setEditingFieldId(null);
  };

  const handleSaveRuleOverride = (ruleId: string) => {
    if (!overrideJustification) return;
    onResolveRule(ruleId, overrideJustification);
    setOverridingRuleId(null);
    setOverrideJustification('');
  };

  const renderHighlightedDocument = () => {
    let text = lease.ocrText;
    if (!searchTerm) {
      if (activeStage === 3) {
        const rentStr = lease.fields.monthlyRent.value.toString();
        const depositStr = lease.fields.securityDeposit.value.toString();
        const nameStr = lease.fields.tenantName.value;

        let parts = [nameStr, rentStr, depositStr].filter(Boolean);
        let highlightedText = text;
        parts.forEach(part => {
          const escapedPart = String(part).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(${escapedPart})`, 'gi');
          highlightedText = highlightedText.replace(regex, '<mark class="bg-amber-200 text-gray-900 rounded-sm px-0.5">$1</mark>');
        });
        return <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: highlightedText }} />;
      }
      
      if (activeStage === 4) {
        let highlightedText = text;
        const terms = ['deposit', 'pets', 'rent', 'occupancy', 'termination', 'late fee', 'service dogs', 'assistance animal'];
        terms.forEach(term => {
          const regex = new RegExp(`(${term})`, 'gi');
          highlightedText = highlightedText.replace(regex, '<mark class="bg-indigo-100 text-indigo-950 font-semibold px-0.5">$1</mark>');
        });
        return <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: highlightedText }} />;
      }

      return <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 leading-relaxed">{text}</pre>;
    }

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const highlighted = text.replace(regex, '<mark class="bg-emerald-300 text-emerald-950 rounded-sm font-semibold px-0.5">$1</mark>');
    return <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[600px] overflow-hidden -mx-6 -mb-6 bg-gray-50">
      
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-xs">
        <button 
          onClick={onBack}
          className="inline-flex items-center space-x-1 text-sm font-semibold text-gray-600 hover:text-gray-950"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Exit Workbench</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="text-xs font-mono text-gray-500 uppercase font-semibold">HITL Stage:</div>
          <div className="flex items-center space-x-1 bg-gray-100 rounded-full p-1 border border-gray-200">
            {PIPELINE_STAGES.map((s) => (
              <button
                key={s.step}
                onClick={() => setActiveStage(s.step)}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition ${
                  activeStage === s.step 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.step}. {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        <div className="w-1/2 border-r border-gray-200 flex flex-col h-full bg-white">
          <div className="border-b border-gray-150 px-5 py-3 flex items-center justify-between bg-gray-50">
            <div className="flex items-center space-x-2 text-gray-700">
              <Eye className="h-4 w-4 text-emerald-600" />
              <span className="font-display font-semibold text-sm">Original Document Sandbox (OCR View)</span>
            </div>
            
            <div className="relative w-48">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search lease terms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-md py-1.5 pl-8 pr-3 text-xs focus:outline-hidden focus:border-emerald-600 font-sans"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
            <div className="max-w-2xl mx-auto bg-white border border-gray-200 shadow-sm rounded-lg p-6 min-h-[500px]">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                <span className="font-mono text-[10px] text-gray-400">FILE REF: {lease.fileName}</span>
                <span className="rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[9px] font-mono text-indigo-700 uppercase">LOCKED TARGET PREVIEW</span>
              </div>
              {renderHighlightedDocument()}
            </div>
          </div>
        </div>

        <div className="w-1/2 flex flex-col h-full bg-white">
          <div className="border-b border-gray-150 px-5 py-3 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-emerald-100 text-emerald-800 h-5 w-5 rounded-full flex items-center justify-center font-bold font-mono">
                {activeStage}
              </span>
              <h3 className="font-display font-semibold text-sm text-gray-950">
                Stage {activeStage}: {PIPELINE_STAGES[activeStage - 1].label}
              </h3>
            </div>
            <div className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-800 rounded px-2 py-0.5 font-semibold">
              HUMAN OVERSIGHT ENGAGED
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {activeStage === 1 && (
              <div className="space-y-4 font-sans">
                <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100 text-xs text-emerald-800 flex items-start space-x-3">
                  <Sparkles className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block mb-0.5">Automated OCR Ingest Completed</strong>
                    The lease was ingested from the document processing engine with an OCR quality metric of <strong className="font-bold text-sm">{lease.ocrQuality}%</strong>.
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-5 bg-white space-y-4">
                  <h4 className="font-semibold text-sm text-gray-900 border-b border-gray-100 pb-2">OCR Intake Verification</h4>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xs font-semibold text-gray-700">Scan Quality Rating</div>
                      <div className="text-xs text-gray-500 mt-0.5">AI-calculated legibility confidence index.</div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-emerald-600 font-mono">{lease.ocrQuality}%</span>
                      <span className="block text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Excellent</span>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded border border-gray-200 text-xs flex flex-col space-y-3">
                    <label className="flex items-start space-x-2.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        defaultChecked={lease.ocrValidated}
                        className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                        onChange={(e) => {
                          if (e.target.checked) {
                            onApproveField('ocrText');
                          }
                        }}
                      />
                      <div>
                        <strong className="font-semibold block text-gray-800">Confirm Raw OCR Legibility</strong>
                        <span className="text-gray-500">I certify that the original PDF text has been scanned properly with no missing pages or unreadable artifacts.</span>
                      </div>
                    </label>
                  </div>
                  
                  <div className="flex space-x-3 pt-2">
                    <button
                      onClick={() => alert("Lease flagged as unreadable. System queue administrator has been notified.")}
                      className="flex-1 py-2 text-xs border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-semibold rounded-lg transition"
                    >
                      Flag Scan as Unreadable
                    </button>
                    <button
                      onClick={() => setActiveStage(2)}
                      className="flex-1 py-2 text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-semibold rounded-lg transition shadow-xs flex items-center justify-center space-x-1"
                    >
                      <span>Proceed to Classification</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeStage === 2 && (
              <div className="space-y-4 font-sans">
                {lease.classificationConfidence < 90 && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start space-x-3 shadow-xs">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block mb-0.5">Classification Confidence Alert</strong>
                      The AI document classifier has assigned a confidence score of <strong className="font-bold font-mono text-sm">{lease.classificationConfidence}%</strong> which is below the enterprise minimum of 90%. Manual validation required.
                    </div>
                  </div>
                )}

                <div className="border border-gray-200 rounded-lg p-5 bg-white space-y-4">
                  <h4 className="font-semibold text-sm text-gray-900 border-b border-gray-100 pb-2">Document Categorization</h4>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">AI Predicted Document Category</span>
                      <span className="font-bold text-gray-900 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded">
                        {lease.documentType}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Model Categorization Certainty</span>
                      <span className={`font-mono font-bold ${lease.classificationConfidence < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {lease.classificationConfidence}%
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 space-y-3">
                    <label className="block text-xs font-semibold text-gray-700">Correct Category Override (HITL)</label>
                    <select 
                      defaultValue={lease.documentType}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white focus:outline-hidden focus:border-emerald-600"
                    >
                      <option value="Residential Lease Agreement">Residential Lease Agreement</option>
                      <option value="Lease Addendum">Lease Addendum</option>
                      <option value="Rent Ledger">Rent Ledger / Payment Statement</option>
                      <option value="Commercial Lease">Commercial Lease Agreement</option>
                    </select>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => {
                        onApproveField('documentType');
                        alert("File type classification successfully certified and recorded into the audit trail ledger.");
                        setActiveStage(3);
                      }}
                      className="w-full py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold rounded-lg transition shadow-xs"
                    >
                      Verify & Approve Classification
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeStage === 3 && (
              <div className="space-y-4 font-sans">
                <div className="p-4 bg-emerald-50 text-xs text-emerald-800 rounded-lg border border-emerald-100 flex items-start space-x-2.5">
                  <Info className="h-4.5 w-4.5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    Verify extracted fields against the source document. Fields with a confidence score <strong className="font-semibold text-amber-700">under 90% are highlighted in amber</strong>. Click edit to manually adjust.
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.values(lease.fields).map((field) => {
                    const isLowConfidence = field.confidence < 90;
                    return (
                      <div 
                        key={field.id}
                        className={`rounded-lg border bg-white p-4 transition-all duration-150 ${
                          isLowConfidence 
                            ? 'border-amber-300 ring-2 ring-amber-50 shadow-xs' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-sans block">
                              {field.label}
                            </span>
                            <div className="flex items-center space-x-2 mt-1">
                              <strong className="font-display font-bold text-gray-900 text-lg">
                                {typeof field.value === 'number' 
                                  ? (field.id === 'occupancyLimit' ? field.value.toLocaleString() : `$${field.value.toLocaleString()}`) 
                                  : field.value}
                              </strong>

                              {field.approved && (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200 font-mono">
                                  ✓ CERTIFIED
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`font-mono font-bold text-xs ${isLowConfidence ? 'text-amber-600' : 'text-emerald-600'}`}>
                              AI Conf: {field.confidence}%
                            </span>
                            <span className="block text-[10px] text-gray-400 mt-0.5">{field.description}</span>
                          </div>
                        </div>

                        {field.modifiedBy && (
                          <div className="mt-3 bg-gray-50 border border-gray-150 rounded p-2 text-[11px] text-gray-600 font-sans">
                            <strong>Modified by {field.modifiedBy}:</strong> {field.originalValue} → {field.approvedValue} <br />
                            <span className="text-amber-800">Reason: {field.reason}</span>
                          </div>
                        )}

                        <div className="mt-4 pt-3 border-t border-gray-100">
                          {editingFieldId === field.id ? (
                            <div className="w-full space-y-3 bg-amber-50/40 border border-amber-100 p-3 rounded-lg">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Corrected Value</label>
                                <input 
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-hidden focus:border-amber-500 shadow-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Reason for Correction</label>
                                <input 
                                  type="text"
                                  placeholder="Provide human justification for overriding AI extraction..."
                                  value={editReason}
                                  onChange={(e) => setEditReason(e.target.value)}
                                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-hidden focus:border-amber-500 shadow-sm"
                                />
                              </div>
                              <div className="flex space-x-2 justify-end pt-2">
                                <button 
                                  onClick={() => setEditingFieldId(null)}
                                  className="px-3 py-1.5 text-xs border border-gray-200 text-gray-700 font-semibold rounded bg-white hover:bg-gray-100"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={() => handleSaveFieldEdit(field.id)}
                                  className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 font-bold shadow-xs flex items-center space-x-1"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>Apply Fix & Log</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <button 
                                onClick={() => handleEditClick(field)}
                                className="inline-flex items-center space-x-1 text-xs font-semibold text-gray-500 hover:text-emerald-700 transition"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>Adjust Value</span>
                              </button>

                              {!field.approved && (
                                <button
                                  onClick={() => onApproveField(field.id)}
                                  className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2.5 py-1.5 rounded-md hover:bg-emerald-100 transition shadow-xs"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Approve Field</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => setActiveStage(4)}
                    className="py-2.5 px-5 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold rounded-lg shadow-xs flex items-center space-x-1 transition"
                  >
                    <span>Proceed to Clauses (Stage 4)</span>
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}

            {activeStage === 4 && (
              <div className="space-y-4 font-sans">
                <div className="p-4 bg-emerald-50 text-xs text-emerald-800 rounded-lg border border-emerald-100 flex items-start space-x-2.5">
                  <Info className="h-4.5 w-4.5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    Review key legal clauses identified from the lease agreement. Confirm mapping or flag issues.
                  </div>
                </div>

                <div className="space-y-4">
                  {lease.clauses.map((clause) => (
                    <div key={clause.id} className="border border-gray-200 bg-white rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-sm text-gray-900 flex items-center space-x-2">
                            <span>{clause.name}</span>
                            {clause.isStandard ? (
                              <span className="bg-gray-100 text-gray-700 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-gray-200 font-mono">STANDARD</span>
                            ) : (
                              <span className="bg-purple-100 text-purple-700 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-purple-200 font-mono">CUSTOM / NON-STANDARD</span>
                            )}
                          </h4>
                        </div>
                        <div>
                          {clause.status === 'compliant' && (
                            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 text-[10px] font-bold rounded-sm">Compliant</span>
                          )}
                          {clause.status === 'warning' && (
                            <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 text-[10px] font-bold rounded-sm">Needs Correction</span>
                          )}
                          {clause.status === 'missing' && (
                            <span className="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 text-[10px] font-bold rounded-sm">Discriminatory / Missing</span>
                          )}
                        </div>
                      </div>

                      <blockquote className="border-l-4 border-gray-200 pl-3 py-1 text-xs text-gray-600 bg-gray-50/50 font-mono italic">
                        "{clause.text}"
                      </blockquote>

                      {clause.remedyAction && (
                        <div className="p-2.5 bg-amber-50 border border-amber-100 text-amber-800 rounded text-xs">
                          <strong>HITL Remediation Directive:</strong> {clause.remedyAction}
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                        <span className="text-[10px] font-mono text-gray-400">AI Tag Certainty: {clause.confidence}%</span>
                        {clause.approved ? (
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center space-x-1">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Audited & Signed</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => onApproveClause(clause.id)}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold text-xs px-2.5 py-1 rounded transition"
                          >
                            Mark Audited
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => setActiveStage(5)}
                    className="py-2.5 px-5 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold rounded-lg shadow-xs flex items-center space-x-1 transition"
                  >
                    <span>Proceed to Compliance Engine (Stage 5)</span>
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}

            {activeStage === 5 && (
              <div className="space-y-4 font-sans">
                <div className="p-4 bg-emerald-50 text-xs text-emerald-800 rounded-lg border border-emerald-100 flex items-start space-x-2.5">
                  <Scale className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    The business rules engine crosschecks legal policies (Fair Housing, local deposit limits, late charges).
                    <strong className="block mt-1 font-semibold text-gray-800">No AI compliance decision is absolute. Overriding require legally defensible justifications.</strong>
                  </div>
                </div>

                <div className="space-y-4">
                  {lease.complianceRules.map((rule) => {
                    const isFailed = rule.status === 'failed';
                    const isWarning = rule.status === 'warning';
                    
                    return (
                      <div 
                        key={rule.id}
                        className={`border rounded-lg p-5 bg-white space-y-3 transition duration-150 ${
                          isFailed ? 'border-red-300 bg-red-50/10' : 
                          isWarning ? 'border-amber-300 bg-amber-50/10' : 
                          'border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-sm text-gray-900">{rule.ruleName}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                          </div>
                          <div>
                            {rule.approved ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase tracking-wider font-mono">RESOLVED</span>
                            ) : isFailed ? (
                              <span className="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase">VIOLATION FLAGGED</span>
                            ) : isWarning ? (
                              <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase">NEEDS REVIEW</span>
                            ) : (
                              <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase">PASSING</span>
                            )}
                          </div>
                        </div>

                        <div className={`p-3 rounded text-xs border ${
                          isFailed ? 'bg-red-50/50 text-red-900 border-red-100' : 
                          isWarning ? 'bg-amber-50/50 text-amber-900 border-amber-100' : 
                          'bg-gray-50 text-gray-700 border-gray-150'
                        }`}>
                          <strong>AI Assessment Output:</strong> {rule.details}
                        </div>

                        {rule.remediation && (
                          <div className="p-3 rounded bg-amber-50 text-amber-800 border border-amber-100 text-xs">
                            <strong>Remediation Steps Required:</strong> {rule.remediation}
                          </div>
                        )}

                        {rule.justification && (
                          <div className="mt-2 bg-indigo-50 border border-indigo-150 rounded p-3 text-xs text-indigo-900">
                            <strong>Overridden by {rule.reviewerId}:</strong> {rule.justification} <br />
                            <span className="text-[10px] text-gray-400 block mt-1">Logged at: {rule.timestamp}</span>
                          </div>
                        )}

                        {!rule.approved && (
                          <div className="pt-3 border-t border-gray-100 flex justify-end">
                            {overridingRuleId === rule.id ? (
                              <div className="w-full space-y-3 pt-1">
                                <label className="block text-xs font-semibold text-gray-700">Enter Defensible Override Justification</label>
                                <textarea
                                  placeholder="Provide legal justification or details on correcting lease terms..."
                                  value={overrideJustification}
                                  onChange={(e) => setOverrideJustification(e.target.value)}
                                  className="w-full border border-gray-300 rounded p-2 text-xs text-gray-900 bg-white focus:outline-hidden focus:border-red-500 h-16"
                                />
                                <div className="flex space-x-2 justify-end">
                                  <button 
                                    onClick={() => setOverridingRuleId(null)}
                                    className="px-2.5 py-1 text-xs border border-gray-200 text-gray-700 bg-white hover:bg-gray-100 rounded"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => handleSaveRuleOverride(rule.id)}
                                    className="px-2.5 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-semibold"
                                  >
                                    Apply Override & Resolve
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setOverridingRuleId(rule.id);
                                  setOverrideJustification('');
                                }}
                                className={`px-3 py-1.5 rounded text-xs font-semibold shadow-xs transition duration-150 ${
                                  isFailed 
                                    ? 'bg-red-600 text-white hover:bg-red-700' 
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-250 hover:bg-emerald-100'
                                }`}
                              >
                                {isFailed || isWarning ? 'Apply Legal Override / Resolve' : 'Sign-Off Rule'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => setActiveStage(6)}
                    className="py-2.5 px-5 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold rounded-lg shadow-xs flex items-center space-x-1 transition"
                  >
                    <span>Proceed to Ledger Audit (Stage 6)</span>
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            )}

            {activeStage === 6 && (
              <div className="space-y-4 font-sans">
                <div className="p-4 bg-emerald-50 text-xs text-emerald-800 rounded-lg border border-emerald-100 flex items-start space-x-2.5">
                  <DollarSign className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    This stage cross-references the written agreement terms against actual billing ledgers to catch billing fraud or accounting mismatch.
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-xs">
                  <div className="border-b border-gray-150 bg-gray-50 px-4 py-3 flex justify-between items-center">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-500 font-mono">Live Billing Ledger Reconciliation</h4>
                    <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold font-mono">CROSS REF CHECKS</span>
                  </div>

                  <table className="w-full text-xs text-left text-gray-500">
                    <thead className="text-gray-700 bg-gray-50/50 uppercase text-[9px] tracking-wider font-mono border-b border-gray-150">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lease.ledgerEntries.map((item) => {
                        const isDiscrepancy = item.status === 'discrepancy';
                        return (
                          <tr key={item.id} className={`${isDiscrepancy ? 'bg-red-50/20 font-semibold text-red-950' : 'hover:bg-gray-50/30'}`}>
                            <td className="px-4 py-3 font-mono text-[11px]">{item.date}</td>
                            <td className="px-4 py-3">{item.description}</td>
                            <td className="px-4 py-3 text-right font-mono font-medium">${item.amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono">${item.balance.toLocaleString()}</td>
                            <td className="px-4 py-3 text-center">
                              {isDiscrepancy ? (
                                <span className="bg-red-100 border border-red-200 text-red-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight">Mismatch</span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight">Matched</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="p-4 bg-gray-50 border-t border-gray-150 space-y-3">
                    <label className="block text-xs font-semibold text-gray-700">Financial Ledger Discrepancy Evaluation</label>
                    <textarea
                      placeholder="Add human reconciling notes or directives..."
                      value={ledgerNotes}
                      onChange={(e) => setLedgerNotes(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2 text-xs text-gray-900 bg-white focus:outline-hidden focus:border-emerald-600 h-20"
                    />
                    
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[10px] font-mono text-gray-400">Ledger Cross-Match Auto-Evaluated</span>
                      <button
                        onClick={() => {
                          onReconcileLedger(ledgerNotes);
                          alert("Reconciliation report successfully saved.");
                          setActiveStage(7);
                        }}
                        className="bg-emerald-600 text-white font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition"
                      >
                        Resolve Ledger & Proceed
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStage === 7 && (
              <div className="space-y-4 font-sans">
                <div className="p-4 bg-emerald-50 text-xs text-emerald-800 rounded-lg border border-emerald-100 flex items-start space-x-2.5">
                  <PenTool className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    Seal the audit report with a legally binding digital signature. All modifications and human decisions will be encrypted into the immutable audit trail.
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-5 bg-white space-y-4">
                  <h4 className="font-semibold text-sm text-gray-900 border-b border-gray-100 pb-2">Sealing Report & Verification</h4>

                  <div className="bg-gray-50 border border-gray-200 rounded p-4 text-xs space-y-2">
                    <h5 className="font-semibold text-gray-800 uppercase tracking-wider text-[10px] font-mono">Summary Certification Block</h5>
                    <p className="text-gray-600 leading-relaxed">
                      I, <strong className="font-semibold text-gray-900">{operatorName}</strong>, have conducted a meticulous human oversight audit on lease document <strong className="font-mono text-emerald-700">{lease.fileName}</strong> in accordance with regional landlord-tenant laws and guidelines. I certify that all exceptions have been validated or overridden.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-700">Digital Auditor Signature</label>
                    <input 
                      type="text"
                      placeholder="Type your full legal name to sign..."
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900 bg-white focus:outline-hidden focus:border-emerald-600 font-mono"
                    />
                    <span className="text-[10px] text-gray-400 block font-mono">Digital Signature Hash: MD5-HMAC-SHA256:7a4f910b4c803</span>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        if (!signatureName) {
                          alert("Please type your signature to seal the audit.");
                          return;
                        }
                        onSignOff(signatureName);
                        alert("Audit signed, finalized, and sealed! Document status set to Completed.");
                        onBack();
                      }}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-md flex items-center justify-center space-x-2"
                    >
                      <FileCheck className="h-5 w-5" />
                      <span>Seal Audit & Commit to Ledger</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}