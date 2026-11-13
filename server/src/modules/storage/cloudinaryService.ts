import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../../config/logger.js';

/**
 * Private Cloudinary storage (Invariant 7: zero public storage).
 * - Every asset is uploaded with `type: 'authenticated'`, so no public delivery URL works.
 * - Downloads happen server-side through a short-lived signed URL, only after the app's JWT +
 *   scope checks; the signed URL itself is never sent to the browser.
 * Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to enable.
 */
let configured = false;

export function isCloudinaryConfigured(): boolean {
  const ok = Boolean(process.env.CLOUDINARY_CLOUD_NAME?.trim() && process.env.CLOUDINARY_API_KEY?.trim() && process.env.CLOUDINARY_API_SECRET?.trim());
  if (ok && !configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
      api_key: process.env.CLOUDINARY_API_KEY!.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET!.trim(),
      secure: true,
    });
    configured = true;
  }
  return ok;
}

const resourceTypeFor = (mimeType: string): 'image' | 'raw' => (mimeType.startsWith('image/') ? 'image' : 'raw');

export async function uploadToCloudinary(params: { buffer: Buffer; fileId: string; category: string; mimeType: string }): Promise<{ publicId: string; resourceType: 'image' | 'raw'; format?: string }> {
  if (!isCloudinaryConfigured()) throw new Error('Cloudinary is not configured');
  const resourceType = resourceTypeFor(params.mimeType);
  const folder = `aarogya-drishti/${params.category.replace(/\/+$/, '')}`;
  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, type: 'authenticated', folder, public_id: params.fileId, overwrite: false, use_filename: false, unique_filename: false },
      (error, value) => (error ? reject(error) : resolve(value)),
    );
    stream.end(params.buffer);
  });
  return { publicId: result.public_id, resourceType, format: result.format };
}

export async function downloadFromCloudinary(params: { publicId: string; resourceType: 'image' | 'raw'; format?: string | null }): Promise<Buffer> {
  if (!isCloudinaryConfigured()) throw new Error('Cloudinary is not configured');
  const expiresAt = Math.floor(Date.now() / 1000) + 120;
  const url = cloudinary.utils.private_download_url(params.publicId, params.format || '', {
    resource_type: params.resourceType,
    type: 'authenticated',
    expires_at: expiresAt,
  });
  const res = await fetch(url);
  if (!res.ok) {
    logger.warn({ status: res.status }, 'Cloudinary private download failed');
    throw Object.assign(new Error('Stored file could not be retrieved'), { statusCode: 502, code: 'STORAGE_PROVIDER_ERROR' });
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteFromCloudinary(params: { publicId: string; resourceType: 'image' | 'raw' }): Promise<boolean> {
  if (!isCloudinaryConfigured()) return false;
  const result: any = await cloudinary.uploader.destroy(params.publicId, { resource_type: params.resourceType, type: 'authenticated', invalidate: true });
  return result?.result === 'ok';
}
