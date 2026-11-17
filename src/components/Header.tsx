import React, { useState } from 'react';
import {
  Keyboard,
  Mouse as MouseIcon,
  Usb,
  BatteryCharging,
  Download,
  Upload,
  RotateCcw,
  Languages,
  AlertTriangle,
  Cloud,
  CloudOff,
  Loader2,
  LogOut,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { DeviceModel, Language } from '../types/device';
import { ConnectedDeviceInfo } from '../services/webhid';
import { PWAInstallButton } from './PWAInstallButton';

export interface AuthUserSummary {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

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
  user: AuthUserSummary | null;
  authLoading?: boolean;
  cloudSyncStatus?: CloudSyncStatus;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
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
  user,
  authLoading = false,
  cloudSyncStatus = 'idle',
  onSignInGoogle,
  onSignOutGoogle,
}) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40 px-3 py-2 md:px-4 md:py-3">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-2 md:gap-3">
        {/* Logo & Device Picker */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 md:flex-initial">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg bg-slate-800 border border-slate-700 text-cyan-400">
              {selectedDevice.type === 'mouse' ? (
                <MouseIcon className="w-4 h-4" />
              ) : (
                <Keyboard className="w-4 h-4" />
              )}
            </div>
            <div className="hidden xs:block sm:block">
              <div className="font-bold text-sm md:text-base tracking-tight text-slate-100 whitespace-nowrap">
                {t('appName')}
              </div>
              <p className="text-[11px] text-slate-400 hidden lg:block whitespace-nowrap">
                {t('appSubtitle')}
              </p>
            </div>
          </div>

          {/* Device Switcher Dropdown */}
          <div className="relative flex-1 min-w-0 max-w-[190px] sm:max-w-[230px] md:max-w-none">
            <select
              value={selectedDevice.id}
              onChange={(e) => {
                const dev = devices.find((d) => d.id === e.target.value);
                if (dev) onSelectDevice(dev);
              }}
              aria-label="Select AULA device"
              className="w-full appearance-none bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold pl-7 md:pl-8 pr-6 md:pr-8 py-2 rounded-lg border border-slate-700/80 focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer shadow-inner truncate"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                  {d.name} ({d.layoutName.split(' ')[0]})
                </option>
              ))}
            </select>
            <div className="absolute left-2 md:left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
              {selectedDevice.type === 'mouse' ? (
                <MouseIcon className="w-3.5 h-3.5" />
              ) : (
                <Keyboard className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="absolute right-2 md:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        </div>

        {/* Mobile Compact Quick Actions (Visible < md) */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <PWAInstallButton lang={lang} compact />
          {user ? (
            <button
              onClick={() => setShowMobileMenu((v) => !v)}
              className="flex items-center gap-1.5 h-9 px-2 rounded-lg bg-slate-800/90 border border-slate-700/80 cursor-pointer"
              title={user.displayName || 'Account'}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              {cloudSyncStatus === 'syncing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : cloudSyncStatus === 'error' ? (
                <CloudOff className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>
          ) : (
            <button
              onClick={onSignInGoogle}
              disabled={authLoading}
              className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 border border-slate-600/80 cursor-pointer disabled:opacity-60"
            >
              {authLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="whitespace-nowrap">Google</span>
            </button>
          )}

          <button
            onClick={() => setShowMobileMenu((v) => !v)}
            aria-label="Mở menu tùy chọn"
            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition cursor-pointer ${
              showMobileMenu
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            {showMobileMenu ? (
              <X className="w-4 h-4" />
            ) : (
              <SlidersHorizontal className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Desktop Full Controls (Hidden < md) */}
        <div className="hidden md:flex flex-wrap items-center justify-end gap-2.5">
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
                title="Mở hộp thoại chọn thiết bị HID của trình duyệt (AULA S75 Pro, F108 Pro, F75, F87, SC620...)"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{t('connectDevice')}</span>
              </button>
            )}
          </div>

          {/* Profile Switcher (P1, P2, P3) */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/70">
            <span className="text-[11px] text-slate-400 font-medium px-2 hidden lg:inline">
              Profile:
            </span>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() => onSelectProfile(p)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
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
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title={t('importProfile')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowResetModal(true)}
              title={t('factoryReset')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-900 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onToggleLang}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-cyan-400" />
              <span>{lang.toUpperCase()}</span>
            </button>

            <PWAInstallButton lang={lang} />
          </div>

          {/* Google Account & Firebase Cloud Sync */}
          {user ? (
            <div className="flex items-center gap-2 bg-slate-800/90 pl-1.5 pr-1 py-1 rounded-lg border border-slate-700/80">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-md object-cover border border-slate-600/80 shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}

              <div className="hidden lg:flex flex-col leading-tight max-w-[115px]">
                <span className="text-[11px] font-semibold text-slate-100 truncate">
                  {user.displayName || user.email?.split('@')[0] || 'Google User'}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  {cloudSyncStatus === 'syncing' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                      <span className="text-cyan-300">
                        {lang === 'vi' ? 'Đang lưu...' : 'Syncing...'}
                      </span>
                    </>
                  ) : cloudSyncStatus === 'error' ? (
                    <>
                      <CloudOff className="w-2.5 h-2.5 text-rose-400" />
                      <span className="text-rose-300">
                        {lang === 'vi' ? 'Lỗi đồng bộ' : 'Sync error'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-emerald-300">
                        {lang === 'vi' ? 'Đã lưu Cloud' : 'Cloud synced'}
                      </span>
                    </>
                  )}
                </span>
              </div>

              <button
                onClick={onSignOutGoogle}
                title={lang === 'vi' ? 'Đăng xuất Google' : 'Sign out'}
                className="p-1.5 rounded-md bg-slate-900/70 hover:bg-rose-950/70 text-slate-300 hover:text-rose-300 border border-slate-700/60 hover:border-rose-800/70 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignInGoogle}
              disabled={authLoading}
              title={
                lang === 'vi'
                  ? 'Đăng nhập Google để lưu Keymap, LED, Macro lên Firebase'
                  : 'Sign in with Google to save configs to Firebase'
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-xs font-semibold text-slate-100 border border-slate-600/80 hover:border-cyan-500/60 transition cursor-pointer"
            >
              {authLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.86 3c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.86-3c-.98.66-2.23 1.06-3.42 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                </svg>
              )}
              <span>{lang === 'vi' ? 'Đăng nhập Google' : 'Google Sign In'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Shared Hidden Profile File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onImportProfile}
        accept=".json"
        className="hidden"
      />

      {/* Mobile Dropdown Quick Tools Sheet */}
      {showMobileMenu && (
        <div className="md:hidden mt-2.5 pt-2.5 border-t border-slate-800 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
          {/* Profile P1-P3 */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-400">Profile:</span>
            <div className="grid grid-cols-3 gap-1.5 flex-1 max-w-[220px]">
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  onClick={() => onSelectProfile(p)}
                  className={`min-h-[40px] rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeProfile === p
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  P{p}
                </button>
              ))}
            </div>
          </div>

          {/* Utility Buttons Grid */}
          <div className="grid grid-cols-2 gap-2">
            {isConnected ? (
              <button
                onClick={() => {
                  onDisconnectHID();
                  setShowMobileMenu(false);
                }}
                className="min-h-[42px] px-3 rounded-xl bg-rose-950/80 text-rose-300 border border-rose-800/60 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{t('disconnect')}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onConnectHID();
                  setShowMobileMenu(false);
                }}
                className="min-h-[42px] px-3 rounded-xl bg-cyan-600 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{t('connectDevice')}</span>
              </button>
            )}

            <button
              onClick={onToggleLang}
              className="min-h-[42px] px-3 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-cyan-400" />
              <span>{lang === 'vi' ? 'Ngôn ngữ: VI' : 'Language: EN'}</span>
            </button>

            <button
              onClick={() => {
                onExportProfile();
                setShowMobileMenu(false);
              }}
              className="min-h-[42px] px-3 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('exportProfile')}</span>
            </button>

            <button
              onClick={() => {
                fileInputRef.current?.click();
                setShowMobileMenu(false);
              }}
              className="min-h-[42px] px-3 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('importProfile')}</span>
            </button>
          </div>

          <PWAInstallButton lang={lang} fullWidth />

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowResetModal(true);
                setShowMobileMenu(false);
              }}
              className="flex-1 min-h-[42px] px-3 rounded-xl bg-slate-800/80 text-rose-300 border border-rose-900/60 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('factoryReset')}</span>
            </button>

            {user && (
              <button
                onClick={() => {
                  onSignOutGoogle();
                  setShowMobileMenu(false);
                }}
                className="flex-1 min-h-[42px] px-3 rounded-xl bg-slate-800/80 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>{lang === 'vi' ? 'Đăng xuất Google' : 'Sign Out'}</span>
              </button>
            )}
          </div>
        </div>
      )}

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
                className="min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  onFactoryReset();
                  setShowResetModal(false);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-600/30 cursor-pointer"
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
