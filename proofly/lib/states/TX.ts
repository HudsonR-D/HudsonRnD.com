import { StateConfig } from './schema';

export const TX: StateConfig = {
  code: 'TX',
  name: 'Texas',
  status: 'coming_soon',

  vitalRecords: {
    agencyName: 'Texas Department of State Health Services — Vital Statistics',
    mailingAddress: {
      name:   'Texas DSHS Vital Statistics',
      street: 'PO Box 12040',
      city:   'Austin',
      state:  'TX',
      zip:    '78711-2040',
    },
    phone: '512-776-7111',
    processingTimeDays: 15,
  },

  fees: {
    firstCopy:      2200,  // $22.00 — DSHS standard fee
    additionalCopy: 2200,  // $22.00 — same per copy
    prooflyService:  500,  // $5.00
    lobPostage:      600,  // $6.00
    checkMemo: 'DSHS Vital Statistics',
  },

  form: {
    pdfPath: '/forms/TX_birth_request.pdf', // place PDF here when available
    fieldMap: {},                           // TODO: fill after AcroForm inspection
  },

  requiredDocs: [
    {
      id:          'photoId',
      label:       'Government-issued photo ID (front only)',
      description: "Driver's license, passport, or state ID.",
      required:    true,
      acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      maxSizeMB:   10,
    },
  ],

  eligibility: {
    whoCanRequest:              ['self', 'parent', 'legal_guardian', 'spouse', 'child'],
    relationshipProofRequired:  false,
    notarizedRequired:          false,
  },

  authorizationLetterTemplate: `
AGENT AUTHORIZATION FOR BIRTH CERTIFICATE REQUEST

Date: {{date}}

I, {{requestorName}}, hereby authorize Proofly (operated by Hudson R&D) to act as my
authorized agent for the sole and limited purpose of submitting a birth certificate
application to the Texas Department of State Health Services on my behalf.

Registrant Information:
  Name at Birth:    {{registrantName}}
  Date of Birth:    {{dateOfBirth}}
  Place of Birth:   {{placeOfBirth}}, Texas

Authorized Agent:  Proofly / Hudson R&D
Agent Contact:     Hello@HudsonRnD.com

Requestor Signature:
{{signaturePlaceholder}}

Date Signed:       {{date}}
Request Reference: {{requestRef}}
`.trim(),
};
