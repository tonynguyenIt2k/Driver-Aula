import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  Mouse,
  Music,
  Settings,
  Ban,
  Command,
  RotateCcw,
  Keyboard,
  ArrowRight,
  X,
  Zap,
} from 'lucide-react';
import { KeyDefinition, KeyRemapAction, Macro, Language } from '../types/device';
import { USB_HID_SCANCODES } from '../data/hidScancodes';

interface KeymapTabProps {
  selectedKey: KeyDefinition | null;
  deviceKeys: KeyDefinition[];
  layerKeymaps: Record<string, KeyRemapAction>;
  onSelectKey: (key: KeyDefinition) => void;
  activeLayer: number;
  onSelectLayer: (layer: number) => void;
  currentAction: KeyRemapAction | null;
  macros: Macro[];
  onRemap: (action: KeyRemapAction | null, targetKey?: KeyDefinition) => void;
  lang: Language;
  t: (key: string) => string;
}

export const KeymapTab: React.FC<KeymapTabProps> = ({
  selectedKey,
  deviceKeys,
  layerKeymaps,
  onSelectKey,
  activeLayer,
  onSelectLayer,
  currentAction,
  macros,
  onRemap,
  lang,
  t,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('standard');
  const [isCapturingKey, setIsCapturingKey] = useState<boolean>(false);
  const [comboMods, setComboMods] = useState<number>(1); // 1=Ctrl, 2=Shift, 4=Alt, 8=Win/Cmd
  const [comboKey, setComboKey] = useState<string>('KeyC');

  const formatComboLabel = (modsMask: number, keyLabel: string) => {
    const parts: string[] = [];
    if (modsMask & 1) parts.push('Ctrl');
    if (modsMask & 2) parts.push('Shift');
    if (modsMask & 4) parts.push('Alt');
    if (modsMask & 8) parts.push('Win');
    parts.push(keyLabel);
    return parts.join(' + ');
  };

  useEffect(() => {
    if (!isCapturingKey || !selectedKey) return;
    let pendingModCode: string | null = null;
    let pendingModLabel = '';

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const hid = USB_HID_SCANCODES[e.code];
      if (hid === undefined) return;
      const niceLabel =
        e.key.length === 1 ? e.key.toUpperCase() : e.code.replace('Key', '').replace('Digit', '');
      const isMod = hid >= 0xe0;

      if (isMod) {
        pendingModCode = e.code;
        pendingModLabel = niceLabel;
        return;
      }

      pendingModCode = null;
      setIsCapturingKey(false);

      const modsMask =
        (e.ctrlKey ? 1 : 0) |
        (e.shiftKey ? 2 : 0) |
        (e.altKey ? 4 : 0) |
        (e.metaKey ? 8 : 0);

      if (modsMask > 0) {
        onRemap({
          type: 'combo',
          value: e.code,
          mods: modsMask,
          label: formatComboLabel(modsMask, niceLabel),
          category: 'Combo',
        });
        return;
      }

      const isFRow = /^F([1-9]|1[0-2])$/.test(e.code);
      onRemap({
        type: 'key',
        value: e.code,
        label: niceLabel,
        category: isFRow ? 'F-Row' : 'Standard',
      });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (pendingModCode && e.code === pendingModCode) {
        e.preventDefault();
        e.stopPropagation();
        const code = pendingModCode;
        const label = pendingModLabel;
        pendingModCode = null;
        setIsCapturingKey(false);
        onRemap({
          type: 'modifier',
          value: code,
          label,
          category: 'Modifier',
        });
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [isCapturingKey, selectedKey, onRemap]);

  // Auto-switch category tab to match the already-assigned target when clicking a remapped key
  useEffect(() => {
    if (!currentAction) return;
    if (currentAction.type === 'combo') {
      setActiveCategory('combo');
      if (typeof currentAction.mods === 'number') setComboMods(currentAction.mods);
      if (currentAction.value) setComboKey(currentAction.value);
    } else if (currentAction.category === 'F-Row' || /^F([1-9]|1[0-2])$/.test(currentAction.value)) {
      setActiveCategory('fkeys');
    } else if (currentAction.type === 'modifier') {
      setActiveCategory('modifiers');
    } else if (currentAction.type === 'media') {
      setActiveCategory('media');
    } else if (currentAction.type === 'mouse') {
      setActiveCategory('mouse');
    } else if (currentAction.type === 'macro') {
      setActiveCategory('macro');
    } else if (currentAction.type === 'rgb') {
      setActiveCategory('rgb');
    } else if (currentAction.type === 'disabled') {
      setActiveCategory('disable');
    } else if (currentAction.type === 'key') {
      setActiveCategory('standard');
    }
  }, [selectedKey?.id, currentAction]);

  const remappedEntries = Object.entries(layerKeymaps)
    .map(([keyId, action]) => ({
      keyDef: deviceKeys.find((k) => k.id === keyId),
      keyId,
      action,
    }))
    .filter((entry): entry is { keyDef: KeyDefinition; keyId: string; action: KeyRemapAction } =>
      Boolean(entry.keyDef)
    );

  const fRowKeys = Array.from({ length: 12 }, (_, i) => ({
    label: `F${i + 1}`,
    value: `F${i + 1}`,
  }));

  const standardKeys = [
    ...fRowKeys,
    { label: 'A', value: 'KeyA' }, { label: 'B', value: 'KeyB' }, { label: 'C', value: 'KeyC' },
    { label: 'D', value: 'KeyD' }, { label: 'E', value: 'KeyE' }, { label: 'F', value: 'KeyF' },
    { label: 'G', value: 'KeyG' }, { label: 'H', value: 'KeyH' }, { label: 'I', value: 'KeyI' },
    { label: 'J', value: 'KeyJ' }, { label: 'K', value: 'KeyK' }, { label: 'L', value: 'KeyL' },
    { label: 'M', value: 'KeyM' }, { label: 'N', value: 'KeyN' }, { label: 'O', value: 'KeyO' },
    { label: 'P', value: 'KeyP' }, { label: 'Q', value: 'KeyQ' }, { label: 'R', value: 'KeyR' },
    { label: 'S', value: 'KeyS' }, { label: 'T', value: 'KeyT' }, { label: 'U', value: 'KeyU' },
    { label: 'V', value: 'KeyV' }, { label: 'W', value: 'KeyW' }, { label: 'X', value: 'KeyX' },
    { label: 'Y', value: 'KeyY' }, { label: 'Z', value: 'KeyZ' },
    { label: '1', value: 'Digit1' }, { label: '2', value: 'Digit2' }, { label: '3', value: 'Digit3' },
    { label: '4', value: 'Digit4' }, { label: '5', value: 'Digit5' }, { label: '6', value: 'Digit6' },
    { label: '7', value: 'Digit7' }, { label: '8', value: 'Digit8' }, { label: '9', value: 'Digit9' },
    { label: '0', value: 'Digit0' }, { label: '-', value: 'Minus' }, { label: '=', value: 'Equal' },
    { label: '[', value: 'BracketLeft' }, { label: ']', value: 'BracketRight' }, { label: '\\', value: 'Backslash' },
    { label: ';', value: 'Semicolon' }, { label: '\'', value: 'Quote' }, { label: ',', value: 'Comma' },
    { label: '.', value: 'Period' }, { label: '/', value: 'Slash' }, { label: '`', value: 'Backquote' },
  ];

  const modifierKeys = [
    { label: 'Ctrl Left', value: 'ControlLeft' }, { label: 'Ctrl Right', value: 'ControlRight' },
    { label: 'Shift Left', value: 'ShiftLeft' }, { label: 'Shift Right', value: 'ShiftRight' },
    { label: 'Alt Left', value: 'AltLeft' }, { label: 'Alt Right', value: 'AltRight' },
    { label: 'Win / Cmd Left', value: 'MetaLeft' }, { label: 'Win / Cmd Right', value: 'MetaRight' },
    { label: 'Menu / App', value: 'ContextMenu' }, { label: 'Caps Lock', value: 'CapsLock' },
    { label: 'Tab', value: 'Tab' }, { label: 'Enter', value: 'Enter' },
    { label: 'Backspace', value: 'Backspace' }, { label: 'Spacebar', value: 'Space' },
    { label: 'Escape', value: 'Escape' }, { label: 'Insert', value: 'Insert' },
    { label: 'Delete', value: 'Delete' }, { label: 'Home', value: 'Home' },
    { label: 'End', value: 'End' }, { label: 'Page Up', value: 'PageUp' },
    { label: 'Page Down', value: 'PageDown' }, { label: 'Arrow Up', value: 'ArrowUp' },
    { label: 'Arrow Down', value: 'ArrowDown' }, { label: 'Arrow Left', value: 'ArrowLeft' },
    { label: 'Arrow Right', value: 'ArrowRight' }, { label: 'Print Screen', value: 'PrintScreen' },
    { label: 'Scroll Lock', value: 'ScrollLock' }, { label: 'Pause / Break', value: 'Pause' },
  ];

  const mediaKeys = [
    { label: 'Volume Up (+)', value: 'AudioVolumeUp' },
    { label: 'Volume Down (-)', value: 'AudioVolumeDown' },
    { label: 'Mute Audio', value: 'AudioVolumeMute' },
    { label: 'Play / Pause', value: 'MediaPlayPause' },
    { label: 'Next Track', value: 'MediaTrackNext' },
    { label: 'Previous Track', value: 'MediaTrackPrevious' },
    { label: 'Stop Music', value: 'MediaStop' },
    { label: 'Calculator', value: 'LaunchCalculator' },
    { label: 'Web Browser', value: 'LaunchWebBrowser' },
    { label: 'My Computer', value: 'LaunchMyComputer' },
  ];

  const mouseKeys = [
    { label: 'Mouse Left Click', value: 'MouseLeft' },
    { label: 'Mouse Right Click', value: 'MouseRight' },
    { label: 'Mouse Middle Click', value: 'MouseMiddle' },
    { label: 'Double Left Click', value: 'MouseDoubleClick' },
    { label: 'Scroll Wheel Up', value: 'MouseScrollUp' },
    { label: 'Scroll Wheel Down', value: 'MouseScrollDown' },
    { label: 'Mouse Forward', value: 'MouseForward' },
    { label: 'Mouse Back', value: 'MouseBack' },
  ];

  const rgbKeys = [
    { label: 'RGB Mode Cycle (+)', value: 'RGB_MODE_NEXT' },
    { label: 'RGB Mode Cycle (-)', value: 'RGB_MODE_PREV' },
    { label: 'Brightness Up (+)', value: 'RGB_BRIGHTNESS_UP' },
    { label: 'Brightness Down (-)', value: 'RGB_BRIGHTNESS_DOWN' },
    { label: 'Speed Up (+)', value: 'RGB_SPEED_UP' },
    { label: 'Speed Down (-)', value: 'RGB_SPEED_DOWN' },
    { label: 'Toggle RGB On/Off', value: 'RGB_TOGGLE' },
  ];

  const comboBaseKeys = [
    ...standardKeys,
    { label: 'Space', value: 'Space' },
    { label: 'Enter', value: 'Enter' },
    { label: 'Tab', value: 'Tab' },
    { label: 'Esc', value: 'Escape' },
    { label: 'Backspace', value: 'Backspace' },
    { label: 'Delete', value: 'Delete' },
    { label: 'Insert', value: 'Insert' },
    { label: 'Home', value: 'Home' },
    { label: 'End', value: 'End' },
    { label: 'PageUp', value: 'PageUp' },
    { label: 'PageDown', value: 'PageDown' },
    { label: '↑ Up', value: 'ArrowUp' },
    { label: '↓ Down', value: 'ArrowDown' },
    { label: '← Left', value: 'ArrowLeft' },
    { label: '→ Right', value: 'ArrowRight' },
    { label: 'PrintScreen', value: 'PrintScreen' },
  ];

  const comboPresets: { label: string; mods: number; value: string; hint: string }[] = [
    { label: 'Ctrl + C', mods: 1, value: 'KeyC', hint: 'Copy' },
    { label: 'Ctrl + V', mods: 1, value: 'KeyV', hint: 'Paste' },
    { label: 'Ctrl + X', mods: 1, value: 'KeyX', hint: 'Cut' },
    { label: 'Ctrl + Z', mods: 1, value: 'KeyZ', hint: 'Undo' },
    { label: 'Ctrl + Y', mods: 1, value: 'KeyY', hint: 'Redo' },
    { label: 'Ctrl + A', mods: 1, value: 'KeyA', hint: 'Select All' },
    { label: 'Ctrl + S', mods: 1, value: 'KeyS', hint: 'Save' },
    { label: 'Alt + Tab', mods: 4, value: 'Tab', hint: 'Đổi cửa sổ' },
    { label: 'Alt + F4', mods: 4, value: 'F4', hint: 'Đóng app' },
    { label: 'Win + D', mods: 8, value: 'KeyD', hint: 'Desktop' },
    { label: 'Win + Shift + S', mods: 10, value: 'KeyS', hint: 'Chụp màn hình' },
    { label: 'Ctrl + Shift + Esc', mods: 3, value: 'Escape', hint: 'Task Manager' },
  ];

  const categories = [
    { id: 'standard', name: t('categoryStandard'), icon: Command },
    { id: 'combo', name: lang === 'vi' ? 'Tổ hợp phím' : 'Shortcuts', icon: Zap },
    { id: 'fkeys', name: lang === 'vi' ? 'Hàng F (F1–F12)' : 'F-Row (F1–F12)', icon: Keyboard },
    { id: 'modifiers', name: t('categoryModifiers'), icon: Settings },
    { id: 'media', name: t('categoryMedia'), icon: Music },
    { id: 'mouse', name: t('categoryMouse'), icon: Mouse },
    { id: 'macro', name: t('categoryMacro'), icon: Sparkles },
    { id: 'rgb', name: t('categoryLighting'), icon: Sparkles },
    { id: 'disable', name: t('categoryDisable'), icon: Ban },
  ];

  const isTargetActive = (type: string, value: string) =>
    currentAction?.type === type && currentAction?.value === value;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Layer Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-300">
            {t('tabKeymap')}:
          </span>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2">
          {[0, 1, 2, 3].map((l) => (
            <button
              key={l}
              onClick={() => onSelectLayer(l)}
              className={`min-h-[44px] sm:min-h-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center justify-center text-center leading-snug cursor-pointer min-w-0 ${
                activeLayer === l
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              <span>{t(`layer${l}`)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Saved / Currently Remapped Keys Summary Bar */}
      {remappedEntries.length > 0 && (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>
                {lang === 'vi'
                  ? `Các phím đã gán trong Layer này (${remappedEntries.length} phím)`
                  : `Remapped Keys in this Layer (${remappedEntries.length})`}
              </span>
            </span>
            <span className="text-[11px] text-slate-400">
              {lang === 'vi'
                ? 'Tự động lưu & hiển thị lại ở những lần sau'
                : 'Saved automatically across sessions'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {remappedEntries.map(({ keyDef, keyId, action }) => {
              const isSelected = selectedKey?.id === keyId;
              return (
                <div
                  key={keyId}
                  onClick={() => onSelectKey(keyDef)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                      : 'bg-slate-800/90 border-slate-700 hover:border-amber-500/60 text-slate-200'
                  }`}
                >
                  <span className="font-bold text-cyan-300">
                    {keyDef.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({keyDef.code})
                  </span>
                  <ArrowRight className="w-3 h-3 text-amber-400" />
                  <span className="font-bold text-amber-300">
                    {action.label}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemap(null, keyDef);
                    }}
                    title={lang === 'vi' ? 'Đặt lại phím này về mặc định' : 'Reset key to default'}
                    className="ml-0.5 p-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Key Status Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
        {selectedKey ? (
          <div className="flex items-center gap-3.5 sm:gap-4 w-full md:w-auto">
            <div
              className={`w-14 h-14 shrink-0 rounded-xl bg-slate-800 border-2 flex flex-col items-center justify-center font-bold text-base sm:text-lg shadow-lg ${
                currentAction
                  ? 'border-amber-400 text-amber-300 shadow-amber-500/20'
                  : 'border-cyan-500 text-cyan-300 shadow-cyan-500/20'
              }`}
            >
              {selectedKey.label}
              <span className="text-[9px] font-mono text-slate-400">
                {selectedKey.code}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 font-medium">
                {t('selectedKey')}
              </div>
              <div className="text-sm font-bold text-slate-100 flex flex-wrap items-center gap-2 mt-0.5">
                <span>{selectedKey.label}</span>
                {currentAction ? (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-500/60 font-semibold">
                    {t('assignedTo')}: {currentAction.label} ({currentAction.category})
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-normal">
                    {t('defaultAction')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-cyan-400/90 font-medium flex items-center gap-2">
            <Command className="w-4 h-4 shrink-0" />
            <span>{t('clickToRemapPrompt')}</span>
          </div>
        )}

        {selectedKey && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsCapturingKey((v) => !v)}
              className={`min-h-[42px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                isCapturingKey
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-700/60'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>
                {isCapturingKey
                  ? lang === 'vi'
                    ? 'Đang chờ nhấn phím...'
                    : 'Press any key...'
                  : lang === 'vi'
                  ? 'Nhấn phím bất kỳ để gán'
                  : 'Press a key to assign'}
              </span>
            </button>

            {currentAction && (
              <button
                onClick={() => onRemap(null)}
                className="min-h-[42px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-400 border border-slate-700 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('restoreKeyDefault')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Remap Options Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-3 sm:mb-4 flex flex-wrap items-center gap-2">
          <span>{t('remapDrawerTitle')}</span>
          {!selectedKey && (
            <span className="text-xs font-normal text-amber-400">
              (Hãy chọn một phím trên bàn phím phía trên trước)
            </span>
          )}
        </h3>

        {/* Category Tabs (Horizontal scrollable strip on mobile) */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar md:flex-wrap gap-2 mb-4 border-b border-slate-800 pb-3">
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`min-h-[40px] sm:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  activeCategory === c.id
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* Category Items Grid */}
        <div className="max-h-72 sm:max-h-64 overflow-y-auto p-0.5 sm:p-1">
          {activeCategory === 'standard' && (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {standardKeys.map((item) => {
                const active = isTargetActive('key', item.value);
                return (
                  <button
                    key={item.value}
                    disabled={!selectedKey}
                    onClick={() =>
                      onRemap({
                        type: 'key',
                        value: item.value,
                        label: item.label,
                        category: /^F\d+$/.test(item.value) ? 'F-Row' : 'Standard',
                      })
                    }
                    className={`min-h-[44px] sm:min-h-0 p-2.5 rounded-lg border text-xs font-bold font-mono transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                      active
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                        : 'bg-slate-800/80 hover:bg-cyan-600/30 hover:border-cyan-500 border-slate-700/80 text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeCategory === 'combo' && (
            <div className="flex flex-col gap-4">
              {/* Custom Combo Builder */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-cyan-300">
                    {lang === 'vi'
                      ? 'Tạo tổ hợp tùy ý (Chọn phím giữ + 1 phím chính)'
                      : 'Custom Shortcut Builder'}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                    {comboMods > 0
                      ? formatComboLabel(
                          comboMods,
                          comboBaseKeys.find((k) => k.value === comboKey)?.label || comboKey
                        )
                      : comboBaseKeys.find((k) => k.value === comboKey)?.label || comboKey}
                  </span>
                </div>

                {/* Modifier Toggles */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { bit: 1, label: 'Ctrl' },
                    { bit: 2, label: 'Shift' },
                    { bit: 4, label: 'Alt' },
                    { bit: 8, label: 'Win / Cmd' },
                  ].map((mod) => {
                    const active = (comboMods & mod.bit) !== 0;
                    return (
                      <button
                        key={mod.bit}
                        type="button"
                        onClick={() => setComboMods((prev) => prev ^ mod.bit)}
                        className={`min-h-[42px] px-2 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                          active
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {mod.label}
                      </button>
                    );
                  })}
                </div>

                {/* Base Key Select + Apply Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={comboKey}
                    onChange={(e) => setComboKey(e.target.value)}
                    className="flex-1 min-h-[42px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    {comboBaseKeys.map((k) => (
                      <option key={k.value} value={k.value}>
                        Phím chính: {k.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!selectedKey || comboMods === 0}
                    onClick={() => {
                      const keyLabel =
                        comboBaseKeys.find((k) => k.value === comboKey)?.label || comboKey;
                      onRemap({
                        type: 'combo',
                        value: comboKey,
                        mods: comboMods,
                        label: formatComboLabel(comboMods, keyLabel),
                        category: 'Combo',
                      });
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  >
                    {lang === 'vi' ? 'Gán tổ hợp này' : 'Assign Shortcut'}
                  </button>
                </div>
                {comboMods === 0 && (
                  <p className="text-[11px] text-amber-400">
                    Hãy chọn ít nhất 1 phím giữ (Ctrl, Shift, Alt hoặc Win).
                  </p>
                )}
              </div>

              {/* Popular Quick Combo Presets */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'vi' ? 'Tổ hợp phổ biến (1 chạm gán ngay)' : 'Quick Presets'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {comboPresets.map((preset) => {
                    const active =
                      currentAction?.type === 'combo' &&
                      currentAction?.value === preset.value &&
                      (currentAction?.mods ?? 0) === preset.mods;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={!selectedKey}
                        onClick={() =>
                          onRemap({
                            type: 'combo',
                            value: preset.value,
                            mods: preset.mods,
                            label: preset.label,
                            category: 'Combo',
                          })
                        }
                        className={`min-h-[48px] min-w-0 p-2.5 rounded-lg border text-left transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex flex-col justify-center ${
                          active
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                            : 'bg-slate-800/80 hover:bg-cyan-600/30 hover:border-cyan-500 border-slate-700/80 text-slate-200'
                        }`}
                      >
                        <span className="text-xs font-bold font-mono truncate">
                          {preset.label}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {preset.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'fkeys' && (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {fRowKeys.map((item) => {
                const active = isTargetActive('key', item.value);
                return (
                  <button
                    key={item.value}
                    disabled={!selectedKey}
                    onClick={() =>
                      onRemap({
                        type: 'key',
                        value: item.value,
                        label: item.label,
                        category: 'F-Row',
                      })
                    }
                    className={`min-h-[44px] sm:min-h-0 p-2.5 rounded-lg border text-xs font-bold font-mono transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                      active
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                        : 'bg-slate-800/80 hover:bg-cyan-600/30 hover:border-cyan-500 border-slate-700/80 text-cyan-300'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeCategory === 'modifiers' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {modifierKeys.map((item) => {
                const active = isTargetActive('modifier', item.value);
                return (
                  <button
                    key={item.value}
                    disabled={!selectedKey}
                    onClick={() =>
                      onRemap({
                        type: 'modifier',
                        value: item.value,
                        label: item.label,
                        category: 'Modifier',
                      })
                    }
                    className={`min-h-[44px] sm:min-h-0 min-w-0 p-2.5 rounded-lg border text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed text-left flex items-center justify-between cursor-pointer break-words leading-snug ${
                      active
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                        : 'bg-slate-800/80 hover:bg-cyan-600/30 hover:border-cyan-500 border-slate-700/80 text-slate-200'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {activeCategory === 'media' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {mediaKeys.map((item) => {
                const active = isTargetActive('media', item.value);
                return (
                  <button
                    key={item.value}
                    disabled={!selectedKey}
                    onClick={() =>
                      onRemap({
                        type: 'media',
                        value: item.value,
                        label: item.label,
                        category: 'Media',
                      })
                    }
                    className={`min-h-[44px] sm:min-h-0 min-w-0 p-2.5 rounded-lg border text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed text-left cursor-pointer break-words leading-snug ${
                      active
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                        : 'bg-slate-800/80 hover:bg-cyan-600/30 hover:border-cyan-500 border-slate-700/80 text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeCategory === 'mouse' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {mouseKeys.map((item) => {
                const active = isTargetActive('mouse', item.value);
                return (
                  <button
                    key={item.value}
                    disabled={!selectedKey}
                    onClick={() =>
                      onRemap({
                        type: 'mouse',
                        value: item.value,
                        label: item.label,
                        category: 'Mouse',
                      })
                    }
                    className={`min-h-[44px] sm:min-h-0 min-w-0 p-2.5 rounded-lg border text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed text-left cursor-pointer break-words leading-snug ${
                      active
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                        : 'bg-slate-800/80 hover:bg-cyan-600/30 hover:border-cyan-500 border-slate-700/80 text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeCategory === 'macro' && (
            <div>
              {macros.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  {t('noMacros')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {macros.map((m) => {
                    const active = isTargetActive('macro', m.id);
                    return (
                      <button
                        key={m.id}
                        disabled={!selectedKey}
                        onClick={() =>
                          onRemap({
                            type: 'macro',
                            value: m.id,
                            label: m.name,
                            category: 'Macro',
                          })
                        }
                        className={`min-h-[48px] p-3 rounded-lg border text-xs transition disabled:opacity-40 disabled:cursor-not-allowed text-left flex flex-col gap-1 cursor-pointer ${
                          active
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                            : 'bg-slate-800/80 hover:bg-purple-950/60 hover:border-purple-500 border-slate-700/80 text-slate-200'
                        }`}
                      >
                        <div className="font-bold text-purple-300 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span>{m.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {m.actions.length} sự kiện • {m.repeatMode}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeCategory === 'rgb' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {rgbKeys.map((item) => {
                const active = isTargetActive('rgb', item.value);
                return (
                  <button
                    key={item.value}
                    disabled={!selectedKey}
                    onClick={() =>
                      onRemap({
                        type: 'rgb',
                        value: item.value,
                        label: item.label,
                        category: 'RGB',
                      })
                    }
                    className={`min-h-[44px] sm:min-h-0 min-w-0 p-2.5 rounded-lg border text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed text-left cursor-pointer break-words leading-snug ${
                      active
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                        : 'bg-slate-800/80 hover:bg-cyan-600/30 hover:border-cyan-500 border-slate-700/80 text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeCategory === 'disable' && (
            <div className="p-4 bg-slate-800/70 border border-slate-700/70 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-xs text-slate-200">
                  {t('categoryDisable')}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Phím này sẽ bị vô hiệu hóa hoàn toàn khi được nhấn.
                </p>
              </div>
              <button
                disabled={!selectedKey}
                onClick={() =>
                  onRemap({
                    type: 'disabled',
                    value: 'DISABLED',
                    label: 'Locked',
                    category: 'System',
                  })
                }
                className={`min-h-[44px] sm:min-h-0 px-4 py-2 rounded-lg text-white font-bold text-xs transition disabled:opacity-40 cursor-pointer shrink-0 ${
                  currentAction?.type === 'disabled'
                    ? 'bg-amber-600 hover:bg-amber-500 ring-1 ring-amber-300'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {currentAction?.type === 'disabled' ? 'Đang khóa phím này' : 'Khóa phím này'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
