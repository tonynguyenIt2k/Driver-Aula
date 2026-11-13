export interface OpenAulaUsbId {
  vendorId: number;
  productId: number;
  role: 'usb' | 'dongle';
}

export interface OpenAulaLayoutKey {
  code: number;
  hid?: number;
  name: string;
  idx: number;
  light: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fnLock?: boolean;
  def?: number[];
}

export interface OpenAulaLightMode {
  mode: number;
  hw?: number;
  name: string;
  caps: number;
}

export interface OpenAulaModel {
  id: string;
  name: string;
  kind: 'keyboard' | 'mouse';
  protocol: 'aula04' | 'aa' | 'g5kb' | 'mouse55';
  usb: OpenAulaUsbId[];
  layout: OpenAulaLayoutKey[];
  extraDefaults?: any[];
  matrixLen?: number;
  features: Record<string, boolean>;
  lightRange?: { brightness: number; speed: number };
  directionMap?: number[];
  lightModes: OpenAulaLightMode[];
  barModes?: { mode: number; name: string }[];
  macroPlay: string[];
  buttonSlots?: any[];
  mouseDefaults?: any;
  settings: any[];
  screen?: {
    width: number;
    height: number;
    headLength: number;
    maxFrames: number;
    chunk: number;
  };
}

export interface OpenAulaDeviceInstance {
  model: OpenAulaModel;
  mode: 'usb' | '2.4g' | 'sim';
  name: string;
  main?: { dev: any; reportId: number; packLen?: number };
  screen?: { dev: any; reportId: number };
  dongle?: { dev: any; reportId: number };
  link?: { dev: any; reportId: number };
  macros?: any[];
  setLighting(cfg: {
    mode: number;
    r?: number;
    g?: number;
    b?: number;
    colorful?: number;
    brightness?: number;
    speed?: number;
    direction?: number;
  }): Promise<any>;
  setBarLight(mode: number): Promise<any>;
  setUserLight(layout: OpenAulaLayoutKey[], colors: Record<number, number[]>, brightness: number): Promise<any>;
  readUserLight(layout: OpenAulaLayoutKey[]): Promise<Record<number, number[]>>;
  setSettings(s: Record<string, number>): Promise<any>;
  setKeymap(layer: 'base' | 'fn', layout: OpenAulaLayoutKey[], actions: Record<number, any>): Promise<any>;
  setMacros(macros: any[]): Promise<any>;
  syncTime(slot?: number, date?: Date): Promise<any>;
  uploadScreen(
    frames: Array<{ pixels: Uint8Array; delayMs: number }>,
    slot?: number,
    onProgress?: (fraction: number) => void
  ): Promise<any>;
  setMatrixEffect(value: number): Promise<any>;
  setMouseConfig?(cfg: any): Promise<any>;
  setButtons?(buttons: any[], macros: any[]): Promise<any>;
  resetKeys(): Promise<any>;
  factoryReset(): Promise<any>;
  battery(): Promise<number | null>;
}
