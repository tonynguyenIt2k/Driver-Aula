import React from 'react';
import {
  Gauge,
  Sliders,
  Zap,
  Activity,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { MouseConfig, Language } from '../types/device';
import { webhidService } from '../services/webhid';

interface MouseTabProps {
  config: MouseConfig;
  onChangeConfig: (newConfig: MouseConfig) => void;
  onApplyMouse?: (nextConfig: MouseConfig) => Promise<void> | void;
  onNotify?: (msg: string) => void;
  lang: Language;
  t: (key: string) => string;
}

export const MouseTab: React.FC<MouseTabProps> = ({
  config,
  onChangeConfig,
  onApplyMouse,
  onNotify,
  lang,
  t,
}) => {
  const handleApplyToMouse = async (nextConfig: MouseConfig) => {
    if (onApplyMouse) {
      await onApplyMouse(nextConfig);
      return;
    }
    const res = await webhidService.applyMouseConfig(nextConfig);
    onNotify?.(res.message);
  };

  const handleStageDPIChange = (stageNum: number, newDPI: number) => {
    const updated = config.dpiStages.map((s) =>
      s.stage === stageNum ? { ...s, dpi: newDPI } : s
    );
    onChangeConfig({ ...config, dpiStages: updated });
  };

  const handleStageColorChange = (stageNum: number, color: string) => {
    const updated = config.dpiStages.map((s) =>
      s.stage === stageNum ? { ...s, color } : s
    );
    onChangeConfig({ ...config, dpiStages: updated });
  };

  const handleSelectActiveStage = async (stageNum: number) => {
    const nextConfig = { ...config, currentStage: stageNum };
    onChangeConfig(nextConfig);
    if (webhidService.isConnected()) {
      await handleApplyToMouse(nextConfig);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
            <Gauge className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            <span>{t('mouseTitle')}</span>
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
            PixArt PAW3395 Flagship Optical Sensor • 26,000 DPI • Open-AULA Mouse55
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Polling Rate Selector */}
          <div className="grid grid-cols-4 sm:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="hidden md:inline text-xs font-bold text-slate-400 pl-2 pr-1">
              {t('pollingRate')}:
            </span>
            {[125, 250, 500, 1000].map((rate) => (
              <button
                key={rate}
                onClick={() => {
                  const next = {
                    ...config,
                    pollingRate: rate as MouseConfig['pollingRate'],
                  };
                  onChangeConfig(next);
                  if (webhidService.isConnected()) handleApplyToMouse(next);
                }}
                className={`min-h-[40px] sm:min-h-0 px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap min-w-0 text-center ${
                  config.pollingRate === rate
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rate}Hz
              </button>
            ))}
          </div>

          <button
            onClick={() => handleApplyToMouse(config)}
            className="min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Lưu xuống chuột SC620</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* DPI Stages Card */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              {t('dpiStages')}
            </span>
            <span className="text-xs text-slate-400">
              {t('activeStage')}: <strong className="text-white">Mức {config.currentStage}</strong>
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {config.dpiStages.map((s) => (
              <div
                key={s.stage}
                onClick={() => handleSelectActiveStage(s.stage)}
                className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                  config.currentStage === s.stage
                    ? 'bg-cyan-950/40 border-cyan-500/80 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">
                      Mức {s.stage}
                    </span>
                    <span className="text-sm font-mono font-extrabold text-cyan-400">
                      {s.dpi} DPI
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input
                    type="range"
                    min="200"
                    max="26000"
                    step="100"
                    value={s.dpi}
                    onChange={(e) =>
                      handleStageDPIChange(s.stage, Number(e.target.value))
                    }
                    className="w-full sm:w-44 accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <input
                    type="color"
                    value={s.color}
                    onChange={(e) =>
                      handleStageColorChange(s.stage, e.target.value)
                    }
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sensor Tuning & Switches */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Advanced Sensor Parameters */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" />
              {t('sensorSettings')}
            </span>

            {/* LOD Distance */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">
                  {t('lodDistance')}
                </span>
                <span className="text-[11px] text-slate-400">
                  Độ cao cảm biến ngừng nhận diện bề mặt lót chuột
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                {[1, 2].map((mm) => (
                  <button
                    key={mm}
                    onClick={() =>
                      onChangeConfig({
                        ...config,
                        lod: mm as MouseConfig['lod'],
                      })
                    }
                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                      config.lod === mm
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mm}mm
                  </button>
                ))}
              </div>
            </div>

            {/* Debounce Time */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>{t('debounceTime')}</span>
                <span className="font-mono text-cyan-400">
                  {config.debounceTime} ms
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={config.debounceTime}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    debounceTime: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Sensor Feature Toggles */}
            <div className="flex flex-col gap-2">
              {/* Angle Snapping */}
              <div
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    angleSnapping: !config.angleSnapping,
                  })
                }
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition"
              >
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    {t('angleSnapping')}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Làm mượt đường thẳng khi vẽ đồ họa hoặc bắn súng ngắm
                  </span>
                </div>
                <div
                  className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center ${
                    config.angleSnapping ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-slate-950 shadow-md" />
                </div>
              </div>

              {/* Motion Sync */}
              <div
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    motionSync: !config.motionSync,
                  })
                }
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition"
              >
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    {t('motionSync')}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Đồng bộ khung hình cảm biến với polling rate USB
                  </span>
                </div>
                <div
                  className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center ${
                    config.motionSync ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-slate-950 shadow-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
