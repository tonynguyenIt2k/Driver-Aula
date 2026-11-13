/**
 * Real Image/GIF to 135x240 RGB565 (Little-Endian) encoder & frame-strip extractor
 * for AULA S75 Pro TFT LCD (matches official AULA driver / open-aula Aula04 spec).
 */

import { ScreenFrame } from '../types/device';

export const AULA_TFT_WIDTH = 135;
export const AULA_TFT_HEIGHT = 240;
export const AULA_TFT_HEAD_LENGTH = 256;
export const AULA_TFT_MAX_FRAMES = 141; // Hardware frame-delay table capacity in 256-byte header

export interface EncodedScreenPayload {
  width: number;
  height: number;
  frameCount: number;
  totalRawBytes: number;
  optimizedBytes: number;
  framesRgb565: Uint8Array[];
  frameDelaysMs: number[];
}

export interface TextOverlayOptions {
  text: string;
  fontSize: number;
  color: string;
}

/**
 * Converts RGBA ImageData (width x height) to 16-bit RGB565 Little-Endian bytes
 * (low byte first, exact format expected by AULA S75 Pro firmware).
 */
export function rgbaToRgb565(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const pixelCount = width * height;
  const out = new Uint8Array(pixelCount * 2);

  for (let i = 0, o = 0; i < pixelCount; i++, o += 2) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];

    const rgb565 = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    out[o] = rgb565 & 0xff;
    out[o + 1] = (rgb565 >> 8) & 0xff;
  }

  return out;
}

/**
 * Computes estimated size of the packed Aula04 screen payload (256B header + frames).
 */
export function estimateDeltaRleBytes(frames: Uint8Array[]): number {
  if (frames.length === 0) return 0;
  return AULA_TFT_HEAD_LENGTH + frames.reduce((sum, f) => sum + f.length, 0);
}

/**
 * Draws an image/video frame cleanly into a 135x240 portrait canvas using aspect-fill (cover).
 */
function drawCoverFrame(
  ctx: CanvasRenderingContext2D,
  bitmap: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  orientation: 0 | 90 | 180 | 270 = 0
) {
  ctx.clearRect(0, 0, AULA_TFT_WIDTH, AULA_TFT_HEIGHT);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, AULA_TFT_WIDTH, AULA_TFT_HEIGHT);

  ctx.save();
  if (orientation !== 0) {
    ctx.translate(AULA_TFT_WIDTH / 2, AULA_TFT_HEIGHT / 2);
    ctx.rotate((orientation * Math.PI) / 180);
    ctx.translate(-AULA_TFT_WIDTH / 2, -AULA_TFT_HEIGHT / 2);
  }

  const safeW = Math.max(1, srcWidth);
  const safeH = Math.max(1, srcHeight);
  const scale = Math.max(AULA_TFT_WIDTH / safeW, AULA_TFT_HEIGHT / safeH);
  const drawW = safeW * scale;
  const drawH = safeH * scale;
  const dx = (AULA_TFT_WIDTH - drawW) / 2;
  const dy = (AULA_TFT_HEIGHT - drawH) / 2;

  ctx.drawImage(bitmap, dx, dy, drawW, drawH);
  ctx.restore();
}

/**
 * Decodes an uploaded GIF / PNG / JPG / WebP or URL into editable 135x240 ScreenFrame[] items.
 */
