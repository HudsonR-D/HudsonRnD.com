import { PDFDocument, PDFImage } from 'pdf-lib';
import { StateConfig } from '@/lib/states/schema';
import { ProoflySession } from '@/lib/session';
import * as fs from 'fs';
import * as path from 'path';

// Map our session relationship values to the PDF checkbox field names
const RELATIONSHIP_CHECKBOX_MAP: Record<string, string> = {
  self:          'relationshipSelf',
  parent:        'relationshipParent',
  grandparent:   'relationshipGrandparent',
  stepparent:    'relationshipStepparent',
  sibling:       'relationshipSibling',
  spouse:        'relationshipSpouse',
  child:         'relationshipChild',
  stepchild:     'relationshipStepchild',
  legal_guardian: 'relationshipGuardian',
};

// Map our session purpose values to the PDF checkbox field names
const PURPOSE_CHECKBOX_MAP: Record<string, string> = {
  voter_registration: 'reasonRecords',
  passport:           'reasonPassport',
  passport_renewal:   'reasonPassport',
  legal:              'reasonRecords',
  benefits:           'reasonRecords',
  other:              'reasonOtherCheck',
};

export interface FillFormInput {
  stateConfig: StateConfig;
  form: NonNullable<ProoflySession['form']>;
  signatureDataUrl: string;   // base64 PNG from SignaturePad
  copies: number;
  todaysDate: string;         // "MM/DD/YYYY"
}

