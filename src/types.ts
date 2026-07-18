export interface AuditField<T = string | number> {
  id: string;
  label: string;
  value: T;
  confidence: number;
  originalValue: T;
  approvedValue: T | null;
  approved: boolean;
  modifiedBy: string | null;
  timestamp: string | null;
  reason: string | null;
  description: string;
}

export interface ExtractedClause {
  id: string;
  name: string;
  text: string;
  confidence: number;
  isStandard: boolean;
  status: 'compliant' | 'warning' | 'missing' | 'custom';
  remedyAction?: string;
  approved: boolean;
  originalText?: string;
  approvedText?: string;
  reason?: string;
}

export interface ComplianceRule {
  id: string;
  ruleName: string;
  description: string;
  status: 'passed' | 'failed' | 'warning';
  details: string;
  remediation?: string;
  approved: boolean;
  justification?: string;
  reviewerId?: string;
  timestamp?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  type: 'charge' | 'payment';
  status: 'reconciled' | 'discrepancy' | 'pending';
}

export interface AuditLedgerLog {
  id: string;
  timestamp: string;
  stage: number;
  fieldId: string;
  label: string;
  action: 'approve' | 'modify' | 'flag_unreadable' | 'reclassify' | 'override_compliance' | 'reconcile' | 'sign_off';
  operator: string;
  originalValue: string;
  newValue: string;
  reason: string;
}

export interface LeaseAuditData {
  id: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  status: 'pending' | 'in_progress' | 'ready_for_review' | 'completed' | 'flagged';
  
  ocrQuality: number;
  ocrText: string;
  ocrValidated: boolean;
  ocrValidatedBy: string | null;
  ocrValidatedTime: string | null;

  documentType: string;
  classificationConfidence: number;
  classificationApproved: boolean;
  classificationApprovedBy: string | null;
  classificationApprovedTime: string | null;

  fields: {
    tenantName: AuditField<string>;
    monthlyRent: AuditField<number>;
    securityDeposit: AuditField<number>;
    startDate: AuditField<string>;
    endDate: AuditField<string>;
    occupancyLimit: AuditField<number>;
  };

  clauses: ExtractedClause[];
  complianceRules: ComplianceRule[];
  ledgerEntries: LedgerEntry[];
  ledgerReconciled: boolean;
  ledgerNotes: string;

  draftReport: string;
  signedOff: boolean;
  signedBy: string | null;
  signedTime: string | null;
}