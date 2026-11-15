import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  Keyboard as KeyboardIcon,
  Sparkles,
  Layers,
  Tv,
  Mouse as MouseIcon,
  Terminal,
  Activity,
  CheckCircle2,
  Usb,
  ExternalLink,
  Search,
  X,
  AlertTriangle,
  Settings,
  Cloud,
  CloudOff,
  Loader2,
  RefreshCw,
  Smartphone,
  Monitor,
} from 'lucide-react';

import {
  DeviceModel,
  KeyDefinition,
  LightingConfig,
  KeyRemapAction,
  Macro,
  MouseConfig,
  ScreenConfig,
  SystemSettings,
  Language,
  HIDPacket,
} from './types/device';

import {
  SUPPORTED_DEVICES,
  DEFAULT_MOUSE_CONFIG,
} from './data/devices';

import { TRANSLATIONS } from './data/translations';
import { webhidService, ConnectedDeviceInfo } from './services/webhid';
import { soundEngine } from './services/soundEngine';
import { auth } from './firebase';
import {
  signInWithGoogle,
  signOutGoogle,
  ensureUserDocuments,
  updateUserPreferences,
  subscribeUserPreferences,
  loadDeviceProfileFromCloud,
  saveDeviceProfileToCloud,
  subscribeDeviceProfile,
  loadUserMacrosFromCloud,
  syncUserMacrosToCloud,
  subscribeUserMacros,
  extractCloudScreenSettings,
  stableStringify,
  publishBridgeStatus,
  subscribeBridgeStatus,
  dispatchRemoteCommand,
  subscribeRemoteCommands,
  completeRemoteCommand,
  cleanupRemoteCommand,
  CloudBridgeStatus,
  CloudDeviceProfile,
  RemoteCommandType,
} from './services/firebaseSync';

import { Header, CloudSyncStatus } from './components/Header';
import { KeyboardVisualizer } from './components/KeyboardVisualizer';
import { MouseVisualizer } from './components/MouseVisualizer';
import { KeymapTab } from './components/KeymapTab';
import { LightingTab } from './components/LightingTab';
import { MacroTab } from './components/MacroTab';
import { ScreenTab } from './components/ScreenTab';
import { MouseTab } from './components/MouseTab';
import { KeyTesterTab } from './components/KeyTesterTab';
import { PacketLogTab } from './components/PacketLogTab';
import { SystemTab } from './components/SystemTab';

const INITIAL_MACROS: Macro[] = [
  {
    id: 'm1',
    name: 'CS2 / Valorant Fast Drop',
    repeatMode: 'once',
    createdAt: Date.now() - 50000,
    actions: [
      { id: '1', type: 'keydown', key: 'g', code: 'KeyG' },
      { id: '2', type: 'delay', delayMs: 30 },
      { id: '3', type: 'keyup', key: 'g', code: 'KeyG' },
      { id: '4', type: 'delay', delayMs: 40 },
      { id: '5', type: 'keydown', key: '3', code: 'Digit3' },
      { id: '6', type: 'delay', delayMs: 25 },
      { id: '7', type: 'keyup', key: '3', code: 'Digit3' },
    ],
  },
  {
    id: 'm2',
    name: 'Dev: Git Push Origin Main',
    repeatMode: 'once',
    createdAt: Date.now() - 40000,
    actions: [
      { id: '1', type: 'keydown', key: 'g', code: 'KeyG' },
      { id: '2', type: 'keyup', key: 'g', code: 'KeyG' },
      { id: '3', type: 'keydown', key: 'i', code: 'KeyI' },
      { id: '4', type: 'keyup', key: 'i', code: 'KeyI' },
      { id: '5', type: 'keydown', key: 't', code: 'KeyT' },
      { id: '6', type: 'keyup', key: 't', code: 'KeyT' },
      { id: '7', type: 'delay', delayMs: 50 },
      { id: '8', type: 'keydown', key: 'p', code: 'KeyP' },
      { id: '9', type: 'keyup', key: 'p', code: 'KeyP' },
    ],
  },
];

const EMPTY_KEYMAPS = (): Record<number, Record<string, KeyRemapAction>> => ({
  0: {},
  1: {},
  2: {},
  3: {},
});

const getKeymapStorageKey = (deviceId: string, profile: number) =>
  `open-aula:keymaps:${deviceId}:p${profile}`;

const loadSavedKeymaps = (
  deviceId: string,
  profile: number
): Record<number, Record<string, KeyRemapAction>> => {
  try {
    const raw = localStorage.getItem(getKeymapStorageKey(deviceId, profile));
    if (!raw) return EMPTY_KEYMAPS();
    const parsed = JSON.parse(raw);
    return {
      0: parsed?.[0] && typeof parsed[0] === 'object' ? parsed[0] : {},
      1: parsed?.[1] && typeof parsed[1] === 'object' ? parsed[1] : {},
      2: parsed?.[2] && typeof parsed[2] === 'object' ? parsed[2] : {},
      3: parsed?.[3] && typeof parsed[3] === 'object' ? parsed[3] : {},
    };
  } catch {
    return EMPTY_KEYMAPS();
  }
};

const loadSavedMacros = (): Macro[] => {
  try {
    const raw = localStorage.getItem('open-aula:macros');
    if (!raw) return INITIAL_MACROS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_MACROS;
  } catch {
    return INITIAL_MACROS;
  }
};

