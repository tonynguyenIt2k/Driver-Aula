import {
  User,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import {
  KeyRemapAction,
  Language,
  LightingConfig,
  Macro,
  MouseConfig,
  ScreenAnimation,
  ScreenConfig,
  ScreenFrame,
  SystemSettings,
} from '../types/device';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface CloudUserPreferences {
  selectedDeviceId?: string;
  activeProfile?: number;
  lang?: Language;
}

export interface CloudScreenSettings {
  brightness: number;
  fps: number;
  orientation: 0 | 90 | 180 | 270;
  showTimeOverlay: boolean;
  showBatteryOverlay: boolean;
  showTempOverlay: boolean;
  activeAnimationId?: string;
}

export interface CloudDeviceProfile {
  keymaps: Record<number, Record<string, KeyRemapAction>>;
  lighting: LightingConfig;
  systemSettings?: SystemSettings;
  mouseConfig?: MouseConfig;
  screenSettings?: CloudScreenSettings;
}

function sanitizeId(raw: string, maxLen = 128): string {
  const cleaned = (raw || 'item').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, maxLen);
  return cleaned || 'item';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

export function getProfileDocKey(deviceId: string, profileSlot: number): string {
  const slot = Math.max(1, Math.min(3, Math.round(profileSlot || 1)));
  return sanitizeId(`${deviceId}_p${slot}`, 128);
}

function normalizeKeymapsForCloud(
  keymaps: Record<number, Record<string, KeyRemapAction>>
): Record<string, Record<string, KeyRemapAction>> {
  return {
    '0': stripUndefined(keymaps?.[0] || {}),
    '1': stripUndefined(keymaps?.[1] || {}),
    '2': stripUndefined(keymaps?.[2] || {}),
    '3': stripUndefined(keymaps?.[3] || {}),
  };
}

function normalizeKeymapsFromCloud(
  raw: Record<string, Record<string, KeyRemapAction>> | undefined
): Record<number, Record<string, KeyRemapAction>> {
  return {
    0: raw?.['0'] && typeof raw['0'] === 'object' ? raw['0'] : {},
    1: raw?.['1'] && typeof raw['1'] === 'object' ? raw['1'] : {},
    2: raw?.['2'] && typeof raw['2'] === 'object' ? raw['2'] : {},
    3: raw?.['3'] && typeof raw['3'] === 'object' ? raw['3'] : {},
  };
}

export function extractCloudScreenSettings(screen: ScreenConfig): CloudScreenSettings {
  const out: CloudScreenSettings = {
    brightness: Number(screen.brightness) || 90,
    fps: Number(screen.fps) || 25,
    orientation: screen.orientation ?? 0,
    showTimeOverlay: Boolean(screen.showTimeOverlay),
    showBatteryOverlay: Boolean(screen.showBatteryOverlay),
    showTempOverlay: Boolean(screen.showTempOverlay),
  };
  if (screen.activeAnimationId && screen.activeAnimationId.trim()) {
    out.activeAnimationId = sanitizeId(screen.activeAnimationId, 128);
  }
  return out;
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserDocuments(
  user: User,
  fallbackPrefs: CloudUserPreferences
): Promise<CloudUserPreferences> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName =
    (user.displayName || user.email?.split('@')[0] || 'AULA User').trim().slice(0, 120) ||
    'AULA User';
  const photoUrl =
    user.photoURL && user.photoURL.trim().length > 0
      ? user.photoURL.trim().slice(0, 512)
      : undefined;
  const safeActiveProfile =
    typeof fallbackPrefs.activeProfile === 'number' &&
    Number.isFinite(fallbackPrefs.activeProfile)
      ? Math.max(1, Math.min(3, Math.round(fallbackPrefs.activeProfile)))
      : 1;
  const safeLang: Language = fallbackPrefs.lang === 'en' ? 'en' : 'vi';

  let savedPrefs: CloudUserPreferences = { ...fallbackPrefs };

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const optionalCreateFields = stripUndefined({
        photoUrl,
        selectedDeviceId: fallbackPrefs.selectedDeviceId
          ? sanitizeId(fallbackPrefs.selectedDeviceId, 64)
          : undefined,
      });
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        ...optionalCreateFields,
        activeProfile: safeActiveProfile,
        lang: safeLang,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const data = snap.data();
      savedPrefs = {
        selectedDeviceId:
          typeof data.selectedDeviceId === 'string'
            ? data.selectedDeviceId
            : fallbackPrefs.selectedDeviceId,
        activeProfile:
          typeof data.activeProfile === 'number'
            ? data.activeProfile
            : fallbackPrefs.activeProfile,
        lang: data.lang === 'en' || data.lang === 'vi' ? data.lang : fallbackPrefs.lang,
      };
      const updateFields = stripUndefined({
        displayName,
        photoUrl,
      });
      await updateDoc(userRef, {
        ...updateFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  if (user.email && user.email.length >= 3) {
    const privatePath = `users/${user.uid}/private/info`;
    const privateRef = doc(db, 'users', user.uid, 'private', 'info');
    try {
      const privSnap = await getDoc(privateRef);
      if (!privSnap.exists()) {
        await setDoc(privateRef, {
          uid: user.uid,
          email: user.email.slice(0, 254),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (privSnap.data()?.email !== user.email) {
        await updateDoc(privateRef, {
          email: user.email.slice(0, 254),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }

  return savedPrefs;
}

export async function updateUserPreferences(
  uid: string,
  prefs: CloudUserPreferences
): Promise<void> {
  const path = `users/${uid}`;
  const cleanActiveProfile =
    typeof prefs.activeProfile === 'number' && Number.isFinite(prefs.activeProfile)
      ? Math.max(1, Math.min(3, Math.round(prefs.activeProfile)))
      : undefined;
  const cleanLang =
    prefs.lang === 'en' || prefs.lang === 'vi' ? prefs.lang : undefined;
  try {
    const cleanPrefs = stripUndefined({
      selectedDeviceId: prefs.selectedDeviceId
        ? sanitizeId(prefs.selectedDeviceId, 64)
        : undefined,
      activeProfile: cleanActiveProfile,
      lang: cleanLang,
    });
    await updateDoc(doc(db, 'users', uid), {
      ...cleanPrefs,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function loadDeviceProfileFromCloud(
  uid: string,
  deviceId: string,
  profileSlot: number
): Promise<CloudDeviceProfile | null> {
  const profileKey = getProfileDocKey(deviceId, profileSlot);
  const path = `users/${uid}/profiles/${profileKey}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'profiles', profileKey));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      keymaps: normalizeKeymapsFromCloud(data.keymaps),
      lighting: data.lighting as LightingConfig,
      systemSettings: data.systemSettings as SystemSettings | undefined,
      mouseConfig: data.mouseConfig as MouseConfig | undefined,
      screenSettings: data.screenSettings as CloudScreenSettings | undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveDeviceProfileToCloud(
  uid: string,
  deviceId: string,
  profileSlot: number,
  payload: CloudDeviceProfile
): Promise<void> {
  const profileKey = getProfileDocKey(deviceId, profileSlot);
  const path = `users/${uid}/profiles/${profileKey}`;
  const ref = doc(db, 'users', uid, 'profiles', profileKey);

  const sanitizedFields = stripUndefined({
    keymaps: normalizeKeymapsForCloud(payload.keymaps),
    lighting: payload.lighting,
    systemSettings: payload.systemSettings,
    mouseConfig: payload.mouseConfig,
    screenSettings: payload.screenSettings,
  });

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        deviceId: sanitizeId(deviceId, 64),
        profileSlot: Math.max(1, Math.min(3, Math.round(profileSlot || 1))),
        ...sanitizedFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...sanitizedFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeDeviceProfile(
  uid: string,
  deviceId: string,
  profileSlot: number,
  onData: (profile: CloudDeviceProfile | null) => void
): Unsubscribe {
  const profileKey = getProfileDocKey(deviceId, profileSlot);
  const path = `users/${uid}/profiles/${profileKey}`;
  const ref = doc(db, 'users', uid, 'profiles', profileKey);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = snap.data();
      onData({
        keymaps: normalizeKeymapsFromCloud(data.keymaps),
        lighting: data.lighting as LightingConfig,
        systemSettings: data.systemSettings as SystemSettings | undefined,
        mouseConfig: data.mouseConfig as MouseConfig | undefined,
        screenSettings: data.screenSettings as CloudScreenSettings | undefined,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function loadUserMacrosFromCloud(uid: string): Promise<Macro[]> {
  const path = `users/${uid}/macros`;
  try {
    const q = query(collection(db, 'users', uid, 'macros'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    const items: Macro[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || 'Macro'),
        repeatMode:
          data.repeatMode === 'hold' || data.repeatMode === 'toggle' ? data.repeatMode : 'once',
        actions: Array.isArray(data.actions) ? data.actions : [],
        createdAt:
          typeof data.clientCreatedAt === 'number' ? data.clientCreatedAt : Date.now(),
      };
    });
    items.sort((a, b) => a.createdAt - b.createdAt);
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeUserMacros(
  uid: string,
  onData: (macros: Macro[]) => void
): Unsubscribe {
  const path = `users/${uid}/macros`;
  const q = query(collection(db, 'users', uid, 'macros'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: Macro[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name || 'Macro'),
          repeatMode:
            data.repeatMode === 'hold' || data.repeatMode === 'toggle' ? data.repeatMode : 'once',
          actions: Array.isArray(data.actions) ? data.actions : [],
          createdAt:
            typeof data.clientCreatedAt === 'number' ? data.clientCreatedAt : Date.now(),
        };
      });
      items.sort((a, b) => a.createdAt - b.createdAt);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function syncUserMacrosToCloud(uid: string, macros: Macro[]): Promise<void> {
  const path = `users/${uid}/macros`;
  try {
    const q = query(collection(db, 'users', uid, 'macros'), where('ownerId', '==', uid));
    const existingSnap = await getDocs(q);
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    const nextIds = new Set<string>();

    for (const macro of macros) {
      const safeId = sanitizeId(macro.id, 128);
      nextIds.add(safeId);
      const ref = doc(db, 'users', uid, 'macros', safeId);
      const cleanName = (macro.name || 'Macro').trim().slice(0, 100) || 'Macro';
      const cleanRepeat =
        macro.repeatMode === 'hold' || macro.repeatMode === 'toggle' ? macro.repeatMode : 'once';
      const cleanActions = stripUndefined((macro.actions || []).slice(0, 128));
      const clientCreatedAt =
        typeof macro.createdAt === 'number' ? macro.createdAt : Date.now();

      if (existingIds.has(safeId)) {
        await updateDoc(ref, {
          name: cleanName,
          repeatMode: cleanRepeat,
          actions: cleanActions,
          clientCreatedAt,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          ownerId: uid,
          macroId: safeId,
          name: cleanName,
          repeatMode: cleanRepeat,
          actions: cleanActions,
          clientCreatedAt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    for (const oldDoc of existingSnap.docs) {
      if (!nextIds.has(oldDoc.id)) {
        await deleteDoc(oldDoc.ref);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function subscribeUserPreferences(
  uid: string,
  onData: (prefs: CloudUserPreferences) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      onData({
        selectedDeviceId:
          typeof data.selectedDeviceId === 'string' ? data.selectedDeviceId : undefined,
        activeProfile:
          typeof data.activeProfile === 'number' ? data.activeProfile : undefined,
        lang: data.lang === 'en' || data.lang === 'vi' ? data.lang : undefined,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export interface CloudBridgeStatus {
  online: boolean;
  hidConnected: boolean;
  deviceId: string;
  productName: string;
  connectionType: 'wired' | 'wireless_2.4g' | 'bluetooth' | 'disconnected';
  batteryLevel?: number | null;
  clientHostId: string;
  updatedAtMs?: number;
}

export async function publishBridgeStatus(
  uid: string,
  status: CloudBridgeStatus
): Promise<void> {
  const path = `users/${uid}/bridge/status`;
  const ref = doc(db, 'users', uid, 'bridge', 'status');
  const safeDeviceId = sanitizeId(status.deviceId || 'aula-s75-pro', 64);
  const safeHostId = sanitizeId(status.clientHostId || 'host', 64);
  const safeProduct = (status.productName || 'AULA Device').trim().slice(0, 120) || 'AULA Device';
  const safeConn =
    status.connectionType === 'wired' ||
    status.connectionType === 'wireless_2.4g' ||
    status.connectionType === 'bluetooth'
      ? status.connectionType
      : 'disconnected';
  const hasBattery =
    typeof status.batteryLevel === 'number' &&
    Number.isFinite(status.batteryLevel) &&
    status.batteryLevel >= 0 &&
    status.batteryLevel <= 100;

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const optionalFields = stripUndefined({
        batteryLevel: hasBattery ? Math.round(status.batteryLevel!) : undefined,
      });
      await setDoc(ref, {
        ownerId: uid,
        online: Boolean(status.online),
        hidConnected: Boolean(status.hidConnected),
        deviceId: safeDeviceId,
        productName: safeProduct,
        connectionType: safeConn,
        ...optionalFields,
        clientHostId: safeHostId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        online: Boolean(status.online),
        hidConnected: Boolean(status.hidConnected),
        deviceId: safeDeviceId,
        productName: safeProduct,
        connectionType: safeConn,
        batteryLevel: hasBattery ? Math.round(status.batteryLevel!) : deleteField(),
        clientHostId: safeHostId,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeBridgeStatus(
  uid: string,
  onData: (status: CloudBridgeStatus | null) => void
): Unsubscribe {
  const path = `users/${uid}/bridge/status`;
  const ref = doc(db, 'users', uid, 'bridge', 'status');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = snap.data();
      const ts = data.updatedAt as Timestamp | undefined;
      onData({
        online: Boolean(data.online),
        hidConnected: Boolean(data.hidConnected),
        deviceId: typeof data.deviceId === 'string' ? data.deviceId : 'aula-s75-pro',
        productName: typeof data.productName === 'string' ? data.productName : 'AULA Device',
        connectionType:
          data.connectionType === 'wired' ||
          data.connectionType === 'wireless_2.4g' ||
          data.connectionType === 'bluetooth'
            ? data.connectionType
            : 'disconnected',
        batteryLevel: typeof data.batteryLevel === 'number' ? data.batteryLevel : null,
        clientHostId: typeof data.clientHostId === 'string' ? data.clientHostId : '',
        updatedAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : undefined,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export type RemoteCommandType =
  | 'apply_lighting'
  | 'apply_keymap'
  | 'apply_macros'
  | 'apply_system'
  | 'apply_mouse'
  | 'sync_time'
  | 'upload_screen'
  | 'reset_keys'
  | 'factory_reset';

export interface RemoteCommandRecord {
  commandId: string;
  senderId: string;
  type: RemoteCommandType;
  deviceId: string;
  profileSlot: number;
  layer?: number;
  animId?: string;
  status: 'pending' | 'completed' | 'failed';
  resultMessage?: string;
  createdAtMs?: number;
}

export async function dispatchRemoteCommand(
  uid: string,
  params: {
    senderId: string;
    type: RemoteCommandType;
    deviceId: string;
    profileSlot: number;
    layer?: number;
    animId?: string;
  }
): Promise<string> {
  const commandId = sanitizeId(`cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 128);
  const path = `users/${uid}/commands/${commandId}`;
  const ref = doc(db, 'users', uid, 'commands', commandId);
  const slot = Math.max(1, Math.min(3, Math.round(params.profileSlot || 1)));
  const cleanLayer =
    typeof params.layer === 'number'
      ? Math.max(0, Math.min(3, Math.round(params.layer)))
      : undefined;
  const cleanAnimId =
    params.animId && params.animId.trim() ? sanitizeId(params.animId, 128) : undefined;

  try {
    const optionalFields = stripUndefined({
      layer: cleanLayer,
      animId: cleanAnimId,
    });
    await setDoc(ref, {
      ownerId: uid,
      commandId,
      senderId: sanitizeId(params.senderId, 64),
      type: params.type,
      deviceId: sanitizeId(params.deviceId, 64),
      profileSlot: slot,
      ...optionalFields,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return commandId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeRemoteCommands(
  uid: string,
  onData: (commands: RemoteCommandRecord[]) => void
): Unsubscribe {
  const path = `users/${uid}/commands`;
  const q = query(collection(db, 'users', uid, 'commands'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: RemoteCommandRecord[] = snap.docs.map((d) => {
        const data = d.data();
        const ts = data.createdAt as Timestamp | undefined;
        return {
          commandId: d.id,
          senderId: typeof data.senderId === 'string' ? data.senderId : '',
          type: data.type as RemoteCommandType,
          deviceId: typeof data.deviceId === 'string' ? data.deviceId : 'aula-s75-pro',
          profileSlot: typeof data.profileSlot === 'number' ? data.profileSlot : 1,
          layer: typeof data.layer === 'number' ? data.layer : undefined,
          animId: typeof data.animId === 'string' ? data.animId : undefined,
          status:
            data.status === 'completed' || data.status === 'failed'
              ? data.status
              : 'pending',
          resultMessage:
            typeof data.resultMessage === 'string' ? data.resultMessage : undefined,
          createdAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now(),
        };
      });
      items.sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function completeRemoteCommand(
  uid: string,
  commandId: string,
  status: 'completed' | 'failed',
  resultMessage: string
): Promise<void> {
  const safeId = sanitizeId(commandId, 128);
  const path = `users/${uid}/commands/${safeId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'commands', safeId), {
      status,
      resultMessage: (resultMessage || status).slice(0, 300),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cleanupRemoteCommand(uid: string, commandId: string): Promise<void> {
  const safeId = sanitizeId(commandId, 128);
  const path = `users/${uid}/commands/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'commands', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function estimateFramesPayloadBytes(frames: ScreenFrame[]): number {
  return frames.reduce((sum, f) => sum + (f.dataUrl?.length || 0) + (f.id?.length || 0) + 32, 0);
}

async function reencodeDataUrl(
  dataUrl: string,
  width: number,
  height: number,
  quality: number
): Promise<string> {
  if (typeof document === 'undefined') return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  return canvas.toDataURL('image/jpeg', quality);
}

export async function compactFramesForCloud(
  frames: ScreenFrame[],
  width: number,
  height: number
): Promise<ScreenFrame[]> {
  const safeFrames: ScreenFrame[] = (frames || []).slice(0, 141).map((f, idx) => ({
    id: sanitizeId(f.id || `f-${idx}`, 96),
    dataUrl: f.dataUrl,
    delayMs: Math.max(20, Math.min(500, Math.round(f.delayMs || 40))),
  }));

  if (safeFrames.length === 0) return [];
  const MAX_CLOUD_BYTES = 720_000;
  if (estimateFramesPayloadBytes(safeFrames) <= MAX_CLOUD_BYTES) {
    return safeFrames;
  }

  let compressed = await Promise.all(
    safeFrames.map(async (f) => ({
      ...f,
      dataUrl: await reencodeDataUrl(f.dataUrl, width, height, 0.8),
    }))
  );
  if (estimateFramesPayloadBytes(compressed) <= MAX_CLOUD_BYTES) {
    return compressed;
  }

  compressed = await Promise.all(
    compressed.map(async (f) => ({
      ...f,
      dataUrl: await reencodeDataUrl(f.dataUrl, width, height, 0.6),
    }))
  );
  if (estimateFramesPayloadBytes(compressed) <= MAX_CLOUD_BYTES) {
    return compressed;
  }

  // Downsample frames evenly if GIF still exceeds Firestore 1MB safety threshold
  const avgBytes = Math.max(1024, Math.ceil(estimateFramesPayloadBytes(compressed) / compressed.length));
  const targetCount = Math.max(1, Math.min(compressed.length, Math.floor(MAX_CLOUD_BYTES / avgBytes)));
  const step = compressed.length / targetCount;
  const sampled: ScreenFrame[] = [];
  for (let i = 0; i < targetCount; i++) {
    const srcIdx = Math.min(compressed.length - 1, Math.floor(i * step));
    const item = compressed[srcIdx];
    sampled.push({
      ...item,
      delayMs: Math.max(20, Math.min(500, Math.round(item.delayMs * step))),
    });
  }
  return sampled;
}

function mapCloudAnimationDoc(id: string, data: Record<string, any>): ScreenAnimation | null {
  const rawFrames = Array.isArray(data.frames) ? data.frames : [];
  const frames: ScreenFrame[] = rawFrames
    .filter((f: any) => f && typeof f.dataUrl === 'string')
    .map((f: any, idx: number) => ({
      id: typeof f.id === 'string' ? f.id : `f-${idx}`,
      dataUrl: f.dataUrl,
      delayMs: typeof f.delayMs === 'number' ? f.delayMs : 40,
    }));
  if (frames.length === 0) return null;
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Custom',
    width: typeof data.width === 'number' ? data.width : undefined,
    height: typeof data.height === 'number' ? data.height : undefined,
    frames,
    createdAt: typeof data.clientCreatedAt === 'number' ? data.clientCreatedAt : Date.now(),
  };
}

export async function saveScreenAnimationToCloud(
  uid: string,
  anim: ScreenAnimation,
  width: number,
  height: number
): Promise<ScreenAnimation> {
  const safeId = sanitizeId(anim.id, 128);
  const safeName = (anim.name || 'Custom').trim().slice(0, 100) || 'Custom';
  const safeW = Math.max(32, Math.min(640, Math.round(anim.width || width || 135)));
  const safeH = Math.max(32, Math.min(640, Math.round(anim.height || height || 240)));
  const compactedFrames = await compactFramesForCloud(anim.frames, safeW, safeH);
  const clientCreatedAt =
    typeof anim.createdAt === 'number' ? anim.createdAt : Date.now();

  const path = `users/${uid}/screenAnimations/${safeId}`;
  const ref = doc(db, 'users', uid, 'screenAnimations', safeId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        animId: safeId,
        name: safeName,
        width: safeW,
        height: safeH,
        frames: compactedFrames,
        clientCreatedAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: safeName,
        width: safeW,
        height: safeH,
        frames: compactedFrames,
        clientCreatedAt,
        updatedAt: serverTimestamp(),
      });
    }
    return {
      id: safeId,
      name: safeName,
      width: safeW,
      height: safeH,
      frames: compactedFrames,
      createdAt: clientCreatedAt,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteScreenAnimationFromCloud(
  uid: string,
  animId: string
): Promise<void> {
  const safeId = sanitizeId(animId, 128);
  const path = `users/${uid}/screenAnimations/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'screenAnimations', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadUserScreenAnimationsFromCloud(
  uid: string
): Promise<ScreenAnimation[]> {
  const path = `users/${uid}/screenAnimations`;
  try {
    const q = query(
      collection(db, 'users', uid, 'screenAnimations'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    const items: ScreenAnimation[] = [];
    for (const d of snap.docs) {
      const mapped = mapCloudAnimationDoc(d.id, d.data());
      if (mapped) items.push(mapped);
    }
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeUserScreenAnimations(
  uid: string,
  onData: (anims: ScreenAnimation[]) => void
): Unsubscribe {
  const path = `users/${uid}/screenAnimations`;
  const q = query(
    collection(db, 'users', uid, 'screenAnimations'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: ScreenAnimation[] = [];
      for (const d of snap.docs) {
        const mapped = mapCloudAnimationDoc(d.id, d.data());
        if (mapped) items.push(mapped);
      }
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

