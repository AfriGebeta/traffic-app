import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { APK_MANIFEST_URL, IS_APK_BUILD } from '../config/distribution';

const MANIFEST_CACHE_KEY = '@traffic_app_apk_manifest';
const DISMISSED_KEY = '@traffic_app_apk_update_dismissed_code';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const APK_PREFIX = 'gebeta-update-';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export interface ApkManifest {
    version: string;
    versionCode: number;
    /** Installs below this build number cannot dismiss the update. */
    minVersionCode?: number;
    url: string;
    md5?: string;
    size?: number;
}

export type ApkUpdateStatus = 'idle' | 'available' | 'downloading' | 'ready' | 'error';

interface CachedManifest {
    fetchedAt: number;
    manifest: ApkManifest;
}

const installedVersionCode = () => parseInt(Application.nativeBuildVersion ?? '', 10);

function parseManifest(raw: unknown): ApkManifest | null {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as Record<string, unknown>;
    const versionCode = Number(m.versionCode);
    if (!Number.isInteger(versionCode) || typeof m.url !== 'string' || !/^https:\/\//.test(m.url)) {
        return null;
    }
    const minVersionCode = Number(m.minVersionCode);
    const size = Number(m.size);
    return {
        version: typeof m.version === 'string' ? m.version : '',
        versionCode,
        minVersionCode: Number.isInteger(minVersionCode) ? minVersionCode : undefined,
        url: m.url,
        md5: typeof m.md5 === 'string' ? m.md5.toLowerCase() : undefined,
        size: Number.isFinite(size) && size > 0 ? size : undefined,
    };
}

async function loadManifest(): Promise<ApkManifest | null> {
    let cached: CachedManifest | null = null;
    try {
        const stored = await AsyncStorage.getItem(MANIFEST_CACHE_KEY);
        if (stored) cached = JSON.parse(stored) as CachedManifest;
    } catch {
        cached = null;
    }
    if (cached && Date.now() - cached.fetchedAt < CHECK_INTERVAL_MS) {
        return parseManifest(cached.manifest);
    }
    try {
        const res = await fetch(APK_MANIFEST_URL, { headers: { 'cache-control': 'no-cache' } });
        if (!res.ok) throw new Error(`manifest http ${res.status}`);
        const manifest = parseManifest(await res.json());
        if (!manifest) throw new Error('manifest malformed');
        await AsyncStorage.setItem(
            MANIFEST_CACHE_KEY,
            JSON.stringify({ fetchedAt: Date.now(), manifest } satisfies CachedManifest)
        ).catch(() => undefined);
        return manifest;
    } catch (e) {
        console.log('apkupdate: manifest check failed', e);
        // Offline or server down: fall back to the last manifest we saw.
        return cached ? parseManifest(cached.manifest) : null;
    }
}

const apkPath = (versionCode: number) =>
    `${FileSystem.cacheDirectory}${APK_PREFIX}${versionCode}.apk`;

async function isValidApk(path: string, manifest: ApkManifest): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(path, { md5: !!manifest.md5 });
    if (!info.exists) return false;
    if (manifest.size && info.size !== manifest.size) return false;
    if (manifest.md5 && info.md5?.toLowerCase() !== manifest.md5) return false;
    return true;
}

/** Drop downloaded APKs other than `keepVersionCode` so the cache doesn't grow. */
async function cleanOldApks(keepVersionCode?: number) {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return;
    try {
        const keep = keepVersionCode ? `${APK_PREFIX}${keepVersionCode}.apk` : '';
        const names = await FileSystem.readDirectoryAsync(dir);
        await Promise.all(
            names
                .filter((n) => n.startsWith(APK_PREFIX) && n !== keep)
                .map((n) => FileSystem.deleteAsync(`${dir}${n}`, { idempotent: true }))
        );
    } catch {
        // best effort
    }
}

export function useApkUpdate() {
    const [status, setStatus] = useState<ApkUpdateStatus>('idle');
    const [manifest, setManifest] = useState<ApkManifest | null>(null);
    const [progress, setProgress] = useState(0);
    const [forced, setForced] = useState(false);
    const busyRef = useRef(false);

    const check = useCallback(async () => {
        if (!IS_APK_BUILD || busyRef.current) return;
        const installed = installedVersionCode();
        if (!Number.isInteger(installed)) return;

        const latest = await loadManifest();
        if (busyRef.current) return;
        if (!latest || latest.versionCode <= installed) {
            setStatus('idle');
            setManifest(null);
            void cleanOldApks();
            return;
        }
        void cleanOldApks(latest.versionCode);

        const isForced = !!latest.minVersionCode && installed < latest.minVersionCode;
        if (!isForced) {
            const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
            if (dismissed === String(latest.versionCode)) {
                setStatus('idle');
                return;
            }
        }
        setManifest(latest);
        setForced(isForced);
        // Already downloaded on a previous run: skip straight to "Install".
        const downloaded = await isValidApk(apkPath(latest.versionCode), latest).catch(() => false);
        if (busyRef.current) return;
        setStatus(downloaded ? 'ready' : 'available');
    }, []);

    useEffect(() => {
        if (!IS_APK_BUILD) return;
        void check();
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') void check();
        });
        return () => sub.remove();
    }, [check]);

    const install = useCallback(async () => {
        if (!manifest) return;
        try {
            const contentUri = await FileSystem.getContentUriAsync(apkPath(manifest.versionCode));
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                data: contentUri,
                flags: FLAG_GRANT_READ_URI_PERMISSION,
                type: 'application/vnd.android.package-archive',
            });
        } catch (e) {
            console.log('apkupdate: install launch failed', e);
            setStatus('error');
        }
    }, [manifest]);

    const download = useCallback(async () => {
        if (!manifest || busyRef.current) return;
        busyRef.current = true;
        const path = apkPath(manifest.versionCode);
        setProgress(0);
        setStatus('downloading');
        try {
            if (!(await isValidApk(path, manifest))) {
                await FileSystem.deleteAsync(path, { idempotent: true });
                const task = FileSystem.createDownloadResumable(manifest.url, path, {}, (p) => {
                    const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : manifest.size;
                    if (total) setProgress(Math.min(1, p.totalBytesWritten / total));
                });
                const result = await task.downloadAsync();
                if (!result || result.status < 200 || result.status >= 300) {
                    throw new Error(`download http ${result?.status}`);
                }
                if (!(await isValidApk(path, manifest))) {
                    throw new Error('downloaded apk failed size/md5 check');
                }
            }
            setProgress(1);
            setStatus('ready');
            busyRef.current = false;
            await install();
        } catch (e) {
            console.log('apkupdate: download failed', e);
            await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
            setStatus('error');
        } finally {
            busyRef.current = false;
        }
    }, [manifest, install]);

    const dismiss = useCallback(() => {
        if (!manifest || forced) return;
        setStatus('idle');
        AsyncStorage.setItem(DISMISSED_KEY, String(manifest.versionCode)).catch(() => undefined);
    }, [manifest, forced]);

    return { status, manifest, progress, forced, download, install, dismiss };
}
