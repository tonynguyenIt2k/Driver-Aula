import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Play,
  Square,
  Clock,
  Sparkles,
  Download,
  Upload,
  Copy,
  Check,
  Flame,
} from 'lucide-react';
import { Macro, MacroAction, Language } from '../types/device';
import { webhidService } from '../services/webhid';

interface MacroTabProps {
  macros: Macro[];
  onUpdateMacros: (macros: Macro[]) => void;
  onApplyMacros?: () => Promise<void> | void;
  onNotify?: (msg: string) => void;
  lang: Language;
  t: (key: string) => string;
}

export const MacroTab: React.FC<MacroTabProps> = ({
  macros,
  onUpdateMacros,
  onApplyMacros,
  onNotify,
  lang,
  t,
}) => {
  const [selectedMacroId, setSelectedMacroId] = useState<string>(
    macros.length > 0 ? macros[0].id : ''
  );
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [lastKeyDownTime, setLastKeyDownTime] = useState<number>(0);
  const [testOutput, setTestOutput] = useState<string>('');
  const [isPlayingTest, setIsPlayingTest] = useState<boolean>(false);
  const [isApplyingHw, setIsApplyingHw] = useState<boolean>(false);

  const selectedMacro = macros.find((m) => m.id === selectedMacroId) || macros[0];

  const handleApplyMacrosToHardware = async () => {
    setIsApplyingHw(true);
    try {
      if (onApplyMacros) {
        await onApplyMacros();
      } else {
        const res = await webhidService.applyMacros(macros);
        onNotify?.(res.message);
      }
    } finally {
      setIsApplyingHw(false);
    }
  };

  // Live Keystroke Recorder listener
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const now = Date.now();
      const delay = lastKeyDownTime > 0 ? Math.min(2000, now - lastKeyDownTime) : 50;

      const newActions: MacroAction[] = [];
      if (delay > 10) {
        newActions.push({
          id: `act-${Date.now()}-delay`,
          type: 'delay',
          delayMs: delay,
        });
      }
      newActions.push({
        id: `act-${Date.now()}-down`,
        type: 'keydown',
        key: e.key,
        code: e.code,
      });

      setLastKeyDownTime(now);

      if (selectedMacro) {
        const updated = macros.map((m) =>
          m.id === selectedMacro.id
            ? { ...m, actions: [...m.actions, ...newActions] }
            : m
        );
        onUpdateMacros(updated);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      const newAction: MacroAction = {
        id: `act-${Date.now()}-up`,
        type: 'keyup',
        key: e.key,
        code: e.code,
      };

      if (selectedMacro) {
        const updated = macros.map((m) =>
          m.id === selectedMacro.id
            ? { ...m, actions: [...m.actions, newAction] }
            : m
        );
        onUpdateMacros(updated);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, lastKeyDownTime, selectedMacro, macros, onUpdateMacros]);

  const handleCreateMacro = () => {
    const newMacro: Macro = {
      id: `macro-${Date.now()}`,
      name: `Macro ${macros.length + 1}`,
      repeatMode: 'once',
      createdAt: Date.now(),
      actions: [
        { id: '1', type: 'keydown', key: 'e', code: 'KeyE' },
        { id: '2', type: 'delay', delayMs: 40 },
        { id: '3', type: 'keyup', key: 'e', code: 'KeyE' },
        { id: '4', type: 'delay', delayMs: 60 },
        { id: '5', type: 'keydown', key: 'q', code: 'KeyQ' },
        { id: '6', type: 'delay', delayMs: 40 },
        { id: '7', type: 'keyup', key: 'q', code: 'KeyQ' },
      ],
    };
    onUpdateMacros([...macros, newMacro]);
    setSelectedMacroId(newMacro.id);
  };

  const handleDeleteMacro = (id: string) => {
    const filtered = macros.filter((m) => m.id !== id);
    onUpdateMacros(filtered);
    if (selectedMacroId === id && filtered.length > 0) {
      setSelectedMacroId(filtered[0].id);
    }
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      setLastKeyDownTime(0);
    } else {
      setIsRecording(true);
      setLastKeyDownTime(Date.now());
    }
  };

  const handleAddDelay = () => {
    if (!selectedMacro) return;
    const newAction: MacroAction = {
      id: `act-${Date.now()}`,
      type: 'delay',
      delayMs: 100,
    };
    const updated = macros.map((m) =>
      m.id === selectedMacro.id ? { ...m, actions: [...m.actions, newAction] } : m
    );
    onUpdateMacros(updated);
  };

  const handleDeleteAction = (actionId: string) => {
    if (!selectedMacro) return;
    const updated = macros.map((m) =>
      m.id === selectedMacro.id
        ? { ...m, actions: m.actions.filter((a) => a.id !== actionId) }
        : m
    );
    onUpdateMacros(updated);
  };

  const handlePlayMacroTest = async () => {
    if (!selectedMacro || isPlayingTest) return;
    setIsPlayingTest(true);
    setTestOutput('');

    for (const act of selectedMacro.actions) {
      if (act.type === 'delay') {
        await new Promise((r) => setTimeout(r, Math.min(act.delayMs || 50, 400)));
      } else if (act.type === 'keydown') {
        setTestOutput((prev) => prev + (act.key && act.key.length === 1 ? act.key : `[${act.key}]`));
      }
    }
    setIsPlayingTest(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Macro List Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              {t('macroTitle')}
            </h3>
            <button
              onClick={handleCreateMacro}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('createMacro')}</span>
            </button>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[460px] overflow-y-auto pr-1">
            {macros.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedMacroId(m.id)}
                className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                  selectedMacro?.id === m.id
                    ? 'bg-gradient-to-r from-purple-900/80 to-indigo-900/80 border border-purple-500/60 text-white'
                    : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    {m.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {m.actions.length} sự kiện • {m.repeatMode}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMacro(m.id);
                  }}
                  className="p-1 hover:text-rose-400 text-slate-500 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Macro Editor & Timeline */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {selectedMacro ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-5">
              {/* Top controls of selected macro */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={selectedMacro.name}
                    onChange={(e) => {
                      const updated = macros.map((m) =>
                        m.id === selectedMacro.id ? { ...m, name: e.target.value } : m
                      );
                      onUpdateMacros(updated);
                    }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                  <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedMacro.actions.length} events</span>
                  </div>
                </div>

                {/* Repeat mode */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">
                    {t('repeatMode')}:
                  </span>
                  <select
                    value={selectedMacro.repeatMode}
                    onChange={(e) => {
                      const mode = e.target.value as Macro['repeatMode'];
                      const updated = macros.map((m) =>
                        m.id === selectedMacro.id ? { ...m, repeatMode: mode } : m
                      );
                      onUpdateMacros(updated);
                    }}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none"
                  >
                    <option value="once">{t('repeatOnce')}</option>
                    <option value="hold">{t('repeatHold')}</option>
                    <option value="toggle">{t('repeatToggle')}</option>
                  </select>
                </div>
              </div>

              {/* Action buttons: Record, Add Delay, Clear */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleToggleRecord}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-md ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-600 hover:to-pink-700'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>{t('stopRecording')}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      <span>{t('recordKeystrokes')}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleAddDelay}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('addDelay')}</span>
                </button>

                <button
                  onClick={handlePlayMacroTest}
                  disabled={isPlayingTest || selectedMacro.actions.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isPlayingTest ? 'Đang chạy...' : 'Chạy thử Macro'}</span>
                </button>

                <button
                  onClick={handleApplyMacrosToHardware}
                  disabled={isApplyingHw}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isApplyingHw ? 'Đang ghi...' : 'Nạp Macro xuống bàn phím'}</span>
                </button>
              </div>

              {/* Recording Notice banner */}
              {isRecording && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs text-rose-200 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                  <span>{t('recordingActive')}</span>
                </div>
              )}

              {/* Timeline of events */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {t('timeline')}
                </span>
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 max-h-56 overflow-y-auto flex flex-wrap gap-2 items-center">
                  {selectedMacro.actions.length === 0 ? (
                    <div className="text-xs text-slate-500 italic p-4">
                      Chưa có sự kiện nào. Hãy bấm "Bắt đầu ghi phím" hoặc "Thêm độ trễ".
                    </div>
                  ) : (
                    selectedMacro.actions.map((act, idx) => (
                      <div
                        key={act.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold shadow-sm ${
                          act.type === 'delay'
                            ? 'bg-slate-800 text-amber-300 border border-amber-800/40'
                            : act.type === 'keydown'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                            : 'bg-slate-800/90 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {act.type === 'delay' ? (
                          <>
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>{act.delayMs}ms</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] uppercase px-1 rounded bg-black/40">
                              {act.type === 'keydown' ? 'DN' : 'UP'}
                            </span>
                            <span>{act.key}</span>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteAction(act.id)}
                          className="hover:text-rose-400 text-slate-500 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Test Sandbox */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-400">
                  {t('testMacro')}:
                </span>
                <input
                  type="text"
                  placeholder={t('typeHereToTest')}
                  value={testOutput}
                  readOnly
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-cyan-300 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
              {t('noMacros')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
