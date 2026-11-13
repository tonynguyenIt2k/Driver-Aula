import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import { SwitchSoundType, Language } from '../types/device';
import { soundEngine } from '../services/soundEngine';

interface KeyTesterTabProps {
  activeKeys: Set<string>;
  testedKeys: Set<string>;
  onResetTester: () => void;
  lang: Language;
  t: (key: string) => string;
}

export const KeyTesterTab: React.FC<KeyTesterTabProps> = ({
  activeKeys,
  testedKeys,
  onResetTester,
  lang,
  t,
}) => {
  const [currentSwitch, setCurrentSwitch] = useState<SwitchSoundType>(
    soundEngine.getSwitch()
  );
  const [volume, setVolume] = useState<number>(soundEngine.getVolume() * 100);
  const [lastKey, setLastKey] = useState<string>('Chưa có');
  const [latencyMs, setLatencyMs] = useState<number>(1.2);

  const switchProfiles: {
    id: SwitchSoundType;
    name: string;
    description: string;
    force: string;
    travel: string;
    badge: string;
    accentColor: string;
  }[] = [
    {
      id: 'greywood',
      name: 'AULA Greywood V3',
      description: 'Switch linear quốc dân, tiếng thock trầm đục dầy dặn, stem POM mượt mà đã lubed sẵn từ nhà máy.',
      force: '40 ± 3 gf',
      travel: '3.6 ± 0.3 mm',
      badge: 'Thocky Linear',
      accentColor: '#94a3b8',
    },
    {
      id: 'reaper',
      name: 'AULA Reaper Switch',
      description: 'Âm thanh clack giòn tan, thanh thoát, nắp che chống bụi, hành trình gõ cực mượt không sạn.',
      force: '45 ± 5 gf',
      travel: '3.6 mm',
      badge: 'Creamy Clack',
      accentColor: '#a855f7',
    },
    {
      id: 'clicky',
      name: 'Ice Blue Clicky',
      description: 'Xúc giác nảy mạnh mẽ với thanh click-bar tạo tiếng tách giòn đanh, phản hồi chính xác từng nhịp bấm.',
      force: '50 ± 5 gf',
      travel: '4.0 mm',
      badge: 'Tactile Click',
      accentColor: '#06b6d4',
    },
    {
      id: 'silent',
      name: 'AULA Silent Peach',
      description: 'Thiết kế đệm cao su giảm chấn kép, triệt tiêu 90% tiếng ồn, lý tưởng làm việc văn phòng hoặc ban đêm.',
      force: '38 ± 5 gf',
      travel: '3.3 mm',
      badge: 'Silent Linear',
      accentColor: '#ec4899',
    },
    {
      id: 'off',
      name: 'Tắt âm thanh (Mute)',
      description: 'Không phát âm thanh mô phỏng khi gõ.',
      force: '--',
      travel: '--',
      badge: 'Mute',
      accentColor: '#64748b',
    },
  ];

  const handleSwitchSelect = (sw: SwitchSoundType) => {
    setCurrentSwitch(sw);
    soundEngine.setSwitch(sw);
    if (sw !== 'off') {
      soundEngine.playKeySound(false);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    soundEngine.setVolume(vol / 100);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Live Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-cyan-400" />
            <span>{t('keyTesterTitle')}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            {t('keyTesterSubtitle')}
          </p>
        </div>

        <button
          onClick={onResetTester}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>{t('resetTester')}</span>
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 font-bold">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">
              {t('testedKeysCount')}
            </span>
            <div className="text-lg font-mono font-black text-emerald-300">
              {testedKeys.size} phím
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">
              {t('latencyEstimated')}
            </span>
            <div className="text-lg font-mono font-black text-cyan-300">
              ~{latencyMs} ms
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400 font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">
              Chế độ nhận diện
            </span>
            <div className="text-sm font-mono font-black text-purple-300">
              NKRO (Anti-Ghosting 100%)
            </div>
          </div>
        </div>
      </div>

      {/* Switch Sound Synthesizer Engine Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Volume2 className="w-4 h-4" />
            <span>{t('switchSound')}</span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">
              {t('soundVolume')}:
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-28 sm:w-36 accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-mono text-cyan-400 w-8">{volume}%</span>
          </div>
        </div>

        {/* Switch Profiles Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {switchProfiles.map((sw) => (
            <div
              key={sw.id}
              onClick={() => handleSwitchSelect(sw.id)}
              className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-3 group ${
                currentSwitch === sw.id
                  ? 'bg-slate-800 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition">
                    {sw.name}
                  </span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${sw.accentColor}25`,
                      color: sw.accentColor,
                    }}
                  >
                    {sw.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {sw.description}
                </p>
              </div>

              {sw.id !== 'off' && (
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                  <span>Lực: {sw.force}</span>
                  <span>Hành trình: {sw.travel}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
