import React, { useState } from 'react';
import {
  Keyboard,
  Mouse as MouseIcon,
  Usb,
  BatteryCharging,
  Sliders,
  Download,
  Upload,
  RotateCcw,
  Languages,
  CheckCircle2,
  AlertTriangle,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { DeviceModel, Language } from '../types/device';
import { ConnectedDeviceInfo } from '../services/webhid';

interface HeaderProps {
  devices: DeviceModel[];
  selectedDevice: DeviceModel;
  onSelectDevice: (device: DeviceModel) => void;
  isConnected: boolean;
  deviceInfo: ConnectedDeviceInfo;
  activeProfile: number;
  onSelectProfile: (profile: number) => void;
  lang: Language;
  onToggleLang: () => void;
  t: (key: string) => string;
  onConnectHID: () => void;
  onDisconnectHID: () => void;
  onExportProfile: () => void;
  onImportProfile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFactoryReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  devices,
  selectedDevice,
  onSelectDevice,
  isConnected,
  deviceInfo,
  activeProfile,
  onSelectProfile,
  lang,
  onToggleLang,
  t,
  onConnectHID,
  onDisconnectHID,
  onExportProfile,
  onImportProfile,
  onFactoryReset,
}) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo and Device Picker */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-cyan-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-slate-100 whitespace-nowrap">
                {t('appName')}
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block whitespace-nowrap">
                {t('appSubtitle')}
              </p>
            </div>
          </div>

          {/* Device Switcher Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedDevice.id}
                onChange={(e) => {
                  const dev = devices.find((d) => d.id === e.target.value);
                  if (dev) onSelectDevice(dev);
                }}
                className="appearance-none bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold pl-8 pr-8 py-2 rounded-lg border border-slate-700/80 focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer shadow-inner"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                    {d.name} ({d.layoutName.split(' ')[0]})
                  </option>
                ))}
              </select>
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
                {selectedDevice.type === 'mouse' ? (
                  <MouseIcon className="w-3.5 h-3.5" />
                ) : (
                  <Keyboard className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 w-full md:w-auto">
          {/* Connection Status Badge & Button */}
          <div className="flex items-center gap-2 bg-slate-800/80 p-1 pl-2.5 rounded-lg border border-slate-700/70">
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span className="font-medium text-slate-200 text-xs max-w-[160px] truncate" title={deviceInfo.productName}>
                {isConnected ? deviceInfo.productName : 'Chưa kết nối'}
              </span>
              {isConnected && (
                <span className="hidden xl:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-800/60">
                  {deviceInfo.vendorId.toString(16).padStart(4, '0').toUpperCase()}:
                  {deviceInfo.productId.toString(16).padStart(4, '0').toUpperCase()}
                </span>
              )}
            </div>

            {/* Real Battery / Link Mode Indicator (only shown when connected) */}
            {isConnected && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/80 text-[11px] font-mono text-cyan-300 border border-slate-700/40">
                <BatteryCharging className="w-3 h-3 text-emerald-400" />
                <span>
                  {deviceInfo.batteryLevel !== null
                    ? `${deviceInfo.batteryLevel}%`
                    : deviceInfo.connectionType === 'wireless_2.4g'
                    ? '2.4G'
                    : 'USB'}
                </span>
              </div>
            )}

            {/* Connect / Disconnect button */}
            {isConnected ? (
              <button
                onClick={onDisconnectHID}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800/60 transition cursor-pointer"
              >
                {t('disconnect')}
              </button>
            ) : (
              <button
                onClick={onConnectHID}
                className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition shadow-sm hover:shadow-cyan-500/20 cursor-pointer"
                title="Mở hộp thoại chọn thiết bị HID của trình duyệt (AULA-S75Pro, F75, F87, SC620...)"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{t('connectDevice')}</span>
              </button>
            )}
          </div>

          {/* Profile Switcher (P1, P2, P3) */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/70">
            <span className="text-[11px] text-slate-400 font-medium px-2 hidden sm:inline">
              Profile:
            </span>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() => onSelectProfile(p)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                  activeProfile === p
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                P{p}
              </button>
            ))}
          </div>

          {/* Action Menu (Export, Import, Reset, Lang) */}
          <div className="flex items-center gap-1">
            <button
              onClick={onExportProfile}
              title={t('exportProfile')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 transition"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title={t('importProfile')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 transition"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImportProfile}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => setShowResetModal(true)}
              title={t('factoryReset')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-900 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Language Switcher */}
            <button
              onClick={onToggleLang}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition"
            >
              <Languages className="w-3.5 h-3.5 text-cyan-400" />
              <span>{lang.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Factory Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-lg text-slate-100">
                {t('resetConfirmTitle')}
              </h3>
            </div>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {t('resetConfirmText')}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  onFactoryReset();
                  setShowResetModal(false);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-600/30"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
