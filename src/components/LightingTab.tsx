import React from 'react';
import {
  Sun,
  Zap,
  ArrowRight,
  Palette,
  Paintbrush,
  Sparkles,
  Trash2,
  CheckCircle,
  Music,
  CheckSquare,
} from 'lucide-react';
import { LightingConfig, RGBEffectMode, Language, KeyDefinition, MusicRhythmConfig } from '../types/device';

interface LightingTabProps {
  lighting: LightingConfig;
  deviceKeys?: KeyDefinition[];
  onChangeLighting: (newConfig: LightingConfig) => void;
  onApplyLighting: () => void;
  isCustomMatrixActive: boolean;
  onToggleCustomMatrix: (active: boolean) => void;
  brushColor: string;
  onChangeBrushColor: (color: string) => void;
  onPaintGroup?: (keyIds: string[], color: string) => void;
  onClearCustomMatrix: () => void;
  lang: Language;
  t: (key: string) => string;
}

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#00f0ff', // Cyan
  '#ec4899', // Magenta
  '#ffffff', // White
  '#000000', // Black / Off
  '#8b5cf6', // Violet
];

const NUMERIC_IDS = new Set([
  'k_1',
  'k_2',
  'k_3',
  'k_4',
  'k_5',
  'k_6',
  'k_7',
  'k_8',
  'k_9',
  'k_0',
]);
const WASD_IDS = new Set(['k_w', 'k_a', 'k_s', 'k_d']);

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v) || 0));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')}`;
}

