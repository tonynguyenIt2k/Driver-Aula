import {
  User,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
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
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import {
  KeyRemapAction,
  Language,
  LightingConfig,
  Macro,
  MouseConfig,
  ScreenConfig,
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

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
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
  return {
    brightness: Number(screen.brightness) || 90,
    fps: Number(screen.fps) || 25,
    orientation: screen.orientation ?? 0,
    showTimeOverlay: Boolean(screen.showTimeOverlay),
    showBatteryOverlay: Boolean(screen.showBatteryOverlay),
    showTempOverlay: Boolean(screen.showTempOverlay),
  };
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
  const displayName = (user.displayName || user.email?.split('@')[0] || 'AULA User').slice(0, 120);
  const photoUrl = user.photoURL ? user.photoURL.slice(0, 512) : undefined;

  let savedPrefs: CloudUserPreferences = { ...fallbackPrefs };

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const createPayload = stripUndefined({
        uid: user.uid,
        displayName,
        photoUrl,
        selectedDeviceId: fallbackPrefs.selectedDeviceId
          ? sanitizeId(fallbackPrefs.selectedDeviceId, 64)
          : undefined,
        activeProfile: fallbackPrefs.activeProfile ?? 1,
        lang: fallbackPrefs.lang ?? 'vi',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(userRef, createPayload);
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
      await updateDoc(
        userRef,
        stripUndefined({
          displayName,
          photoUrl,
          updatedAt: serverTimestamp(),
        })
      );
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
  try {
    await updateDoc(
      doc(db, 'users', uid),
      stripUndefined({
        selectedDeviceId: prefs.selectedDeviceId
          ? sanitizeId(prefs.selectedDeviceId, 64)
          : undefined,
        activeProfile: prefs.activeProfile,
        lang: prefs.lang,
        updatedAt: serverTimestamp(),
      })
    );
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