export async function decodeSourceToFrames(
  source: File | string,
  orientation: 0 | 90 | 180 | 270 = 0,
  maxFrames: number = AULA_TFT_MAX_FRAMES
): Promise<ScreenFrame[]> {
  const canvas = document.createElement('canvas');
  canvas.width = AULA_TFT_WIDTH;
  canvas.height = AULA_TFT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo Canvas 2D để xử lý khung hình.');
  }

  const ImageDecoderCtor = (window as unknown as { ImageDecoder?: any }).ImageDecoder;
  const isGifFile =
    source instanceof File &&
    (source.type === 'image/gif' || source.name.toLowerCase().endsWith('.gif'));

  if (isGifFile && ImageDecoderCtor) {
    try {
      const buf = await source.arrayBuffer();
      const decoder = new ImageDecoderCtor({ data: buf, type: 'image/gif' });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      const totalGifFrames = Math.max(1, track?.frameCount || 1);
      const step = totalGifFrames > maxFrames ? Math.ceil(totalGifFrames / maxFrames) : 1;

      const frames: ScreenFrame[] = [];
      for (let idx = 0; idx < totalGifFrames && frames.length < maxFrames; idx += step) {
        const decoded = await decoder.decode({ frameIndex: idx });
        const img = decoded.image;
        const srcW = img.displayWidth || img.codedWidth || AULA_TFT_WIDTH;
        const srcH = img.displayHeight || img.codedHeight || AULA_TFT_HEIGHT;
        drawCoverFrame(ctx, img, srcW, srcH, orientation);

        const durationUs = typeof img.duration === 'number' && img.duration > 0 ? img.duration : 40000;
        const delayMs = Math.max(20, Math.min(500, Math.round(durationUs / 1000) * step));
        img.close?.();

        frames.push({
          id: `f-${idx}-${Date.now()}`,
          dataUrl: canvas.toDataURL('image/png'),
          delayMs,
        });
      }
      decoder.close?.();

      if (frames.length > 0) {
        return frames;
      }
    } catch {
      // Fall through to single-frame image decode
    }
  }

  const imgUrl = source instanceof File ? URL.createObjectURL(source) : source;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không thể tải ảnh nguồn để giải mã.'));
      el.src = imgUrl;
    });

    drawCoverFrame(
      ctx,
      img,
      img.naturalWidth || AULA_TFT_WIDTH,
      img.naturalHeight || AULA_TFT_HEIGHT,
      orientation
    );
    return [
      {
        id: `f-0-${Date.now()}`,
        dataUrl: canvas.toDataURL('image/png'),
        delayMs: 40,
      },
    ];
  } finally {
    if (source instanceof File) {
      URL.revokeObjectURL(imgUrl);
    }
  }
}

/**
 * Encodes an array of editable ScreenFrame[] (with optional text overlay) to 135x240 Little-Endian RGB565 buffers.
 */
export async function encodeFramesToRgb565(
  frames: ScreenFrame[],
  overlay?: TextOverlayOptions
): Promise<EncodedScreenPayload> {
  const canvas = document.createElement('canvas');
  canvas.width = AULA_TFT_WIDTH;
  canvas.height = AULA_TFT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo Canvas 2D để mã hóa RGB565.');
  }

  const framesRgb565: Uint8Array[] = [];
  const frameDelaysMs: number[] = [];

  for (const frame of frames) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Lỗi đọc khung hình để mã hóa RGB565.'));
      el.src = frame.dataUrl;
    });

    ctx.clearRect(0, 0, AULA_TFT_WIDTH, AULA_TFT_HEIGHT);
    ctx.drawImage(img, 0, 0, AULA_TFT_WIDTH, AULA_TFT_HEIGHT);

    if (overlay && overlay.text.trim()) {
      ctx.save();
      ctx.font = `bold ${overlay.fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(overlay.text, AULA_TFT_WIDTH / 2, AULA_TFT_HEIGHT - overlay.fontSize - 10);
      ctx.fillStyle = overlay.color || '#ffffff';
      ctx.fillText(overlay.text, AULA_TFT_WIDTH / 2, AULA_TFT_HEIGHT - overlay.fontSize - 10);
      ctx.restore();
    }

    const imgData = ctx.getImageData(0, 0, AULA_TFT_WIDTH, AULA_TFT_HEIGHT);
    framesRgb565.push(rgbaToRgb565(imgData.data, AULA_TFT_WIDTH, AULA_TFT_HEIGHT));
    frameDelaysMs.push(frame.delayMs || 40);
  }

  const totalRawBytes = framesRgb565.reduce((acc, f) => acc + f.length, 0);
  const optimizedBytes = estimateDeltaRleBytes(framesRgb565);

  return {
    width: AULA_TFT_WIDTH,
    height: AULA_TFT_HEIGHT,
    frameCount: framesRgb565.length,
    totalRawBytes,
    optimizedBytes,
    framesRgb565,
    frameDelaysMs,
  };
}
