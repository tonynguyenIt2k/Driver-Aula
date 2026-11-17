import React, { useState } from 'react';
import { Download, Smartphone, Share, ExternalLink, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../types/device';

interface PWAInstallButtonProps {
  lang: Language;
  compact?: boolean;
  fullWidth?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang,
  compact = false,
  fullWidth = false,
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={
          lang === 'vi'
            ? 'Cài đặt Open AULA lên màn hình chính / Desktop như ứng dụng độc lập'
            : 'Install Open AULA as a standalone app'
        }
        className={`flex items-center justify-center gap-1.5 rounded-lg font-bold transition cursor-pointer ${
          fullWidth
            ? 'w-full min-h-[42px] px-3 py-2 text-xs'
            : compact
            ? 'w-9 h-9 text-xs shrink-0'
            : 'px-2.5 py-1.5 text-xs'
        } ${
          isInstallable
            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-sm shadow-emerald-500/20'
            : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/60'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        {!compact && (
          <span className="whitespace-nowrap">
            {lang === 'vi' ? 'Cài App' : 'Install App'}
          </span>
        )}
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    {lang === 'vi' ? 'Cài Open AULA như App' : 'Install Open AULA App'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lang === 'vi'
                      ? 'Mở toàn màn hình, icon riêng & hỗ trợ dùng offline'
                      : 'Standalone app icon & offline support'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 flex flex-col gap-2 leading-relaxed">
                <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Share className="w-3.5 h-3.5" />
                  <span>Hướng dẫn cho iPhone / iPad (Safari):</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-300">
                  <li>
                    Mở trang này bằng trình duyệt <strong>Safari</strong> (nếu đang ở khung xem trước, hãy bấm nút <strong>Mở trong Tab mới</strong> bên dưới).
                  </li>
                  <li>
                    Chạm biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh dưới/trên của Safari.
                  </li>
                  <li>
                    Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong> → bấm <strong>Thêm</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 flex flex-col gap-2 leading-relaxed">
                <div className="font-bold text-emerald-300">
                  Hướng dẫn cài đặt trên Android & Máy tính (Chrome / Edge):
                </div>
                <ul className="list-disc pl-4 space-y-1.5 text-slate-300">
                  {isInIframe && (
                    <li>
                      Bạn đang xem trong khung nhúng: hãy bấm <strong>Mở trong Tab mới</strong> bên dưới, sau đó bấm <strong>Cài App</strong> hoặc menu trình duyệt.
                    </li>
                  )}
                  <li>
                    <strong>Android (Chrome):</strong> Bấm menu <strong>⋮</strong> góc trên phải → chọn <strong>Thêm vào Màn hình chính / Cài đặt ứng dụng</strong>.
                  </li>
                  <li>
                    <strong>Windows / macOS (Chrome / Edge):</strong> Bấm biểu tượng <strong>Cài đặt (⊕ / màn hình)</strong> ở cuối thanh địa chỉ URL, hoặc menu <strong>⋮ → Truyền, lưu và chia sẻ → Cài đặt Open AULA</strong>.
                  </li>
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {isInIframe && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Mở trong Tab mới để cài' : 'Open in New Tab'}</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
              >
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
