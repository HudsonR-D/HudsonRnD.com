import { StateConfig } from './schema';

export const NY: StateConfig = {
  code: 'NY',
  name: 'New York',
  status: 'coming_soon',

  vitalRecords: {
    agencyName: 'New York State Department of Health — Vital Records',
    mailingAddress: {
      name:   'NYS DOH Vital Records',
      street: 'PO Box 2602',
      city:   'Albany',
      state:  'NY',
      zip:    '12220-2602',
    },
    phone: '518-474-3077',
    processingTimeDays: 20,
  },

  fees: {
    firstCopy:      3000,  // $30.00 — NYSDOH standard fee
    additionalCopy: 3000,
    prooflyService:  500,
    lobPostage:      600,
    checkMemo: 'NYS Department of Health',
  },

  form: {
    pdfPath: '/forms/NY_birth_request.pdf',
    fieldMap: {},
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
    whoCanRequest:             ['self', 'parent', 'legal_guardian', 'spouse', 'child', 'sibling'],
    relationshipProofRequired: false,
    notarizedRequired:         false,
  },

  authorizationLetterTemplate: `
AGENT AUTHORIZATION FOR BIRTH CERTIFICATE REQUEST

Date: {{date}}

I, {{requestorName}}, hereby authorize Proofly (operated by Hudson R&D) to act as my
authorized agent for the sole and limited purpose of submitting a birth certificate
application to the New York State Department of Health on my behalf.

Registrant Information:
  Name at Birth:    {{registrantName}}
  Date of Birth:    {{dateOfBirth}}
  Place of Birth:   {{placeOfBirth}}, New York

Authorized Agent:  Proofly / Hudson R&D
Agent Contact:     Hello@HudsonRnD.com

Requestor Signature:
{{signaturePlaceholder}}

Date Signed:       {{date}}
Request Reference: {{requestRef}}
`.trim(),
};