export const LightingTab: React.FC<LightingTabProps> = ({
  lighting,
  deviceKeys = [],
  onChangeLighting,
  onApplyLighting,
  isCustomMatrixActive,
  onToggleCustomMatrix,
  brushColor,
  onChangeBrushColor,
  onPaintGroup,
  onClearCustomMatrix,
  t,
}) => {
  const effects: { id: RGBEffectMode; label: string }[] = [
    { id: 'static', label: t('effect_static') },
    { id: 'starlight', label: t('effect_starlight') },
    { id: 'breathing', label: t('effect_breathing') },
    { id: 'fountain', label: t('effect_fountain') },
    { id: 'rainbow_wave', label: t('effect_rainbow_wave') },
    { id: 'currents', label: t('effect_currents') },
    { id: 'revolving', label: t('effect_revolving') },
    { id: 'spectrum', label: t('effect_spectrum') },
    { id: 'reactive', label: t('effect_reactive') },
    { id: 'ripple', label: t('effect_ripple') },
    { id: 'custom_matrix', label: t('effect_custom_matrix') },
    { id: 'audio', label: t('effect_audio') },
    { id: 'off', label: t('effect_off') },
  ];

  const handleModeChange = (mode: RGBEffectMode) => {
    onChangeLighting({
      ...lighting,
      mode,
    });
    onToggleCustomMatrix(mode === 'custom_matrix');
  };

  const activeColorHex = isCustomMatrixActive ? brushColor : lighting.primaryColor;
  const rgb = hexToRgb(activeColorHex);

  const handleColorSet = (hex: string) => {
    if (isCustomMatrixActive) {
      onChangeBrushColor(hex);
    } else {
      onChangeLighting({ ...lighting, primaryColor: hex });
    }
  };

  const handleQuickGroup = (group: 'all' | 'numeric' | 'wasd') => {
    const targetIds = deviceKeys
      .filter((k) => {
        if (k.isKnob || k.isScreen) return false;
        if (group === 'all') return true;
        if (group === 'numeric') return NUMERIC_IDS.has(k.id);
        return WASD_IDS.has(k.id);
      })
      .map((k) => k.id);

    onToggleCustomMatrix(true);
    if (onPaintGroup) {
      onPaintGroup(targetIds, brushColor);
    }
  };

  const mr: MusicRhythmConfig = lighting.musicRhythm || {
    rhythmStyle: 'gradient',
    backgroundMode: 'off',
    amplitude: 30,
    backgroundBrightness: 100,
  };

  const updateMusicRhythm = (patch: Partial<MusicRhythmConfig>) => {
    onChangeLighting({
      ...lighting,
      musicRhythm: {
        ...mr,
        ...patch,
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Effect Mode Selector */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>{t('effectMode')}</span>
          </div>

          <div className="grid grid-cols-2 lg:flex lg:flex-col gap-1.5 max-h-[260px] lg:max-h-[420px] overflow-y-auto pr-1">
            {effects.map((eff) => (
              <button
                key={eff.id}
                onClick={() => handleModeChange(eff.id)}
                className={`min-h-[42px] sm:min-h-0 w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-between gap-1.5 cursor-pointer ${
                  lighting.mode === eff.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                }`}
              >
                <span className="truncate">{eff.label}</span>
                {lighting.mode === eff.id && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Controls, Music Rhythm, & RGB Palette */}
        <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-5">
          {/* Quick Group Selection (Select All / Numeric / WASD from official S75 Pro UI) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Chọn nhanh vùng phím tô màu:</span>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <button
                onClick={() => handleQuickGroup('all')}
                className="min-h-[40px] sm:min-h-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                Select All
              </button>
              <button
                onClick={() => handleQuickGroup('numeric')}
                className="min-h-[40px] sm:min-h-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                Numeric (1–0)
              </button>
              <button
                onClick={() => handleQuickGroup('wasd')}
                className="min-h-[40px] sm:min-h-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                WASD
              </button>
              <button
                onClick={onClearCustomMatrix}
                className="min-h-[40px] sm:min-h-0 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-400 text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa màu vẽ</span>
              </button>
            </div>
          </div>

          {/* Music Rhythm Settings Panel (shown when audio mode selected, matching image_d1b90ef6) */}
          {lighting.mode === 'audio' ? (
            <div className="bg-slate-900 border border-amber-700/50 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Music className="w-4 h-4" />
                <span>Music Rhythm (Đồng bộ nhịp điệu âm thanh)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300">Rhythm Style</label>
                  <select
                    value={mr.rhythmStyle}
                    onChange={(e) =>
                      updateMusicRhythm({
                        rhythmStyle: e.target.value as MusicRhythmConfig['rhythmStyle'],
                      })
                    }
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="gradient">Gradient</option>
                    <option value="spectrum">Spectrum Bars</option>
                    <option value="pulse">Bass Pulse</option>
                    <option value="center">Center Outward</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300">Background Mode</label>
                  <select
                    value={mr.backgroundMode}
                    onChange={(e) =>
                      updateMusicRhythm({
                        backgroundMode: e.target.value as MusicRhythmConfig['backgroundMode'],
                      })
                    }
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="off">Off</option>
                    <option value="static">Static Color</option>
                    <option value="breathing">Breathing</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-200">
                    <span>Amplitude</span>
                    <span className="font-mono text-amber-400">{mr.amplitude}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={mr.amplitude}
                    onChange={(e) => updateMusicRhythm({ amplitude: Number(e.target.value) })}
                    className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-200">
                    <span>Background Brightness</span>
                    <span className="font-mono text-amber-400">{mr.backgroundBrightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={mr.backgroundBrightness}
                    onChange={(e) =>
                      updateMusicRhythm({ backgroundBrightness: Number(e.target.value) })
                    }
                    className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Brightness, Speed & Direction */
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-400" />
                    {t('brightness')}
                  </span>
                  <span className="font-mono text-cyan-400">{lighting.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={lighting.brightness}
                  onChange={(e) =>
                    onChangeLighting({ ...lighting, brightness: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    {t('speed')}
                  </span>
                  <span className="font-mono text-cyan-400">Mức {lighting.speed}/5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={lighting.speed}
                  onChange={(e) =>
                    onChangeLighting({ ...lighting, speed: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ArrowRight className="w-4 h-4 text-indigo-400" />
                  {t('direction')}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'left', label: t('dirLeft') },
                    { id: 'right', label: t('dirRight') },
                    { id: 'outward', label: t('dirOutward') },
                    { id: 'inward', label: t('dirInward') },
                  ].map((d) => (
                    <button
                      key={d.id}
                      onClick={() =>
                        onChangeLighting({
                          ...lighting,
                          direction: d.id as LightingConfig['direction'],
                        })
                      }
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        lighting.direction === d.id
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Palette with Color Wheel + R/G/B Sliders & Swatches (matching official S75 Pro Palette) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                <Palette className="w-4 h-4" />
                <span>
                  {isCustomMatrixActive
                    ? 'Palette (Cọ tô màu từng phím)'
                    : t('presetColors')}
                </span>
              </div>
              <span className="font-mono text-xs text-slate-300 uppercase font-semibold">
                {activeColorHex}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              <input
                type="color"
                value={activeColorHex}
                onChange={(e) => handleColorSet(e.target.value)}
                className="w-20 h-20 rounded-full cursor-pointer bg-transparent border border-slate-700 flex-shrink-0"
              />

              <div className="flex-1 w-full flex flex-col gap-2.5">
                {(['r', 'g', 'b'] as const).map((ch) => (
                  <div key={ch} className="flex items-center gap-3">
                    <span className="w-5 font-mono text-xs font-bold uppercase text-slate-400">
                      {ch}:
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={rgb[ch]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        handleColorSet(
                          rgbToHex(
                            ch === 'r' ? v : rgb.r,
                            ch === 'g' ? v : rgb.g,
                            ch === 'b' ? v : rgb.b
                          )
                        );
                      }}
                      className="flex-1 accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={rgb[ch]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        handleColorSet(
                          rgbToHex(
                            ch === 'r' ? v : rgb.r,
                            ch === 'g' ? v : rgb.g,
                            ch === 'b' ? v : rgb.b
                          )
                        );
                      }}
                      className="w-14 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSet(color)}
                    style={{ backgroundColor: color }}
                    className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border border-slate-700 transition-transform hover:scale-110 cursor-pointer ${
                      activeColorHex.toLowerCase() === color.toLowerCase()
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                        : ''
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => onToggleCustomMatrix(!isCustomMatrixActive)}
                className={`min-h-[42px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  isCustomMatrixActive
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>{isCustomMatrixActive ? 'Đang bật cọ tô phím' : 'Bật cọ tô từng phím'}</span>
              </button>
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={onApplyLighting}
            className="min-h-[48px] w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-extrabold text-sm transition shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('applyLightingBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
