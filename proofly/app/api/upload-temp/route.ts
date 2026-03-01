import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

// This route generates a short-lived Vercel Blob client upload token.
// The file goes directly from the user's browser to Vercel Blob storage —
// it never passes through this function body, so there's no 4MB limit issue.
// The blob is explicitly deleted in /api/process after mailing completes.

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate file type and size before issuing token
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
        const ext = pathname.toLowerCase().slice(pathname.lastIndexOf('.'));

        if (!allowedExtensions.includes(ext)) {
          throw new Error(`File type not allowed. Accepted: ${allowedExtensions.join(', ')}`);
        }

        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
          ],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
          // Blobs are accessible but not listed publicly — deleted after processing
          tokenPayload: JSON.stringify({ uploadedAt: Date.now() }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Blob is now in Vercel storage — we just log the URL for debugging
        // The actual record is kept in the user's localStorage session, not our DB
        console.log('Temp blob uploaded:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
