import React, { useState, useEffect, useRef } from 'react';
import { Battery, Maximize2, Minimize2 } from 'lucide-react';
import { DeviceModel, KeyDefinition, LightingConfig, KeyRemapAction, ScreenConfig } from '../types/device';
import { soundEngine } from '../services/soundEngine';

interface KeyboardVisualizerProps {
  device: DeviceModel;
  lighting: LightingConfig;
  screenConfig?: ScreenConfig;
  activeLayer: number;
  keymaps: Record<number, Record<string, KeyRemapAction>>;
  selectedKeyId: string | null;
  onSelectKey: (key: KeyDefinition) => void;
  isCustomMatrixActive?: boolean;
  brushColor?: string;
  onPaintKey?: (keyId: string, color: string) => void;
  externalActiveKeys?: Set<string>;
}

const BASE_UNIT = 50; // px per 1u key width (75% / TKL)
const BASE_ROW_H = 50; // px per 1u row height
const BASE_GAP = 5; // px gap between keycaps
const BASE_FROW_GAP = 7; // subtle physical separation between F-row and main cluster

export const KeyboardVisualizer: React.FC<KeyboardVisualizerProps> = ({
  device,
  lighting,
  screenConfig,
  activeLayer,
  keymaps,
  selectedKeyId,
  onSelectKey,
  isCustomMatrixActive = false,
  brushColor = '#00f0ff',
  onPaintKey,
  externalActiveKeys = new Set(),
}) => {
  const [pressedKeyIds, setPressedKeyIds] = useState<Set<string>>(new Set());
  const [knobRotation, setKnobRotation] = useState<number>(28);
  const [isKnobMuted, setIsKnobMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('10:01');
  const [currentDate, setCurrentDate] = useState<string>('11-13');
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [zoomMode, setZoomMode] = useState<'fit' | 'actual'>('fit');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const chassisRef = useRef<HTMLDivElement | null>(null);
  const [chassisSize, setChassisSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const updateWidth = () => setContainerWidth(el.clientWidth);
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      );
      setCurrentDate(
        `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyClick = (key: KeyDefinition) => {
    if (key.isKnob) {
      handleKnobClick();
      return;
    }
    if (key.isScreen) {
      return;
    }

    soundEngine.playKeySound(false);

    if (isCustomMatrixActive && onPaintKey) {
      onPaintKey(key.id, brushColor);
      return;
    }

    setPressedKeyIds((prev) => new Set([...prev, key.id]));
    setTimeout(() => {
      setPressedKeyIds((prev) => {
        const next = new Set(prev);
        next.delete(key.id);
        return next;
      });
      soundEngine.playKeySound(true);
    }, 150);

    onSelectKey(key);
  };

  const handleKnobClick = () => {
    soundEngine.playKeySound(false);
    setIsKnobMuted((prev) => !prev);
    setKnobRotation((prev) => (prev + 30) % 360);
  };

  const handleKnobScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    soundEngine.playKeySound(false);
    const delta = e.deltaY < 0 ? 18 : -18;
    setKnobRotation((prev) => (prev + delta + 360) % 360);
  };

  const getKeyLedColor = (key: KeyDefinition, isPressed: boolean) => {
    if (lighting.mode === 'off') return 'transparent';
    if (lighting.mode === 'custom_matrix') {
      return lighting.customKeyColors[key.id] || 'transparent';
    }
    if (isPressed || externalActiveKeys.has(key.code)) {
      return '#22c55e';
    }
    if (lighting.mode === 'static' || lighting.mode === 'breathing') {
      return lighting.primaryColor;
    }
    if (lighting.mode === 'rainbow_wave' || lighting.mode === 'fountain' || lighting.mode === 'revolving') {
      const hue = (key.col * 18 + key.row * 28) % 360;
      return `hsl(${hue}, 92%, 58%)`;
    }
    if (lighting.mode === 'starlight' || lighting.mode === 'currents') {
      const hue = (key.col * 24 + key.row * 47 + 160) % 360;
      return `hsl(${hue}, 88%, 60%)`;
    }
    if (lighting.mode === 'audio') {
      const hue = (key.col * 16 + (5 - key.row) * 35) % 360;
      return `hsl(${hue}, 92%, 56%)`;
    }
    if (lighting.mode === 'neon') {
      const hue = (key.col * 14 + 180) % 360;
      return `hsl(${hue}, 90%, 56%)`;
    }
    return lighting.primaryColor;
  };

  const keys = device.keys || [];
  const maxCol = keys.reduce((m, k) => Math.max(m, k.col + k.width), 16.25);
  const maxRow = keys.reduce((m, k) => Math.max(m, k.row + (k.height || 1)), 6);

  // Fit full-size 23u layout comfortably alongside sidebar
  const isFullSize = maxCol > 19;
  const UNIT = isFullSize ? 41 : BASE_UNIT;
  const ROW_H = isFullSize ? 44 : BASE_ROW_H;
  const GAP = isFullSize ? 4 : BASE_GAP;
  const FROW_GAP = isFullSize ? 6 : BASE_FROW_GAP;

  const matrixWidth = Math.round(maxCol * UNIT) - GAP;
  const matrixHeight = Math.round(maxRow * ROW_H) + FROW_GAP - GAP;

  const isS75Pro = device.id === 'aula-s75-pro';
  const isF108Pro = device.id === 'aula-f108-pro';

  useEffect(() => {
    const el = chassisRef.current;
    if (!el) return;
    const measure = () => {
      setChassisSize({ w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [matrixWidth, matrixHeight, isS75Pro, isF108Pro]);

  const rawChassisWidth = chassisSize.w || matrixWidth + 46;
  const rawChassisHeight = chassisSize.h || matrixHeight + 56;
  const needsAutoScale = containerWidth > 0 && rawChassisWidth > containerWidth;
  const fitScale = needsAutoScale ? Math.max(0.32, containerWidth / rawChassisWidth) : 1;
  const activeScale = zoomMode === 'fit' ? fitScale : 1;
  const isScaledDown = activeScale < 0.99;

  const currentLayerKeymaps = keymaps[activeLayer] || {};
  const rgbAlpha = lighting.mode === 'off' ? 0 : Math.max(0.18, lighting.brightness / 100);

  const getKeycapColors = (colorGroup?: KeyDefinition['colorGroup']) => {
    if (isS75Pro) {
      if (colorGroup === 'accent') {
        return {
          skirt: 'linear-gradient(180deg, #1b2034 0%, #121625 100%)',
          face: 'linear-gradient(180deg, #2d3454 0%, #222842 100%)',
          border: '#384166',
          faceBorder: 'rgba(255,255,255,0.14)',
          text: '#f1f5f9',
          subText: '#94a3b8',
          legendAccent: '#38bdf8',
        };
      }
      if (colorGroup === 'modifier') {
        return {
          skirt: 'linear-gradient(180deg, #b8cce2 0%, #9ab3cf 100%)',
          face: 'linear-gradient(180deg, #e5effa 0%, #d4e4f7 100%)',
          border: '#a5bdd8',
          faceBorder: 'rgba(255,255,255,0.8)',
          text: '#1e293b',
          subText: '#475569',
          legendAccent: '#0284c7',
        };
      }
      return {
        skirt: 'linear-gradient(180deg, #d7dde8 0%, #bec7d6 100%)',
        face: 'linear-gradient(180deg, #ffffff 0%, #f1f4f9 100%)',
        border: '#c7d0de',
        faceBorder: 'rgba(255,255,255,0.95)',
        text: '#0f172a',
        subText: '#64748b',
        legendAccent: '#0284c7',
      };
    }

    if (isF108Pro) {
      // Graphite / Titanium Grey / Charcoal PBT theme matching AULA F108 Pro
      if (colorGroup === 'accent') {
        return {
          skirt: 'linear-gradient(180deg, #7c838f 0%, #636a76 100%)',
          face: 'linear-gradient(180deg, #b2b8c2 0%, #99a0ac 100%)',
          border: '#8f96a3',
          faceBorder: 'rgba(255,255,255,0.55)',
          text: '#111827',
          subText: '#374151',
          legendAccent: '#0369a1',
        };
      }
      if (colorGroup === 'modifier') {
        return {
          skirt: 'linear-gradient(180deg, #1b2028 0%, #12161d 100%)',
          face: 'linear-gradient(180deg, #323945 0%, #262b35 100%)',
          border: '#3b4351',
          faceBorder: 'rgba(255,255,255,0.1)',
          text: '#e5e7eb',
          subText: '#9ca3af',
          legendAccent: '#38bdf8',
        };
      }
      return {
        skirt: 'linear-gradient(180deg, #3c4350 0%, #2c323d 100%)',
        face: 'linear-gradient(180deg, #5a6372 0%, #4b5362 100%)',
        border: '#525b6b',
        faceBorder: 'rgba(255,255,255,0.16)',
        text: '#f8fafc',
        subText: '#cbd5e1',
        legendAccent: '#38bdf8',
      };
    }

    // Dark anodized PBT styling for F75 / F87 Pro
    if (colorGroup === 'accent') {
      return {
        skirt: 'linear-gradient(180deg, #0e4a5e 0%, #093242 100%)',
        face: 'linear-gradient(180deg, #15627c 0%, #0f4c61 100%)',
        border: '#1d7a98',
        faceBorder: 'rgba(255,255,255,0.2)',
        text: '#ecfeff',
        subText: '#a5f3fc',
        legendAccent: '#67e8f9',
      };
    }
    if (colorGroup === 'modifier') {
      return {
        skirt: 'linear-gradient(180deg, #161c2b 0%, #0f1420 100%)',
        face: 'linear-gradient(180deg, #242d42 0%, #1b2234 100%)',
        border: '#2d3852',
        faceBorder: 'rgba(255,255,255,0.09)',
        text: '#e2e8f0',
        subText: '#94a3b8',
        legendAccent: '#38bdf8',
      };
    }
    return {
      skirt: 'linear-gradient(180deg, #1f273b 0%, #151b2a 100%)',
      face: 'linear-gradient(180deg, #2e3954 0%, #232c42 100%)',
      border: '#384563',
      faceBorder: 'rgba(255,255,255,0.11)',
      text: '#f8fafc',
      subText: '#94a3b8',
      legendAccent: '#38bdf8',
    };
  };

  return (
    <div ref={wrapperRef} className="w-full flex flex-col items-center select-none gap-2.5">
      {/* Compact Fit / Zoom 1:1 Control when container is narrower than physical keyboard matrix */}
      {needsAutoScale && (
        <div className="w-full flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-400 truncate">
            {zoomMode === 'fit'
              ? `Thu gọn ${Math.round(fitScale * 100)}% vừa màn hình`
              : 'Phóng to 1:1 (kéo ngang để chọn phím)'}
          </span>
          <button
            type="button"
            onClick={() => setZoomMode((m) => (m === 'fit' ? 'actual' : 'fit'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-semibold shrink-0 cursor-pointer"
          >
            {zoomMode === 'fit' ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Phóng to 1:1</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Vừa màn hình</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Responsive Scaling Stage */}
      <div
        className={`w-full flex ${isScaledDown ? 'justify-center overflow-hidden' : 'overflow-x-auto pb-1 justify-start xl:justify-center'}`}
        style={
          isScaledDown
            ? { height: `${Math.ceil(rawChassisHeight * activeScale) + 6}px` }
            : undefined
        }
      >
        <div
          style={
            isScaledDown
              ? {
                  width: `${Math.ceil(rawChassisWidth * activeScale)}px`,
                  height: `${Math.ceil(rawChassisHeight * activeScale)}px`,
                  position: 'relative',
                }
              : undefined
          }
        >
          {/* Outer CNC Keyboard Chassis */}
          <div
            ref={chassisRef}
            className="relative w-fit rounded-[20px] p-3 sm:p-4 transition-shadow"
            style={{
              ...(isScaledDown
                ? {
                    transform: `scale(${activeScale})`,
                    transformOrigin: 'top left',
                  }
                : {}),
              ...(isS75Pro
                ? {
                    background: 'linear-gradient(180deg, #f3f5f9 0%, #e4e8f0 55%, #cfd5e2 100%)',
                    border: '1px solid rgba(255,255,255,0.85)',
                    boxShadow:
                      '0 28px 65px -16px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(15, 23, 42, 0.25), inset 0 2px 0 rgba(255, 255, 255, 0.95), inset 0 -4px 0 rgba(148, 163, 184, 0.55)',
                  }
                : isF108Pro
                ? {
                    background: 'linear-gradient(180deg, #2b313c 0%, #191d25 60%, #11141a 100%)',
                    border: '1px solid rgba(156, 163, 175, 0.22)',
                    boxShadow:
                      '0 28px 65px -16px rgba(0, 0, 0, 0.92), inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 -4px 0 rgba(2, 6, 23, 0.85)',
                  }
                : {
                    background: 'linear-gradient(180deg, #1f2738 0%, #141a27 65%, #0d121c 100%)',
                    border: '1px solid rgba(148, 163, 184, 0.16)',
                    boxShadow:
                      '0 28px 65px -16px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -4px 0 rgba(2, 6, 23, 0.8)',
                  }),
            }}
          >
        {/* Subtle laser-etched side tri-mode indicator on S75 Pro top-right bezel */}
        {isS75Pro && (
          <div className="flex items-center justify-end pr-2 pb-1.5 text-[8px] font-mono font-bold tracking-widest text-slate-500/80">
            BT · USB · 2.4G
          </div>
        )}

        {/* Inner Matte Switch Plate */}
        <div
          className="relative w-fit rounded-[14px] p-2.5"
          style={{
            background: '#0b0f18',
            border: isS75Pro ? '1px solid rgba(100, 116, 139, 0.35)' : '1px solid rgba(30, 41, 59, 0.9)',
            boxShadow: 'inset 0 4px 14px rgba(0, 0, 0, 0.9), 0 1px 0 rgba(255, 255, 255, 0.25)',
          }}
        >
          <div
            className="relative"
            style={{
              width: `${matrixWidth}px`,
              height: `${matrixHeight}px`,
            }}
          >
            {/* Vertical Acrylic RGB Diffuser Bar on S75 Pro */}
            {isS75Pro && (
              <div
                className="absolute rounded-full pointer-events-none transition-all duration-300"
                style={{
                  left: `${15.05 * UNIT - 1}px`,
                  top: `${ROW_H + FROW_GAP + 6}px`,
                  width: '3px',
                  height: `${ROW_H * 2.55}px`,
                  background:
                    lighting.mode === 'off'
                      ? '#1e293b'
                      : `linear-gradient(180deg, #00f0ff, #22c55e, #f59e0b, ${lighting.primaryColor})`,
                  boxShadow:
                    lighting.mode === 'off'
                      ? 'none'
                      : `0 0 8px rgba(0, 240, 255, ${0.7 * rgbAlpha})`,
                  opacity: lighting.mode === 'off' ? 0.5 : rgbAlpha,
                }}
              />
            )}

            {/* F108 Pro Lock Status LEDs (between Esc and F1) + AULA Light Bar (above Arrows) */}
            {isF108Pro && (
              <>
                <div
                  className="absolute flex flex-col items-center justify-center gap-1.5 pointer-events-none"
                  style={{
                    left: `${1.12 * UNIT}px`,
                    top: '4px',
                    width: `${0.48 * UNIT}px`,
                    height: `${ROW_H - GAP - 8}px`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.85)]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                </div>

                <div
                  className="absolute flex items-center justify-between px-1.5 pointer-events-none"
                  style={{
                    left: `${15.5 * UNIT}px`,
                    top: `${3 * ROW_H + FROW_GAP + Math.round((ROW_H - GAP) / 2) - 8}px`,
                    width: `${3 * UNIT - GAP}px`,
                    height: '16px',
                  }}
                >
                  <span className="text-[9px] font-black tracking-[0.22em] text-slate-300/90 font-mono">
                    AULA
                  </span>
                  <div
                    className="h-[3px] flex-1 ml-2.5 rounded-full transition-all duration-300"
                    style={{
                      background:
                        lighting.mode === 'off'
                          ? '#1e293b'
                          : `linear-gradient(90deg, #00f0ff, #22c55e, #f59e0b, ${lighting.primaryColor})`,
                      boxShadow:
                        lighting.mode === 'off'
                          ? 'none'
                          : `0 0 8px rgba(0, 240, 255, ${0.75 * rgbAlpha})`,
                      opacity: lighting.mode === 'off' ? 0.5 : rgbAlpha,
                    }}
                  />
                </div>
              </>
            )}

            {keys.map((key) => {
              const isSelected = selectedKeyId === key.id;
              const isPressed = pressedKeyIds.has(key.id) || externalActiveKeys.has(key.code);
              const remapAction = currentLayerKeymaps[key.id];
              const ledColor = getKeyLedColor(key, isPressed);

              const leftPx = Math.round(key.col * UNIT);
              const topPx = Math.round(key.row * ROW_H + (key.row >= 1 ? FROW_GAP : 0));
              const widthPx = Math.round(key.width * UNIT - GAP);
              const heightPx = Math.round((key.height || 1) * ROW_H - GAP);

              // Built-in TFT Screen (Vertical 135x240 on S75 Pro OR Horizontal 240x135 on F108 Pro)
              if (key.isScreen) {
                const isHorizontalScreen = key.width > (key.height || 1);
                return (
                  <div
                    key={key.id}
                    style={{
                      left: `${leftPx}px`,
                      top: `${topPx}px`,
                      width: `${widthPx}px`,
                      height: `${heightPx}px`,
                      background: '#050811',
                      boxShadow:
                        'inset 0 2px 8px rgba(0,0,0,0.95), 0 0 0 1px rgba(51, 65, 85, 0.7)',
                    }}
                    className="absolute rounded-[8px] overflow-hidden border-[3px] border-[#1a2234] flex flex-col justify-between cursor-default"
                    title={
                      isHorizontalScreen
                        ? 'Màn hình ngang TFT AULA F108 Pro (240 × 135 px)'
                        : 'Màn hình dọc TFT AULA S75 Pro (135 × 240 px)'
                    }
                  >
                    {screenConfig?.currentGifUrl ? (
                      <img
                        src={screenConfig.currentGifUrl}
                        alt="TFT Screen"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover opacity-80"
                      />
                    ) : null}

                    {isHorizontalScreen ? (
                      <div className="relative z-10 w-full h-full flex flex-col justify-between py-1 px-2 bg-gradient-to-r from-black/80 via-black/45 to-black/80 text-white font-mono">
                        <div className="flex items-center justify-between leading-none">
                          {screenConfig?.showTimeOverlay !== false ? (
                            <span className="text-[7px] tabular-nums text-slate-300">
                              {currentDate}
                            </span>
                          ) : (
                            <span />
                          )}
                          {screenConfig?.showBatteryOverlay !== false && (
                            <div className="flex items-center gap-0.5 text-[7px] text-emerald-300 font-bold">
                              <Battery className="w-2.5 h-2.5" />
                              <span className="tabular-nums">98%</span>
                            </div>
                          )}
                        </div>

                        {screenConfig?.showTimeOverlay !== false && (
                          <div className="flex items-center justify-center leading-none">
                            <span className="text-[11px] font-bold tracking-tight tabular-nums text-cyan-200 drop-shadow">
                              {currentTime}
                            </span>
                          </div>
                        )}

                        <div className="w-full flex items-center justify-between text-[6px] font-bold">
                          <span className="bg-amber-400/90 text-slate-950 rounded-sm px-1">WIN</span>
                          <span className="bg-cyan-400/90 text-slate-950 rounded-sm px-1">USB</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-1.5 px-0.5 bg-gradient-to-b from-black/75 via-black/35 to-black/80 text-white font-mono">
                        {screenConfig?.showTimeOverlay !== false ? (
                          <div className="flex flex-col items-center leading-none">
                            <span className="text-[10px] font-bold tracking-tight tabular-nums text-cyan-200">
                              {currentTime}
                            </span>
                            <span className="text-[7px] tabular-nums text-slate-300 mt-0.5">
                              {currentDate}
                            </span>
                          </div>
                        ) : (
                          <div />
                        )}

                        {screenConfig?.showBatteryOverlay !== false && (
                          <div className="flex items-center gap-0.5 text-[7px] text-emerald-300 font-bold bg-black/65 px-1 py-0.5 rounded">
                            <Battery className="w-2.5 h-2.5" />
                            <span className="tabular-nums">98%</span>
                          </div>
                        )}

                        <div className="w-full flex items-center justify-center gap-0.5 text-[6px] font-bold">
                          <span className="bg-amber-400/90 text-slate-950 rounded-sm px-1">W</span>
                          <span className="bg-cyan-400/90 text-slate-950 rounded-sm px-1">USB</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // CNC Rotary Volume Knob (Top-right on S75 Pro / F108 Pro / F75)
              if (key.isKnob) {
                return (
                  <div
                    key={key.id}
                    onWheel={handleKnobScroll}
                    onClick={handleKnobClick}
                    style={{
                      left: `${leftPx}px`,
                      top: `${topPx}px`,
                      width: `${widthPx}px`,
                      height: `${heightPx}px`,
                      background: isS75Pro
                        ? 'conic-gradient(from 0deg, #cfd6e2, #f8fafc, #b8c2d1, #eef2f7, #cfd6e2)'
                        : 'conic-gradient(from 0deg, #334155, #64748b, #1e293b, #475569, #334155)',
                      boxShadow:
                        '0 4px 10px rgba(0,0,0,0.75), inset 0 1px 1px rgba(255,255,255,0.8)',
                    }}
                    className="absolute rounded-full p-[4px] cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95"
                    title="Núm xoay CNC AULA: Cuộn để tăng/giảm âm lượng, bấm để Mute"
                  >
                    <div
                      className="w-full h-full rounded-full relative flex items-center justify-center"
                      style={{
                        background: isS75Pro
                          ? 'radial-gradient(circle at 32% 30%, #ffffff 0%, #dde3ec 65%, #b9c3d3 100%)'
                          : 'radial-gradient(circle at 32% 30%, #475569 0%, #1e293b 70%, #0f172a 100%)',
                        border: isS75Pro ? '1px solid #94a3b8' : '1px solid #475569',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.25)',
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-full flex items-start justify-center transition-transform duration-100 pointer-events-none"
                        style={{ transform: `rotate(${knobRotation}deg)` }}
                      >
                        <div
                          className={`w-[3px] h-2 rounded-full mt-1 ${
                            isKnobMuted ? 'bg-rose-500' : 'bg-cyan-500'
                          }`}
                        />
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border ${
                          isS75Pro
                            ? 'border-slate-300/80 bg-slate-100/70'
                            : 'border-slate-600/80 bg-slate-800/70'
                        }`}
                      />
                    </div>
                  </div>
                );
              }

              // Sculpted 3D PBT Keycap
              const palette = getKeycapColors(key.colorGroup);
              const isCompactLegend = key.label.length >= 4 && key.width <= 1.25;

              return (
                <div
                  key={key.id}
                  onClick={() => handleKeyClick(key)}
                  title={
                    remapAction
                      ? `${key.label} (${key.code}) → Đang gán thành: ${remapAction.label}`
                      : `${key.label} (${key.code})`
                  }
                  style={{
                    left: `${leftPx}px`,
                    top: `${topPx}px`,
                    width: `${widthPx}px`,
                    height: `${heightPx}px`,
                    background: palette.skirt,
                    borderColor: isSelected
                      ? '#22d3ee'
                      : remapAction
                      ? '#f59e0b'
                      : palette.border,
                    boxShadow: isSelected
                      ? '0 0 0 2px rgba(34, 211, 238, 0.9), 0 0 18px rgba(6, 182, 212, 0.7)'
                      : lighting.mode === 'off'
                      ? '0 3px 5px rgba(0, 0, 0, 0.55)'
                      : `0 0 ${Math.round(7 * rgbAlpha + 3)}px ${ledColor}cc, 0 3px 5px rgba(0, 0, 0, 0.6)`,
                  }}
                  className={`absolute rounded-[7px] border cursor-pointer transition-transform duration-75 select-none ${
                    isPressed ? 'translate-y-[2px] brightness-95' : ''
                  } ${isSelected ? 'scale-[1.04] z-20' : remapAction ? 'z-10' : 'hover:brightness-105'}`}
                >
                  {/* Sculpted Top Keycap Dish */}
                  <div
                    className="absolute inset-x-[3.5px] top-[2.5px] bottom-[5.5px] rounded-[5px] flex flex-col justify-between px-1 py-0.5 pointer-events-none"
                    style={{
                      background: palette.face,
                      borderTop: `1px solid ${palette.faceBorder}`,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
                    }}
                  >
                    {/* Top secondary legends (Shift symbol + FN wireless badge) */}
                    <div className="flex items-center justify-between text-[7.5px] leading-none font-mono">
                      <span style={{ color: palette.subText }}>{key.shiftLabel || ''}</span>
                      {key.subLabel && (
                        <span
                          className="text-[6.5px] font-bold tracking-tight"
                          style={{ color: palette.legendAccent }}
                        >
                          {key.subLabel}
                        </span>
                      )}
                    </div>

                    {/* Main Legend */}
                    <div
                      className={`flex items-center justify-center font-semibold tracking-tight text-center leading-none truncate ${
                        isCompactLegend ? 'text-[8.5px]' : 'text-[10px]'
                      }`}
                      style={{ color: palette.text }}
                    >
                      <span>{key.label}</span>
                    </div>

                    {/* Subtle Spacebar homing bar */}
                    {key.code === 'Space' ? (
                      <div className="mx-auto w-8 h-[2px] rounded-full bg-white/20 mb-0.5" />
                    ) : (
                      <div className="h-[2px]" />
                    )}
                  </div>

                  {/* Remapped Badge */}
                  {remapAction && (
                    <div
                      className="absolute -top-1.5 -right-1 max-w-[44px] truncate px-1 py-[1px] rounded bg-amber-400 text-slate-950 text-[7px] font-extrabold uppercase shadow-md pointer-events-none border border-slate-950/50"
                    >
                      →{remapAction.label.slice(0, 5)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};
