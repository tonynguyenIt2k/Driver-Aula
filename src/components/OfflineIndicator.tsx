import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { Language } from '../types/device';

export const OfflineIndicator: React.FC<{ lang: Language }> = ({ lang }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-3 sm:left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500/95 backdrop-blur-md px-3 py-2 text-xs font-bold text-slate-950 shadow-xl border border-amber-300/60">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        {lang === 'vi'
          ? 'Chế độ Ngoại tuyến — Đang dùng dữ liệu đã lưu trên máy'
          : 'Offline Mode — Using cached app data'}
      </span>
    </div>
  );
};