export default function App() {
  const [lang, setLang] = useState<Language>('vi');
  const t = (key: string) => TRANSLATIONS[lang][key] || key;

  // Selected device
  const [selectedDevice, setSelectedDevice] = useState<DeviceModel>(SUPPORTED_DEVICES[0]);
  const [activeTab, setActiveTab] = useState<
    'keymap' | 'lighting' | 'macro' | 'screen' | 'mouse' | 'tester' | 'system' | 'packets'
  >('keymap');

  // Connection & WebHID state (real hardware only)
  const [isConnected, setIsConnected] = useState<boolean>(webhidService.isConnected());
  const [deviceInfo, setDeviceInfo] = useState<ConnectedDeviceInfo>(webhidService.getDeviceInfo());
  const [packets, setPackets] = useState<HIDPacket[]>(webhidService.getPackets());

  // Profile
  const [activeProfile, setActiveProfile] = useState<number>(1);

  // Keyboard configurations (persisted per device + profile in localStorage)
  const [lighting, setLighting] = useState<LightingConfig>(selectedDevice.defaultLighting);
  const [activeLayer, setActiveLayer] = useState<number>(0);
  const activeKeymapStorageKey = getKeymapStorageKey(selectedDevice.id, activeProfile);
  const [keymapStore, setKeymapStore] = useState<{
    key: string;
    map: Record<number, Record<string, KeyRemapAction>>;
  }>(() => ({
    key: getKeymapStorageKey(SUPPORTED_DEVICES[0].id, 1),
    map: loadSavedKeymaps(SUPPORTED_DEVICES[0].id, 1),
  }));
  const keymaps =
    keymapStore.key === activeKeymapStorageKey
      ? keymapStore.map
      : loadSavedKeymaps(selectedDevice.id, activeProfile);
  const setKeymaps = (
    updater:
      | Record<number, Record<string, KeyRemapAction>>
      | ((
          prev: Record<number, Record<string, KeyRemapAction>>
        ) => Record<number, Record<string, KeyRemapAction>>)
  ) => {
    setKeymapStore((prev) => {
      const base =
        prev.key === activeKeymapStorageKey
          ? prev.map
          : loadSavedKeymaps(selectedDevice.id, activeProfile);
      const nextMap = typeof updater === 'function' ? updater(base) : updater;
      try {
        localStorage.setItem(activeKeymapStorageKey, JSON.stringify(nextMap));
      } catch {
        // Ignore storage quota errors
      }
      return { key: activeKeymapStorageKey, map: nextMap };
    });
  };
  const [selectedKey, setSelectedKey] = useState<KeyDefinition | null>(null);

  // Screen config (S75 Pro)
  const [screenConfig, setScreenConfig] = useState<ScreenConfig>({
    brightness: 90,
    fps: 25,
    currentGifUrl:
      'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=320&auto=format&fit=crop&q=80',
    orientation: 0,
    showTimeOverlay: true,
    showBatteryOverlay: true,
    showTempOverlay: false,
  });

  // System Settings (S75 Pro)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    debounceLevel: 2,
    sleepMinutes: 1,
    disableWinKey: false,
    disableAltF4: false,
    disableAltTab: false,
  });

  // Mouse config (SC620)
  const [mouseConfig, setMouseConfig] = useState<MouseConfig>(DEFAULT_MOUSE_CONFIG);
  const [selectedMouseButton, setSelectedMouseButton] = useState<string | null>(null);

  // Macros (persisted in localStorage)
  const [macros, setMacros] = useState<Macro[]>(() => loadSavedMacros());

  // Custom Per-Key Matrix Painter state
  const [isCustomMatrixActive, setIsCustomMatrixActive] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#ef4444');

  // Key Tester anti-ghosting state
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [testedKeys, setTestedKeys] = useState<Set<string>>(new Set());

  // Firebase Auth & Cloud Sync state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudSessionUid, setCloudSessionUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('idle');
  const [lastCloudSavedAt, setLastCloudSavedAt] = useState<number | null>(null);
  const [remoteBridge, setRemoteBridge] = useState<CloudBridgeStatus | null>(null);

  const clientIdRef = useRef<string>(
    `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const isHydratingProfileRef = useRef<boolean>(false);
  const isHydratingMacrosRef = useRef<boolean>(false);
  const isHydratingPrefsRef = useRef<boolean>(false);
  const profileHydratedKeyRef = useRef<string>('');
  const macrosHydratedUidRef = useRef<string>('');
  const prefsHydratedUidRef = useRef<string>('');
  const lastCloudProfileSigRef = useRef<string>('');
  const lastCloudMacrosSigRef = useRef<string>('');
  const lastCloudPrefsSigRef = useRef<string>('');
  const lastAppliedHwProfileRef = useRef<CloudDeviceProfile | null>(null);
  const applyProfileOnNextLoadRef = useRef<boolean>(false);
  const wasHostingBridgeRef = useRef<boolean>(false);
  const processedCmdIdsRef = useRef<Set<string>>(new Set());
  const sentCmdIdsRef = useRef<Set<string>>(new Set());

  // Toast feedback & WebHID connect assistant modal
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  const [connectModal, setConnectModal] = useState<{
    open: boolean;
    errorType?: 'unsupported' | 'permissions_policy' | 'cancelled' | 'open_failed';
    message?: string;
  }>({ open: false });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const latestStateRef = useRef({
    selectedDevice,
    activeProfile,
    activeLayer,
    keymaps,
    lighting,
    systemSettings,
    mouseConfig,
    screenConfig,
    macros,
    lang,
  });
  latestStateRef.current = {
    selectedDevice,
    activeProfile,
    activeLayer,
    keymaps,
    lighting,
    systemSettings,
    mouseConfig,
    screenConfig,
    macros,
    lang,
  };

  const isRemoteBridgeOnline = Boolean(
    !isConnected &&
      cloudSessionUid &&
      remoteBridge?.online &&
      remoteBridge?.hidConnected &&
      remoteBridge.clientHostId !== clientIdRef.current
  );

  const selectedDeviceIdRef = React.useRef<string>(selectedDevice.id);
  selectedDeviceIdRef.current = selectedDevice.id;

  const mapUiDeviceToOpenAulaId = (uiDeviceId: string): string | null => {
    if (uiDeviceId === 'aula-s75-pro') return 's75pro';
    if (uiDeviceId === 'aula-f108-pro') return 'f108pro';
    if (uiDeviceId === 'aula-f75') return 'f75';
    if (uiDeviceId === 'aula-f87-pro') return 'f87pro';
    if (uiDeviceId === 'aula-sc620') return 'sc620';
    return null;
  };

  const syncMatchedDeviceModel = (info: ConnectedDeviceInfo | null) => {
    if (!info || info.connectionType === 'disconnected') return;
    const name = (info.productName || '').toLowerCase();
    let matched: DeviceModel | undefined;
    if (name.includes('f108') || name.includes('108')) {
      matched = SUPPORTED_DEVICES.find((d) => d.id === 'aula-f108-pro');
    } else if (info.openAulaModelId === 'f108pro') {
      matched = SUPPORTED_DEVICES.find((d) => d.id === 'aula-f108-pro');
    } else if (info.openAulaModelId === 's75pro') {
      matched =
        selectedDeviceIdRef.current === 'aula-f108-pro' && !name.includes('s75')
          ? SUPPORTED_DEVICES.find((d) => d.id === 'aula-f108-pro')
          : SUPPORTED_DEVICES.find((d) => d.id === 'aula-s75-pro');
    } else if (info.openAulaModelId === 'f75') {
      matched = SUPPORTED_DEVICES.find((d) => d.id === 'aula-f75');
    } else if (info.openAulaModelId === 'f87pro') {
      matched = SUPPORTED_DEVICES.find((d) => d.id === 'aula-f87-pro');
    } else if (info.openAulaModelId === 'sc620') {
      matched = SUPPORTED_DEVICES.find((d) => d.id === 'aula-sc620');
    } else if (
      name.includes('s75') ||
      (info.vendorId === 0x0c45 && info.productId === 0x800a) ||
      (info.vendorId === 0x05ac && info.productId === 0x024f)
    ) {
      matched =
        selectedDeviceIdRef.current === 'aula-f108-pro' && !name.includes('s75')
          ? SUPPORTED_DEVICES.find((d) => d.id === 'aula-f108-pro')
          : SUPPORTED_DEVICES.find((d) => d.id === 'aula-s75-pro');
    } else if (name.includes('f75') || (info.vendorId === 0x258a && info.productId === 0x010c)) {
      matched = SUPPORTED_DEVICES.find((d) => d.id === 'aula-f75');
    } else if (name.includes('f87') || info.vendorId === 0x38a6) {
      matched = SUPPORTED_DEVICES.find((d) => d.id === 'aula-f87-pro');
    } else if (
      name.includes('sc620') ||
      name.includes('mouse') ||
      info.vendorId === 0x24ae ||
      info.vendorId === 0xa8a4 ||
      info.vendorId === 0xa8a5
    ) {
      matched = SUPPORTED_DEVICES.find((d) => d.id === 'aula-sc620');
    }

    if (matched) {
      setSelectedDevice(matched);
      setLighting(matched.defaultLighting);
      if (matched.type === 'mouse') {
        setActiveTab('mouse');
      }
    }
  };

  // Subscribe to WebHID packets, status, and auto-detect already-paired devices ("Đã ghép nối")
  useEffect(() => {
    const unsubPackets = webhidService.subscribePackets(() => {
      setPackets(webhidService.getPackets());
    });
    const unsubStatus = webhidService.subscribeStatus((connected, info) => {
      setIsConnected(connected);
      if (info) {
        setDeviceInfo(info);
        if (connected) {
          syncMatchedDeviceModel(info);
        }
      }
    });

    webhidService.checkPairedDevices(true).then((list) => {
      setPairedDevices(list);
      if (webhidService.isConnected()) {
        syncMatchedDeviceModel(webhidService.getDeviceInfo());
        showToast(`Đã tự động kết nối thiết bị đã ghép nối: ${webhidService.getDeviceInfo().productName}`);
      }
    });

    return () => {
      unsubPackets();
      unsubStatus();
    };
  }, []);

  // Sync saved keymaps whenever device or profile changes
  useEffect(() => {
    setKeymapStore((prev) =>
      prev.key === activeKeymapStorageKey
        ? prev
        : {
            key: activeKeymapStorageKey,
            map: loadSavedKeymaps(selectedDevice.id, activeProfile),
          }
    );
  }, [activeKeymapStorageKey, selectedDevice.id, activeProfile]);

  // Persist macros automatically to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('open-aula:macros', JSON.stringify(macros));
    } catch {
      // Ignore storage quota errors
    }
  }, [macros]);

  // Listen to Firebase Auth state and bootstrap /users/{uid} + /private/info
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCloudSessionUid(null);
        setRemoteBridge(null);
        setCloudSyncStatus('idle');
        profileHydratedKeyRef.current = '';
        macrosHydratedUidRef.current = '';
        prefsHydratedUidRef.current = '';
        lastCloudProfileSigRef.current = '';
        lastCloudMacrosSigRef.current = '';
        lastCloudPrefsSigRef.current = '';
        lastAppliedHwProfileRef.current = null;
        return;
      }

      setCloudSyncStatus('syncing');
      try {
        const savedPrefs = await ensureUserDocuments(user, {
          selectedDeviceId: selectedDeviceIdRef.current,
          activeProfile,
          lang,
        });

        isHydratingPrefsRef.current = true;
        if (savedPrefs.lang === 'vi' || savedPrefs.lang === 'en') {
          setLang(savedPrefs.lang);
        }
        if (
          typeof savedPrefs.activeProfile === 'number' &&
          savedPrefs.activeProfile >= 1 &&
          savedPrefs.activeProfile <= 3
        ) {
          setActiveProfile(savedPrefs.activeProfile);
        }
        if (savedPrefs.selectedDeviceId && !webhidService.isConnected()) {
          const matchedDev = SUPPORTED_DEVICES.find(
            (d) => d.id === savedPrefs.selectedDeviceId
          );
          if (matchedDev) {
            selectedDeviceIdRef.current = matchedDev.id;
            webhidService.setPreferredModel(mapUiDeviceToOpenAulaId(matchedDev.id));
            setSelectedDevice(matchedDev);
            setLighting(matchedDev.defaultLighting);
            if (matchedDev.type === 'mouse') {
              setActiveTab('mouse');
            }
          }
        }
        lastCloudPrefsSigRef.current = stableStringify({
          selectedDeviceId: savedPrefs.selectedDeviceId || selectedDeviceIdRef.current,
          activeProfile: savedPrefs.activeProfile ?? activeProfile,
          lang: savedPrefs.lang ?? lang,
        });
        setTimeout(() => {
          isHydratingPrefsRef.current = false;
        }, 80);

        prefsHydratedUidRef.current = user.uid;
        setCloudSessionUid(user.uid);
      } catch (err) {
        console.error('Firebase user bootstrap failed:', err);
        setCloudSyncStatus('error');
        showToast(
          lang === 'vi'
            ? 'Không thể khởi tạo hồ sơ Firebase. Vui lòng thử đăng nhập lại.'
            : 'Failed to initialize Firebase profile.'
        );
      }
    });

    return () => unsubAuth();
  }, []);

  // Subscribe to real-time user preferences (device, profile, language) across Phone <-> PC
  useEffect(() => {
    if (!cloudSessionUid) return;
    const unsubPrefs = subscribeUserPreferences(cloudSessionUid, (prefs) => {
      const nextDeviceId = prefs.selectedDeviceId || latestStateRef.current.selectedDevice.id;
      const nextProfile = prefs.activeProfile ?? latestStateRef.current.activeProfile;
      const nextLang = prefs.lang ?? latestStateRef.current.lang;
      const sig = stableStringify({
        selectedDeviceId: nextDeviceId,
        activeProfile: nextProfile,
        lang: nextLang,
      });
      if (sig === lastCloudPrefsSigRef.current) return;
      lastCloudPrefsSigRef.current = sig;

      isHydratingPrefsRef.current = true;
      let switchedProfileOrDevice = false;

      if (nextLang && nextLang !== latestStateRef.current.lang) {
        setLang(nextLang);
      }
      if (nextProfile >= 1 && nextProfile <= 3 && nextProfile !== latestStateRef.current.activeProfile) {
        setActiveProfile(nextProfile);
        switchedProfileOrDevice = true;
      }
      if (nextDeviceId !== latestStateRef.current.selectedDevice.id) {
        const matchedDev = SUPPORTED_DEVICES.find((d) => d.id === nextDeviceId);
        if (matchedDev) {
          const canSwitchConnected =
            !webhidService.isConnected() ||
            ((matchedDev.id === 'aula-s75-pro' || matchedDev.id === 'aula-f108-pro') &&
              webhidService.getDeviceInfo().protocolFamily === 'aula04');
          if (canSwitchConnected) {
            selectedDeviceIdRef.current = matchedDev.id;
            webhidService.setPreferredModel(mapUiDeviceToOpenAulaId(matchedDev.id));
            setSelectedDevice(matchedDev);
            setLighting(matchedDev.defaultLighting);
            if (matchedDev.type === 'mouse') {
              setActiveTab('mouse');
            } else if (activeTab === 'mouse') {
              setActiveTab('keymap');
            }
            switchedProfileOrDevice = true;
          }
        }
      }

      if (switchedProfileOrDevice && webhidService.isConnected()) {
        applyProfileOnNextLoadRef.current = true;
      }

      setTimeout(() => {
        isHydratingPrefsRef.current = false;
      }, 100);
    });

    return () => unsubPrefs();
  }, [cloudSessionUid]);

  // Publish PC WebHID Bridge status when connected; subscribe to Bridge status on Phone/other tabs
  useEffect(() => {
    if (!cloudSessionUid) return;

    const unsubBridge = subscribeBridgeStatus(cloudSessionUid, (status) => {
      setRemoteBridge(status);
    });

    return () => unsubBridge();
  }, [cloudSessionUid]);

  useEffect(() => {
    if (!cloudSessionUid) return;

    if (isConnected) {
      wasHostingBridgeRef.current = true;
      publishBridgeStatus(cloudSessionUid, {
        online: true,
        hidConnected: true,
        deviceId: selectedDevice.id,
        productName: deviceInfo.productName || selectedDevice.name,
        connectionType: deviceInfo.connectionType,
        batteryLevel: deviceInfo.batteryLevel,
        clientHostId: clientIdRef.current,
      }).catch((err) => console.error('Publish bridge status failed:', err));
    } else if (wasHostingBridgeRef.current) {
      wasHostingBridgeRef.current = false;
      publishBridgeStatus(cloudSessionUid, {
        online: false,
        hidConnected: false,
        deviceId: selectedDevice.id,
        productName: selectedDevice.name,
        connectionType: 'disconnected',
        batteryLevel: null,
        clientHostId: clientIdRef.current,
      }).catch((err) => console.error('Clear bridge status failed:', err));
    }
  }, [
    cloudSessionUid,
    isConnected,
    selectedDevice.id,
    selectedDevice.name,
    deviceInfo.productName,
    deviceInfo.connectionType,
    deviceInfo.batteryLevel,
  ]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (cloudSessionUid && wasHostingBridgeRef.current) {
        publishBridgeStatus(cloudSessionUid, {
          online: false,
          hidConnected: false,
          deviceId: latestStateRef.current.selectedDevice.id,
          productName: latestStateRef.current.selectedDevice.name,
          connectionType: 'disconnected',
          batteryLevel: null,
          clientHostId: clientIdRef.current,
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cloudSessionUid]);

  // Auto-apply remote profile diffs onto physical WebHID hardware when PC is connected
  const syncRemoteDiffToHardware = async (
    prevHw: CloudDeviceProfile | null,
    nextProf: CloudDeviceProfile,
    device: DeviceModel,
    macrosList: Macro[],
    forceApplyAll = false
  ) => {
    if (!webhidService.isConnected()) return;
    const keys = device.keys || [];
    const appliedMessages: string[] = [];

    const prevLightSig = prevHw ? stableStringify(prevHw.lighting) : '';
    const nextLightSig = stableStringify(nextProf.lighting);
    if ((forceApplyAll || (prevHw && prevLightSig !== nextLightSig)) && nextProf.lighting) {
      const mergedLight = { ...device.defaultLighting, ...nextProf.lighting };
      const res = await webhidService.applyLighting(mergedLight, keys);
      if (res.ok) appliedMessages.push('LED RGB');
    }

    if (device.type === 'keyboard') {
      for (const layerIdx of [0, 1]) {
        const prevLayerSig = prevHw ? stableStringify(prevHw.keymaps?.[layerIdx] || {}) : '';
        const nextLayerMap = nextProf.keymaps?.[layerIdx] || {};
        const nextLayerSig = stableStringify(nextLayerMap);
        if (forceApplyAll || (prevHw && prevLayerSig !== nextLayerSig)) {
          const res = await webhidService.applyKeymap(
            layerIdx,
            0,
            { type: 'default', value: '', label: 'Default', category: 'Default' },
            keys,
            nextLayerMap,
            macrosList
          );
          if (res.ok) appliedMessages.push(layerIdx === 1 ? 'Fn Keymap' : 'Keymap');
        }
      }

      if (nextProf.systemSettings) {
        const prevSysSig = prevHw ? stableStringify(prevHw.systemSettings || {}) : '';
        const nextSysSig = stableStringify(nextProf.systemSettings);
        if (forceApplyAll || (prevHw && prevSysSig !== nextSysSig)) {
          const res = await webhidService.applySystemSettings(nextProf.systemSettings);
          if (res.ok) appliedMessages.push('System');
        }
      }
    } else if (device.type === 'mouse' && nextProf.mouseConfig) {
      const prevMouseSig = prevHw ? stableStringify(prevHw.mouseConfig || {}) : '';
      const nextMouseSig = stableStringify(nextProf.mouseConfig);
      if (forceApplyAll || (prevHw && prevMouseSig !== nextMouseSig)) {
        const res = await webhidService.applyMouseConfig(nextProf.mouseConfig);
        if (res.ok) appliedMessages.push('Mouse DPI');
      }
    }

    if (appliedMessages.length > 0) {
      showToast(
        latestStateRef.current.lang === 'vi'
          ? `Đã đồng bộ từ điện thoại/Cloud xuống ${device.name}: ${appliedMessages.join(', ')}`
          : `Synced from remote to ${device.name}: ${appliedMessages.join(', ')}`
      );
    }
  };

  // Load & subscribe active device profile from Firestore when signed in
  useEffect(() => {
    if (!cloudSessionUid) return;
    let active = true;
    let unsubProfile: (() => void) | null = null;
    const comboKey = `${cloudSessionUid}:${selectedDevice.id}:p${activeProfile}`;

    const applyCloudProfile = (
      cloudProf: CloudDeviceProfile,
      isRemoteUpdate: boolean,
      forceHwApply = false
    ) => {
      const normalizedProf: CloudDeviceProfile = {
        keymaps: cloudProf.keymaps,
        lighting: {
          ...selectedDevice.defaultLighting,
          ...cloudProf.lighting,
        },
        systemSettings: cloudProf.systemSettings
          ? { ...latestStateRef.current.systemSettings, ...cloudProf.systemSettings }
          : latestStateRef.current.systemSettings,
        mouseConfig: cloudProf.mouseConfig
          ? { ...latestStateRef.current.mouseConfig, ...cloudProf.mouseConfig }
          : latestStateRef.current.mouseConfig,
        screenSettings: cloudProf.screenSettings
          ? cloudProf.screenSettings
          : extractCloudScreenSettings(latestStateRef.current.screenConfig),
      };

      const sig = stableStringify(normalizedProf);
      if (sig === lastCloudProfileSigRef.current && !forceHwApply) return;
      lastCloudProfileSigRef.current = sig;

      isHydratingProfileRef.current = true;
      setKeymaps(normalizedProf.keymaps);
      if (normalizedProf.lighting) {
        setLighting(normalizedProf.lighting);
      }
      if (normalizedProf.systemSettings) {
        setSystemSettings(normalizedProf.systemSettings);
      }
      if (normalizedProf.mouseConfig) {
        setMouseConfig(normalizedProf.mouseConfig);
      }
      if (normalizedProf.screenSettings) {
        setScreenConfig((prev) => ({ ...prev, ...normalizedProf.screenSettings }));
      }
      setTimeout(() => {
        isHydratingProfileRef.current = false;
      }, 100);

      const prevHw = lastAppliedHwProfileRef.current;
      lastAppliedHwProfileRef.current = normalizedProf;

      if ((isRemoteUpdate || forceHwApply) && webhidService.isConnected()) {
        syncRemoteDiffToHardware(
          prevHw,
          normalizedProf,
          selectedDevice,
          latestStateRef.current.macros,
          forceHwApply
        ).catch((err) => console.error('Auto-apply remote hardware failed:', err));
      }
    };

    (async () => {
      setCloudSyncStatus('syncing');
      try {
        const existing = await loadDeviceProfileFromCloud(
          cloudSessionUid,
          selectedDevice.id,
          activeProfile
        );
        if (!active) return;

        const forceApply = applyProfileOnNextLoadRef.current;
        applyProfileOnNextLoadRef.current = false;

        if (existing) {
          applyCloudProfile(existing, false, forceApply);
        } else {
          const initialPayload: CloudDeviceProfile = {
            keymaps: latestStateRef.current.keymaps,
            lighting: latestStateRef.current.lighting,
            systemSettings: latestStateRef.current.systemSettings,
            mouseConfig: latestStateRef.current.mouseConfig,
            screenSettings: extractCloudScreenSettings(latestStateRef.current.screenConfig),
          };
          lastCloudProfileSigRef.current = stableStringify(initialPayload);
          lastAppliedHwProfileRef.current = initialPayload;
          await saveDeviceProfileToCloud(
            cloudSessionUid,
            selectedDevice.id,
            activeProfile,
            initialPayload
          );
        }

        if (!active) return;
        profileHydratedKeyRef.current = comboKey;
        setCloudSyncStatus('synced');
        setLastCloudSavedAt(Date.now());

        unsubProfile = subscribeDeviceProfile(
          cloudSessionUid,
          selectedDevice.id,
          activeProfile,
          (cloudProf) => {
            if (!active || !cloudProf) return;
            applyCloudProfile(cloudProf, true, false);
            setCloudSyncStatus('synced');
            setLastCloudSavedAt(Date.now());
          }
        );
      } catch (err) {
        if (!active) return;
        console.error('Profile cloud sync error:', err);
        setCloudSyncStatus('error');
      }
    })();

    return () => {
      active = false;
      if (unsubProfile) unsubProfile();
    };
  }, [cloudSessionUid, selectedDevice.id, activeProfile]);

  // Load & subscribe user macros from Firestore when signed in
  useEffect(() => {
    if (!cloudSessionUid) return;
    let active = true;
    let unsubMacros: (() => void) | null = null;

    const applyCloudMacros = (cloudMacros: Macro[]) => {
      const sig = stableStringify(cloudMacros);
      if (sig === lastCloudMacrosSigRef.current) return;
      lastCloudMacrosSigRef.current = sig;

      isHydratingMacrosRef.current = true;
      setMacros(cloudMacros);
      setTimeout(() => {
        isHydratingMacrosRef.current = false;
      }, 100);
    };

    (async () => {
      try {
        const existingMacros = await loadUserMacrosFromCloud(cloudSessionUid);
        if (!active) return;

        if (existingMacros.length > 0) {
          applyCloudMacros(existingMacros);
        } else if (latestStateRef.current.macros.length > 0) {
          lastCloudMacrosSigRef.current = stableStringify(latestStateRef.current.macros);
          await syncUserMacrosToCloud(cloudSessionUid, latestStateRef.current.macros);
        }

        if (!active) return;
        macrosHydratedUidRef.current = cloudSessionUid;

        unsubMacros = subscribeUserMacros(cloudSessionUid, (cloudMacros) => {
          if (!active) return;
          if (cloudMacros.length === 0 && macrosHydratedUidRef.current !== cloudSessionUid) return;
          applyCloudMacros(cloudMacros);
          setLastCloudSavedAt(Date.now());
        });
      } catch (err) {
        if (!active) return;
        console.error('Macro cloud sync error:', err);
        setCloudSyncStatus('error');
      }
    })();

    return () => {
      active = false;
      if (unsubMacros) unsubMacros();
    };
  }, [cloudSessionUid]);

  // Subscribe to Remote Hardware Commands (Phone -> Firebase -> PC WebHID Bridge)
  useEffect(() => {
    if (!cloudSessionUid) return;

    const unsubCmds = subscribeRemoteCommands(cloudSessionUid, async (commands) => {
      for (const cmd of commands) {
        // Phone / sender receives completion feedback from PC
        if (
          cmd.senderId === clientIdRef.current &&
          sentCmdIdsRef.current.has(cmd.commandId) &&
          cmd.status !== 'pending'
        ) {
          sentCmdIdsRef.current.delete(cmd.commandId);
          showToast(
            cmd.status === 'completed'
              ? `Máy tính đã thực thi: ${cmd.resultMessage || 'Thành công'}`
              : `Máy tính báo lỗi: ${cmd.resultMessage || 'Không thể thực thi'}`
          );
          continue;
        }

        // PC WebHID Bridge executes pending commands sent by Phone/other devices
        if (
          cmd.status === 'pending' &&
          cmd.senderId !== clientIdRef.current &&
          webhidService.isConnected() &&
          !processedCmdIdsRef.current.has(cmd.commandId)
        ) {
          processedCmdIdsRef.current.add(cmd.commandId);
          try {
            const devModel =
              SUPPORTED_DEVICES.find((d) => d.id === cmd.deviceId) ||
              latestStateRef.current.selectedDevice;
            const devKeys = devModel.keys || [];
            const [freshProf, freshMacros] = await Promise.all([
              loadDeviceProfileFromCloud(cloudSessionUid, cmd.deviceId, cmd.profileSlot),
              loadUserMacrosFromCloud(cloudSessionUid),
            ]);
            const effectiveMacros =
              freshMacros.length > 0 ? freshMacros : latestStateRef.current.macros;

            let res: { ok: boolean; message: string } = {
              ok: false,
              message: 'Lệnh không xác định.',
            };

            if (cmd.type === 'apply_lighting') {
              const lightCfg = freshProf?.lighting
                ? { ...devModel.defaultLighting, ...freshProf.lighting }
                : latestStateRef.current.lighting;
              res = await webhidService.applyLighting(lightCfg, devKeys);
            } else if (cmd.type === 'apply_keymap') {
              const layerIdx = cmd.layer ?? latestStateRef.current.activeLayer;
              const layerMap =
                freshProf?.keymaps?.[layerIdx] ??
                latestStateRef.current.keymaps[layerIdx] ??
                {};
              res = await webhidService.applyKeymap(
                layerIdx,
                0,
                { type: 'default', value: '', label: 'Default', category: 'Default' },
                devKeys,
                layerMap,
                effectiveMacros
              );
            } else if (cmd.type === 'apply_macros') {
              res = await webhidService.applyMacros(effectiveMacros);
            } else if (cmd.type === 'apply_system') {
              const sysCfg =
                freshProf?.systemSettings ?? latestStateRef.current.systemSettings;
              res = await webhidService.applySystemSettings(sysCfg);
            } else if (cmd.type === 'apply_mouse') {
              const mouseCfg = freshProf?.mouseConfig ?? latestStateRef.current.mouseConfig;
              res = await webhidService.applyMouseConfig(mouseCfg);
            } else if (cmd.type === 'sync_time') {
              res = await webhidService.syncTime(new Date());
            } else if (cmd.type === 'reset_keys') {
              res = await webhidService.factoryResetHardware(false);
            } else if (cmd.type === 'factory_reset') {
              res = await webhidService.factoryResetHardware(true);
            }

            await completeRemoteCommand(
              cloudSessionUid,
              cmd.commandId,
              res.ok ? 'completed' : 'failed',
              res.message
            );
            showToast(`Điều khiển từ xa: ${res.message}`);
          } catch (err: any) {
            await completeRemoteCommand(
              cloudSessionUid,
              cmd.commandId,
              'failed',
              err?.message || 'Lỗi thực thi lệnh WebHID'
            ).catch(() => {});
          }
          continue;
        }

        // Prune old completed/failed commands (> 20s) from PC side
        if (
          cmd.status !== 'pending' &&
          webhidService.isConnected() &&
          cmd.createdAtMs &&
          Date.now() - cmd.createdAtMs > 20000
        ) {
          cleanupRemoteCommand(cloudSessionUid, cmd.commandId).catch(() => {});
        }
      }
    });

    return () => unsubCmds();
  }, [cloudSessionUid, isConnected]);

  // Debounced auto-save active device profile to Firestore (300ms for snappy Phone -> PC sync)
  useEffect(() => {
    if (!cloudSessionUid) return;
    const comboKey = `${cloudSessionUid}:${selectedDevice.id}:p${activeProfile}`;
    if (profileHydratedKeyRef.current !== comboKey || isHydratingProfileRef.current) {
      return;
    }

    const payload: CloudDeviceProfile = {
      keymaps,
      lighting,
      systemSettings,
      mouseConfig,
      screenSettings: extractCloudScreenSettings(screenConfig),
    };
    const nextSig = stableStringify(payload);
    if (nextSig === lastCloudProfileSigRef.current) return;

    const timer = setTimeout(async () => {
      setCloudSyncStatus('syncing');
      try {
        lastCloudProfileSigRef.current = nextSig;
        lastAppliedHwProfileRef.current = payload;
        await saveDeviceProfileToCloud(
          cloudSessionUid,
          selectedDevice.id,
          activeProfile,
          payload
        );
        setCloudSyncStatus('synced');
        setLastCloudSavedAt(Date.now());
      } catch (err) {
        console.error('Auto-save profile failed:', err);
        setCloudSyncStatus('error');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    cloudSessionUid,
    selectedDevice.id,
    activeProfile,
    keymaps,
    lighting,
    systemSettings,
    mouseConfig,
    screenConfig.brightness,
    screenConfig.fps,
    screenConfig.orientation,
    screenConfig.showTimeOverlay,
    screenConfig.showBatteryOverlay,
    screenConfig.showTempOverlay,
  ]);

  // Debounced auto-save macros to Firestore
  useEffect(() => {
    if (!cloudSessionUid) return;
    if (macrosHydratedUidRef.current !== cloudSessionUid || isHydratingMacrosRef.current) {
      return;
    }

    const nextSig = stableStringify(macros);
    if (nextSig === lastCloudMacrosSigRef.current) return;

    const timer = setTimeout(async () => {
      setCloudSyncStatus('syncing');
      try {
        lastCloudMacrosSigRef.current = nextSig;
        await syncUserMacrosToCloud(cloudSessionUid, macros);
        setCloudSyncStatus('synced');
        setLastCloudSavedAt(Date.now());
      } catch (err) {
        console.error('Auto-save macros failed:', err);
        setCloudSyncStatus('error');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cloudSessionUid, macros]);

  // Debounced auto-save user preferences (device, profile, language)
  useEffect(() => {
    if (
      !cloudSessionUid ||
      prefsHydratedUidRef.current !== cloudSessionUid ||
      isHydratingPrefsRef.current
    ) {
      return;
    }
    const nextSig = stableStringify({
      selectedDeviceId: selectedDevice.id,
      activeProfile,
      lang,
    });
    if (nextSig === lastCloudPrefsSigRef.current) return;

    const timer = setTimeout(() => {
      lastCloudPrefsSigRef.current = nextSig;
      updateUserPreferences(cloudSessionUid, {
        selectedDeviceId: selectedDevice.id,
        activeProfile,
        lang,
      }).catch((err) => {
        console.error('Preference update failed:', err);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [cloudSessionUid, selectedDevice.id, activeProfile, lang]);

  // Listen to physical keyboard events for Switch Sounds & Key Tester
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger switch sounds if user is typing into text inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      soundEngine.playKeySound(false);

      setActiveKeys((prev) => new Set([...prev, e.code]));
      setTestedKeys((prev) => new Set([...prev, e.code]));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      soundEngine.playKeySound(true);

      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle Device Change
  const handleSelectDevice = (device: DeviceModel) => {
    selectedDeviceIdRef.current = device.id;
    webhidService.setPreferredModel(mapUiDeviceToOpenAulaId(device.id));
    setSelectedDevice(device);
    setLighting(device.defaultLighting);
    setSelectedKey(null);
    setSelectedMouseButton(null);

    if (device.type === 'mouse') {
      setActiveTab('mouse');
    } else {
      if (activeTab === 'mouse') {
        setActiveTab('keymap');
      }
    }
    showToast(`Đã chọn layout hiển thị: ${device.name}`);
  };

  // Connect Hardware WebHID
  const handleConnectHID = async (allowAllDevices = false) => {
    const res = await webhidService.connectHardware(allowAllDevices);
    const paired = await webhidService.checkPairedDevices(false);
    setPairedDevices(paired);

    if (res.success) {
      setConnectModal({ open: false });
      if (res.deviceInfo) {
        syncMatchedDeviceModel(res.deviceInfo);
      }
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.1 },
      });
      showToast(res.message);
    } else {
      if (
        res.errorType === 'permissions_policy' ||
        res.errorType === 'unsupported' ||
        res.errorType === 'open_failed' ||
        (res.errorType === 'cancelled' && !allowAllDevices)
      ) {
        setConnectModal({
          open: true,
          errorType: res.errorType,
          message: res.message,
        });
      }
      showToast(res.message);
    }
  };

  const handleConnectPaired = async (dev: any) => {
    const res = await webhidService.connectPairedDevice(dev);
    if (res.success) {
      setConnectModal({ open: false });
      if (res.deviceInfo) syncMatchedDeviceModel(res.deviceInfo);
      confetti({ particleCount: 70, spread: 55, origin: { y: 0.1 } });
      showToast(res.message);
    } else {
      showToast(res.message);
    }
  };

  const handleDisconnectHID = () => {
    webhidService.disconnect();
    showToast('Đã ngắt kết nối phần cứng WebHID.');
  };

  // Helper to flush current state to Firebase and dispatch a remote command to the PC WebHID bridge
  const sendCommandFromRemote = async (
    type: RemoteCommandType,
    override?: {
      keymaps?: Record<number, Record<string, KeyRemapAction>>;
      mouseConfig?: MouseConfig;
      layer?: number;
    }
  ) => {
    if (!cloudSessionUid) {
      showToast('Chưa kết nối thiết bị WebHID thật! Hãy kết nối bàn phím/chuột hoặc đăng nhập Google.');
      return;
    }

    setCloudSyncStatus('syncing');
    try {
      const st = latestStateRef.current;
      const profilePayload: CloudDeviceProfile = {
        keymaps: override?.keymaps ?? st.keymaps,
        lighting: st.lighting,
        systemSettings: st.systemSettings,
        mouseConfig: override?.mouseConfig ?? st.mouseConfig,
        screenSettings: extractCloudScreenSettings(st.screenConfig),
      };
      lastCloudProfileSigRef.current = stableStringify(profilePayload);
      lastCloudMacrosSigRef.current = stableStringify(st.macros);

      await Promise.all([
        saveDeviceProfileToCloud(
          cloudSessionUid,
          st.selectedDevice.id,
          st.activeProfile,
          profilePayload
        ),
        syncUserMacrosToCloud(cloudSessionUid, st.macros),
      ]);

      const cmdId = await dispatchRemoteCommand(cloudSessionUid, {
        senderId: clientIdRef.current,
        type,
        deviceId: st.selectedDevice.id,
        profileSlot: st.activeProfile,
        layer: override?.layer ?? st.activeLayer,
      });
      sentCmdIdsRef.current.add(cmdId);
      setCloudSyncStatus('synced');
      setLastCloudSavedAt(Date.now());

      showToast(
        isRemoteBridgeOnline
          ? `Đã gửi lệnh qua Firebase tới máy tính (${remoteBridge?.productName || st.selectedDevice.name})!`
          : 'Đã lưu lên Firebase Cloud (máy tính sẽ tự đồng bộ khi mở app & cắm WebHID).'
      );
    } catch (err) {
      console.error('Remote command dispatch failed:', err);
      setCloudSyncStatus('error');
      showToast('Lỗi gửi lệnh đồng bộ qua Firebase.');
    }
  };

  // Key Remap Action (writes real HID scancode on PC OR syncs remotely via Firebase on Phone)
  const handleRemapKey = async (action: KeyRemapAction | null, targetKey?: KeyDefinition) => {
    const keyToEdit = targetKey ?? selectedKey;
    if (!keyToEdit) return;

    if (action) {
      const nextLayerMap = {
        ...(keymaps[activeLayer] || {}),
        [keyToEdit.id]: action,
      };
      const nextKeymaps = {
        ...keymaps,
        [activeLayer]: nextLayerMap,
      };

      if (webhidService.isConnected()) {
        const res = await webhidService.applyKeymap(
          activeLayer,
          keyToEdit.hwIdx ?? Math.round(keyToEdit.col),
          action,
          selectedDevice.keys || [],
          nextLayerMap,
          macros
        );
        if (!res.ok) {
          showToast(res.message);
          return;
        }
        setKeymaps(nextKeymaps);
        showToast(`Đã ghi thật [${keyToEdit.label}] -> ${action.label}`);
      } else if (cloudSessionUid) {
        setKeymaps(nextKeymaps);
        await sendCommandFromRemote('apply_keymap', {
          keymaps: nextKeymaps,
          layer: activeLayer,
        });
      } else {
        showToast(
          'Chưa kết nối thiết bị WebHID thật! Hãy cắm bàn phím trên máy tính hoặc đăng nhập Google để điều khiển từ xa.'
        );
      }
    } else {
      const nextLayerMap = { ...(keymaps[activeLayer] || {}) };
      delete nextLayerMap[keyToEdit.id];
      const nextKeymaps = {
        ...keymaps,
        [activeLayer]: nextLayerMap,
      };

      if (webhidService.isConnected()) {
        await webhidService.applyKeymap(
          activeLayer,
          keyToEdit.hwIdx ?? Math.round(keyToEdit.col),
          { type: 'default', value: '', label: 'Default', category: 'Default' },
          selectedDevice.keys || [],
          nextLayerMap,
          macros
        );
        setKeymaps(nextKeymaps);
        showToast(`Đã khôi phục [${keyToEdit.label}] về mặc định`);
      } else if (cloudSessionUid) {
        setKeymaps(nextKeymaps);
        await sendCommandFromRemote('apply_keymap', {
          keymaps: nextKeymaps,
          layer: activeLayer,
        });
      } else {
        setKeymaps(nextKeymaps);
        showToast(`Đã khôi phục [${keyToEdit.label}] về mặc định`);
      }
    }
  };

  // Apply Lighting to Real Hardware (or remotely via Firebase Bridge)
  const handleApplyLighting = async () => {
    if (webhidService.isConnected()) {
      const res = await webhidService.applyLighting(lighting, selectedDevice.keys || []);
      showToast(res.ok ? res.message || t('savedNotification') : res.message);
      return;
    }
    if (cloudSessionUid) {
      await sendCommandFromRemote('apply_lighting');
      return;
    }
    showToast('Chưa kết nối thiết bị WebHID thật! Hãy kết nối bàn phím/chuột hoặc đăng nhập Google.');
  };

  const handleApplyMacrosAction = async () => {
    if (webhidService.isConnected()) {
      const res = await webhidService.applyMacros(macros);
      showToast(res.message);
      return;
    }
    if (cloudSessionUid) {
      await sendCommandFromRemote('apply_macros');
      return;
    }
    showToast('Vui lòng kết nối thiết bị WebHID thật hoặc đăng nhập Google.');
  };

  const handleApplySystemAction = async () => {
    if (webhidService.isConnected()) {
      const res = await webhidService.applySystemSettings(systemSettings);
      showToast(res.message);
      return;
    }
    if (cloudSessionUid) {
      await sendCommandFromRemote('apply_system');
      return;
    }
    showToast('Vui lòng kết nối thiết bị WebHID thật hoặc đăng nhập Google.');
  };

  const handleHardwareResetAction = async (fullFactory: boolean) => {
    if (fullFactory) {
      handleFactoryReset();
    }
    if (webhidService.isConnected()) {
      const res = await webhidService.factoryResetHardware(fullFactory);
      showToast(res.message);
      return;
    }
    if (cloudSessionUid) {
      await sendCommandFromRemote(fullFactory ? 'factory_reset' : 'reset_keys');
      return;
    }
    if (!fullFactory) {
      showToast('Chưa kết nối thiết bị WebHID thật để gửi lệnh Reset Keyboard.');
    }
  };

  const handleApplyMouseAction = async (nextMouseCfg: MouseConfig) => {
    if (webhidService.isConnected()) {
      const res = await webhidService.applyMouseConfig(nextMouseCfg);
      showToast(res.message);
      return;
    }
    if (cloudSessionUid) {
      await sendCommandFromRemote('apply_mouse', { mouseConfig: nextMouseCfg });
      return;
    }
    showToast('Vui lòng kết nối chuột AULA SC620 hoặc đăng nhập Google.');
  };

  const handleSyncTimeAction = async () => {
    if (webhidService.isConnected()) {
      const res = await webhidService.syncTime(new Date());
      showToast(res.message);
      return;
    }
    if (cloudSessionUid) {
      await sendCommandFromRemote('sync_time');
      return;
    }
    showToast('Chưa kết nối bàn phím AULA qua WebHID thật hoặc đăng nhập Google.');
  };

  // Custom Matrix Painter Key Click & Group Paint
  const handlePaintKey = (keyId: string, color: string) => {
    setLighting((prev) => ({
      ...prev,
      mode: 'custom_matrix',
      customKeyColors: {
        ...prev.customKeyColors,
        [keyId]: color,
      },
    }));
  };

  const handlePaintGroup = (keyIds: string[], color: string) => {
    setLighting((prev) => {
      const updated = { ...prev.customKeyColors };
      for (const id of keyIds) {
        updated[id] = color;
      }
      return {
        ...prev,
        mode: 'custom_matrix',
        customKeyColors: updated,
      };
    });
    showToast(`Đã tô màu ${keyIds.length} phím bằng màu ${color.toUpperCase()}`);
  };

  const handleClearCustomMatrix = () => {
    setLighting((prev) => ({
      ...prev,
      customKeyColors: {},
    }));
    showToast('Đã xóa màu tùy biến tất cả các phím');
  };

  // Export / Import Profiles
  const handleExportProfile = () => {
    const data = {
      version: '2.4.0',
      device: selectedDevice.id,
      profile: activeProfile,
      lighting,
      keymaps,
      macros,
      screenConfig,
      mouseConfig,
      systemSettings,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `open-aula-${selectedDevice.id}-profile-${activeProfile}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('exportProfile'));
  };

  const handleImportProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.lighting) setLighting(parsed.lighting);
        if (parsed.keymaps) setKeymaps(parsed.keymaps);
        if (parsed.macros) setMacros(parsed.macros);
        if (parsed.screenConfig) setScreenConfig(parsed.screenConfig);
        if (parsed.mouseConfig) setMouseConfig(parsed.mouseConfig);
        if (parsed.systemSettings) setSystemSettings(parsed.systemSettings);
        showToast('Đã nhập thành công cấu hình!');
      } catch (err) {
        showToast('Tệp cấu hình không hợp lệ.');
      }
    };
    reader.readAsText(file);
  };

  // Google Sign-In / Sign-Out & Manual Cloud Sync
  const handleSignInGoogle = async () => {
    setAuthLoading(true);
    try {
      const signedInUser = await signInWithGoogle();
      showToast(
        lang === 'vi'
          ? `Đã đăng nhập Google: ${signedInUser.displayName || signedInUser.email}`
          : `Signed in as ${signedInUser.displayName || signedInUser.email}`
      );
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast(
          lang === 'vi' ? 'Đã đóng cửa sổ đăng nhập Google.' : 'Google sign-in popup closed.'
        );
      } else if (code === 'auth/popup-blocked') {
        showToast(
          lang === 'vi'
            ? 'Trình duyệt đã chặn popup đăng nhập. Hãy cho phép popup hoặc mở tab mới.'
            : 'Sign-in popup was blocked by browser.'
        );
      } else {
        console.error('Google Sign-In error:', error);
        showToast(
          lang === 'vi'
            ? 'Đăng nhập Google thất bại. Vui lòng thử lại.'
            : 'Google sign-in failed.'
        );
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOutGoogle();
      showToast(lang === 'vi' ? 'Đã đăng xuất tài khoản Google.' : 'Signed out.');
    } catch (error) {
      console.error('Sign-out error:', error);
      showToast(lang === 'vi' ? 'Lỗi khi đăng xuất.' : 'Sign-out failed.');
    }
  };

  const handleManualCloudSync = async () => {
    if (!cloudSessionUid) {
      handleSignInGoogle();
      return;
    }
    setCloudSyncStatus('syncing');
    try {
      const profilePayload: CloudDeviceProfile = {
        keymaps,
        lighting,
        systemSettings,
        mouseConfig,
        screenSettings: extractCloudScreenSettings(screenConfig),
      };
      lastCloudProfileSigRef.current = stableStringify(profilePayload);
      lastCloudMacrosSigRef.current = stableStringify(macros);
      lastAppliedHwProfileRef.current = profilePayload;

      await Promise.all([
        saveDeviceProfileToCloud(
          cloudSessionUid,
          selectedDevice.id,
          activeProfile,
          profilePayload
        ),
        syncUserMacrosToCloud(cloudSessionUid, macros),
        updateUserPreferences(cloudSessionUid, {
          selectedDeviceId: selectedDevice.id,
          activeProfile,
          lang,
        }),
      ]);
      setCloudSyncStatus('synced');
      setLastCloudSavedAt(Date.now());
      showToast(
        lang === 'vi'
          ? `Đã lưu đồng bộ ${selectedDevice.name} (P${activeProfile}) & Macro lên Firebase!`
          : `Synced ${selectedDevice.name} (P${activeProfile}) & Macros to Firebase!`
      );
    } catch (error) {
      console.error('Manual cloud sync error:', error);
      setCloudSyncStatus('error');
      showToast(
        lang === 'vi' ? 'Lỗi đồng bộ lên Firebase Cloud.' : 'Failed to sync to Firebase Cloud.'
      );
    }
  };

  const handleFactoryReset = () => {
    const resetLighting = selectedDevice.defaultLighting;
    const resetKeymaps = EMPTY_KEYMAPS();
    const resetSystem: SystemSettings = {
      debounceLevel: 2,
      sleepMinutes: 1,
      disableWinKey: false,
      disableAltF4: false,
      disableAltTab: false,
    };
    setLighting(resetLighting);
    setKeymaps(resetKeymaps);
    try {
      localStorage.removeItem(getKeymapStorageKey(selectedDevice.id, activeProfile));
    } catch {
      // Ignore
    }
    setMacros(INITIAL_MACROS);
    setMouseConfig(DEFAULT_MOUSE_CONFIG);
    setSystemSettings(resetSystem);
    webhidService.clearPackets();
    showToast('Đã khôi phục toàn bộ cài đặt gốc AULA!');
  };

  // Tabs navigation list
  const navTabs = [
    ...(selectedDevice.type === 'keyboard'
      ? [
          { id: 'keymap', name: t('tabKeymap'), icon: Layers },
          { id: 'lighting', name: t('tabLighting'), icon: Sparkles },
          { id: 'macro', name: t('tabMacro'), icon: Activity },
          ...(selectedDevice.hasScreen
            ? [{ id: 'screen', name: t('tabScreen'), icon: Tv }]
            : []),
          { id: 'tester', name: t('tabKeyTester'), icon: KeyboardIcon },
          { id: 'system', name: t('tabSystem'), icon: Settings },
        ]
      : [
          { id: 'mouse', name: t('tabMouse'), icon: MouseIcon },
          { id: 'lighting', name: t('tabLighting'), icon: Sparkles },
          { id: 'macro', name: t('tabMacro'), icon: Activity },
        ]),
    { id: 'packets', name: t('tabPackets'), icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 border border-cyan-500/80 text-cyan-300 text-xs font-bold shadow-2xl shadow-cyan-500/20 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <Header
        devices={SUPPORTED_DEVICES}
        selectedDevice={selectedDevice}
        onSelectDevice={handleSelectDevice}
        isConnected={isConnected}
        deviceInfo={deviceInfo}
        activeProfile={activeProfile}
        onSelectProfile={setActiveProfile}
        lang={lang}
        onToggleLang={() => setLang(lang === 'vi' ? 'en' : 'vi')}
        t={t}
        onConnectHID={() => handleConnectHID(false)}
        onDisconnectHID={handleDisconnectHID}
        onExportProfile={handleExportProfile}
        onImportProfile={handleImportProfile}
        onFactoryReset={handleFactoryReset}
        user={
          firebaseUser
            ? {
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName,
                email: firebaseUser.email,
                photoURL: firebaseUser.photoURL,
              }
            : null
        }
        authLoading={authLoading}
        cloudSyncStatus={cloudSyncStatus}
        onSignInGoogle={handleSignInGoogle}
        onSignOutGoogle={handleSignOutGoogle}
      />

      {/* Real Hardware / Firebase Remote Bridge Status Banner */}
      {isRemoteBridgeOnline ? (
        <div className="bg-emerald-950/45 border-b border-emerald-700/50 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-200">
              <Smartphone className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>
                {lang === 'vi' ? 'Chế độ điều khiển từ xa qua Firebase:' : 'Firebase Remote Control:'}{' '}
                <strong className="text-white">
                  {remoteBridge?.productName || selectedDevice.name}
                </strong>{' '}
                <span className="text-emerald-300 font-semibold">
                  •{' '}
                  {remoteBridge?.connectionType === 'wireless_2.4g'
                    ? '2.4GHz'
                    : remoteBridge?.connectionType === 'wired'
                    ? 'USB-C'
                    : 'Online'}
                  {typeof remoteBridge?.batteryLevel === 'number'
                    ? ` • Pin ${remoteBridge.batteryLevel}%`
                    : ''}
                </span>{' '}
                <span className="text-slate-300 hidden sm:inline">
                  — Mọi chỉnh sửa LED, Keymap, Macro, DPI sẽ tự động gửi xuống máy tính.
                </span>
              </span>
            </div>
            <button
              onClick={handleManualCloudSync}
              className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition cursor-pointer"
            >
              {lang === 'vi' ? 'Đồng bộ ngay' : 'Sync Now'}
            </button>
          </div>
        </div>
      ) : !isConnected && pairedDevices.length > 0 ? (
        <div className="bg-cyan-950/40 border-b border-cyan-800/50 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-cyan-200">
              <Usb className="w-4 h-4 text-cyan-400" />
              <span>
                Phát hiện thiết bị đã ghép nối:{' '}
                <strong className="text-white">
                  {pairedDevices[0].productName || 'AULA HID Device'}
                </strong>{' '}
                <span className="text-emerald-400 font-semibold">• Đã ghép nối</span>
              </span>
            </div>
            <button
              onClick={() => handleConnectPaired(pairedDevices[0])}
              className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition cursor-pointer"
            >
              Kết nối lại ngay
            </button>
          </div>
        </div>
      ) : !isConnected ? (
        <div className="bg-amber-950/30 border-b border-amber-800/40 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <Usb className="w-4 h-4 text-amber-400" />
              <span>
                {cloudSessionUid
                  ? 'Trên máy tính: bấm Kết nối thiết bị WebHID để làm cầu nối. Trên điện thoại: chỉnh trực tiếp để đồng bộ qua Firebase.'
                  : 'Chế độ phần cứng thật: cắm cáp USB-C / 2.4GHz trên máy tính để kết nối WebHID, hoặc đăng nhập Google để điều khiển đồng bộ từ điện thoại.'}
              </span>
            </div>
            <button
              onClick={() => handleConnectHID(false)}
              className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition cursor-pointer"
            >
              Kết nối ngay
            </button>
          </div>
        </div>
      ) : null}

      {/* WebHID Connection Assistant Modal */}
      {connectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
                  {connectModal.errorType === 'permissions_policy' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Usb className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    Kết nối thiết bị WebHID (AULA)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Hỗ trợ Chrome / Edge / Brave / Opera trên máy tính
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConnectModal({ open: false })}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {connectModal.message && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                {connectModal.message}
              </div>
            )}

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 flex flex-col gap-1.5">
              <div className="font-bold text-cyan-300">Lưu ý để dùng đầy đủ AULA S75 Pro / F108 Pro (gồm cả nạp GIF màn hình TFT):</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>Cắm bàn phím qua cáp USB-C (nếu muốn nạp ảnh/GIF màn hình TFT 135×240 / 240×135) hoặc đầu thu 2.4GHz (LED, Keymap, Macro, Time Sync).</li>
                <li>Trên Windows/macOS, Chrome có thể hiện nhiều dòng <strong className="text-slate-200">AULA</strong>: hãy cấp quyền cho tất cả các cổng cấu hình & màn hình (nếu thiếu cổng Screen, bấm nút <strong className="text-amber-300">Cấp quyền cổng Screen</strong> trong tab Màn hình TFT).</li>
                <li>Tắt hẳn phần mềm AULA Driver gốc dưới khay hệ thống (nếu đang chạy nền) để không bị chiếm cổng HID.</li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              {connectModal.errorType === 'permissions_policy' && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở trong Tab mới để kết nối WebHID</span>
                </a>
              )}

              {connectModal.errorType !== 'permissions_policy' &&
                connectModal.errorType !== 'unsupported' && (
                  <button
                    onClick={() => handleConnectHID(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Quét tất cả thiết bị HID (Không lọc VID)</span>
                  </button>
                )}

              <button
                onClick={() => setConnectModal({ open: false })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area: Left Workspace + Right Vertical Sidebar */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Main Workspace */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          {/* Device Visualizer Stage */}
          <section className="relative rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/75 via-slate-950/90 to-slate-950 p-4 sm:p-6 md:p-7 shadow-2xl flex flex-col items-center gap-4 overflow-hidden">
            <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 border-b border-slate-800/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100">{selectedDevice.name}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedDevice.layoutName}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedDevice.series}</span>
              </div>
              <div className="font-mono tabular-nums text-[11px] text-slate-400">
                {selectedDevice.type === 'keyboard'
                  ? `${t(`layer${activeLayer}`)} · Profile P${activeProfile}`
                  : `Profile P${activeProfile}`}
              </div>
            </div>

            {selectedDevice.type === 'keyboard' ? (
              <KeyboardVisualizer
                device={selectedDevice}
                lighting={lighting}
                screenConfig={screenConfig}
                activeLayer={activeLayer}
                keymaps={keymaps}
                selectedKeyId={selectedKey?.id || null}
                onSelectKey={(k) => setSelectedKey(k)}
                isCustomMatrixActive={isCustomMatrixActive}
                brushColor={brushColor}
                onPaintKey={handlePaintKey}
                externalActiveKeys={activeKeys}
              />
            ) : (
              <MouseVisualizer
                config={mouseConfig}
                lighting={lighting}
                selectedButtonId={selectedMouseButton}
                onSelectButton={(btnId) => setSelectedMouseButton(btnId)}
              />
            )}
          </section>

          {/* Tab Content Panes */}
          <div className="pb-12">
            {activeTab === 'keymap' && selectedDevice.type === 'keyboard' && (
              <KeymapTab
                selectedKey={selectedKey}
                deviceKeys={selectedDevice.keys || []}
                layerKeymaps={keymaps[activeLayer] || {}}
                onSelectKey={(k) => setSelectedKey(k)}
                activeLayer={activeLayer}
                onSelectLayer={setActiveLayer}
                currentAction={selectedKey ? keymaps[activeLayer]?.[selectedKey.id] || null : null}
                macros={macros}
                onRemap={handleRemapKey}
                lang={lang}
                t={t}
              />
            )}

            {activeTab === 'lighting' && (
              <LightingTab
                lighting={lighting}
                deviceKeys={selectedDevice.keys}
                onChangeLighting={setLighting}
                onApplyLighting={handleApplyLighting}
                isCustomMatrixActive={isCustomMatrixActive}
                onToggleCustomMatrix={setIsCustomMatrixActive}
                brushColor={brushColor}
                onChangeBrushColor={setBrushColor}
                onPaintGroup={handlePaintGroup}
                onClearCustomMatrix={handleClearCustomMatrix}
                lang={lang}
                t={t}
              />
            )}

            {activeTab === 'macro' && (
              <MacroTab
                macros={macros}
                onUpdateMacros={setMacros}
                onApplyMacros={handleApplyMacrosAction}
                onNotify={showToast}
                lang={lang}
                t={t}
              />
            )}

            {activeTab === 'screen' && selectedDevice.hasScreen && (
              <ScreenTab
                config={screenConfig}
                deviceName={selectedDevice.name}
                screenResolution={selectedDevice.screenResolution}
                deviceInfo={deviceInfo}
                isConnected={isConnected}
                onRequestHIDConnect={() => handleConnectHID(false)}
                onSyncTime={handleSyncTimeAction}
                onChangeConfig={setScreenConfig}
                onNotify={showToast}
                lang={lang}
                t={t}
              />
            )}

            {activeTab === 'mouse' && selectedDevice.type === 'mouse' && (
              <MouseTab
                config={mouseConfig}
                onChangeConfig={setMouseConfig}
                onApplyMouse={handleApplyMouseAction}
                onNotify={showToast}
                lang={lang}
                t={t}
              />
            )}

            {activeTab === 'tester' && (
              <KeyTesterTab
                activeKeys={activeKeys}
                testedKeys={testedKeys}
                onResetTester={() => setTestedKeys(new Set())}
                lang={lang}
                t={t}
              />
            )}

            {activeTab === 'system' && selectedDevice.type === 'keyboard' && (
              <SystemTab
                settings={systemSettings}
                onChangeSettings={setSystemSettings}
                onApplySettings={handleApplySystemAction}
                onHardwareReset={handleHardwareResetAction}
                onFactoryResetLocal={handleFactoryReset}
                onNotify={showToast}
                lang={lang}
              />
            )}

            {activeTab === 'packets' && (
              <PacketLogTab
                packets={packets}
                deviceInfo={deviceInfo}
                isConnected={isConnected}
                onClearLog={() => webhidService.clearPackets()}
                lang={lang}
                t={t}
              />
            )}
          </div>
        </div>

        {/* Right Vertical Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-20 flex flex-col gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2 shadow-xl">
            <div className="px-2 pt-1 pb-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-800/80">
              {lang === 'vi' ? 'Bảng điều khiển' : 'Workspace'}
            </div>

            <nav className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col gap-1">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer text-left ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 border border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Hardware & Layer Summary inside Sidebar (Desktop) */}
          {selectedDevice.type === 'keyboard' && (
            <div className="hidden lg:flex flex-col gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">
                  {lang === 'vi' ? 'Layer nhanh' : 'Quick Layer'}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-amber-300">
                  {Object.keys(keymaps[activeLayer] || {}).length} {lang === 'vi' ? 'phím gán' : 'mapped'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[0, 1, 2, 3].map((l) => (
                  <button
                    key={l}
                    onClick={() => setActiveLayer(l)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap truncate ${
                      activeLayer === l
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {t(`layer${l}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Firebase Cloud Sync Sidebar Card */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-3 text-xs shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                {cloudSyncStatus === 'syncing' ? (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                ) : cloudSyncStatus === 'error' ? (
                  <CloudOff className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Cloud
                    className={`w-4 h-4 shrink-0 ${
                      firebaseUser ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                )}
                <span>Firebase Cloud</span>
              </div>
              {firebaseUser && lastCloudSavedAt && (
                <span className="font-mono tabular-nums text-[10px] text-slate-400">
                  {new Date(lastCloudSavedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              )}
            </div>

            {firebaseUser ? (
              <>
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2.5">
                  {firebaseUser.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt={firebaseUser.displayName || 'User'}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center shrink-0">
                      {(firebaseUser.displayName || firebaseUser.email || 'U')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-100 truncate">
                      {firebaseUser.displayName || 'Google User'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {firebaseUser.email || ''}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2 text-[11px]">
                  {isConnected ? (
                    <>
                      <Monitor className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300 font-semibold leading-snug">
                        {lang === 'vi'
                          ? 'Máy tính đang làm cầu nối WebHID cho điện thoại'
                          : 'PC WebHID bridge active for mobile control'}
                      </span>
                    </>
                  ) : isRemoteBridgeOnline ? (
                    <>
                      <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-cyan-300 font-semibold leading-snug">
                        {lang === 'vi'
                          ? `Đang điều khiển máy tính: ${remoteBridge?.productName}`
                          : `Controlling PC: ${remoteBridge?.productName}`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-400 leading-snug">
                        {lang === 'vi'
                          ? 'Đang chờ máy tính mở web & cắm WebHID'
                          : 'Waiting for PC WebHID host'}
                      </span>
                    </>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'vi'
                    ? `Tự động đồng bộ Keymap, LED, Macro và Profile P${activeProfile} của ${selectedDevice.name}.`
                    : `Auto-syncing Keymap, RGB, Macros & Profile P${activeProfile} for ${selectedDevice.name}.`}
                </p>

                <button
                  onClick={handleManualCloudSync}
                  disabled={cloudSyncStatus === 'syncing'}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-semibold transition cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      cloudSyncStatus === 'syncing' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {lang === 'vi' ? 'Lưu ngay lên Cloud' : 'Sync to Cloud Now'}
                  </span>
                </button>
              </>
            ) : (
              <>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'vi'
                    ? 'Đăng nhập Google để lưu và đồng bộ Keymap, LED, Macro, Profile P1-P3 giữa các máy.'
                    : 'Sign in with Google to backup and sync Keymap, RGB, Macros and Profiles across devices.'}
                </p>
                <button
                  onClick={handleSignInGoogle}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600/80 hover:border-cyan-500/60 font-semibold transition cursor-pointer disabled:opacity-60"
                >
                  {authLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>
                    {lang === 'vi' ? 'Đăng nhập Google' : 'Sign in with Google'}
                  </span>
                </button>
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
