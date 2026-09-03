/**
 * @file src/imageCompress.ts
 * @description Provides a function to compress and re-encode an image file using the browser's native Canvas API.
 */

/**
 * Compresses an image file to a JPEG blob with a target size.
 * @param file The image file to compress.
 * @param options Options for compression.
 * @returns The compressed image as a JPEG blob.
 */
export async function compressImage(
  file: File,
  options: {
    maxSizeMB: number;
    maxDimensions: number;
    targetSizeKB: number;
  }
): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image.');
  }
  if (file.size > options.maxSizeMB * 1024 * 1024) {
    throw new Error(`File size exceeds the ${options.maxSizeMB}MB limit.`);
  }

  const imageBitmap = await createImageBitmap(file);
  const { width, height } = imageBitmap;

  let scale = 1;
  if (width > options.maxDimensions || height > options.maxDimensions) {
    scale = Math.min(options.maxDimensions / width, options.maxDimensions / height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context.');
  }

  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.8;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

  if (!blob) {
    throw new Error('Could not create blob from canvas.');
  }

  // If the first pass is still too large, try one more time with lower quality
  if (blob.size > options.targetSizeKB * 1024) {
    quality = 0.7;
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) {
      throw new Error('Could not create blob from canvas on second attempt.');
    }
  }

  return blob;
}
