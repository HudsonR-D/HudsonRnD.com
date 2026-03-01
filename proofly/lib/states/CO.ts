import { StateConfig } from './schema';

export const CO: StateConfig = {
  code: 'CO',
  name: 'Colorado',
  status: 'live',

  vitalRecords: {
    agencyName: 'Colorado Department of Public Health and Environment',
    mailingAddress: {
      name: 'Vital Records Section, CDPHE',
      street: '4300 Cherry Creek Drive South',
      city: 'Denver',
      state: 'CO',
      zip: '80246-1530',
    },
    phone: '303-692-2200',
    processingTimeDays: 10,
  },

  fees: {
    firstCopy: 2500,       // $25.00 — confirmed CDPHE direct mail Jan 2026
    additionalCopy: 2000,  // $20.00 — confirmed CDPHE direct mail Jan 2026
    prooflyService: 500,   // $5.00 — Proofly service fee
    lobPostage: 600,       // $6.00 — certified letter + postage (Lob cost)
    checkMemo: 'Vital Records',  // payable to "Vital Records" per form
  },

  form: {
    pdfPath: '/forms/CO_birth_request.pdf',  // place the PDF here in /public/forms/

    // Confirmed field names from AcroForm inspection Feb 2026
    // Text fields (type /Tx) — set with form.getTextField(name).setText(value)
    // Checkbox fields (type /Btn) — set with form.getCheckBox(name).check()
    fieldMap: {
      // === REQUESTOR INFORMATION ===
      requestorFirstName:   'Text6',
      requestorMiddleName:  'Text7',
      requestorLastName:    'Text8',
      requestorEmail:       'Text9',
      mailingStreet:        'Text10',
      mailingApt:           'Text11',
      mailingCity:          'Text12',
      mailingState:         'Text13',
      mailingZip:           'Text14',
      // Physical address — we fill same as mailing
      physicalStreet:       'Text17',
      physicalCity:         'Text19',
      physicalState:        'Text20',
      physicalZip:          'Text21',

      // === RELATIONSHIP CHECKBOXES (check exactly one) ===
      relationshipSelf:         'Self',
      relationshipParent:       'Parent',
      relationshipGrandparent:  'Grandparent',
      relationshipStepparent:   'Stepparent',
      relationshipSibling:      'Sibling',
      relationshipSpouse:       'Spouse',
      relationshipChild:        'Child',
      relationshipStepchild:    'Stepchild',
      relationshipGuardian:     'Legal guardian',

      // === REASON CHECKBOXES (check exactly one) ===
      reasonNewborn:        'Newborn',
      reasonPassport:       'TravelPassport',
      reasonRecords:        'Records',
      reasonSchool:         'School',
      reasonInsurance:      'Insurance',
      reasonOtherCheck:     'undefined_2',
      reasonOtherText:      'Other_2',

      // === REGISTRANT INFORMATION ===
      registrantFirstName:  'First',
      registrantMiddleName: 'Middle',
      registrantLastName:   'Last',
      dobMonth:             'Month',
      dobDay:               'Day',
      dobYear:              'Year',
      deceasedNo:           'undefined_4',  // pre-check "No"
      placeOfBirthCity:     'City',
      placeOfBirthCounty:   'County',
      motherFirstName:      'First_2',
      motherMiddleName:     'Middle_2',
      motherMaidenLastName: 'Last_2',
      fatherFirstName:      'First_3',
      fatherMiddleName:     'Middle_3',
      fatherLastName:       'Maiden Last Name name prior to first marriage',

      // === SIGNATURE + DATE ===
      // Signature field 'Signature1_es_:signer:signature' is type /Tx
      // We embed signature image as page overlay — handled separately in fillForm.ts
      todaysDate:           'Todays Date',

      // === FEE SECTION ===
      feeCopies:            'undefined_5',   // dollar amount for first copy line
      feeTotal:             'Text2',         // total charges box

      // === SHIPPING ===
      shippingRegularMail:  'Please check your shipping method',  // check = Regular Mail $0.00
    },
  },

  requiredDocs: [
    {
      id: 'photoId',
      label: 'Government-issued photo ID (front only)',
      description:
        "Driver's license, passport, or state ID. Must be current and show your full name.",
      required: true,
      acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      maxSizeMB: 10,
    },
  ],

  eligibility: {
    whoCanRequest: [
      'self', 'parent', 'grandparent', 'stepparent',
      'sibling', 'spouse', 'child', 'stepchild', 'legal_guardian',
    ],
    relationshipProofRequired: false,
    notarizedRequired: false,
  },

  authorizationLetterTemplate: `
AGENT AUTHORIZATION FOR BIRTH CERTIFICATE REQUEST

Date: {{date}}

I, {{requestorName}}, hereby authorize Proofly (operated by Hudson R&D) to act as my
authorized agent for the sole and limited purpose of submitting a birth certificate
application to the Colorado Department of Public Health and Environment on my behalf.

This authorization covers:
  • Completing the official CDPHE birth certificate application on my behalf
  • Submitting the completed application with a copy of my government-issued photo ID
  • Submitting the required fee payment on my behalf
  • Receiving submission confirmation and tracking information

I understand and agree:
  • All documents provided will be permanently deleted immediately after submission
  • A cryptographic hash of every file is published on-chain before deletion
  • The birth certificate will be mailed directly to my address by CDPHE
  • This authorization is one-time use only, for this specific request
  • Proofly retains no copies of any documents after the deletion receipt is issued

Registrant Information:
  Name at Birth:    {{registrantName}}
  Date of Birth:    {{dateOfBirth}}
  Place of Birth:   {{placeOfBirth}} County, Colorado

Authorized Agent:  Proofly / Hudson R&D
Agent Contact:     Hello@HudsonRnD.com

Requestor Signature:

{{signaturePlaceholder}}

Date Signed:       {{date}}
Request Reference: {{requestRef}}
`.trim(),
};
