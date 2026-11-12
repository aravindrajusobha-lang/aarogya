import { createWorker } from 'tesseract.js';
import workerUrl from 'tesseract.js/dist/worker.min.js?url';
import jsQR from 'jsqr';
import { parseAadhaarQrPayload } from './aadhaarQr';
import { parseIdentityOcrText } from './identityTextParser';
import { ExtractedIdentityFields, IdentityDocumentKind } from './identityOcrTypes';

export type { ExtractedIdentityFields, IdentityDocumentKind } from './identityOcrTypes';

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The image could not be decoded.'));
    image.src = source;
  });
}

function renderImage(image: HTMLImageElement, scale: number, enhance: boolean): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image processing is unavailable in this browser.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  if (enhance) {
    const pixels = imageData.data;
    for (let index = 0; index < pixels.length; index += 4) {
      const gray = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
      const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.65 + 128));
      pixels[index] = contrast;
      pixels[index + 1] = contrast;
      pixels[index + 2] = contrast;
    }
    context.putImageData(imageData, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }
  return imageData;
}

function scanQr(image: HTMLImageElement): ExtractedIdentityFields | undefined {
  for (const scale of [1, 1.5, 2, 0.75]) {
    for (const enhance of [false, true]) {
      const imageData = renderImage(image, scale, enhance);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
      if (!decoded?.data) continue;
      const fields = parseAadhaarQrPayload(decoded.data);
      if (fields) return fields;
    }
  }
  return undefined;
}

function inspectImage(image: HTMLImageElement): string | undefined {
  const imageData = renderImage(image, Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight)), false);
  const { data, width, height } = imageData;
  if (width < 200 || height < 120) return 'Please retake: place the Aadhaar card flat, fill the frame, good light.';

  const step = Math.max(1, Math.floor(Math.min(width, height) / 300));
  let brightnessTotal = 0;
  let glareCount = 0;
  let pixelCount = 0;
  let edgeTotal = 0;
  let edgeSquaredTotal = 0;
  let edgeCount = 0;
  let contentLeft = width;
  let contentTop = height;
  let contentRight = 0;
  let contentBottom = 0;
  const cornerIndexes = [0, (width - 1) * 4, ((height - 1) * width) * 4, ((height * width) - 1) * 4];
  const background = cornerIndexes.reduce((sum, index) => sum + (0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]), 0) / cornerIndexes.length;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      brightnessTotal += gray;
      pixelCount += 1;
      if (gray > 248 && Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2]) < 22) glareCount += 1;
      if (Math.abs(gray - background) > 24) {
        contentLeft = Math.min(contentLeft, x);
        contentTop = Math.min(contentTop, y);
        contentRight = Math.max(contentRight, x);
        contentBottom = Math.max(contentBottom, y);
      }
      if (x + step < width && y + step < height) {
        const rightIndex = (y * width + x + step) * 4;
        const belowIndex = ((y + step) * width + x) * 4;
        const right = 0.299 * data[rightIndex] + 0.587 * data[rightIndex + 1] + 0.114 * data[rightIndex + 2];
        const below = 0.299 * data[belowIndex] + 0.587 * data[belowIndex + 1] + 0.114 * data[belowIndex + 2];
        const edge = Math.abs(gray - right) + Math.abs(gray - below);
        edgeTotal += edge;
        edgeSquaredTotal += edge * edge;
        edgeCount += 1;
      }
    }
  }

  const brightness = brightnessTotal / pixelCount;
  const glareRatio = glareCount / pixelCount;
  const meanEdge = edgeTotal / Math.max(1, edgeCount);
  const blurVariance = edgeSquaredTotal / Math.max(1, edgeCount) - meanEdge * meanEdge;
  const contentArea = Math.max(0, contentRight - contentLeft) * Math.max(0, contentBottom - contentTop);
  const frameRatio = contentArea / (width * height);

  if (brightness < 42 || glareRatio > 0.34 || blurVariance < 12 || frameRatio < 0.18) {
    return 'Please retake: place the Aadhaar card flat, fill the frame, good light.';
  }
  return undefined;
}

