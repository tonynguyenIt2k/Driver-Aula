import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Clock,
  Battery,
  Cpu,
  Tv,
  Plus,
  Trash2,
  Copy,
  Grid as GridIcon,
  Play,
  Edit3,
  Download,
  RefreshCw,
  Type,
  Eraser,
  Usb,
  Check,
} from 'lucide-react';
import { ScreenConfig, ScreenAnimation, ScreenFrame, Language } from '../types/device';
import { webhidService, ConnectedDeviceInfo } from '../services/webhid';
import {
  decodeSourceToFrames,
  encodeFramesToRgb565,
  estimateDeltaRleBytes,
  rgbaToRgb565,
  AULA_TFT_WIDTH,
  AULA_TFT_HEIGHT,
} from '../services/gifEncoder';

interface ScreenTabProps {
  config: ScreenConfig;
  deviceName?: string;
  screenResolution?: { width: number; height: number };
  deviceInfo?: ConnectedDeviceInfo;
  isConnected?: boolean;
  onRequestHIDConnect?: () => void;
  onChangeConfig: (newConfig: ScreenConfig) => void;
  onNotify?: (msg: string) => void;
  lang: Language;
  t: (key: string) => string;
}

const QUICK_SWATCHES = ['#7c3aed', '#facc15', '#22c55e', '#06b6d4', '#ef4444', '#ec4899'];

const DEFAULT_PRESET_URLS = [
  {
    id: 'preset-cat',
    name: 'Cat Typist',
    url: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=320&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-cyber',
    name: 'Cyber Pulse',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=320&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-space',
    name: 'Space Glow',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=320&auto=format&fit=crop&q=80',
  },
];

function createSolidFrame(
  width = AULA_TFT_WIDTH,
  height = AULA_TFT_HEIGHT,
  color = '#090d16'
): ScreenFrame {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }
  return {
    id: `f-${Date.now()}-${Math.random()}`,
    dataUrl: canvas.toDataURL('image/png'),
    delayMs: 40,
  };
}

