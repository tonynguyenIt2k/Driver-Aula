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
 * Draws an image/video frame cleanly into a targetW x targetH canvas using aspect-fill (cover).
 */
function drawCoverFrame(
  ctx: CanvasRenderingContext2D,
  bitmap: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number,
  orientation: 0 | 90 | 180 | 270 = 0
) {
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  ctx.save();
  if (orientation !== 0) {
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate((orientation * Math.PI) / 180);
    ctx.translate(-targetWidth / 2, -targetHeight / 2);
  }

  const safeW = Math.max(1, srcWidth);
  const safeH = Math.max(1, srcHeight);
  const scale = Math.max(targetWidth / safeW, targetHeight / safeH);
  const drawW = safeW * scale;
  const drawH = safeH * scale;
  const dx = (targetWidth - drawW) / 2;
  const dy = (targetHeight - drawH) / 2;

  ctx.drawImage(bitmap, dx, dy, drawW, drawH);
  ctx.restore();
}

function encodeCanvasFrame(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.88);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  return canvas.toDataURL('image/jpeg', 0.88);
}

export function isVideoFile(file: File): boolean {
  if (file.type && file.type.startsWith('video/')) return true;
  return /\.(mp4|mov|m4v|webm|avi|mkv|3gp|ogv)$/i.test(file.name);
}

async function decodeVideoFileToFrames(
  file: File,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  orientation: 0 | 90 | 180 | 270,
  maxFrames: number,
  targetWidth: number,
  targetHeight: number,
  onProgress?: (pct: number) => void
): Promise<ScreenFrame[]> {
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto';
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.top = '-9999px';
  video.style.width = '2px';
  video.style.height = '2px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  document.body.appendChild(video);

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Hết thời gian đọc tệp video. Hãy thử video ngắn hơn hoặc định dạng MP4 (H.264).'));
        }
      }, 12000);

      const finish = () => {
        if (settled) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          settled = true;
          window.clearTimeout(timer);
          resolve();
        }
      };

      video.onloadeddata = finish;
      video.oncanplay = finish;
      video.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(new Error('Không thể giải mã video này trên trình duyệt (codec chưa được hỗ trợ, hãy thử MP4 H.264 hoặc WebM).'));
      };

      video.src = videoUrl;
      video.load();
    });

    // Unlock hardware video decoder on iOS Safari / mobile browsers
    try {
      await video.play();
      video.pause();
    } catch {
      // Ignore autoplay blocks; muted playsInline seek still works on most engines
    }

    const srcW = video.videoWidth || targetWidth;
    const srcH = video.videoHeight || targetHeight;
    if (srcW <= 0 || srcH <= 0) {
      throw new Error('Không đọc được kích thước khung hình từ video.');
    }

    const rawDuration = video.duration;
    const hasDuration = Number.isFinite(rawDuration) && rawDuration > 0;
    const clipDuration = hasDuration ? Math.min(rawDuration, 12) : 5;
    const cappedMax = Math.max(1, Math.min(maxFrames, 75));
    const targetFps = 12;
    const sampleCount = Math.max(1, Math.min(cappedMax, Math.round(clipDuration * targetFps)));
    const stepSec = sampleCount > 1 ? clipDuration / sampleCount : 0;
    const delayMs = Math.max(20, Math.min(500, Math.round((clipDuration * 1000) / sampleCount) || 80));

    const frames: ScreenFrame[] = [];
    const baseTs = Date.now();

    for (let idx = 0; idx < sampleCount; idx++) {
      const maxSeek = hasDuration ? Math.max(0, rawDuration - 0.03) : clipDuration;
      const targetTime = Math.min(idx * stepSec, maxSeek);

      if (Math.abs(video.currentTime - targetTime) > 0.015 || idx > 0) {
        await new Promise<void>((resolve) => {
          let done = false;
          const timer = window.setTimeout(() => {
            if (!done) {
              done = true;
              resolve();
            }
          }, 1200);

          const onSeeked = () => {
            if (done) return;
            done = true;
            window.clearTimeout(timer);
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked, { once: true });
          try {
            video.currentTime = targetTime;
          } catch {
            done = true;
            window.clearTimeout(timer);
            video.removeEventListener('seeked', onSeeked);
            resolve();
          }
        });
      }

      drawCoverFrame(ctx, video, srcW, srcH, targetWidth, targetHeight, orientation);
      frames.push({
        id: `vf-${idx}-${baseTs}`,
        dataUrl: encodeCanvasFrame(canvas),
        delayMs,
      });

      onProgress?.(Math.round(((idx + 1) / sampleCount) * 100));
    }

    if (frames.length === 0) {
      throw new Error('Không trích xuất được khung hình nào từ video.');
    }

    return frames;
  } finally {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch {
      // Ignore cleanup errors
    }
    video.remove();
    URL.revokeObjectURL(videoUrl);
  }
}

