import { PDFDocument, PDFImage } from 'pdf-lib';

export interface PacketInput {
  filledFormBytes: Uint8Array;      // filled CDPHE application
  consentLetterBytes: Uint8Array;   // generated authorization letter
  idFileBuffer: Buffer;             // raw file buffer of uploaded ID
  idFileType: string;               // MIME type: 'image/jpeg' | 'image/png' | 'application/pdf'
}

/**
 * Merges all three documents into a single PDF for Lob /letters.
 * Order: consent letter → filled CDPHE form → ID copy
 * (Consent letter first so it reads as a cover page)
 */
export async function buildPacket(input: PacketInput): Promise<Uint8Array> {
  const { filledFormBytes, consentLetterBytes, idFileBuffer, idFileType } = input;

  const masterDoc = await PDFDocument.create();

  // 1. Consent letter (first — acts as cover/authorization)
  const consentDoc = await PDFDocument.load(consentLetterBytes);
  const consentPages = await masterDoc.copyPages(consentDoc, consentDoc.getPageIndices());
  for (const p of consentPages) masterDoc.addPage(p);

  // 2. Filled CDPHE application form
  const formDoc = await PDFDocument.load(filledFormBytes);
  const formPages = await masterDoc.copyPages(formDoc, formDoc.getPageIndices());
  for (const p of formPages) masterDoc.addPage(p);

  // 3. ID document
  if (idFileType === 'application/pdf') {
    // PDF ID — merge pages directly
    const idDoc = await PDFDocument.load(idFileBuffer);
    const idPages = await masterDoc.copyPages(idDoc, idDoc.getPageIndices());
    for (const p of idPages) masterDoc.addPage(p);
  } else {
    // Image ID — embed as a new page
    const idPage = masterDoc.addPage([612, 792]);
    const { width, height } = idPage.getSize();
    const margin = 54;

    let idImage: PDFImage;
    if (idFileType === 'image/png') {
      idImage = await masterDoc.embedPng(idFileBuffer);
    } else {
      // jpeg, webp — treat as jpeg (Lob converts webp on upload anyway)
      idImage = await masterDoc.embedJpg(idFileBuffer);
    }

    // Scale image to fit within page margins while preserving aspect ratio
    const maxW = width - margin * 2;
    const maxH = height - margin * 2 - 60; // leave room for label
    const { width: imgW, height: imgH } = idImage.scale(1);
    const scale = Math.min(maxW / imgW, maxH / imgH, 1); // never upscale

    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = (width - drawW) / 2;
    const drawY = (height - drawH) / 2;

    // Label above the image
    idPage.drawText('GOVERNMENT-ISSUED PHOTO ID — SUBMITTED BY APPLICANT', {
      x: margin,
      y: height - margin,
      size: 9,
    });
    idPage.drawText('Required by CDPHE for mail-in birth certificate requests. See reverse of application for ID requirements.', {
      x: margin,
      y: height - margin - 14,
      size: 8,
    });

    idPage.drawImage(idImage, { x: drawX, y: drawY, width: drawW, height: drawH });
  }

  return masterDoc.save();
}
