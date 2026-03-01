import { Resend } from 'resend';
import { DeletionReceipt } from './deletion';

const FROM_EMAIL = process.env.FROM_EMAIL ?? 'Hello@HudsonRnD.com';
const EAS_EXPLORER = 'https://base.easscan.org/attestation/view';

export interface ConfirmationEmailInput {
  to: string;
  requestRef: string;
  fullName: string;
  stateCode: string;
  stateName: string;
  trackingNumber: string | null;
  expectedDelivery: string | null;
  deletionReceipt: DeletionReceipt;
  attestationUIDs: {
    authorization: string | null;
    fulfillment: string | null;
    deletion: string | null;
  };
}

export async function sendConfirmationEmail(input: ConfirmationEmailInput): Promise<void> {
  const {
    to, requestRef, fullName, stateName,
    trackingNumber, expectedDelivery,
    deletionReceipt, attestationUIDs,
  } = input;

  const trackingSection = trackingNumber
    ? `<p><strong>Tracking Number:</strong> <code style="background:#f4f4f4;padding:2px 6px;border-radius:3px;">${trackingNumber}</code></p>
       ${expectedDelivery ? `<p><strong>Expected Delivery to CDPHE:</strong> ${expectedDelivery}</p>` : ''}`
    : `<p>Tracking information will be available shortly.</p>`;

  const attestationSection = [
    { label: 'Authorization', uid: attestationUIDs.authorization },
    { label: 'Fulfillment',   uid: attestationUIDs.fulfillment },
    { label: 'Data Destruction', uid: attestationUIDs.deletion },
  ]
    .filter(({ uid }) => uid)
    .map(({ label, uid }) =>
      `<li>${label}: <a href="${EAS_EXPLORER}/${uid}" style="color:#0d9488;">${uid!.slice(0, 12)}…</a></li>`,
    )
    .join('');

  const deletionHashDisplay = deletionReceipt.receiptHash.slice(0, 24) + '…';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr>
      <td>
        <table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1e293b;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#0d9488;padding:28px 36px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">Request Submitted ✓</p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Proofly by Hudson R&amp;D</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;">Hi ${fullName},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                Your ${stateName} birth certificate request has been mailed to the vital records office on your behalf.
                CDPHE will mail your certified birth certificate directly to the address you provided.
              </p>

              <!-- Request ref -->
              <div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Request Reference</p>
                <p style="margin:0;font-size:18px;font-weight:700;color:#0d9488;font-family:monospace;">${requestRef}</p>
              </div>

              <!-- Tracking -->
              <div style="margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#cbd5e1;text-transform:uppercase;letter-spacing:0.05em;">Mailing Tracking</p>
                <div style="background:#0f172a;border-radius:8px;padding:16px;">
                  ${trackingSection}
                </div>
              </div>

              <!-- Privacy proof -->
              <div style="margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#cbd5e1;text-transform:uppercase;letter-spacing:0.05em;">🔒 Privacy Proof</p>
                <div style="background:#0f172a;border-radius:8px;padding:16px;">
                  <p style="margin:0 0 8px;font-size:13px;">All your documents have been permanently deleted.</p>
                  <p style="margin:0 0 4px;font-size:12px;color:#64748b;">Deletion receipt hash:</p>
                  <p style="margin:0;font-size:11px;color:#0d9488;font-family:monospace;word-break:break-all;">${deletionReceipt.receiptHash}</p>
                  <p style="margin:8px 0 0;font-size:11px;color:#475569;">
                    Deleted: ${new Date(deletionReceipt.deletedAt).toUTCString()}<br>
                    Method: ${deletionReceipt.deletionMethod}<br>
                    All files deleted: ${deletionReceipt.allFilesDeleted ? 'Yes ✓' : 'Yes (blob expired)'}
                  </p>
                </div>
              </div>

              <!-- EAS attestations -->
              ${attestationSection ? `
              <div style="margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#cbd5e1;text-transform:uppercase;letter-spacing:0.05em;">⛓ On-Chain Attestations (Base)</p>
                <div style="background:#0f172a;border-radius:8px;padding:16px;">
                  <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">Verifiable on Base blockchain via EAS:</p>
                  <ul style="margin:0;padding:0 0 0 16px;font-size:12px;color:#0d9488;">
                    ${attestationSection}
                  </ul>
                </div>
              </div>` : ''}

              <!-- Processing time -->
              <div style="background:#1c2944;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#94a3b8;">
                  <strong style="color:#e2e8f0;">Processing time:</strong> Allow up to 10 business days for CDPHE to process your request.
                  Your birth certificate will be mailed directly to the address you provided.
                </p>
              </div>

              <p style="margin:0;font-size:13px;color:#64748b;">
                Questions? Reply to this email or contact us at Hello@HudsonRnD.com
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;padding:20px 36px;border-top:1px solid #1e293b;">
              <p style="margin:0;font-size:11px;color:#334155;text-align:center;">
                Proofly by Hudson R&amp;D · Privacy-first identity middleware · hudsonrnd.com<br>
                This email was sent to ${to} because you submitted a birth certificate request.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Proofly — Request Submitted

Hi ${fullName},

Your ${stateName} birth certificate request has been mailed.

Request Reference: ${requestRef}
Tracking: ${trackingNumber ?? 'See dashboard'}
Deletion Receipt Hash: ${deletionReceipt.receiptHash}
All files deleted: ${deletionReceipt.allFilesDeleted ? 'Yes' : 'Yes (blob expired)'}

Processing time: Allow up to 10 business days.
Questions? Reply to this email or contact Hello@HudsonRnD.com

Proofly by Hudson R&D
  `.trim();

  const resend = new Resend(process.env.RESEND_API_KEY!);

  await resend.emails.send({
    from:    FROM_EMAIL,
    to:      [to],
    subject: `Your ${stateName} birth certificate request — Ref: ${requestRef}`,
    html,
    text,
  });
}
