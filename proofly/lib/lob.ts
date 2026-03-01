import { LobClient } from 'lob';
import { StateConfig } from '@/lib/states/schema';

function getClient() {
  return new LobClient({ apiKey: process.env.LOB_API_KEY! });
}

export interface LobLetterResult {
  lobLetterId: string;
  trackingNumber: string | null;
  expectedDeliveryDate: string | null;
}

export interface LobCheckResult {
  lobCheckId: string;
  checkNumber: number | null;
  status: 'created' | 'stubbed';
}

/**
 * Mail the complete packet (consent letter + CDPHE form + ID copy) to the
 * vital records office via Lob's Print & Mail API.
 */
export async function mailPacketToVitalRecords(
  packetPdfBytes: Uint8Array,
  stateConfig: StateConfig,
  fromName: string,
  fromAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  },
  requestRef: string,
): Promise<LobLetterResult> {
  const toAddress = stateConfig.vitalRecords.mailingAddress;

  // Lob v7 accepts PDF as base64 data URL
  const pdfBase64 = Buffer.from(packetPdfBytes).toString('base64');
  const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

  const letter = await getClient().lettersApi.create({
    description: `Proofly — ${stateConfig.name} Birth Certificate Request — ${requestRef}`,
    to: {
      name:            toAddress.name,
      address_line1:   toAddress.street,
      address_city:    toAddress.city,
      address_state:   toAddress.state,
      address_zip:     toAddress.zip,
      address_country: 'US' as any,
    },
    from: {
      name:            fromName,
      address_line1:   fromAddress.street,
      address_city:    fromAddress.city,
      address_state:   fromAddress.state,
      address_zip:     fromAddress.zip,
      address_country: 'US' as any,
    },
    file:              pdfDataUrl,
    color:             false,
    double_sided:      true,
    address_placement: 'top_first_page' as any,
    mail_type:         'usps_first_class' as any,
  });

  return {
    lobLetterId:          (letter as any).id ?? '',
    trackingNumber:       (letter as any).tracking_number ?? null,
    expectedDeliveryDate: (letter as any).expected_delivery_date ?? null,
  };
}

/**
 * Mail a check for the state fee to the vital records office.
 * Requires LOB_BANK_ACCOUNT_ID env var — stubs if not present.
 */
export async function mailFeeCheck(
  stateConfig: StateConfig,
  copies: number,
  fromName: string,
  fromAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  },
  requestRef: string,
): Promise<LobCheckResult> {
  const bankAccountId = process.env.LOB_BANK_ACCOUNT_ID;

  if (!bankAccountId) {
    console.warn(
      `[Proofly] LOB_BANK_ACCOUNT_ID not set — fee check NOT mailed for ${requestRef}.`,
      'Add bank account in Lob dashboard and set LOB_BANK_ACCOUNT_ID env var.',
    );
    return { lobCheckId: `STUB_${requestRef}`, checkNumber: null, status: 'stubbed' };
  }

  const { firstCopy, additionalCopy, checkMemo } = stateConfig.fees;
  const amountCents = firstCopy + Math.max(0, copies - 1) * additionalCopy;
  const toAddress = stateConfig.vitalRecords.mailingAddress;

  const check = await getClient().checksApi.create({
    description:  `${stateConfig.name} Birth Certificate Fee — ${requestRef}`,
    bank_account: bankAccountId,
    amount:       amountCents / 100,
    memo:         checkMemo,
    to: {
      name:            toAddress.name,
      address_line1:   toAddress.street,
      address_city:    toAddress.city,
      address_state:   toAddress.state,
      address_zip:     toAddress.zip,
      address_country: 'US' as any,
    },
    from: {
      name:            fromName,
      address_line1:   fromAddress.street,
      address_city:    fromAddress.city,
      address_state:   fromAddress.state,
      address_zip:     fromAddress.zip,
      address_country: 'US' as any,
    },
  });

  return {
    lobCheckId:  (check as any).id ?? '',
    checkNumber: (check as any).check_number ?? null,
    status:      'created',
  };
}
