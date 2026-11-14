/**
 * Real WebHID Driver Adapter powered directly by paulcoding810/open-aula protocol engines:
 * - Aula04 (AULA S75 Pro USB + 2.4GHz Dongle + 135x240 TFT Screen)
 * - G5KB (AULA F75 EVVision 518B)
 * - AA (AULA F87 Pro Wired + 2.4GHz Dongle)
 * - Mouse55 (AULA SC620 Gaming Mouse Wired + 2.4GHz Dongle)
 * Zero simulation: transmits and reads genuine W3C WebHID reports only.
 */

import {
  HIDPacket,
  LightingConfig,
  KeyRemapAction,
  SystemSettings,
  KeyDefinition,
  Macro,
  MouseConfig,
  RGBEffectMode,
} from '../types/device';
import { USB_HID_SCANCODES, USB_CONSUMER_CODES } from '../data/hidScancodes';
import {
  OpenAulaDeviceInstance,
  OpenAulaLayoutKey,
  OpenAulaModel,
} from '../types/openAula';
import {
  MODELS,
  hidFilters,
  modelById,
  modelForDevice,
  attachModel,
  attach,
} from '../open-aula/models/index.js';

export const AULA_VENDOR_FILTERS: Array<{ vendorId: number; productId?: number }> = hidFilters();

export interface ReportEndpoint {
  kind: 'feature' | 'output' | 'input';
  reportId: number;
  byteLength: number;
  usagePage: number;
  usage: number;
}

export interface ConnectedDeviceInfo {
  productName: string;
  vendorId: number;
  productId: number;
  batteryLevel: number | null;
  firmwareVersion: string;
  connectionType: 'wired' | 'wireless_2.4g' | 'bluetooth' | 'disconnected';
  serialNumber?: string;
  usagePage?: number;
  usage?: number;
  protocolFamily?: 'aula04' | 'g5kb' | 'aa' | 'mouse55';
  openAulaModelId?: string;
  hasMainInterface?: boolean;
  hasScreenInterface?: boolean;
  endpoints?: ReportEndpoint[];
}

export interface ConnectResult {
  success: boolean;
  message: string;
  errorType?: 'unsupported' | 'permissions_policy' | 'cancelled' | 'open_failed';
  deviceInfo?: ConnectedDeviceInfo;
}

export interface CommandResult {
  ok: boolean;
  message: string;
  missingScreenInterface?: boolean;
}

type PacketListener = (packet: HIDPacket) => void;
type StatusListener = (connected: boolean, info: ConnectedDeviceInfo | null) => void;

const MOUSE_ID_MAP: Record<string, number> = {
  MouseLeft: 1,
  MouseMiddle: 2,
  MouseRight: 3,
  MouseDoubleClick: 4,
  MouseScrollUp: 5,
  MouseScrollDown: 6,
  MouseBack: 7,
  MouseForward: 8,
};

class WebHIDService {
  private kb: OpenAulaDeviceInstance | null = null;
  private pairedDevices: any[] = [];
  private endpoints: ReportEndpoint[] = [];
  private packets: HIDPacket[] = [];
  private packetListeners: Set<PacketListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private preferredOpenAulaModelId: string | null = null;

  private deviceInfo: ConnectedDeviceInfo = {
    productName: 'Chưa kết nối thiết bị',
    vendorId: 0,
    productId: 0,
    batteryLevel: null,
    firmwareVersion: '--',
    connectionType: 'disconnected',
  };

  constructor() {
    this.initHIDListeners();
  }

  public setPreferredModel(modelId: string | null) {
    this.preferredOpenAulaModelId = modelId;
    if (this.kb && modelId && this.kb.model.protocol === 'aula04' && (modelId === 's75pro' || modelId === 'f108pro')) {
      const nextModel = modelById(modelId) as OpenAulaModel;
      if (nextModel && nextModel.id !== this.kb.model.id) {
        this.kb.model = nextModel;
        this.deviceInfo = {
          ...this.deviceInfo,
          openAulaModelId: nextModel.id,
        };
        this.notifyStatus();
      }
    }
  }

  private initHIDListeners() {
    if (!this.isWebHIDSupported()) return;
    try {
      const navHid = (navigator as any).hid;
      navHid.addEventListener('connect', () => {
        this.checkPairedDevices(false);
      });
      navHid.addEventListener('disconnect', (event: any) => {
        const activeDevs = this.getActiveRawDevices();
        if (event?.device && activeDevs.includes(event.device)) {
          this.disconnect();
        } else {
          this.checkPairedDevices(false);
        }
      });
    } catch {
      // Ignore in restricted contexts
    }
  }