export async function fillCDPHEForm(input: FillFormInput): Promise<Uint8Array> {
  const { stateConfig, form, signatureDataUrl, copies, todaysDate } = input;
  const fm = stateConfig.form.fieldMap;

  // Load the PDF from public/forms/
  const pdfPath = path.join(process.cwd(), 'public', stateConfig.form.pdfPath.replace(/^\//, ''));
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pdfForm = pdfDoc.getForm();

  // Helper — set text field safely (skip if field doesn't exist)
  const setText = (fieldKey: string, value: string) => {
    const fieldName = fm[fieldKey];
    if (!fieldName || !value) return;
    try {
      const field = pdfForm.getTextField(fieldName);
      field.setText(value);
    } catch {
      // Field not found or wrong type — log and continue, never crash
      console.warn(`fillForm: could not set text field "${fieldName}" (key: ${fieldKey})`);
    }
  };

  // Helper — check a checkbox safely
  const checkBox = (fieldKey: string) => {
    const fieldName = fm[fieldKey];
    if (!fieldName) return;
    try {
      const field = pdfForm.getCheckBox(fieldName);
      field.check();
    } catch {
      console.warn(`fillForm: could not check box "${fieldName}" (key: ${fieldKey})`);
    }
  };

  // === REQUESTOR INFORMATION ===
  // Parse full name into parts — "Last, First Middle" or "First Middle Last"
  const nameParts = parseFullName(form.fullName);
  setText('requestorFirstName',  nameParts.first);
  setText('requestorMiddleName', nameParts.middle);
  setText('requestorLastName',   nameParts.last);
  setText('requestorEmail',      form.email);
  setText('mailingStreet',       form.mailingAddress1);
  setText('mailingApt',          form.mailingAddress2 ?? '');
  setText('mailingCity',         form.city);
  setText('mailingState',        form.state);
  setText('mailingZip',          form.zip);
  // Physical address = same as mailing
  setText('physicalStreet',      form.mailingAddress1);
  setText('physicalCity',        form.city);
  setText('physicalState',       form.state);
  setText('physicalZip',         form.zip);

  // === RELATIONSHIP CHECKBOX ===
  const relCheckboxKey = RELATIONSHIP_CHECKBOX_MAP[form.relationship];
  if (relCheckboxKey) checkBox(relCheckboxKey);

  // === PURPOSE CHECKBOX ===
  const purposeCheckboxKey = PURPOSE_CHECKBOX_MAP[form.purpose];
  if (purposeCheckboxKey) {
    checkBox(purposeCheckboxKey);
    if (form.purpose === 'other' && form.purposeOther) {
      setText('reasonOtherText', form.purposeOther);
    }
    if (form.purpose === 'voter_registration') {
      // Write "Voter Registration / SAVE Act" in the other text field
      setText('reasonOtherText', 'Voter Registration');
    }
  }

  // === REGISTRANT INFORMATION ===
  const regParts = parseFullName(form.fullName);
  setText('registrantFirstName',  regParts.first);
  setText('registrantMiddleName', regParts.middle);
  setText('registrantLastName',   regParts.last);

  // Date of birth: session stores "YYYY-MM-DD"
  if (form.dateOfBirth) {
    const [year, month, day] = form.dateOfBirth.split('-');
    setText('dobMonth', month);
    setText('dobDay',   day);
    setText('dobYear',  year);
  }

  // Pre-check "Not deceased"
  checkBox('deceasedNo');

  // Place of birth — form stores county name
  setText('placeOfBirthCity',   form.placeOfBirth); // county used as city
  setText('placeOfBirthCounty', form.placeOfBirth);

  // Mother's name
  const motherParts = parseFullName(form.motherNameAtBirth ?? '');
  setText('motherFirstName',      motherParts.first);
  setText('motherMiddleName',     motherParts.middle);
  setText('motherMaidenLastName', motherParts.last);

  // Father's name
  const fatherParts = parseFullName(form.fatherName ?? '');
  setText('fatherFirstName',  fatherParts.first);
  setText('fatherMiddleName', fatherParts.middle);
  setText('fatherLastName',   fatherParts.last);

  // === SIGNATURE ===
  await embedSignature(pdfDoc, signatureDataUrl);

  // === DATE ===
  setText('todaysDate', todaysDate);

  // === FEES ===
  const { firstCopy, additionalCopy } = stateConfig.fees;
  const firstCopyDollars = (firstCopy / 100).toFixed(2);
  const totalCents =
    firstCopy + Math.max(0, copies - 1) * additionalCopy;
  const totalDollars = (totalCents / 100).toFixed(2);
  setText('feeCopies', firstCopyDollars);
  setText('feeTotal',  totalDollars);

  if (copies > 1) {
    // There's no dedicated "additional copies" field in this form — 
    // write count in the first fee field text
    setText('feeCopies', `${firstCopyDollars} + ${copies - 1} @ $${(additionalCopy / 100).toFixed(2)}`);
  }

  // === SHIPPING — select Regular Mail ===
  checkBox('shippingRegularMail');

  // Flatten makes the PDF non-editable — skip for now so CDPHE can verify
  // pdfForm.flatten();

  return pdfDoc.save();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Embed signature PNG as an image overlay on page 1 near the signature line.
 * The signature field 'Signature1_es_:signer:signature' is at y≈588-610 in PDF coords.
 * We draw the image directly on the page at that position.
 */
async function embedSignature(pdfDoc: PDFDocument, dataUrl: string): Promise<void> {
  try {
    // Strip the data URL prefix: "data:image/png;base64,..."
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Buffer.from(base64, 'base64');

    let image: PDFImage;
    if (dataUrl.includes('image/png')) {
      image = await pdfDoc.embedPng(imageBytes);
    } else {
      image = await pdfDoc.embedJpg(imageBytes);
    }

    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();

    // Signature line is at PDF y≈588-610 from bottom (page height 792)
    // In pdf-lib, y=0 is bottom-left. The field rect was Y1≈181 from top = 792-611=181 from bottom.
    page.drawImage(image, {
      x: 80,
      y: height - 615,  // position just above the signature line
      width: 200,
      height: 40,
      opacity: 0.95,
    });
  } catch (err) {
    console.warn('fillForm: could not embed signature image:', err);
    // Non-fatal — form still gets submitted, consent letter has sig separately
  }
}

/**
 * Parse "Last, First Middle" or "First Middle Last" into parts.
 * CDPHE form uses separate fields for first/middle/last.
 */
function parseFullName(fullName: string): { first: string; middle: string; last: string } {
  if (!fullName?.trim()) return { first: '', middle: '', last: '' };

  // Handle "Last, First Middle" format (common on legal docs)
  if (fullName.includes(',')) {
    const [lastPart, rest] = fullName.split(',').map(s => s.trim());
    const restParts = rest ? rest.split(' ').filter(Boolean) : [];
    return {
      first:  restParts[0] ?? '',
      middle: restParts.slice(1).join(' '),
      last:   lastPart,
    };
  }

  // Handle "First Middle Last" format
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
  return {
    first:  parts[0],
    middle: parts.slice(1, -1).join(' '),
    last:   parts[parts.length - 1],
  };
}