function preprocessForOcr(image: HTMLImageElement): string {
  const analysisScale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
  const analysisCanvas = document.createElement('canvas');
  analysisCanvas.width = Math.max(1, Math.round(image.naturalWidth * analysisScale));
  analysisCanvas.height = Math.max(1, Math.round(image.naturalHeight * analysisScale));
  const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
  if (!analysisContext) throw new Error('Image processing is unavailable in this browser.');
  analysisContext.drawImage(image, 0, 0, analysisCanvas.width, analysisCanvas.height);
  const analysis = analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
  const { data, width, height } = analysis;
  const cornerIndexes = [0, (width - 1) * 4, ((height - 1) * width) * 4, (height * width - 1) * 4];
  const background = cornerIndexes.reduce((sum, index) => sum + (0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]), 0) / cornerIndexes.length;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 400));
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      if (Math.abs(gray - background) > 20) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  let crop = { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
  if (right > left && bottom > top && ((right - left) * (bottom - top)) / (width * height) > 0.28) {
    const padX = Math.round((right - left) * 0.04);
    const padY = Math.round((bottom - top) * 0.04);
    const x = Math.max(0, left - padX);
    const y = Math.max(0, top - padY);
    const cropRight = Math.min(width, right + padX);
    const cropBottom = Math.min(height, bottom + padY);
    crop = {
      x: Math.round(x / analysisScale),
      y: Math.round(y / analysisScale),
      width: Math.round((cropRight - x) / analysisScale),
      height: Math.round((cropBottom - y) / analysisScale),
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, crop.width * 2);
  canvas.height = Math.max(1, crop.height * 2);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image processing is unavailable in this browser.');
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.55 + 128));
    pixels[index] = contrast;
    pixels[index + 1] = contrast;
    pixels[index + 2] = contrast;
  }
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function mergeFields(ocr: ExtractedIdentityFields, qr: ExtractedIdentityFields): ExtractedIdentityFields {
  const merged: ExtractedIdentityFields = { ...ocr, ...qr, fieldSources: { ...ocr.fieldSources, ...qr.fieldSources } };
  for (const key of Object.keys(ocr) as Array<keyof ExtractedIdentityFields>) {
    if (merged[key] === undefined && ocr[key] !== undefined) merged[key] = ocr[key] as never;
  }
  return merged;
}

export async function extractIdentityFromImages(
  images: string[],
  kind: IdentityDocumentKind,
  onProgress?: (percent: number) => void,
): Promise<ExtractedIdentityFields> {
  if (!images.length || !images[0]) throw new Error('Select a card image before starting OCR.');

  const qrFields: ExtractedIdentityFields = { fieldSources: {} };
  const imageElements = await Promise.all(images.filter(Boolean).map(loadImage));
  const qualityError = imageElements.map(inspectImage).find(Boolean);
  if (qualityError) throw new Error(qualityError);

  for (const image of imageElements) {
    const fields = scanQr(image);
    if (fields) Object.assign(qrFields, mergeFields(qrFields, fields));
  }

  const needsOcr = kind === 'abha' || !qrFields.fullName || !qrFields.gender || !qrFields.yearOfBirth || !qrFields.address || !qrFields.village || !qrFields.mandal || !qrFields.pincode;
  if (!needsOcr) return qrFields;

  // Tesseract runs in the browser; card images and recognized text are never sent to an API.
  const worker = await createWorker('eng+tel+hin', 1, {
    workerPath: workerUrl,
    logger: (message) => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        onProgress?.(Math.round(message.progress * 100));
      }
    },
  });

  try {
    const texts: string[] = [];
    for (const image of imageElements) {
      const result = await worker.recognize(preprocessForOcr(image));
      texts.push(result.data.text);
    }
    const ocrFields = parseIdentityOcrText(texts.join('\n'), kind);
    const merged = mergeFields(ocrFields, qrFields);
    if (Object.keys(merged).every((key) => key === 'fieldSources' || key === 'qualityError' || merged[key as keyof ExtractedIdentityFields] === undefined)) {
      throw new Error('Aadhaar details could not be read from the QR code or text. Check the card image and retake both sides.');
    }
    return merged;
  } finally {
    await worker.terminate();
  }
}