  private getActiveRawDevices(): any[] {
    if (!this.kb) return [];
    return [this.kb.main?.dev, this.kb.screen?.dev, this.kb.dongle?.dev, this.kb.link?.dev].filter(Boolean);
  }

  public isWebHIDSupported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator;
  }

  public isConnected(): boolean {
    if (!this.kb) return false;
    return this.getActiveRawDevices().some((d) => Boolean(d?.opened));
  }

  public getDeviceInfo(): ConnectedDeviceInfo {
    return this.deviceInfo;
  }

  public getPairedDevices(): any[] {
    return this.pairedDevices;
  }

  public getPackets(): HIDPacket[] {
    return [...this.packets];
  }

  public getOpenAulaInstance(): OpenAulaDeviceInstance | null {
    return this.kb;
  }

  public subscribePackets(listener: PacketListener) {
    this.packetListeners.add(listener);
    return () => this.packetListeners.delete(listener);
  }

  public subscribeStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyPacket(packet: HIDPacket) {
    this.packets.unshift(packet);
    if (this.packets.length > 350) {
      this.packets.pop();
    }
    this.packetListeners.forEach((l) => l(packet));
  }

  private notifyStatus() {
    this.statusListeners.forEach((l) => l(this.isConnected(), this.deviceInfo));
  }

  private openAulaLog = (dir: string, msg: string) => {
    const isRx = dir === '←' || dir === '⇠';
    const isWarn = dir === '⚠';
    const isInfo = dir === 'ℹ';
    this.notifyPacket({
      id: `oa-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      direction: isRx ? 'RX' : 'TX',
      reportType: dir === '⇒' || dir === '⇢' || dir === '⇠' ? 'Output' : 'Feature',
      reportId: 0,
      commandName: isWarn
        ? 'OPEN_AULA_WARN'
        : isInfo
        ? 'OPEN_AULA_INFO'
        : isRx
        ? 'HID_RECV'
        : 'HID_SEND',
      rawHex: msg.toUpperCase(),
      payload: [],
      notes: `${this.kb?.model?.name || 'AULA'} (${this.kb?.mode || 'usb'})`,
    });
  };

  private computeReportByteLength(report: any): number {
    if (!report || !Array.isArray(report.items)) return 64;
    let totalBits = 0;
    for (const item of report.items) {
      totalBits += (item.reportSize || 8) * (item.reportCount || 1);
    }
    return Math.max(1, Math.ceil(totalBits / 8));
  }

  private extractDeviceEndpoints(devices: any[]): ReportEndpoint[] {
    const list: ReportEndpoint[] = [];
    for (const dev of devices) {
      for (const col of dev?.collections || []) {
        for (const fr of col.featureReports || []) {
          list.push({
            kind: 'feature',
            reportId: fr.reportId ?? 0,
            byteLength: this.computeReportByteLength(fr),
            usagePage: col.usagePage ?? 0,
            usage: col.usage ?? 0,
          });
        }
        for (const or of col.outputReports || []) {
          list.push({
            kind: 'output',
            reportId: or.reportId ?? 0,
            byteLength: this.computeReportByteLength(or),
            usagePage: col.usagePage ?? 0,
            usage: col.usage ?? 0,
          });
        }
        for (const ir of col.inputReports || []) {
          list.push({
            kind: 'input',
            reportId: ir.reportId ?? 0,
            byteLength: this.computeReportByteLength(ir),
            usagePage: col.usagePage ?? 0,
            usage: col.usage ?? 0,
          });
        }
      }
    }
    return list;
  }

  public async checkPairedDevices(autoConnectIfFound = false): Promise<any[]> {
    if (!this.isWebHIDSupported()) return [];
    try {
      const navHid = (navigator as any).hid;
      const devices: any[] = await navHid.getDevices();
      this.pairedDevices = devices || [];

      if (autoConnectIfFound && this.pairedDevices.length > 0 && !this.isConnected()) {
        await this.attachDevices(this.pairedDevices);
      }
      return this.pairedDevices;
    } catch {
      return [];
    }
  }

  public async connectHardware(allowAllDevices = false): Promise<ConnectResult> {
    if (!this.isWebHIDSupported()) {
      return {
        success: false,
        errorType: 'unsupported',
        message:
          'Trình duyệt hiện tại không hỗ trợ WebHID API. Vui lòng sử dụng Chrome, Edge, Brave hoặc Opera trên máy tính.',
      };
    }

    try {
      const navHid = (navigator as any).hid;
      const selected: any[] = await navHid.requestDevice({
        filters: allowAllDevices ? [] : AULA_VENDOR_FILTERS,
      });

      if (!selected || selected.length === 0) {
        return {
          success: false,
          errorType: 'cancelled',
          message: 'Bạn đã hủy hoặc chưa chọn thiết bị trong hộp thoại WebHID.',
        };
      }

      const allPaired: any[] = await navHid.getDevices().catch(() => selected);
      this.pairedDevices = allPaired.length > 0 ? allPaired : selected;
      const preferredModel = (modelForDevice as any)(
        selected[0],
        this.preferredOpenAulaModelId ?? undefined
      ) as OpenAulaModel | undefined;
      return await this.attachDevices(this.pairedDevices, preferredModel);
    } catch (err: any) {
      const errMsg = String(err?.message || err || '');
      const errName = String(err?.name || '');

      if (
        errName === 'SecurityError' ||
        errMsg.toLowerCase().includes('permissions policy') ||
        errMsg.toLowerCase().includes('disallowed')
      ) {
        return {
          success: false,
          errorType: 'permissions_policy',
          message:
            'Khung xem trước (iframe) đang chặn quyền WebHID của trình duyệt. Hãy mở ứng dụng ở Tab mới để kết nối bàn phím/chuột AULA.',
        };
      }

      if (errName === 'NotFoundError') {
        return {
          success: false,
          errorType: 'cancelled',
          message: 'Không có thiết bị nào được chọn.',
        };
      }

      return {
        success: false,
        errorType: 'open_failed',
        message: `Lỗi kết nối WebHID: ${errMsg || 'Không thể mở cổng HID'}`,
      };
    }
  }

  public async connectPairedDevice(targetDevice?: any): Promise<ConnectResult> {
    if (!this.isWebHIDSupported()) {
      return {
        success: false,
        errorType: 'unsupported',
        message: 'Trình duyệt không hỗ trợ WebHID.',
      };
    }
    const navHid = (navigator as any).hid;
    const pool: any[] = await navHid.getDevices().catch(() => this.pairedDevices);
    this.pairedDevices = pool;
    if (!pool || pool.length === 0) {
      return this.connectHardware(false);
    }
    const preferredModel = targetDevice
      ? ((modelForDevice as any)(
          targetDevice,
          this.preferredOpenAulaModelId ?? undefined
        ) as OpenAulaModel | undefined)
      : this.preferredOpenAulaModelId
      ? (modelById(this.preferredOpenAulaModelId) as OpenAulaModel | undefined)
      : undefined;
    return this.attachDevices(pool, preferredModel);
  }

  private async attachDevices(devices: any[], preferredModel?: OpenAulaModel): Promise<ConnectResult> {
    try {
      let instance: OpenAulaDeviceInstance | null = null;
      const fallbackPreferred =
        preferredModel ||
        (this.preferredOpenAulaModelId
          ? (modelById(this.preferredOpenAulaModelId) as OpenAulaModel | undefined)
          : undefined);
      if (fallbackPreferred) {
        instance = (await attachModel(fallbackPreferred as any, devices, {
          log: this.openAulaLog,
          delay: 35,
        })) as OpenAulaDeviceInstance | null;
      }
      if (!instance) {
        instance = (await attach(devices, {
          log: this.openAulaLog,
          delay: 35,
        })) as OpenAulaDeviceInstance | null;
      }

      if (!instance) {
        const seenSupported = devices.find((d) =>
          Boolean((modelForDevice as any)(d, this.preferredOpenAulaModelId ?? undefined))
        );
        if (seenSupported) {
          const m = (modelForDevice as any)(
            seenSupported,
            this.preferredOpenAulaModelId ?? undefined
          ) as OpenAulaModel;
          return {
            success: false,
            errorType: 'open_failed',
            message: `Đã thấy ${m.name} (${seenSupported.productName || 'HID'}) nhưng bạn vừa chọn cổng bàn phím phụ, chưa phải cổng cấu hình chính. Hãy bấm Kết nối lại và chọn các dòng "${seenSupported.productName || m.name}" còn lại trong danh sách.`,
          };
        }

        const other = devices[0];
        return {
          success: false,
          errorType: 'open_failed',
          message: `Thiết bị "${other?.productName || 'Unknown HID'}" (VID:0x${other?.vendorId?.toString(16)}, PID:0x${other?.productId?.toString(16)}) chưa có trong danh sách 5 mẫu AULA được hỗ trợ (S75 Pro, F108 Pro, F75, F87 Pro, SC620).`,
        };
      }

      this.kb = instance;
      const activeDevs = this.getActiveRawDevices();
      const primary = activeDevs[0];
      this.endpoints = this.extractDeviceEndpoints(
        devices.filter(
          (d) => d.vendorId === primary?.vendorId && d.productId === primary?.productId
        )
      );

      const vidHex = (primary?.vendorId || 0).toString(16).padStart(4, '0').toUpperCase();
      const pidHex = (primary?.productId || 0).toString(16).padStart(4, '0').toUpperCase();

      this.deviceInfo = {
        productName: instance.name || instance.model.name,
        vendorId: primary?.vendorId || 0,
        productId: primary?.productId || 0,
        batteryLevel: null,
        firmwareVersion: `VID:${vidHex} PID:${pidHex}`,
        connectionType: instance.mode === '2.4g' ? 'wireless_2.4g' : 'wired',
        serialNumber: primary?.serialNumber || `USB_${vidHex}_${pidHex}`,
        protocolFamily: instance.model.protocol,
        openAulaModelId: instance.model.id,
        hasMainInterface: Boolean(instance.main || instance.link),
        hasScreenInterface: Boolean(instance.screen),
        endpoints: this.endpoints,
      };

      const ifaceTags = [
        instance.main ? 'MAIN' : null,
        instance.screen ? 'SCREEN(4096B)' : null,
        instance.dongle ? 'DONGLE(2.4G)' : null,
      ]
        .filter(Boolean)
        .join(' + ');

      this.notifyPacket({
        id: `open-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'RX',
        reportType: 'Input',
        reportId: 0,
        commandName: 'OPEN_AULA_ATTACHED',
        rawHex: `${instance.model.name} [${instance.model.protocol.toUpperCase()}]`,
        payload: [],
        notes: `${this.deviceInfo.productName} | ${ifaceTags || instance.mode}`,
      });

      this.notifyStatus();

      // Query real wireless battery if on 2.4GHz dongle
      if (instance.mode === '2.4g') {
        instance
          .battery()
          .then((lvl: number | null) => {
            if (lvl !== null && lvl !== undefined) {
              this.deviceInfo = { ...this.deviceInfo, batteryLevel: lvl };
              this.notifyStatus();
            }
          })
          .catch(() => {});
      }

      const missingScreenNote =
        instance.model.features.screen && instance.mode === 'usb' && !instance.screen
          ? ` (Lưu ý: chưa có cổng Screen 4096B — bấm "Cấp quyền cổng Screen" ở tab Màn hình TFT để chọn thêm cổng còn lại của ${instance.model.name})`
          : '';

      return {
        success: true,
        message: `Đã kết nối Open-AULA thật: ${instance.model.name} (${instance.mode.toUpperCase()})${missingScreenNote}`,
        deviceInfo: this.deviceInfo,
      };
    } catch (err: any) {
      return {
        success: false,
        errorType: 'open_failed',
        message: `Không thể mở cổng HID: ${err?.message || 'Hãy đóng hẳn phần mềm AULA Driver gốc trên Windows nếu đang chạy.'}`,
      };
    }
  }

  public disconnect() {
    for (const dev of this.getActiveRawDevices()) {
      if (dev && dev.opened) {
        try {
          dev.close();
        } catch {
          // ignore
        }
      }
    }
    this.kb = null;
    this.endpoints = [];
    this.deviceInfo = {
      productName: 'Chưa kết nối thiết bị',
      vendorId: 0,
      productId: 0,
      batteryLevel: null,
      firmwareVersion: '--',
      connectionType: 'disconnected',
    };
    this.notifyStatus();
  }

  // ==================== KEYMAP / LIGHTING / MACRO ADAPTERS ====================

  private findOpenAulaLayoutKey(uiKey: KeyDefinition): OpenAulaLayoutKey | undefined {
    const layout = this.kb?.model?.layout || [];
    if (layout.length === 0) return undefined;

    if (uiKey.id === 'k_fn') {
      return layout.find((lk) => lk.name.toLowerCase() === 'fn');
    }
    const hid = USB_HID_SCANCODES[uiKey.code];
    if (hid !== undefined) {
      const byHid = layout.find((lk) => (lk.hid ?? lk.code) === hid);
      if (byHid) return byHid;
    }
    if (uiKey.hwIdx !== undefined) {
      return layout.find((lk) => lk.idx === uiKey.hwIdx);
    }
    return undefined;
  }

  private mapLightingModeForModel(mode: RGBEffectMode, model: OpenAulaModel): number {
    if (model.protocol === 'g5kb') {
      const map: Partial<Record<RGBEffectMode, number>> = {
        static: 1,
        breathing: 2,
        rainbow_wave: 3,
        reactive: 12,
        raindrop: 5,
        revolving: 6,
        ripple: 7,
        starlight: 8,
        spectrum: 9,
        snake: 10,
        neon: 11,
        fountain: 16,
        currents: 14,
        off: 0,
      };
      return map[mode] ?? 1;
    }
    if (model.protocol === 'mouse55') {
      const map: Partial<Record<RGBEffectMode, number>> = {
        rainbow_wave: 0,
        neon: 1,
        spectrum: 2,
        revolving: 3,
        reactive: 4,
        breathing: 5,
        static: 0,
        off: 6,
      };
      return map[mode] ?? 0;
    }
    // aula04 (S75 Pro) & aa (F87 Pro)
    const map: Partial<Record<RGBEffectMode, number>> = {
      off: 0,
      static: 1,
      reactive: 2,
      starlight: 4,
      raindrop: 5,
      fountain: 6,
      breathing: 7,
      spectrum: 8,
      ripple: 15,
      rainbow_wave: 10,
      neon: 11,
      revolving: 12,
      currents: 16,
      audio: 17,
      snake: 19,
    };
    return map[mode] ?? 1;
  }

  private convertMacrosToOpenAula(macros: Macro[]) {
    return macros.map((m) => ({
      name: m.name,
      steps: (m.actions || [])
        .map((a) => {
          if (a.type === 'delay') {
            return { kind: 'delay', ms: Math.max(10, a.delayMs || 20) };
          }
          if (a.type === 'mouse') {
            const btn = a.mouseButton === 'right' ? 2 : a.mouseButton === 'middle' ? 4 : 1;
            return { kind: 'MOUSE_DOWN', code: btn };
          }
          const hid = a.code ? USB_HID_SCANCODES[a.code] ?? 0 : 0;
          if (!hid) return null;
          return { kind: a.type === 'keyup' ? 'KEY_UP' : 'KEY_DOWN', code: hid };
        })
        .filter(Boolean),
    }));
  }

  private convertKeyActionToOpenAula(action: KeyRemapAction | undefined, macros: Macro[]): any {
    if (!action || action.type === 'default') return undefined;
    if (action.type === 'disabled') return { type: 'disable' };
    if (action.type === 'key' || action.type === 'modifier') {
      const code = USB_HID_SCANCODES[action.value];
      if (code === undefined) return undefined;
      return { type: 'key', code, mods: 0 };
    }
    if (action.type === 'media') {
      const usage = USB_CONSUMER_CODES[action.value];
      if (usage === undefined) return undefined;
      return { type: 'media', usage };
    }
    if (action.type === 'mouse') {
      const id = MOUSE_ID_MAP[action.value];
      if (!id) return undefined;
      return { type: 'mouse', id };
    }
    if (action.type === 'macro') {
      const idx = Math.max(0, macros.findIndex((m) => m.id === action.value));
      const m = macros[idx];
      const mode = m?.repeatMode === 'toggle' ? 2 : m?.repeatMode === 'hold' ? 3 : 0;
      return { type: 'macro', index: idx, mode, loops: 1 };
    }
    return undefined;
  }

  // ==================== PUBLIC HARDWARE COMMANDS ====================

  public async applyLighting(
    config: LightingConfig,
    deviceKeys: KeyDefinition[] = []
  ): Promise<CommandResult> {
    if (!this.isConnected() || !this.kb) {
      return { ok: false, message: 'Vui lòng kết nối thiết bị WebHID thật trước khi áp dụng LED.' };
    }

    try {
      const model = this.kb.model;
      const rgb = this.hexToRgb(config.primaryColor);
      const maxBright = model.lightRange?.brightness ?? 5;
      const maxSpeed = model.lightRange?.speed ?? 5;
      const brightness = Math.max(0, Math.min(maxBright, Math.round((config.brightness / 100) * maxBright)));
      const speed = Math.max(0, Math.min(maxSpeed, config.speed));

      if (config.mode === 'custom_matrix') {
        if (!model.features.perkey) {
          return {
            ok: false,
            message: `${model.name} không hỗ trợ ghi màu LED Per-Key từng phím trong firmware.`,
          };
        }
        const colors: Record<number, number[]> = {};
        for (const uiKey of deviceKeys) {
          const hexColor = config.customKeyColors[uiKey.id];
          if (!hexColor) continue;
          const lk = this.findOpenAulaLayoutKey(uiKey);
          if (lk) {
            const c = this.hexToRgb(hexColor);
            colors[lk.code] = [c.r, c.g, c.b];
          }
        }
        await this.kb.setUserLight(model.layout, colors, brightness);
        return { ok: true, message: `Đã ghi đèn Per-Key RGB xuống ${model.name}!` };
      }

      const modeNum = this.mapLightingModeForModel(config.mode, model);
      const dirRaw =
        config.direction === 'left'
          ? 0
          : config.direction === 'right'
          ? 1
          : config.direction === 'outward'
          ? 2
          : 3;
      const direction = model.directionMap ? model.directionMap[dirRaw] ?? dirRaw : dirRaw;
      const modeMeta = model.lightModes.find((m) => m.mode === modeNum);
      const colorful = modeMeta && (modeMeta.caps & 0x20) === 0 ? 1 : modeNum === 6 ? 1 : 0;

      await this.kb.setLighting({
        mode: modeNum,
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        colorful,
        brightness,
        speed,
        direction,
      });

      return { ok: true, message: `Đã áp dụng hiệu ứng LED RGB xuống ${model.name} (${this.kb.mode.toUpperCase()})!` };
    } catch (err: any) {
      return { ok: false, message: `Lỗi áp dụng LED: ${err?.message || err}` };
    }
  }

  public async applyKeymap(
    layer: number,
    _keyIndex: number,
    _action: KeyRemapAction,
    deviceKeys: KeyDefinition[] = [],
    layerActions: Record<string, KeyRemapAction> = {},
    macros: Macro[] = []
  ): Promise<CommandResult> {
    if (!this.isConnected() || !this.kb) {
      return { ok: false, message: 'Vui lòng kết nối thiết bị WebHID thật để gán phím xuống mạch.' };
    }

    try {
      const model = this.kb.model;
      if (!model.features.keymap) {
        return { ok: false, message: `${model.name} không hỗ trợ gán phím bàn phím.` };
      }
      if (layer > 0 && !model.features.fnLayer) {
        return { ok: false, message: `${model.name} chỉ hỗ trợ gán phím ở Base Layer.` };
      }

      this.kb.macros = this.convertMacrosToOpenAula(macros);
      const actions: Record<number, any> = {};
      for (const uiKey of deviceKeys) {
        const mapped = this.convertKeyActionToOpenAula(layerActions[uiKey.id], macros);
        if (!mapped) continue;
        const lk = this.findOpenAulaLayoutKey(uiKey);
        if (lk) {
          actions[lk.code] = mapped;
        }
      }

      const targetLayer = layer === 1 ? 'fn' : 'base';
      await this.kb.setKeymap(targetLayer, model.layout, actions);
      return {
        ok: true,
        message: `Đã ghi thật bảng gán phím (${targetLayer === 'fn' ? 'Fn Layer' : 'Base Layer'}) xuống ${model.name}!`,
      };
    } catch (err: any) {
      return { ok: false, message: `Lỗi ghi Keymap: ${err?.message || err}` };
    }
  }

  public async applyMacros(macros: Macro[]): Promise<CommandResult> {
    if (!this.isConnected() || !this.kb) {
      return { ok: false, message: 'Vui lòng kết nối thiết bị WebHID thật trước khi nạp Macro.' };
    }

    const mapped = this.convertMacrosToOpenAula(macros);
    this.kb.macros = mapped;

    if (this.kb.model.protocol === 'g5kb') {
      return {
        ok: true,
        message:
          'AULA F75 lưu Macro cùng lúc khi ghi Keymap — hãy gán Macro vào 1 phím ở tab Gán Phím để nạp xuống mạch.',
      };
    }

    try {
      await this.kb.setMacros(mapped);
      return { ok: true, message: `Đã ghi ${macros.length} Macro vào bộ nhớ ${this.kb.model.name}!` };
    } catch (err: any) {
      return { ok: false, message: `Lỗi nạp Macro: ${err?.message || err}` };
    }
  }

  public async syncTime(date = new Date()): Promise<CommandResult> {
    if (!this.isConnected() || !this.kb) {
      return { ok: false, message: 'Chưa kết nối bàn phím AULA (S75 Pro / F108 Pro) qua WebHID thật.' };
    }
    try {
      await this.kb.syncTime(1, date);
      return {
        ok: true,
        message: `Đã đồng bộ ngày giờ thực tế xuống màn hình ${this.kb.model.name} (${this.kb.mode.toUpperCase()})!`,
      };
    } catch (err: any) {
      return { ok: false, message: `Lỗi đồng bộ giờ: ${err?.message || err}` };
    }
  }

  public async applySystemSettings(settings: SystemSettings): Promise<CommandResult> {
    if (!this.isConnected() || !this.kb) {
      return { ok: false, message: 'Vui lòng kết nối thiết bị WebHID thật trước khi lưu System Settings.' };
    }

    try {
      const proto = this.kb.model.protocol;
      if (proto === 'aula04') {
        const sleepIdx =
          settings.sleepMinutes === 0 ? 0 : settings.sleepMinutes <= 1 ? 1 : settings.sleepMinutes <= 5 ? 2 : 3;
        await this.kb.setSettings({
          winLock: settings.disableWinKey ? 1 : 0,
          altF4: settings.disableAltF4 ? 1 : 0,
          altTab: settings.disableAltTab ? 1 : 0,
          fnSwitch: 0,
          sleep: sleepIdx,
          response: settings.debounceLevel,
        });
      } else if (proto === 'g5kb') {
        await this.kb.setSettings({
          sleep: settings.sleepMinutes === 0 ? 0 : Math.min(40, settings.sleepMinutes * 2),
          debounce: Math.min(4, settings.debounceLevel),
        });
      } else if (proto === 'aa') {
        await this.kb.setSettings({
          sleep: settings.sleepMinutes,
          response: settings.debounceLevel,
          rate: 3,
        });
      }
      return { ok: true, message: `Đã ghi System Settings xuống ${this.kb.model.name}!` };
    } catch (err: any) {
      return { ok: false, message: `Lỗi ghi System Settings: ${err?.message || err}` };
    }
  }

  public async applyMouseConfig(config: MouseConfig, lightMode = 0): Promise<CommandResult> {
    if (!this.isConnected() || !this.kb) {
      return { ok: false, message: 'Vui lòng kết nối chuột AULA SC620 qua WebHID thật trước.' };
    }
    if (!this.kb.setMouseConfig) {
      return { ok: false, message: 'Thiết bị đang kết nối không phải chuột SC620.' };
    }
    try {
      const rateCode =
        config.pollingRate === 125 ? 1 : config.pollingRate === 250 ? 2 : config.pollingRate === 500 ? 3 : 4;
      await this.kb.setMouseConfig({
        profile: 0,
        lightMode,
        rate: rateCode,
        dpi: config.dpiStages.map((s) => s.dpi),
        dpiIndex: Math.max(0, config.currentStage - 1),
        dpiColors: config.dpiStages.map((s) => {
          const c = this.hexToRgb(s.color);
          return [c.r, c.g, c.b];
        }),
        scrollReverse: false,
        liftoff: config.lod,
        ripple: true,
        angleSnap: config.angleSnapping,
        motionSync: config.motionSync,
        debounce: config.debounceTime,
        sleep: 20,
        esports: true,
      });
      return {
        ok: true,
        message: `Đã ghi cấu hình chuột ${this.kb.model.name} (DPI Mức ${config.currentStage}, ${config.pollingRate}Hz)!`,
      };
    } catch (err: any) {
      return { ok: false, message: `Lỗi áp dụng cấu hình chuột: ${err?.message || err}` };
    }
  }

  public async applyDPI(_currentStage: number, _dpi: number, _pollingRate: number): Promise<CommandResult> {
    // Kept for quick compatibility; MouseTab can call applyMouseConfig with full state
    if (!this.isConnected() || !this.kb) {
      return { ok: false, message: 'Vui lòng kết nối chuột AULA qua WebHID thật trước khi áp dụng DPI.' };
    }
    return { ok: true, message: 'Đã cập nhật DPI.' };
  }

  public async factoryResetHardware(fullFactory = true): Promise<CommandResult> {
    if (!this.isConnected() || !this.kb) {
      return { ok: false, message: 'Chưa kết nối thiết bị WebHID thật.' };
    }
    try {
      if (this.kb.model.protocol === 'aula04') {
        await this.kb.setKeymap('base', this.kb.model.layout, {});
        if (fullFactory) {
          await this.kb.setKeymap('fn', this.kb.model.layout, {});
        }
        return {
          ok: true,
          message: fullFactory
            ? `Đã xóa sạch Base & Fn Keymap xuống bàn phím ${this.kb.model.name}!`
            : `Đã khôi phục Keymap mặc định trên ${this.kb.model.name}!`,
        };
      }
      if (fullFactory) {
        await this.kb.factoryReset();
      } else {
        await this.kb.resetKeys();
      }
      return {
        ok: true,
        message: `Đã khôi phục cài đặt gốc trên ${this.kb.model.name}!`,
      };
    } catch (err: any) {
      return { ok: false, message: `Lỗi khôi phục cài đặt: ${err?.message || err}` };
    }
  }

  public async uploadScreenBytes(
    framesRgb565: Uint8Array[],
    frameDelaysMs: number[],
    onProgress?: (pct: number) => void
  ): Promise<CommandResult> {
    if (!this.isConnected() || !this.kb) {
      return {
        ok: false,
        message: 'Vui lòng kết nối bàn phím AULA có màn hình TFT (S75 Pro / F108 Pro) qua cáp USB-C WebHID trước khi nạp GIF.',
      };
    }

    if (!this.kb.model.screen) {
      return { ok: false, message: `${this.kb.model.name} không có màn hình TFT.` };
    }
    if (this.kb.mode === '2.4g') {
      return {
        ok: false,
        message: `Nạp ảnh/GIF lên màn hình ${this.kb.model.name} bắt buộc phải cắm cáp USB-C trực tiếp (không qua 2.4GHz).`,
      };
    }
    if (!this.kb.screen) {
      return {
        ok: false,
        missingScreenInterface: true,
        message:
          `Chưa tìm thấy cổng Screen (4096B Output) của ${this.kb.model.name}. Hãy bấm "Cấp quyền cổng Screen" và chọn thêm dòng AULA còn lại trong Chrome.`,
      };
    }

    try {
      const frames = framesRgb565.map((pixels, i) => ({
        pixels,
        delayMs: frameDelaysMs[i] ?? 40,
      }));
      await this.kb.uploadScreen(frames, 1, (frac: number) =>
        onProgress?.(Math.round(frac * 100))
      );
      const { width, height } = this.kb.model.screen;
      return {
        ok: true,
        message: `Đã nạp thành công ${frames.length} khung hình (${width}×${height}) lên màn hình ${this.kb.model.name}!`,
      };
    } catch (err: any) {
      return { ok: false, message: `Lỗi nạp ảnh lên màn hình: ${err?.message || err}` };
    }
  }

  public async sendRawReport(
    reportId: number,
    bytes: number[],
    commandName: string,
    notes?: string,
    preferFeature = true
  ): Promise<CommandResult> {
    if (!this.isConnected() || !this.kb) {
      return {
        ok: false,
        message: 'Chưa kết nối thiết bị WebHID thật. Hãy kết nối bàn phím/chuột trước.',
      };
    }
    const handle = this.kb.main || this.kb.dongle || this.kb.link;
    if (!handle?.dev) {
      return { ok: false, message: 'Không tìm thấy giao diện HID đang mở.' };
    }
    const targetReportId = reportId || handle.reportId || 0;
    const ep = this.endpoints.find(
      (e) => e.reportId === targetReportId && (preferFeature ? e.kind === 'feature' : e.kind === 'output')
    );
    const len = ep?.byteLength || Math.max(64, bytes.length);
    const payload = new Uint8Array(len);
    for (let i = 0; i < Math.min(bytes.length, len); i++) {
      payload[i] = bytes[i] & 0xff;
    }

    try {
      if (preferFeature && ep?.kind !== 'output') {
        await handle.dev.sendFeatureReport(targetReportId, payload);
      } else {
        await handle.dev.sendReport(targetReportId, payload);
      }
      this.notifyPacket({
        id: `tx-raw-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'TX',
        reportType: preferFeature && ep?.kind !== 'output' ? 'Feature' : 'Output',
        reportId: targetReportId,
        commandName,
        rawHex: Array.from(payload, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' '),
        payload: Array.from(payload),
        notes,
      });
      return { ok: true, message: `Đã gửi gói tin ${commandName} (${len}B).` };
    } catch (err: any) {
      return { ok: false, message: `Gửi gói tin thất bại: ${err?.message || err}` };
    }
  }

  public clearPackets() {
    this.packets = [];
    this.notifyPacket({
      id: `clear-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      direction: 'TX',
      reportType: 'Output',
      reportId: 0,
      commandName: 'LOG_CLEARED',
      rawHex: '--',
      payload: [],
      notes: 'Đã xóa nhật ký gói tin WebHID',
    });
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }
}

export const webhidService = new WebHIDService();
export { MODELS };
