import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import { StateConfig } from '@/lib/states/schema';
import { ProoflySession } from '@/lib/session';

export interface ConsentLetterInput {
  stateConfig: StateConfig;
  form: NonNullable<ProoflySession['form']>;
  signatureDataUrl: string;
  requestRef: string;
  todaysDate: string; // "Month DD, YYYY"
}

export async function generateConsentLetter(input: ConsentLetterInput): Promise<Uint8Array> {
  const { stateConfig, form, signatureDataUrl, requestRef, todaysDate } = input;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter

  const { width, height } = page.getSize();
  const margin = 72; // 1 inch
  const contentWidth = width - margin * 2;

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono    = await pdfDoc.embedFont(StandardFonts.Courier);

  let y = height - margin;

  // ─── Header ────────────────────────────────────────────────────────────────
  // Logo text (no image dependency)
  drawText('PROOFLY', fontBold, 20, margin, y, rgb(0.06, 0.47, 0.42)); // teal
  y -= 16;
  drawText('by Hudson R&D  •  Hello@HudsonRnD.com', fontRegular, 9, margin, y, rgb(0.4, 0.4, 0.4));
  y -= 8;

  // Horizontal rule
  page.drawLine({
    start: { x: margin, y },
    end:   { x: width - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 24;

  // ─── Document title ─────────────────────────────────────────────────────────
  drawText('AGENT AUTHORIZATION FOR BIRTH CERTIFICATE REQUEST', fontBold, 13, margin, y);
  y -= 20;
  drawText(`Date: ${todaysDate}`, fontRegular, 10, margin, y, rgb(0.3, 0.3, 0.3));
  y -= 28;

  // ─── Body ───────────────────────────────────────────────────────────────────
  const body1 = `I, ${form.fullName}, hereby authorize Proofly (operated by Hudson R&D) to act as my authorized agent for the sole and limited purpose of submitting a birth certificate application to the ${stateConfig.vitalRecords.agencyName} on my behalf.`;
  y = drawWrappedText(body1, fontRegular, 11, margin, y, contentWidth, 16);
  y -= 20;

  // Coverage section
  drawText('This authorization covers:', fontBold, 11, margin, y);
  y -= 16;
  const coverageItems = [
    'Completing the official CDPHE birth certificate application on my behalf',
    'Submitting the completed application with a copy of my government-issued photo ID',
    'Submitting the required fee payment on my behalf',
    'Receiving submission confirmation and tracking information',
  ];
  for (const item of coverageItems) {
    y = drawWrappedText(`• ${item}`, fontRegular, 10, margin + 12, y, contentWidth - 12, 15);
    y -= 4;
  }
  y -= 16;

  // Agreement section
  drawText('I understand and agree:', fontBold, 11, margin, y);
  y -= 16;
  const agreeItems = [
    'All documents provided will be permanently deleted immediately after submission',
    'A cryptographic SHA-256 hash of every file is published on Base blockchain before deletion',
    'The birth certificate will be mailed directly to my address by CDPHE',
    'This authorization is one-time use only, for this specific request',
    'Proofly retains no copies of any documents after the on-chain deletion receipt is issued',
  ];
  for (const item of agreeItems) {
    y = drawWrappedText(`• ${item}`, fontRegular, 10, margin + 12, y, contentWidth - 12, 15);
    y -= 4;
  }
  y -= 20;

  // ─── Registrant info box ────────────────────────────────────────────────────
  const boxTop    = y + 8;
  const boxHeight = 90;
  page.drawRectangle({
    x: margin,
    y: boxTop - boxHeight,
    width: contentWidth,
    height: boxHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: rgb(0.97, 0.97, 0.97),
  });
  y -= 4;
  drawText('Registrant Information', fontBold, 10, margin + 12, y, rgb(0.3, 0.3, 0.3));
  y -= 16;

  const dob = form.dateOfBirth
    ? new Date(form.dateOfBirth + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : form.dateOfBirth;

  const infoRows: [string, string][] = [
    ['Name at Birth:',    form.fullName],
    ['Date of Birth:',    dob],
    ['Place of Birth:',   `${form.placeOfBirth} County, Colorado`],
    ['Relationship:',     form.relationship],
  ];
  for (const [label, value] of infoRows) {
    drawText(label, fontBold, 10, margin + 12, y);
    drawText(value, fontRegular, 10, margin + 130, y);
    y -= 15;
  }
  y -= 20;

  // ─── Agent info ──────────────────────────────────────────────────────────────
  drawText('Authorized Agent:', fontBold, 10, margin, y);
  drawText('Proofly / Hudson R&D', fontRegular, 10, margin + 130, y);
  y -= 14;
  drawText('Agent Contact:', fontBold, 10, margin, y);
  drawText('Hello@HudsonRnD.com', fontRegular, 10, margin + 130, y);
  y -= 30;

  // ─── Signature section ───────────────────────────────────────────────────────
  drawText('Requestor Signature:', fontBold, 11, margin, y);
  y -= 14;
  drawText('By signing below, I certify the above authorization is true and correct.', fontRegular, 9, margin, y, rgb(0.4, 0.4, 0.4));
  y -= 8;

  // Signature image
  try {
    const base64 = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Buffer.from(base64, 'base64');
    const sigImage = signatureDataUrl.includes('image/png')
      ? await pdfDoc.embedPng(imageBytes)
      : await pdfDoc.embedJpg(imageBytes);

    page.drawImage(sigImage, {
      x: margin,
      y: y - 60,
      width: 220,
      height: 55,
    });
    y -= 70;
  } catch {
    // If image fails, draw a placeholder line
    page.drawLine({
      start: { x: margin, y: y - 40 },
      end:   { x: margin + 220, y: y - 40 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 50;
  }

  // Signature metadata
  drawText(`Date Signed: ${todaysDate}`, fontRegular, 10, margin, y);
  y -= 14;
  drawText('Request Reference: ', fontRegular, 10, margin, y);
  drawText(requestRef, fontMono, 10, margin + 120, y, rgb(0.06, 0.47, 0.42));
  y -= 28;

  // ─── Legal notice ───────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: margin, y },
    end:   { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 14;
  const legalText = 'This e-signature is legally binding under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and applicable state electronic signature laws. This authorization is one-time use only and expires upon fulfillment.';
  drawWrappedText(legalText, fontRegular, 8, margin, y, contentWidth, 13, rgb(0.5, 0.5, 0.5));

  // ─── Footer ──────────────────────────────────────────────────────────────────
  drawText('Proofly by Hudson R&D  •  Privacy-first identity middleware  •  hudsonrnd.com', fontRegular, 8, margin, 36, rgb(0.6, 0.6, 0.6));

  return pdfDoc.save();

  // ─── Inner helpers ────────────────────────────────────────────────────────────
  function drawText(
    text: string,
    font: PDFFont,
    size: number,
    x: number,
    yPos: number,
    color = rgb(0, 0, 0),
  ) {
    page.drawText(text, { x, y: yPos, font, size, color });
  }

  function drawWrappedText(
    text: string,
    font: PDFFont,
    size: number,
    x: number,
    yPos: number,
    maxWidth: number,
    lineHeight: number,
    color = rgb(0, 0, 0),
  ): number {
    const words = text.split(' ');
    let line = '';
    let currentY = yPos;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      if (testWidth > maxWidth && line) {
        page.drawText(line, { x, y: currentY, font, size, color });
        currentY -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x, y: currentY, font, size, color });
      currentY -= lineHeight;
    }
    return currentY;
  }
}
