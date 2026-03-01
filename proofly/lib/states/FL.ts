import { StateConfig } from './schema';

export const FL: StateConfig = {
  code: 'FL',
  name: 'Florida',
  status: 'coming_soon',

  vitalRecords: {
    agencyName: 'Florida Department of Health — Bureau of Vital Statistics',
    mailingAddress: {
      name:   'FL DOH Bureau of Vital Statistics',
      street: 'PO Box 210',
      city:   'Jacksonville',
      state:  'FL',
      zip:    '32231-0042',
    },
    phone: '904-359-6900',
    processingTimeDays: 10,
  },

  fees: {
    firstCopy:      1000,  // $10.00 — FL standard fee (one of the lowest)
    additionalCopy: 1000,
    prooflyService:  500,
    lobPostage:      600,
    checkMemo: 'Florida Department of Health',
  },

  form: {
    pdfPath: '/forms/FL_birth_request.pdf',
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
    whoCanRequest:             ['self', 'parent', 'legal_guardian', 'spouse', 'child', 'grandparent'],
    relationshipProofRequired: false,
    notarizedRequired:         false,
  },

  authorizationLetterTemplate: `
AGENT AUTHORIZATION FOR BIRTH CERTIFICATE REQUEST

Date: {{date}}

I, {{requestorName}}, hereby authorize Proofly (operated by Hudson R&D) to act as my
authorized agent for the sole and limited purpose of submitting a birth certificate
application to the Florida Department of Health on my behalf.

Registrant Information:
  Name at Birth:    {{registrantName}}
  Date of Birth:    {{dateOfBirth}}
  Place of Birth:   {{placeOfBirth}}, Florida

Authorized Agent:  Proofly / Hudson R&D
Agent Contact:     Hello@HudsonRnD.com

Requestor Signature:
{{signaturePlaceholder}}

Date Signed:       {{date}}
Request Reference: {{requestRef}}
`.trim(),
};
