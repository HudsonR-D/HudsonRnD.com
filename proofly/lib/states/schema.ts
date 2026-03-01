export interface StateConfig {
  code: string;
  name: string;
  status: 'live' | 'coming_soon';

  vitalRecords: {
    agencyName: string;
    mailingAddress: {
      name: string;
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    phone: string;
    processingTimeDays: number;
  };

  fees: {
    firstCopy: number;       // cents
    additionalCopy: number;  // cents
    prooflyService: number;  // cents
    lobPostage: number;      // cents — Lob print+mail cost passed through to user
    checkMemo: string;       // who the check is payable to
  };

  form: {
    pdfPath: string;
    fieldMap: Record<string, string>;
  };

  requiredDocs: {
    id: string;
    label: string;
    description: string;
    required: boolean;
    acceptedTypes: string[];
    maxSizeMB: number;
  }[];

  eligibility: {
    whoCanRequest: string[];
    relationshipProofRequired: boolean;
    notarizedRequired: boolean;
  };

  authorizationLetterTemplate: string;
}