export const ScreenTab: React.FC<ScreenTabProps> = ({
  config,
  deviceName = 'AULA S75 Pro',
  screenResolution,
  deviceInfo,
  isConnected,
  onRequestHIDConnect,
  onChangeConfig,
  onNotify,
  t,
}) => {
  const tftWidth = screenResolution?.width ?? AULA_TFT_WIDTH;
  const tftHeight = screenResolution?.height ?? AULA_TFT_HEIGHT;
  const isLandscape = tftWidth > tftHeight;

  const [animations, setAnimations] = useState<ScreenAnimation[]>([]);
  const [selectedAnimId, setSelectedAnimId] = useState<string>('');
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [playIndex, setPlayIndex] = useState<number>(0);

  const [viewMode, setViewMode] = useState<'preview' | 'editing'>('preview');
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(4);

  // Text overlay & color settings
  const [overlayText, setOverlayText] = useState<string>('');
  const [fontSize, setFontSize] = useState<number>(18);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [rgbInput, setRgbInput] = useState<{ r: number; g: number; b: number }>({
    r: 255,
    g: 255,
    b: 255,
  });

  // Upload & optimization stats
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [missingScreenPrompt, setMissingScreenPrompt] = useState<boolean>(false);
  const [payloadSizeKb, setPayloadSizeKb] = useState<number | null>(null);

  const isDrawingRef = useRef<boolean>(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize built-in presets for the active device screen aspect ratio
  useEffect(() => {
    let mounted = true;
    const initPresets = async () => {
      const loaded: ScreenAnimation[] = [];
      for (const p of DEFAULT_PRESET_URLS) {
        try {
          const frames = await decodeSourceToFrames(p.url, 0, 141, tftWidth, tftHeight);
          loaded.push({ id: p.id, name: p.name, frames });
        } catch {
          // Ignore if offline
        }
      }
      if (!mounted) return;
      if (loaded.length === 0) {
        loaded.push({
          id: 'blank-1',
          name: 'AULA Custom',
          frames: [createSolidFrame(tftWidth, tftHeight)],
        });
      }
      setAnimations(loaded);
      setSelectedAnimId(loaded[0].id);
      setSelectedFrameIndex(0);
      setPlayIndex(0);
      if (loaded[0].frames[0]) {
        onChangeConfig({ ...config, currentGifUrl: loaded[0].frames[0].dataUrl });
      }
    };
    initPresets();
    return () => {
      mounted = false;
    };
  }, [tftWidth, tftHeight]);

  const currentAnim = animations.find((a) => a.id === selectedAnimId) || animations[0];
  const currentFrames = currentAnim?.frames || [];
  const activeFrame =
    currentFrames[
      viewMode === 'preview'
        ? playIndex % Math.max(1, currentFrames.length)
        : Math.min(selectedFrameIndex, Math.max(0, currentFrames.length - 1))
    ] || currentFrames[0];

  // Animate preview playback using actual frame delays
  useEffect(() => {
    if (!currentFrames.length || viewMode !== 'preview' || currentFrames.length <= 1) {
      setPlayIndex(0);
      return;
    }
    const frame = currentFrames[playIndex % currentFrames.length];
    const delay = Math.max(20, frame?.delayMs || Math.round(1000 / Math.max(1, config.fps)));
    const timer = setTimeout(() => {
      setPlayIndex((prev) => (prev + 1) % currentFrames.length);
    }, delay);
    return () => clearTimeout(timer);
  }, [currentFrames, playIndex, viewMode, config.fps]);

  // Sync currently displayed frame to keyboard visualizer mini-screen
  useEffect(() => {
    if (activeFrame?.dataUrl && activeFrame.dataUrl !== config.currentGifUrl) {
      onChangeConfig({ ...config, currentGifUrl: activeFrame.dataUrl });
    }
  }, [activeFrame?.dataUrl]);

  // Compute exact hardware payload size
  useEffect(() => {
    if (!currentFrames.length) {
      setPayloadSizeKb(null);
      return;
    }
    const perFrameBytes = tftWidth * tftHeight * 2;
    const total = 256 + perFrameBytes * currentFrames.length;
    setPayloadSizeKb(Number((total / 1024).toFixed(1)));
  }, [currentAnim?.id, currentFrames.length, tftWidth, tftHeight]);

  const handleImportMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsDecoding(true);
    setUploadError(null);

    try {
      let mergedFrames: ScreenFrame[] = [];
      for (const file of files) {
        const decoded = await decodeSourceToFrames(
          file,
          config.orientation,
          141,
          tftWidth,
          tftHeight
        );
        mergedFrames = [...mergedFrames, ...decoded];
      }

      const newAnim: ScreenAnimation = {
        id: `anim-${Date.now()}`,
        name: files[0].name.replace(/\.[^.]+$/, ''),
        frames: mergedFrames,
      };

      setAnimations((prev) => [newAnim, ...prev]);
      setSelectedAnimId(newAnim.id);
      setSelectedFrameIndex(0);
      setPlayIndex(0);
      onNotify?.(
        `Đã nhập "${newAnim.name}" (${mergedFrames.length} khung hình ${tftWidth}×${tftHeight})`
      );
    } catch (err: any) {
      setUploadError(err?.message || 'Không thể giải mã tệp ảnh/GIF đã chọn.');
    } finally {
      setIsDecoding(false);
      e.target.value = '';
    }
  };

  const handleCreateNewAnimation = () => {
    const newAnim: ScreenAnimation = {
      id: `anim-${Date.now()}`,
      name: `Custom ${animations.length + 1}`,
      frames: [createSolidFrame(tftWidth, tftHeight, '#090d16')],
    };
    setAnimations((prev) => [newAnim, ...prev]);
    setSelectedAnimId(newAnim.id);
    setSelectedFrameIndex(0);
    setViewMode('editing');
  };

  const handleDeleteAnimation = (id: string) => {
    if (animations.length <= 1) return;
    const filtered = animations.filter((a) => a.id !== id);
    setAnimations(filtered);
    if (selectedAnimId === id && filtered[0]) {
      setSelectedAnimId(filtered[0].id);
      setSelectedFrameIndex(0);
    }
  };

  const handleDuplicateFrame = () => {
    if (!currentAnim || !currentFrames[selectedFrameIndex]) return;
    const target = currentFrames[selectedFrameIndex];
    const copy: ScreenFrame = {
      ...target,
      id: `f-${Date.now()}-${Math.random()}`,
    };
    const nextFrames = [...currentFrames];
    nextFrames.splice(selectedFrameIndex + 1, 0, copy);
    setAnimations((prev) =>
      prev.map((a) => (a.id === currentAnim.id ? { ...a, frames: nextFrames } : a))
    );
    setSelectedFrameIndex(selectedFrameIndex + 1);
  };

  const handleDeleteFrame = () => {
    if (!currentAnim || currentFrames.length <= 1) return;
    const nextFrames = currentFrames.filter((_, idx) => idx !== selectedFrameIndex);
    setAnimations((prev) =>
      prev.map((a) => (a.id === currentAnim.id ? { ...a, frames: nextFrames } : a))
    );
    setSelectedFrameIndex(Math.max(0, selectedFrameIndex - 1));
  };

  const handleUpdateFrameDelay = (idx: number, delayMs: number) => {
    if (!currentAnim) return;
    const clamped = Math.max(20, Math.min(500, delayMs || 40));
    const nextFrames = currentFrames.map((f, i) => (i === idx ? { ...f, delayMs: clamped } : f));
    setAnimations((prev) =>
      prev.map((a) => (a.id === currentAnim.id ? { ...a, frames: nextFrames } : a))
    );
  };

  const handleApplyAllFrameDelay = (fps: number) => {
    onChangeConfig({ ...config, fps });
    if (!currentAnim) return;
    const delayMs = Math.max(20, Math.round(1000 / fps));
    const nextFrames = currentFrames.map((f) => ({ ...f, delayMs }));
    setAnimations((prev) =>
      prev.map((a) => (a.id === currentAnim.id ? { ...a, frames: nextFrames } : a))
    );
  };

  // Interactive Pixel / Brush Drawing on the tftWidth x tftHeight canvas in Editing Mode
  const paintAtClientCoords = async (clientX: number, clientY: number) => {
    if (viewMode !== 'editing' || !currentAnim || !activeFrame || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * tftWidth;
    const y = ((clientY - rect.top) / rect.height) * tftHeight;

    const canvas = document.createElement('canvas');
    canvas.width = tftWidth;
    canvas.height = tftHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = activeFrame.dataUrl;
    });

    ctx.drawImage(img, 0, 0, tftWidth, tftHeight);
    ctx.fillStyle = textColor;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, brushSize / 2), 0, Math.PI * 2);
    ctx.fill();

    const updatedUrl = canvas.toDataURL('image/png');
    setAnimations((prev) =>
      prev.map((a) =>
        a.id === currentAnim.id
          ? {
              ...a,
              frames: a.frames.map((f, i) =>
                i === selectedFrameIndex ? { ...f, dataUrl: updatedUrl } : f
              ),
            }
          : a
      )
    );
  };

  // Permanently bake overlayText onto the selected frame
  const handleBakeTextToFrame = async () => {
    if (!overlayText.trim() || !currentAnim || !activeFrame) return;
    const canvas = document.createElement('canvas');
    canvas.width = tftWidth;
    canvas.height = tftHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = activeFrame.dataUrl;
    });

    ctx.drawImage(img, 0, 0, tftWidth, tftHeight);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 3;
    const textY = Math.max(fontSize, tftHeight - fontSize - 10);
    ctx.strokeText(overlayText, tftWidth / 2, textY);
    ctx.fillStyle = textColor;
    ctx.fillText(overlayText, tftWidth / 2, textY);

    const updatedUrl = canvas.toDataURL('image/png');
    setAnimations((prev) =>
      prev.map((a) =>
        a.id === currentAnim.id
          ? {
              ...a,
              frames: a.frames.map((f, i) =>
                i === selectedFrameIndex ? { ...f, dataUrl: updatedUrl } : f
              ),
            }
          : a
      )
    );
    setOverlayText('');
    onNotify?.('Đã ghi chữ vào khung hình đang chọn!');
  };

  const updateRgbColor = (r: number, g: number, b: number) => {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v) || 0));
    const nr = clamp(r);
    const ng = clamp(g);
    const nb = clamp(b);
    setRgbInput({ r: nr, g: ng, b: nb });
    const hex = `#${[nr, ng, nb].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
    setTextColor(hex);
  };

  const handleHexChange = (hex: string) => {
    setTextColor(hex);
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      setRgbInput({
        r: parseInt(clean.slice(0, 2), 16) || 0,
        g: parseInt(clean.slice(2, 4), 16) || 0,
        b: parseInt(clean.slice(4, 6), 16) || 0,
      });
    }
  };

  const handleSyncTime = async () => {
    setUploadError(null);
    const res = await webhidService.syncTime(new Date());
    if (!res.ok) {
      setUploadError(res.message);
    }
    onNotify?.(res.message);
  };

  const handleBlankScreen = async () => {
    setUploadError(null);
    setMissingScreenPrompt(false);

    if (!webhidService.isConnected()) {
      const msg = `Chưa kết nối bàn phím ${deviceName} qua cáp USB-C WebHID.`;
      setUploadError(msg);
      onNotify?.(msg);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatusMsg(`Đang xóa trắng màn hình TFT (${tftWidth}×${tftHeight})...`);

    try {
      const blankPixels = new Uint8Array(tftWidth * tftHeight * 2);
      const res = await webhidService.uploadScreenBytes([blankPixels], [1000], (pct) =>
        setUploadProgress(pct)
      );
      if (res.ok) {
        onNotify?.(`Đã xóa trắng màn hình ${deviceName}!`);
      } else {
        setUploadError(res.message);
        if (res.missingScreenInterface) setMissingScreenPrompt(true);
        onNotify?.(res.message);
      }
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
    }
  };

  const handleExportFrame = () => {
    if (!activeFrame) return;
    const a = document.createElement('a');
    a.href = activeFrame.dataUrl;
    a.download = `${currentAnim?.name || 'aula-tft'}-${tftWidth}x${tftHeight}.png`;
    a.click();
    onNotify?.(`Đã xuất khung hình ${tftWidth}×${tftHeight} px (.png)`);
  };

  const handleFlashToDevice = async () => {
    setUploadError(null);
    setMissingScreenPrompt(false);

    if (!webhidService.isConnected()) {
      const msg = `Chưa kết nối bàn phím ${deviceName} qua WebHID thật! Hãy cắm cáp USB-C và kết nối trước khi nạp ảnh/GIF.`;
      setUploadError(msg);
      onNotify?.(msg);
      return;
    }

    if (currentFrames.length === 0) {
      setUploadError('Chưa có khung hình nào để nạp.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatusMsg(
      `Đang mã hóa ${currentFrames.length} khung RGB565 Little-Endian (${tftWidth}×${tftHeight})...`
    );

    try {
      const encoded = await encodeFramesToRgb565(
        currentFrames,
        overlayText.trim()
          ? { text: overlayText, fontSize, color: textColor }
          : undefined,
        tftWidth,
        tftHeight
      );

      setUploadStatusMsg(
        `Đang nạp ${encoded.frameCount} khung (${tftWidth}×${tftHeight}, ${(encoded.optimizedBytes / 1024).toFixed(1)} KB) qua cổng Screen 4096B...`
      );

      const res = await webhidService.uploadScreenBytes(
        encoded.framesRgb565,
        encoded.frameDelaysMs,
        (pct) => setUploadProgress(pct)
      );

      if (res.ok) {
        setUploadStatusMsg(res.message);
        onNotify?.(res.message);
      } else {
        setUploadError(res.message);
        if (res.missingScreenInterface) setMissingScreenPrompt(true);
        onNotify?.(res.message);
      }
    } catch (err: any) {
      const msg = err?.message || 'Lỗi khi mã hóa và truyền dữ liệu ảnh xuống màn hình.';
      setUploadError(msg);
      onNotify?.(msg);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1500);
    }
  };

  const now = new Date();
  const liveTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const liveDateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Header Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Tv className="w-5 h-5 text-indigo-400" />
            <span>{t('screenTitle')}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Chuẩn {deviceName} ({tftWidth}×{tftHeight} {isLandscape ? 'màn ngang' : 'màn dọc'} RGB565 Little-Endian • tối đa 141 frames • truyền 4096B Output qua USB-C)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncTime}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold text-xs transition cursor-pointer"
            title={`Đồng bộ ngày giờ máy tính xuống đồng hồ TFT trên ${deviceName}`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Time Sync</span>
          </button>

          <button
            onClick={handleBlankScreen}
            disabled={isUploading || isDecoding}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
            title="Xóa trắng màn hình về màu đen"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Blank Screen</span>
          </button>

          <button
            onClick={handleExportFrame}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={handleFlashToDevice}
            disabled={isUploading || isDecoding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white font-extrabold text-xs transition shadow-lg shadow-indigo-500/25 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? `${uploadProgress}%` : t('uploadToDevice')}</span>
          </button>
        </div>
      </div>

      {/* Diagnostic banner if USB connected without Screen 4096B interface */}
      {isConnected &&
        deviceInfo?.protocolFamily === 'aula04' &&
        deviceInfo.connectionType === 'wired' &&
        !deviceInfo.hasScreenInterface && (
          <div className="bg-amber-950/50 border border-amber-700/70 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Usb className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Đã kết nối cổng cấu hình chính của <strong>{deviceInfo.productName}</strong>, nhưng chưa có quyền truy cập{' '}
                <strong>cổng Screen (4096B Output)</strong>. Hãy bấm nút bên phải và chọn cả mục {deviceName} còn lại trong danh sách WebHID.
              </span>
            </div>
            {onRequestHIDConnect && (
              <button
                onClick={onRequestHIDConnect}
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold transition cursor-pointer"
              >
                Cấp quyền cổng Screen
              </button>
            )}
          </div>
        )}

      {uploadError && (
        <div className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-200 font-medium">
          <span>{uploadError}</span>
          {missingScreenPrompt && onRequestHIDConnect && (
            <button
              onClick={onRequestHIDConnect}
              className="px-3 py-1.5 rounded-lg bg-rose-400 hover:bg-rose-300 text-slate-950 font-bold cursor-pointer"
            >
              Chọn lại đủ cổng {deviceName}
            </button>
          )}
        </div>
      )}

      {isUploading && (
        <div className="bg-slate-900 border border-indigo-800/80 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
            <span>{uploadStatusMsg}</span>
            <span className="font-mono">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 transition-all duration-75"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Official S75 Pro 3-Column Screen Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Column 1: LED Screen Preview Library (Animations List) */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              LED screen preview
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              {animations.length} mục
            </span>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
            {animations.map((anim) => {
              const isSelected = anim.id === currentAnim?.id;
              const thumb = anim.frames[0]?.dataUrl;
              return (
                <div
                  key={anim.id}
                  onClick={() => {
                    setSelectedAnimId(anim.id);
                    setSelectedFrameIndex(0);
                    setPlayIndex(0);
                  }}
                  className={`relative rounded-xl border overflow-hidden cursor-pointer transition bg-slate-950 ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="h-24 w-full flex items-center justify-center bg-black p-1.5">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={anim.name}
                        className={`object-cover rounded border border-slate-800 ${
                          isLandscape ? 'w-32 h-[72px]' : 'h-full w-12'
                        }`}
                      />
                    ) : null}
                  </div>
                  <div
                    className={`px-2.5 py-1 text-[11px] font-bold flex items-center justify-between ${
                      isSelected ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="truncate">{anim.name}</span>
                    <span className="font-mono flex-shrink-0">Frames: {anim.frames.length}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* New / Import / Delete buttons matching official driver */}
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800">
            <button
              onClick={handleCreateNewAnimation}
              className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
            <label className="py-1.5 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{isDecoding ? '...' : 'Import'}</span>
              <input
                type="file"
                multiple
                accept=".gif,.png,.jpg,.jpeg,.webp"
                onChange={handleImportMedia}
                className="hidden"
              />
            </label>
            <button
              onClick={() => currentAnim && handleDeleteAnimation(currentAnim.id)}
              disabled={animations.length <= 1}
              className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Column 2: Center Portrait 135x240 Canvas + Timeline Strip */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
          {/* Top toolbar: Grid, Brush size (when Editing), Editing / Preview */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300">Image preview:</span>
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="accent-cyan-400 rounded"
                />
                <GridIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Grid</span>
              </label>
              {viewMode === 'editing' && (
                <div className="flex items-center gap-1 text-[11px] text-amber-300 font-mono">
                  <span>Cọ:</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Math.max(1, Number(e.target.value) || 4))}
                    className="w-10 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('editing')}
                className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  viewMode === 'editing'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="w-3 h-3" />
                <span>Editing</span>
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Play className="w-3 h-3" />
                <span>Preview</span>
              </button>
            </div>
          </div>

          {/* Portrait 135x240 Screen Frame (supports click+drag pixel painting when in Editing mode) */}
          <div className="flex-1 flex flex-col items-center justify-center bg-black/70 rounded-xl p-4 border border-slate-800">
            <div className="relative p-2.5 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-slate-700 shadow-2xl">
              <div
                ref={previewContainerRef}
                onMouseDown={(e) => {
                  if (viewMode === 'editing') {
                    isDrawingRef.current = true;
                    paintAtClientCoords(e.clientX, e.clientY);
                  }
                }}
                onMouseMove={(e) => {
                  if (isDrawingRef.current && viewMode === 'editing') {
                    paintAtClientCoords(e.clientX, e.clientY);
                  }
                }}
                onMouseUp={() => {
                  isDrawingRef.current = false;
                }}
                onMouseLeave={() => {
                  isDrawingRef.current = false;
                }}
                className={`relative rounded-lg bg-black border border-slate-700 overflow-hidden flex items-center justify-center select-none ${
                  isLandscape ? 'w-[312px] h-[175px]' : 'w-[162px] h-[288px]'
                } ${viewMode === 'editing' ? 'cursor-crosshair' : ''}`}
                style={{
                  filter: `brightness(${config.brightness / 100})`,
                  transform: `rotate(${config.orientation}deg)`,
                }}
                title={viewMode === 'editing' ? 'Bấm & kéo chuột trực tiếp để vẽ lên khung hình' : ''}
              >
                {activeFrame ? (
                  <img
                    src={activeFrame.dataUrl}
                    alt={`TFT ${tftWidth}x${tftHeight}`}
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <Cpu className="w-8 h-8 text-cyan-400 animate-pulse" />
                )}

                {showGrid && (
                  <div
                    className="absolute inset-0 pointer-events-none opacity-35"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.25) 1px, transparent 1px)',
                      backgroundSize: '12px 12px',
                    }}
                  />
                )}

                {/* Custom Text Overlay Preview */}
                {overlayText.trim() && (
                  <div
                    className="absolute inset-x-1 bottom-4 text-center font-bold leading-tight pointer-events-none break-words"
                    style={{
                      fontSize: `${Math.round(fontSize * 1.2)}px`,
                      color: textColor,
                      textShadow: '0 1px 4px rgba(0,0,0,0.95)',
                    }}
                  >
                    {overlayText}
                  </div>
                )}

                {/* HUD Overlays */}
                <div className="absolute inset-0 flex flex-col items-center justify-between p-2 pointer-events-none">
                  {config.showTimeOverlay ? (
                    <div
                      className={`w-full flex ${
                        isLandscape
                          ? 'flex-row items-center justify-between px-2 py-1'
                          : 'flex-col items-center px-1.5 py-1'
                      } font-mono font-bold text-white bg-black/60 rounded`}
                    >
                      <div className="flex items-center gap-1 text-[11px] text-cyan-300">
                        <Clock className="w-3 h-3" />
                        <span>{liveTimeStr}</span>
                      </div>
                      <span className="text-[8px] text-slate-300">{liveDateStr}</span>
                    </div>
                  ) : (
                    <div />
                  )}

                  <div
                    className={`w-full flex ${
                      isLandscape
                        ? 'flex-row items-center justify-between gap-1'
                        : 'flex-col items-center gap-1'
                    }`}
                  >
                    {config.showBatteryOverlay && (
                      <div className="text-[9px] font-mono font-bold text-emerald-400 bg-black/65 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Battery className="w-3 h-3" />
                        <span>HUD PIN</span>
                      </div>
                    )}
                    {config.showTempOverlay && (
                      <div className="text-[9px] font-mono font-bold text-amber-300 bg-black/65 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        <span>WIN • USB</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-3 text-[11px] font-mono text-slate-400">
              <span>{tftWidth} × {tftHeight} px</span>
              <span>•</span>
              <span className="text-cyan-400 font-bold">{currentFrames.length} frames</span>
              {payloadSizeKb !== null && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400">{payloadSizeKb} KB RGB565</span>
                </>
              )}
            </div>
          </div>

          {/* Frame Timeline Strip */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
              {currentFrames.map((frame, idx) => {
                const activeIdx =
                  viewMode === 'preview'
                    ? playIndex % Math.max(1, currentFrames.length)
                    : selectedFrameIndex;
                const isSelected = idx === activeIdx;
                return (
                  <div
                    key={frame.id}
                    onClick={() => {
                      setViewMode('editing');
                      setSelectedFrameIndex(idx);
                    }}
                    className={`relative flex-shrink-0 rounded-lg border overflow-hidden cursor-pointer bg-black transition ${
                      isLandscape ? 'w-20 h-12' : 'w-12 h-20'
                    } ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-500/40'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <img
                      src={frame.dataUrl}
                      alt={`Frame ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute bottom-0 right-0 px-1 text-[9px] font-mono font-bold rounded-tl ${
                        isSelected ? 'bg-amber-600 text-white' : 'bg-black/80 text-slate-300'
                      }`}
                    >
                      {frame.delayMs}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bottom Text Overlay & Frame Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 flex-1 min-w-[140px] bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                <Type className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleBakeTextToFrame();
                  }}
                  placeholder="Nhập chữ + Enter..."
                  className="w-full bg-transparent text-xs text-slate-200 focus:outline-none"
                />
                {overlayText.trim() && (
                  <button
                    onClick={handleBakeTextToFrame}
                    title="Ghi chữ lên khung hình"
                    className="p-0.5 rounded bg-cyan-500 text-slate-950 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">Size:</span>
                <input
                  type="number"
                  min={8}
                  max={36}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value) || 18)}
                  className="w-12 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs font-mono text-slate-200"
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">Delay:</span>
                <input
                  type="number"
                  min={20}
                  max={500}
                  step={10}
                  value={currentFrames[selectedFrameIndex]?.delayMs || 40}
                  onChange={(e) =>
                    handleUpdateFrameDelay(selectedFrameIndex, Number(e.target.value))
                  }
                  className="w-14 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs font-mono text-cyan-400"
                />
              </div>

              <button
                onClick={handleDuplicateFrame}
                title="Nhân bản khung hình"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDeleteFrame}
                disabled={currentFrames.length <= 1}
                title="Xóa khung hình đang chọn"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Color Settings + FPS / Brightness / Overlays */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Color Settings Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Color settings (Màu chữ & Cọ vẽ)
            </span>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={textColor}
                onChange={(e) => handleHexChange(e.target.value)}
                className="w-14 h-14 rounded-xl cursor-pointer bg-transparent border border-slate-700"
              />
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {(['r', 'g', 'b'] as const).map((ch) => (
                  <div key={ch} className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400">{ch}</span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={rgbInput[ch]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        updateRgbColor(
                          ch === 'r' ? v : rgbInput.r,
                          ch === 'g' ? v : rgbInput.g,
                          ch === 'b' ? v : rgbInput.b
                        );
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-100"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {QUICK_SWATCHES.map((sw) => (
                <button
                  key={sw}
                  onClick={() => handleHexChange(sw)}
                  style={{ backgroundColor: sw }}
                  className={`w-7 h-7 rounded-lg transition hover:scale-110 cursor-pointer ${
                    textColor.toLowerCase() === sw.toLowerCase()
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                      : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Display Parameters & HUD Overlays */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>{t('screenFps')}</span>
                <span className="font-mono text-cyan-400">
                  {config.fps} FPS ({Math.round(1000 / config.fps)}ms)
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={config.fps}
                onChange={(e) => handleApplyAllFrameDelay(Number(e.target.value))}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>{t('screenBrightness')}</span>
                <span className="font-mono text-cyan-400">{config.brightness}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={config.brightness}
                onChange={(e) =>
                  onChangeConfig({ ...config, brightness: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300">{t('widgetsOverlay')}:</span>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() =>
                    onChangeConfig({ ...config, showTimeOverlay: !config.showTimeOverlay })
                  }
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                    config.showTimeOverlay
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                      : 'bg-slate-950/60 text-slate-400 border border-slate-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t('widgetTime')}</span>
                </button>

                <button
                  onClick={() =>
                    onChangeConfig({
                      ...config,
                      showBatteryOverlay: !config.showBatteryOverlay,
                    })
                  }
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                    config.showBatteryOverlay
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-slate-950/60 text-slate-400 border border-slate-800'
                  }`}
                >
                  <Battery className="w-3.5 h-3.5" />
                  <span>{t('widgetBattery')}</span>
                </button>

                <button
                  onClick={() =>
                    onChangeConfig({ ...config, showTempOverlay: !config.showTempOverlay })
                  }
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                    config.showTempOverlay
                      ? 'bg-amber-950 text-amber-300 border border-amber-700'
                      : 'bg-slate-950/60 text-slate-400 border border-slate-800'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{t('widgetTemp')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
