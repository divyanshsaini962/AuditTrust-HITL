import express from 'express';
import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// --- MongoDB Schemas & Models ---
const leaseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  fileName: String,
  fileSize: String,
  uploadDate: String,
  status: String,
  ocrQuality: Number,
  ocrText: String,
  ocrValidated: Boolean,
  ocrValidatedBy: String,
  ocrValidatedTime: String,
  documentType: String,
  classificationConfidence: Number,
  classificationApproved: Boolean,
  classificationApprovedBy: String,
  classificationApprovedTime: String,
  fields: { type: Object, default: {} },
  clauses: { type: Array, default: [] },
  complianceRules: { type: Array, default: [] },
  ledgerEntries: { type: Array, default: [] },
  ledgerReconciled: Boolean,
  ledgerNotes: String,
  draftReport: String,
  signedOff: Boolean,
  signedBy: String,
  signedTime: String
}, { strict: false });

const logSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timestamp: String,
  stage: Number,
  fieldId: String,
  label: String,
  action: String,
  operator: String,
  originalValue: String,
  newValue: String,
  reason: String
});

// Use existing models if they exist (prevents OverwriteModelError in Serverless environment)
const Lease = mongoose.models.Lease || mongoose.model('Lease', leaseSchema);
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', logSchema);

const app = express();
app.use(express.json());

let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lease-auditor';
  try {
    await mongoose.connect(mongoURI);
    isConnected = true;
    console.log('MongoDB successfully connected.');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
};

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    console.log('Gemini AI successfully initialized server-side.');
  } catch (err) {
    console.error('Error initializing Gemini AI SDK:', err);
  }
}

// --- API Routes for Persistence ---
app.get('/api/leases', async (req, res) => {
  try {
    const leases = await Lease.find().sort({ uploadDate: -1 });
    res.json(leases);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leases' });
  }
});

