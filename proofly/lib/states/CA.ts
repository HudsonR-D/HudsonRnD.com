import { StateConfig } from './schema';

export const CA: StateConfig = {
  code: 'CA',
  name: 'California',
  status: 'coming_soon',

  vitalRecords: {
    agencyName: 'California Department of Public Health — Vital Records',
    mailingAddress: {
      name:   'CA DPH Vital Records',
      street: 'PO Box 997410',
      city:   'Sacramento',
      state:  'CA',
      zip:    '95899-7410',
    },
    phone: '916-445-2684',
    processingTimeDays: 21,
  },

  fees: {
    firstCopy:      2900,  // $29.00 — CDPH standard fee
    additionalCopy: 2900,
    prooflyService:  500,
    lobPostage:      600,
    checkMemo: 'CDPH Vital Records',
  },

  form: {
    pdfPath: '/forms/CA_birth_request.pdf',
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
    {
      id:          'swornStatement',
      label:       'Sworn statement (CA requirement)',
      description: 'California requires a signed sworn statement. Proofly generates this automatically.',
      required:    true,
      acceptedTypes: [],
      maxSizeMB:   0,
    },
  ],

  eligibility: {
    whoCanRequest:             ['self', 'parent', 'legal_guardian', 'spouse', 'child', 'sibling', 'grandparent'],
    relationshipProofRequired: false,
    notarizedRequired:         false,
  },

  authorizationLetterTemplate: `
AGENT AUTHORIZATION FOR BIRTH CERTIFICATE REQUEST

Date: {{date}}

I, {{requestorName}}, hereby authorize Proofly (operated by Hudson R&D) to act as my
authorized agent for the sole and limited purpose of submitting a birth certificate
application to the California Department of Public Health on my behalf.

Registrant Information:
  Name at Birth:    {{registrantName}}
  Date of Birth:    {{dateOfBirth}}
  Place of Birth:   {{placeOfBirth}}, California

Authorized Agent:  Proofly / Hudson R&D
Agent Contact:     Hello@HudsonRnD.com

Requestor Signature:
{{signaturePlaceholder}}

Date Signed:       {{date}}
Request Reference: {{requestRef}}
`.trim(),
};
