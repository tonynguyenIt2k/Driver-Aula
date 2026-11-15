import React, { useState } from 'react';
import {
  Terminal,
  Send,
  Trash2,
  Copy,
  Download,
  Filter,
  Check,
  Code,
  Info,
} from 'lucide-react';
import { HIDPacket, Language } from '../types/device';
import { webhidService, ConnectedDeviceInfo } from '../services/webhid';

interface PacketLogTabProps {
  packets: HIDPacket[];
  deviceInfo: ConnectedDeviceInfo;
  isConnected: boolean;
  onClearLog: () => void;
  lang: Language;
  t: (key: string) => string;
}

export const PacketLogTab: React.FC<PacketLogTabProps> = ({
  packets,
  deviceInfo,
  isConnected,
  onClearLog,
  lang,
  t,
}) => {
  const [filter, setFilter] = useState<'all' | 'TX' | 'RX'>('all');
  const [reportIdHex, setReportIdHex] = useState<string>('06');
  const [customHex, setCustomHex] = useState<string>('83 00 00 01 00 00 02');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const filteredPackets = packets.filter((p) => {
    if (filter === 'all') return true;
    return p.direction === filter;
  });

  const handleCopyHex = (id: string, hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSendCustomPacket = async () => {
    setSendStatus(null);
    const clean = customHex.replace(/0x/g, '').replace(/[^0-9a-fA-F]/g, ' ').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    const bytes = parts.map((p) => parseInt(p, 16));
    const parsedReportId = parseInt(reportIdHex.replace(/0x/gi, ''), 16) || 0;

    if (bytes.length === 0) return;

    const res = await webhidService.sendRawReport(
      parsedReportId,
      bytes,
      'CMD_CUSTOM_TRANSMIT',
      `Manual packet -> Report ID 0x${parsedReportId.toString(16).padStart(2, '0')}`
    );
    setSendStatus(res.message);
  };

  const handleExportLog = () => {
    const content = packets
      .map(
        (p) =>
          `[${p.timestamp}] [${p.direction}] ReportID: 0x${p.reportId.toString(16)} | ${p.commandName}\nRAW: ${p.rawHex}\nNote: ${p.notes || ''}\n`
      )
      .join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `open-aula-webhid-packets-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
            <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            <span>{t('packetsTitle')}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {t('packetsSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filter */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold flex-1 sm:flex-initial justify-between">
            {(['all', 'TX', 'RX'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`min-h-[36px] sm:min-h-0 flex-1 sm:flex-initial px-2.5 sm:px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  filter === f
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f === 'all' ? t('filterAll') : f === 'TX' ? 'TX (OUT)' : 'RX (IN)'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportLog}
            className="min-h-[40px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất file</span>
          </button>

          <button
            onClick={onClearLog}
            className="min-h-[40px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('clearLog')}</span>
          </button>
        </div>
      </div>

      {/* Real HID Descriptor Endpoints Inspector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>Descriptor phần cứng thực tế (HID Endpoints)</span>
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {isConnected
              ? `${deviceInfo.productName} (${deviceInfo.protocolFamily})`
              : 'Chưa kết nối thiết bị thật'}
          </span>
        </div>
        {isConnected && deviceInfo.endpoints && deviceInfo.endpoints.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {deviceInfo.endpoints.map((ep, i) => (
              <button
                key={`${ep.kind}-${ep.reportId}-${i}`}
                onClick={() => setReportIdHex(ep.reportId.toString(16).padStart(2, '0').toUpperCase())}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500 text-[11px] font-mono text-cyan-300 transition cursor-pointer"
              >
                {ep.kind.toUpperCase()} • ID:0x{ep.reportId.toString(16).padStart(2, '0').toUpperCase()} •{' '}
                {ep.byteLength}B • UP:0x{ep.usagePage.toString(16).toUpperCase()}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">
            {isConnected
              ? 'Interface này không công bố Feature/Output report.'
              : 'Kết nối bàn phím/chuột qua WebHID để đọc danh sách Report ID & kích thước byte thực tế.'}
          </div>
        )}
      </div>

      {/* Custom Packet Injector Sandbox */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <Code className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs font-mono text-slate-400">
              <span>ID:0x</span>
              <input
                type="text"
                value={reportIdHex}
                onChange={(e) => setReportIdHex(e.target.value.slice(0, 2))}
                className="w-7 bg-transparent text-cyan-300 font-bold focus:outline-none uppercase"
              />
            </div>
            <input
              type="text"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              placeholder={t('hexExample')}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            onClick={handleSendCustomPacket}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition shadow-md shadow-cyan-500/20 flex-shrink-0 w-full sm:w-auto justify-center cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t('sendTestPacket')}</span>
          </button>
        </div>
        {sendStatus && (
          <div className="text-[11px] font-mono text-amber-300">{sendStatus}</div>
        )}
      </div>

      {/* Packet Log Feed */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-800">
          {filteredPackets.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 italic">
              Chưa có gói tin nào theo bộ lọc này.
            </div>
          ) : (
            filteredPackets.map((pkt) => (
              <div
                key={pkt.id}
                className="p-3.5 hover:bg-slate-900/60 transition flex flex-col gap-2 font-mono"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {/* Direction badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pkt.direction === 'TX'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                      }`}
                    >
                      {pkt.direction === 'TX' ? 'TX -> OUT' : 'RX <- IN'}
                    </span>

                    <span className="text-slate-400 text-[11px]">
                      [{pkt.timestamp}]
                    </span>

                    <span className="font-bold text-slate-200">
                      {pkt.commandName}
                    </span>

                    <span className="text-[10px] text-slate-500">
                      Report: 0x{pkt.reportId.toString(16).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {pkt.notes && (
                      <span className="text-[11px] text-slate-400 font-sans hidden md:inline">
                        {pkt.notes}
                      </span>
                    )}
                    <button
                      onClick={() => handleCopyHex(pkt.id, pkt.rawHex)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                      title={t('copyHex')}
                    >
                      {copiedId === pkt.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Hex Stream Display */}
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 text-xs text-cyan-400/90 tracking-wider break-all select-all">
                  {pkt.rawHex}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
