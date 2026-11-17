export type DeviceType = 'keyboard' | 'mouse';

export interface KeyDefinition {
  id: string; // e.g., "K_ESC", "K_A"
  code: string; // KeyboardEvent.code e.g. "Escape", "KeyA"
  label: string; // Default visual text e.g. "ESC", "A"
  shiftLabel?: string; // e.g. "~", "!"
  subLabel?: string; // Secondary Fn legend e.g. "F1", "BT1"
  row: number; // 0 to 5
  col: number; // visual column index
  width: number; // in unit (1 = 1u, 1.25 = 1.25u, etc.)
  height?: number; // default 1
  isKnob?: boolean; // Volume knob indicator
  isScreen?: boolean; // Built-in mini display
  colorGroup?: 'accent' | 'modifier' | 'alpha' | 'special';
  hwIdx?: number; // Hardware keymap table slot index (e.g. Aula04 idx)
  hwLight?: number; // Hardware per-key RGB matrix index (e.g. Aula04 light)
}

export type RGBEffectMode =
  | 'static'
  | 'starlight'
  | 'breathing'
  | 'fountain'
  | 'rainbow_wave'
  | 'currents'
  | 'revolving'
  | 'spectrum'
  | 'reactive'
  | 'ripple'
  | 'raindrop'
  | 'neon'
  | 'snake'
  | 'audio'
  | 'custom_matrix'
  | 'off';

export interface MusicRhythmConfig {
  rhythmStyle: 'gradient' | 'spectrum' | 'pulse' | 'center';
  backgroundMode: 'off' | 'static' | 'breathing';
  amplitude: number; // 0 - 100
  backgroundBrightness: number; // 0 - 100
}

export interface SystemSettings {
  debounceLevel: 1 | 2 | 3 | 4 | 5; // Level 1..5
  sleepMinutes: 1 | 3 | 5 | 10 | 30 | 0; // 0 = Never
  disableWinKey: boolean;
  disableAltF4: boolean;
  disableAltTab: boolean;
}

export interface LightingConfig {
  mode: RGBEffectMode;
  brightness: number; // 0 to 100
  speed: number; // 1 to 5
  direction: 'left' | 'right' | 'outward' | 'inward';
  primaryColor: string; // Hex e.g. "#00f0ff"
  secondaryColor?: string; // Hex
  customKeyColors: Record<string, string>; // keyId -> hex color
  sleepTimeout: number; // in minutes (0 = never, 5, 10, 15, 30)
  musicRhythm?: MusicRhythmConfig;
}

export type KeyActionType =
  | 'default'
  | 'key'
  | 'combo'
  | 'modifier'
  | 'media'
  | 'mouse'
  | 'macro'
  | 'rgb'
  | 'system'
  | 'disabled';

export interface KeyRemapAction {
  type: KeyActionType;
  value: string; // target keycode or action identifier
  mods?: number; // USB HID modifier bitmask (1=LCtrl, 2=LShift, 4=LAlt, 8=LWin/Cmd)
  label: string;
  category: string;
}

export interface MacroAction {
  id: string;
  type: 'keydown' | 'keyup' | 'delay' | 'mouse';
  key?: string;
  code?: string;
  mouseButton?: 'left' | 'right' | 'middle';
  delayMs?: number;
}

export interface Macro {
  id: string;
  name: string;
  repeatMode: 'once' | 'hold' | 'toggle';
  actions: MacroAction[];
  createdAt: number;
}

export interface DPISetting {
  stage: number;
  dpi: number;
  color: string;
  enabled: boolean;
}

export interface MouseConfig {
  dpiStages: DPISetting[];
  currentStage: number;
  pollingRate: 125 | 250 | 500 | 1000 | 2000 | 4000;
  lod: 1 | 2; // Lift off distance in mm
  debounceTime: number; // 0 to 20 ms
  angleSnapping: boolean;
  motionSync: boolean;
  buttonActions: Record<string, KeyRemapAction>;
}

export interface ScreenFrame {
  id: string;
  dataUrl: string; // 80x160 PNG data URL for instant editing/preview
  delayMs: number; // e.g. 40ms
}

export interface ScreenAnimation {
  id: string;
  name: string;
  frames: ScreenFrame[];
  width?: number;
  height?: number;
  createdAt?: number;
}

export interface ScreenConfig {
  brightness: number; // 0 - 100
  fps: number; // 5 - 30
  currentGifUrl: string;
  activeAnimationId?: string;
  orientation: 0 | 90 | 180 | 270;
  showTimeOverlay: boolean;
  showBatteryOverlay: boolean;
  showTempOverlay: boolean;
}

export interface DeviceProfile {
  id: string;
  name: string;
  deviceId: string;
  lighting: LightingConfig;
  keymaps: Record<number, Record<string, KeyRemapAction>>; // layer -> { keyId -> action }
  macros: Macro[];
  mouseConfig?: MouseConfig;
  screenConfig?: ScreenConfig;
}

export interface DeviceModel {
  id: string;
  name: string;
  series: 'S-Series' | 'F-Series' | 'SC-Series';
  type: DeviceType;
  layoutName: string;
  vendorId: number;
  productId: number;
  keys?: KeyDefinition[];
  hasKnob?: boolean;
  hasScreen?: boolean;
  screenResolution?: { width: number; height: number };
  defaultLighting: LightingConfig;
  mouseSensors?: string;
  defaultDPI?: number;
  imageThumbnail?: string;
  description: string;
}

export interface HIDPacket {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX';
  reportType: 'Feature' | 'Output' | 'Input';
  reportId: number;
  commandName: string;
  rawHex: string;
  payload: number[];
  notes?: string;
}

export type SwitchSoundType = 'greywood' | 'reaper' | 'clicky' | 'silent' | 'off';

export type Language = 'vi' | 'en';
