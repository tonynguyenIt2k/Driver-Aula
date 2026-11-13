import React, { useState } from 'react';
import { MouseConfig, KeyRemapAction, LightingConfig } from '../types/device';
import { soundEngine } from '../services/soundEngine';

interface MouseVisualizerProps {
  config: MouseConfig;
  lighting: LightingConfig;
  selectedButtonId: string | null;
  onSelectButton: (buttonId: string) => void;
}

export const MouseVisualizer: React.FC<MouseVisualizerProps> = ({
  config,
  lighting,
  selectedButtonId,
  onSelectButton,
}) => {
  const [activeBtn, setActiveBtn] = useState<string | null>(null);

  const handleBtnClick = (btnId: string) => {
    soundEngine.playMouseClick();
    setActiveBtn(btnId);
    setTimeout(() => setActiveBtn(null), 150);
    onSelectButton(btnId);
  };

  const currentStage = config.dpiStages.find((s) => s.stage === config.currentStage) || config.dpiStages[0];
  const ledColor = lighting.mode === 'off' ? 'transparent' : currentStage.color || '#00f0ff';

  return (
    <div className="w-full flex flex-col items-center select-none py-4">
      {/* Outer container */}
      <div className="relative p-6 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col items-center">
        {/* Mouse top-down silhouette */}
        <div className="relative w-64 h-96 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 rounded-[48px] border-2 border-slate-700 shadow-2xl flex flex-col items-center overflow-hidden">
          {/* LED Ring Under-glow at the base */}
          <div
            className="absolute -bottom-4 inset-x-4 h-12 rounded-full blur-xl transition-all duration-300 pointer-events-none"
            style={{
              backgroundColor: ledColor,
              opacity: lighting.brightness / 100,
            }}
          />

          {/* Top Button Shell (Left & Right clicks) */}
          <div className="w-full h-40 flex border-b border-slate-700/60 relative">
            {/* Left Click Button */}
            <button
              onClick={() => handleBtnClick('btn_left')}
              className={`w-1/2 h-full rounded-tl-[44px] transition-colors border-r border-slate-700/70 p-3 flex flex-col justify-start items-center ${
                activeBtn === 'btn_left'
                  ? 'bg-slate-700 shadow-inner'
                  : selectedButtonId === 'btn_left'
                  ? 'bg-cyan-950/60 ring-2 ring-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <span className="text-[11px] font-bold text-slate-300">Left Click</span>
              <span className="text-[9px] text-cyan-400 mt-1">
                {config.buttonActions.btn_left?.label || 'Chuột trái'}
              </span>
            </button>

            {/* Scroll Wheel & DPI in center notch */}
            <div className="absolute left-1/2 -translate-x-1/2 top-4 flex flex-col items-center gap-2 z-10">
              {/* Scroll Wheel */}
              <div
                onClick={() => handleBtnClick('btn_middle')}
                className={`w-7 h-16 rounded-full bg-slate-950 border-2 border-slate-600 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-md ${
                  selectedButtonId === 'btn_middle' ? 'ring-2 ring-cyan-400' : ''
                }`}
              >
                <div
                  className="w-2.5 h-10 rounded-full blur-[1px] transition-colors"
                  style={{ backgroundColor: ledColor }}
                />
              </div>

              {/* DPI Switch Button */}
              <button
                onClick={() => handleBtnClick('btn_dpi')}
                className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono transition border ${
                  selectedButtonId === 'btn_dpi'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                DPI
              </button>
            </div>

            {/* Right Click Button */}
            <button
              onClick={() => handleBtnClick('btn_right')}
              className={`w-1/2 h-full rounded-tr-[44px] transition-colors p-3 flex flex-col justify-start items-center ${
                activeBtn === 'btn_right'
                  ? 'bg-slate-700 shadow-inner'
                  : selectedButtonId === 'btn_right'
                  ? 'bg-cyan-950/60 ring-2 ring-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <span className="text-[11px] font-bold text-slate-300">Right Click</span>
              <span className="text-[9px] text-cyan-400 mt-1">
                {config.buttonActions.btn_right?.label || 'Chuột phải'}
              </span>
            </button>
          </div>

          {/* Left Side Buttons (Forward / Backward) */}
          <div className="absolute left-0 top-36 flex flex-col gap-1 z-20">
            <button
              onClick={() => handleBtnClick('btn_forward')}
              className={`w-3.5 h-10 rounded-r-md transition border-y border-r border-slate-600 shadow-md ${
                selectedButtonId === 'btn_forward'
                  ? 'bg-cyan-400'
                  : 'bg-slate-700 hover:bg-cyan-600'
              }`}
              title="Forward Button (Nút phụ trước)"
            />
            <button
              onClick={() => handleBtnClick('btn_backward')}
              className={`w-3.5 h-10 rounded-r-md transition border-y border-r border-slate-600 shadow-md ${
                selectedButtonId === 'btn_backward'
                  ? 'bg-cyan-400'
                  : 'bg-slate-700 hover:bg-cyan-600'
              }`}
              title="Backward Button (Nút phụ sau)"
            />
          </div>

          {/* Palm Rest with illuminated AULA Logo */}
          <div className="w-full flex-1 flex flex-col items-center justify-center p-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-700/60 transition-all duration-300 shadow-lg"
              style={{
                boxShadow: `0 0 20px ${ledColor}40`,
                borderColor: `${ledColor}80`,
              }}
            >
              <span
                className="font-black text-xs tracking-wider"
                style={{ color: ledColor }}
              >
                AULA
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 mt-3 font-medium">
              SC620 • PAW3395
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: currentStage.color }}
              />
              <span className="text-xs font-bold font-mono text-slate-200">
                {currentStage.dpi} DPI
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