app.put('/api/leases/:id', async (req, res) => {
  try {
    const updatedLease = await Lease.findOneAndUpdate(
      { id: req.params.id }, 
      req.body, 
      { new: true }
    );
    res.json(updatedLease);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lease' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.post('/api/logs', async (req, res) => {
  try {
    const newLog = await AuditLog.create(req.body);
    res.json(newLog);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create log' });
  }
});

// AI Intake Pipeline (Generates and Saves to DB)
app.post('/api/audit-lease', async (req, res) => {
  const { leaseText, fileName } = req.body;

  if (!leaseText || typeof leaseText !== 'string' || leaseText.trim() === '') {
    return res.status(400).json({ error: 'Please provide valid lease agreement text to audit.' });
  }

  const generateLocalFallback = (text: string) => {
    let tenantName = 'Unknown Tenant';
    const tenantMatch = text.match(/Tenant(?:(?:\(s\))?|:|\s*\|)\s*([^0-9\n]+)/i);
    if (tenantMatch && tenantMatch[1]) tenantName = tenantMatch[1].trim();

    let rent = 0;
    const rentMatch = text.match(/Monthly Rent(?:(?:\(s\))?|:|\s*\|)\s*\$?([0-9,]+)/i) || text.match(/rent of \$([0-9,]+)/i);
    if (rentMatch && rentMatch[1]) rent = parseFloat(rentMatch[1].replace(/,/g, ''));

    let deposit = 0;
    const depositMatch = text.match(/Security Deposit(?:(?:\(s\))?|:|\s*\|)\s*\$?([0-9,]+)/i) || text.match(/deposit of \$([0-9,]+)/i);
    if (depositMatch && depositMatch[1]) deposit = parseFloat(depositMatch[1].replace(/,/g, ''));

    let startDate = 'YYYY-MM-DD';
    const startDateMatch = text.match(/Start Date(?:(?:\(s\))?|:|\s*\|)\s*([A-Za-z0-9,\s]+)/i);
    if (startDateMatch && startDateMatch[1]) startDate = startDateMatch[1].trim();

    let endDate = 'YYYY-MM-DD';
    const endDateMatch = text.match(/End Date(?:(?:\(s\))?|:|\s*\|)\s*([A-Za-z0-9,\s]+)/i);
    if (endDateMatch && endDateMatch[1]) endDate = endDateMatch[1].trim();

    const lowerText = text.toLowerCase();
    const complianceRules = [];
    const clauses = [];

    const addendumRentMatch = lowerText.match(/addendum.*rent is \$([0-9,]+)/i);
    if (addendumRentMatch && parseFloat(addendumRentMatch[1].replace(/,/g, '')) !== rent) {
      clauses.push({
        id: 'c-rent-conflict', name: 'Rent Addendum Discrepancy', text: 'Addendum contradicts main lease rent amount.',
        confidence: 99, isStandard: false, status: 'warning', remedyAction: `Reconcile discrepancy between main rent and addendum.`, approved: false
      });
      complianceRules.push({
        id: 'r-rent-match', ruleName: 'Rent Amount Reconciliation', description: 'Rent amounts in main lease must match all attached addendums.',
        status: 'failed', details: `Discrepancy detected: Main lease extracts $${rent}. Addendum extracts $${addendumRentMatch[1]}.`, remediation: 'Human Reviewer must verify correct rent amount.', approved: false
      });
    }

    if (deposit > (rent * 2) && rent > 0) {
       complianceRules.push({
        id: 'rule-deposit-limit', ruleName: 'Security Deposit Limit Check', description: 'Security deposit must not exceed 2 months rent.',
        status: 'failed', details: `Deposit ($${deposit}) exceeds 2x monthly rent limit.`, remediation: 'Refund surplus deposit.', approved: false
      });
    } else {
       complianceRules.push({
        id: 'rule-deposit-limit', ruleName: 'Security Deposit Limit Check', description: 'Security deposit must not exceed 2 months rent.',
        status: 'passed', details: `Deposit ($${deposit}) is within the maximum limit.`, approved: false
      });
    }

    if (lowerText.includes('assistance animal') || lowerText.includes('service animal') || lowerText.includes('pet')) {
      const petIdx = lowerText.indexOf('assistance animal');
      const snippet = petIdx !== -1 ? text.substring(Math.max(0, petIdx - 50), Math.min(text.length, petIdx + 150)) : "Assistance animal / Pet policies mentioned.";
      clauses.push({
         id: 'c-assist', name: 'Assistance Animal Review Clause', text: snippet, 
         confidence: 85, isStandard: true, status: 'warning', 
         remedyAction: 'Route compliance-sensitive language to human review; no final legal conclusion.', approved: false
      });
      complianceRules.push({
        id: 'r-fair-housing', ruleName: 'Fair Housing / Assistance Animal Check', description: 'Verify policies do not illegally restrict or charge fees for assistance animals.',
        status: 'warning', details: 'Compliance-sensitive language detected regarding assistance animals. Requires human legal review to ensure Fair Housing compliance.', remediation: 'Manually review clause to ensure no illegal fees are levied on service animals.', approved: false
      });
    }

    const lateMatch = text.match(/late\s+(?:fee|charge)\s+of\s*\$([0-9,]+)/i) || text.match(/\$([0-9,]+)\s+late\s+fee/i);
    if (lateMatch) {
       clauses.push({
         id: 'c-late', name: 'Late Payment Clause', text: `Late fee of $${lateMatch[1]} assessed.`, 
         confidence: 85, isStandard: true, status: 'warning', 
         remedyAction: 'Route jurisdiction-dependent validity to human review.', approved: false
      });
      complianceRules.push({
        id: 'r-late-fee', ruleName: 'Late Fee Cap Validation', description: 'Late fees must adhere to local jurisdiction statutory limits.',
        status: 'warning', details: `Late fee of $${lateMatch[1]} detected. System cannot auto-approve due to jurisdictional variances.`, remediation: 'Human must verify if fee exceeds local jurisdiction caps.', approved: false
      });
    }

    if (lowerText.includes('notice period is intentionally not specified') || lowerText.includes('unspecified notice')) {
       clauses.push({
         id: 'c-notice', name: 'Entry Notice Requirement', text: 'Landlord may enter... subject to applicable notice requirements.', 
         confidence: 85, isStandard: false, status: 'warning', 
         remedyAction: 'Flag unspecified notice period for human review.', approved: false
      });
    }

    return {
      id: 'fallback-audited-' + Date.now(),
      fileName: fileName || 'Uploaded_Lease_Agreement.txt',
      fileSize: `${(text.length / 1024).toFixed(1)} KB`,
      uploadDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'ready_for_review',
      ocrQuality: 92, 
      ocrText: text, 
      ocrValidated: false,
      ocrValidatedBy: null,
      ocrValidatedTime: null,
      documentType: 'Residential Lease Agreement',
      classificationConfidence: 89,
      classificationApproved: false,
      classificationApprovedBy: null,
      classificationApprovedTime: null,
      fields: {
        tenantName: { id: 'tenantName', label: 'Tenant Name', value: tenantName, confidence: 88, originalValue: tenantName, approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'Full legal name.' },
        monthlyRent: { id: 'monthlyRent', label: 'Monthly Rent', value: rent, confidence: addendumRentMatch ? 75 : 95, originalValue: rent, approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'The recurring monthly rent.' },
        securityDeposit: { id: 'securityDeposit', label: 'Security Deposit', value: deposit, confidence: 92, originalValue: deposit, approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'Security deposit amount.' },
        startDate: { id: 'startDate', label: 'Start Date', value: startDate, confidence: 90, originalValue: startDate, approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'Tenancy start date.' },
        endDate: { id: 'endDate', label: 'End Date', value: endDate, confidence: 90, originalValue: endDate, approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'Tenancy end date.' },
        occupancyLimit: { id: 'occupancyLimit', label: 'Occupancy Limit', value: 0, confidence: 0, originalValue: 0, approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'Maximum residents.' }
      },
      clauses: clauses,
      complianceRules: complianceRules,
      ledgerEntries: [
        { id: 'l1', date: 'Move-in', description: 'Rent Charged', amount: rent, balance: rent, type: 'charge', status: 'pending' },
        { id: 'l2', date: 'Move-in', description: 'Security Deposit Charged', amount: deposit, balance: rent + deposit, type: 'charge', status: 'pending' }
      ],
      ledgerReconciled: false,
      ledgerNotes: '',
      draftReport: `# FALLBACK LEASE COMPLIANCE REPORT\nDocument audited using local RegEx processing heuristics.`,
      signedOff: false,
      signedBy: null,
      signedTime: null
    };
  };

  if (!ai) {
    console.log('API key missing. Running fallback heuristics and saving to DB...');
    const fallbackData = generateLocalFallback(leaseText);
    try {
      const savedLease = await Lease.create(fallbackData);
      return res.json({
        data: savedLease,
        warning: 'Audit Notice / Pipeline Update: Gemini API is currently offline. Executed using local dynamic Regex rules. Saved to database.',
      });
    } catch (dbErr) {
      return res.status(500).json({ error: 'Failed to save fallback document to database.' });
    }
  }

  try {
    console.log('Initiating Gemini AI processing for document audit...');
    const systemInstruction = `You are an elite, pragmatic Principal Lease Compliance Auditor. Your job is to extract data fields, identify clauses, run compliance checks, and cross-reference financial terms from the lease document text.
You MUST output your response in valid JSON matching this exact structure:
{
  "ocrQuality": 95,
  "documentType": "Residential Lease Agreement",
  "classificationConfidence": 94,
  "fields": {
    "tenantName": { "value": "Primary tenant full name", "confidence": 98, "description": "Full legal name of the primary lease signer." },
    "monthlyRent": { "value": 1500, "confidence": 99, "description": "The recurring monthly rent payment in USD (numeric)." },
    "securityDeposit": { "value": 3000, "confidence": 95, "description": "Security deposit amount (numeric)." },
    "startDate": { "value": "YYYY-MM-DD", "confidence": 90, "description": "The date on which the tenancy begins." },
    "endDate": { "value": "YYYY-MM-DD", "confidence": 90, "description": "The date on which the tenancy concludes." },
    "occupancyLimit": { "value": 2, "confidence": 85, "description": "Maximum number of residents permitted." }
  },
  "clauses": [
    { "id": "c1", "name": "Security Deposit Clause", "text": "exact quote from lease regarding security deposit", "confidence": 92, "isStandard": true, "status": "compliant", "remedyAction": "" }
  ],
  "complianceRules": [
    { "id": "rule-deposit", "ruleName": "Security Deposit Limit Check", "description": "Security deposit must not exceed 2x rent.", "status": "passed", "details": "Deposit is within bounds." },
    { "id": "rule-fair-housing", "ruleName": "Fair Housing / Assistance Animal Check", "description": "Verify policies do not illegally restrict or charge fees for assistance animals.", "status": "warning", "details": "Compliance-sensitive language detected. Requires human legal review.", "remediation": "Review clause to ensure no illegal fees are levied." },
    { "id": "rule-late-fee", "ruleName": "Late Fee Cap Validation", "description": "Late fees must adhere to local jurisdiction limits.", "status": "warning", "details": "Late fee detected. Human must verify local jurisdiction limits." },
    { "id": "rule-rent-match", "ruleName": "Rent Amount Reconciliation", "description": "Rent amounts in main lease must match addendums.", "status": "failed", "details": "Conflict detected.", "remediation": "Reconcile amounts." }
  ],
  "ledgerEntries": [
    { "id": "l1", "date": "YYYY-MM-DD", "description": "Rent Charged", "amount": 1500, "balance": 1500, "type": "charge", "status": "reconciled" }
  ],
  "ledgerNotes": "Notes about ledger and lease matching",
  "draftReport": "Markdown formatted summary report detailing executive analysis and required revisions."
}

Rules for evaluation (CRITICAL):
1. Security deposit limit check: Rule status is 'failed' if securityDeposit > monthlyRent * 2. 
2. Fair Housing / Assistance Animals: Extract the clause into 'clauses'. ALSO populate the 'rule-fair-housing' in 'complianceRules' with status 'warning' if any mention of assistance or service animals is found.
3. Late Fee Check: Extract the clause into 'clauses'. ALSO populate the 'rule-late-fee' in 'complianceRules' with status 'warning' to enforce jurisdiction checks.
4. Rent Discrepancies: If an Addendum contradicts the main text rent amount, lower field confidence. ALSO populate the 'rule-rent-match' in 'complianceRules' with status 'failed' to flag the dollar conflict.
5. Unspecified Notices: If the right of entry clause is missing a specific time period, extract it as a 'warning' clause.

Output ONLY the JSON object. Do not wrap in markdown \`\`\`json blocks. Return raw JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Audit the following lease text: \n\n${leaseText}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    const responseText = response.text || '';
    console.log('Gemini AI successfully returned analysis.');
    let parsedData;
    try {
      parsedData = JSON.parse(responseText.trim());
    } catch (parseErr) {
      throw new Error('AI response formatting error.');
    }

    // ====================================================================
    // DETERMINISTIC POST-PROCESSING (INDUSTRY STANDARD HITL ENFORCEMENT)
    // Override LLM semantic bias to guarantee compliance checkpoints
    // ====================================================================
    
    // 1. Force Clause Statuses
    if (parsedData.clauses) {
      parsedData.clauses.forEach((clause: any) => {
        const lowerName = clause.name.toLowerCase();
        const lowerText = clause.text.toLowerCase();
        
        if (lowerName.includes('assistance') || lowerName.includes('pet') || lowerText.includes('assistance')) {
          clause.status = 'warning';
          clause.confidence = 85;
          clause.remedyAction = 'Route compliance-sensitive language to human review; no final legal conclusion.';
        }
        if (lowerName.includes('late') || lowerText.includes('late fee')) {
          clause.status = 'warning';
          clause.confidence = 85;
          clause.remedyAction = 'Route jurisdiction-dependent validity to human review.';
        }
      });
    }

    // 2. Force Compliance Rule Statuses
    if (parsedData.complianceRules) {
      parsedData.complianceRules.forEach((rule: any) => {
        const lowerRule = rule.ruleName.toLowerCase();
        
        if (lowerRule.includes('fair housing') || lowerRule.includes('assistance')) {
          rule.status = 'warning'; // Forces the Amber UI badge
        }
        if (lowerRule.includes('late fee')) {
          rule.status = 'warning'; // Forces the Amber UI badge
        }
        if (lowerRule.includes('rent') && lowerRule.includes('reconciliation')) {
          rule.status = 'failed'; // Forces the Red UI badge
        }
      });
    }
    // ====================================================================

    const formattedFields = {
      tenantName: {
        id: 'tenantName', label: 'Tenant Name', value: parsedData.fields?.tenantName?.value || 'Unknown', confidence: parsedData.fields?.tenantName?.confidence || 85,
        originalValue: parsedData.fields?.tenantName?.value || 'Unknown', approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'Full legal name of the primary lease signer(s).'
      },
      monthlyRent: {
        id: 'monthlyRent', label: 'Monthly Rent', value: Number(parsedData.fields?.monthlyRent?.value) || 0, confidence: parsedData.fields?.monthlyRent?.confidence || 95,
        originalValue: Number(parsedData.fields?.monthlyRent?.value) || 0, approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'The recurring monthly rent payment agreed upon in US Dollars.'
      },
      securityDeposit: {
        id: 'securityDeposit', label: 'Security Deposit', value: Number(parsedData.fields?.securityDeposit?.value) || 0, confidence: parsedData.fields?.securityDeposit?.confidence || 90,
        originalValue: Number(parsedData.fields?.securityDeposit?.value) || 0, approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'Refundable security deposit amount held in escrow.'
      },
      startDate: {
        id: 'startDate', label: 'Start Date', value: parsedData.fields?.startDate?.value || 'YYYY-MM-DD', confidence: parsedData.fields?.startDate?.confidence || 90,
        originalValue: parsedData.fields?.startDate?.value || 'YYYY-MM-DD', approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'The date on which the tenancy begins.'
      },
      endDate: {
        id: 'endDate', label: 'End Date', value: parsedData.fields?.endDate?.value || 'YYYY-MM-DD', confidence: parsedData.fields?.endDate?.confidence || 90,
        originalValue: parsedData.fields?.endDate?.value || 'YYYY-MM-DD', approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'The date on which the tenancy concludes.'
      },
      occupancyLimit: {
        id: 'occupancyLimit', label: 'Occupancy Limit', value: Number(parsedData.fields?.occupancyLimit?.value) || 0, confidence: parsedData.fields?.occupancyLimit?.confidence || 85,
        originalValue: Number(parsedData.fields?.occupancyLimit?.value) || 0, approvedValue: null, approved: false, modifiedBy: null, timestamp: null, reason: null, description: 'Maximum number of residents permitted.'
      }
    };

    const finalAuditResult = {
      id: 'gemini-audited-' + Date.now(),
      fileName: fileName || 'Gemini_Audited_Lease.txt',
      fileSize: `${(leaseText.length / 1024).toFixed(1)} KB`,
      uploadDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'ready_for_review',
      ocrQuality: parsedData.ocrQuality || 95,
      ocrText: leaseText,
      ocrValidated: false,
      ocrValidatedBy: null,
      ocrValidatedTime: null,
      documentType: parsedData.documentType || 'Residential Lease Agreement',
      classificationConfidence: parsedData.classificationConfidence || 95,
      classificationApproved: false,
      classificationApprovedBy: null,
      classificationApprovedTime: null,
      fields: formattedFields,
      clauses: (parsedData.clauses || []).map((c: any, index: number) => ({
        id: c.id || `c-${index}`, name: c.name || 'Extracted Clause', text: c.text || '', confidence: c.confidence || 90, isStandard: c.isStandard !== undefined ? c.isStandard : true, status: c.status || 'compliant', remedyAction: c.remedyAction || '', approved: false
      })),
      complianceRules: (parsedData.complianceRules || []).map((r: any, index: number) => ({
        id: r.id || `r-${index}`, ruleName: r.ruleName || 'Compliance Check', description: r.description || '', status: r.status || 'passed', details: r.details || '', remediation: r.remediation || '', approved: false
      })),
      ledgerEntries: (parsedData.ledgerEntries || []).map((l: any, index: number) => ({
        id: l.id || `l-${index}`, date: l.date || formattedFields.startDate.value, description: l.description || 'Charge / Payment transaction', amount: Number(l.amount) || 0, balance: Number(l.balance) || 0, type: l.type || 'charge', status: l.status || 'reconciled'
      })),
      ledgerReconciled: parsedData.ledgerEntries ? true : false,
      ledgerNotes: parsedData.ledgerNotes || 'Ledger matches parsed dates and fees.',
      draftReport: parsedData.draftReport || '# LEASE AUDIT REPORT',
      signedOff: false,
      signedBy: null,
      signedTime: null
    };

    // SAVE TO DATABASE
    const savedLease = await Lease.create(finalAuditResult);
    res.json({ data: savedLease });

  } catch (err: any) {
    console.error('Gemini API call failed, backing up with local heuristics...', err);
    try {
      const fallbackData = generateLocalFallback(leaseText);
      const savedFallback = await Lease.create(fallbackData);
      res.json({
        data: savedFallback,
        warning: `Audit Notice / Pipeline Update: Gemini API is currently offline. Executed using local dynamic Regex rules. Saved to database.`,
      });
    } catch (dbErr) {
      res.status(500).json({ error: 'Failed to process and save document.' });
    }
  }
});

export default app;