/**
 * Decodes an uploaded Video / GIF / PNG / JPG / WebP or URL into editable targetW x targetH ScreenFrame[] items.
 */
export async function decodeSourceToFrames(
  source: File | string,
  orientation: 0 | 90 | 180 | 270 = 0,
  maxFrames: number = AULA_TFT_MAX_FRAMES,
  targetWidth: number = AULA_TFT_WIDTH,
  targetHeight: number = AULA_TFT_HEIGHT,
  onProgress?: (pct: number) => void
): Promise<ScreenFrame[]> {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo Canvas 2D để xử lý khung hình.');
  }

  if (source instanceof File && isVideoFile(source)) {
    return decodeVideoFileToFrames(
      source,
      canvas,
      ctx,
      orientation,
      maxFrames,
      targetWidth,
      targetHeight,
      onProgress
    );
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
        const srcW = img.displayWidth || img.codedWidth || targetWidth;
        const srcH = img.displayHeight || img.codedHeight || targetHeight;
        drawCoverFrame(ctx, img, srcW, srcH, targetWidth, targetHeight, orientation);

        const durationUs = typeof img.duration === 'number' && img.duration > 0 ? img.duration : 40000;
        const delayMs = Math.max(20, Math.min(500, Math.round(durationUs / 1000) * step));
        img.close?.();

        frames.push({
          id: `f-${idx}-${Date.now()}`,
          dataUrl: canvas.toDataURL('image/png'),
          delayMs,
        });
        onProgress?.(Math.round(((idx + step) / totalGifFrames) * 100));
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
      el.onerror = () => reject(new Error('Không thể tải ảnh/video nguồn để giải mã.'));
      el.src = imgUrl;
    });

    drawCoverFrame(
      ctx,
      img,
      img.naturalWidth || targetWidth,
      img.naturalHeight || targetHeight,
      targetWidth,
      targetHeight,
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
 * Encodes an array of editable ScreenFrame[] (with optional text overlay) to targetW x targetH Little-Endian RGB565 buffers.
 */
export async function encodeFramesToRgb565(
  frames: ScreenFrame[],
  overlay?: TextOverlayOptions,
  targetWidth: number = AULA_TFT_WIDTH,
  targetHeight: number = AULA_TFT_HEIGHT
): Promise<EncodedScreenPayload> {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
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

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    if (overlay && overlay.text.trim()) {
      ctx.save();
      ctx.font = `bold ${overlay.fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 3;
      const textY = Math.max(overlay.fontSize, targetHeight - overlay.fontSize - 10);
      ctx.strokeText(overlay.text, targetWidth / 2, textY);
      ctx.fillStyle = overlay.color || '#ffffff';
      ctx.fillText(overlay.text, targetWidth / 2, textY);
      ctx.restore();
    }

    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    framesRgb565.push(rgbaToRgb565(imgData.data, targetWidth, targetHeight));
    frameDelaysMs.push(frame.delayMs || 40);
  }

  const totalRawBytes = framesRgb565.reduce((acc, f) => acc + f.length, 0);
  const optimizedBytes = estimateDeltaRleBytes(framesRgb565);

  return {
    width: targetWidth,
    height: targetHeight,
    frameCount: framesRgb565.length,
    totalRawBytes,
    optimizedBytes,
    framesRgb565,
    frameDelaysMs,
  };
}
