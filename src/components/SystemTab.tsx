import React from 'react';
import { Settings, Clock, ShieldAlert, RotateCcw, Save, Zap } from 'lucide-react';
import { SystemSettings, Language } from '../types/device';
import { webhidService } from '../services/webhid';

interface SystemTabProps {
  settings: SystemSettings;
  onChangeSettings: (next: SystemSettings) => void;
  onApplySettings?: () => Promise<void> | void;
  onHardwareReset?: (fullFactory: boolean) => Promise<void> | void;
  onFactoryResetLocal: () => void;
  onNotify?: (msg: string) => void;
  lang: Language;
}

export const SystemTab: React.FC<SystemTabProps> = ({
  settings,
  onChangeSettings,
  onApplySettings,
  onHardwareReset,
  onFactoryResetLocal,
  onNotify,
  lang,
}) => {
  const handleApply = async () => {
    if (onApplySettings) {
      await onApplySettings();
      return;
    }
    const res = await webhidService.applySystemSettings(settings);
    onNotify?.(res.message);
  };

  const handleHardwareReset = async (fullFactory: boolean) => {
    if (onHardwareReset) {
      await onHardwareReset(fullFactory);
      return;
    }
    if (fullFactory) {
      onFactoryResetLocal();
    }
    if (webhidService.isConnected()) {
      const res = await webhidService.factoryResetHardware(fullFactory);
      onNotify?.(res.message);
    } else if (!fullFactory) {
      onNotify?.('Chưa kết nối thiết bị WebHID thật để gửi lệnh Reset Keyboard.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Key Response Time & Sleep Time (from official S75 Pro System Settings) */}
      <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-5">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <Settings className="w-4 h-4" />
          <span>{lang === 'vi' ? 'Cài đặt Hệ thống Bàn phím (System Settings)' : 'Keyboard System Settings'}</span>
        </div>

        {/* Key Response Time (Debounce Level) */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Key Response Time (Độ nhạy / Debounce)</span>
          </label>
          <select
            value={settings.debounceLevel}
            onChange={(e) =>
              onChangeSettings({
                ...settings,
                debounceLevel: Number(e.target.value) as SystemSettings['debounceLevel'],
              })
            }
            className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-100"
          >
            <option value={1}>1 Level (Nhanh nhất - Esports Wired)</option>
            <option value={2}>2 Level (Mặc định - Wired ~5-6ms / 2.4G ~7-9ms / BT ~15-16ms)</option>
            <option value={3}>3 Level (Cân bằng chống double-click)</option>
            <option value={4}>4 Level (Ổn định cao cho switch nhạy)</option>
            <option value={5}>5 Level (Chống dội phím tối đa)</option>
          </select>
          <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/70 border border-slate-800 rounded-lg p-3">
            Thông số tham chiếu Level 2: Có dây ~5–6 ms, 2.4GHz ~7–9 ms, Bluetooth ~15–16 ms. Nếu switch bị nhấn đúp (chatter), hãy tăng mức Level lên cao hơn.
          </p>
        </div>

        {/* Sleep Time */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sleep Time (Thời gian chờ tiết kiệm pin)</span>
          </label>
          <select
            value={settings.sleepMinutes}
            onChange={(e) =>
              onChangeSettings({
                ...settings,
                sleepMinutes: Number(e.target.value) as SystemSettings['sleepMinutes'],
              })
            }
            className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-100"
          >
            <option value={1}>1 min</option>
            <option value={3}>3 min</option>
            <option value={5}>5 min</option>
            <option value={10}>10 min</option>
            <option value={30}>30 min</option>
            <option value={0}>Never (Không tự tắt)</option>
          </select>
        </div>
      </div>

      {/* Right: Gaming Key Locks & Reset Actions */}
      <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <ShieldAlert className="w-4 h-4" />
            <span>Khóa phím Gaming (Disable Key Shortcuts)</span>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={settings.disableWinKey}
              onChange={(e) =>
                onChangeSettings({ ...settings, disableWinKey: e.target.checked })
              }
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <span className="text-xs font-bold text-slate-200">Disable Windows Key</span>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={settings.disableAltF4}
              onChange={(e) =>
                onChangeSettings({ ...settings, disableAltF4: e.target.checked })
              }
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <span className="text-xs font-bold text-slate-200">Disable ALT + F4</span>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={settings.disableAltTab}
              onChange={(e) =>
                onChangeSettings({ ...settings, disableAltTab: e.target.checked })
              }
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <span className="text-xs font-bold text-slate-200">Disable ALT + TAB</span>
          </label>
        </div>

        <div className="flex flex-col gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={handleApply}
            className="min-h-[46px] w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-extrabold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Áp dụng System Settings xuống thiết bị</span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <button
              onClick={() => handleHardwareReset(false)}
              className="min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Keyboard</span>
            </button>
            <button
              onClick={() => handleHardwareReset(true)}
              className="min-h-[44px] py-2.5 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 text-xs font-bold border border-rose-800/60 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Factory Reset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
