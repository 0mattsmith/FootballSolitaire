import { Capacitor, registerPlugin } from '@capacitor/core';
import { APP_INFO } from '../data/appVersion';

export interface InstalledVersionInfo {
  versionName: string;
  versionCode: number;
  justUpdated: boolean;
  updateNotes: string;
  downloadedReady: boolean;
  downloadedVersion?: string;
  downloadedNotes?: string;
  isAndroidNative: boolean;
}

export interface RemoteReleaseInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  versionCodeGuess: number;
  releaseNotes: string;
  apkUrl: string | null;
  releaseUrl: string;
  publishedAt?: string;
}

export interface DownloadProgressEvent {
  progress: number;
  bytesDownloaded?: number;
  totalBytes?: number;
  status: 'downloading' | 'ready' | 'error';
  error?: string;
}

export interface InstallProgressEvent {
  progress: number;
  stage: 'preparing' | 'writing' | 'committing' | 'installing' | 'complete';
}

interface AppUpdaterPluginNative {
  getInstalledVersion(): Promise<{
    versionName: string;
    versionCode: number;
    justUpdated: boolean;
    updateNotes: string;
    downloadedReady: boolean;
    downloadedVersion?: string;
    downloadedNotes?: string;
  }>;
  checkInstallPermission(): Promise<{ canInstall: boolean }>;
  requestInstallPermission(): Promise<void>;
  downloadUpdate(options: {
    url: string;
    version: string;
    versionCode: number;
    notes: string;
  }): Promise<{ filePath: string; version: string }>;
  installUpdate(): Promise<{ started?: boolean; needsPermission?: boolean }>;
  addListener(
    eventName: 'downloadProgress',
    cb: (data: DownloadProgressEvent) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'installProgress',
    cb: (data: InstallProgressEvent) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'installError',
    cb: (data: { status?: number; message: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const NativeUpdater = registerPlugin<AppUpdaterPluginNative>('AppUpdater');

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function compareSemver(a: string, b: string): number {
  const cleanA = a.replace(/^v/i, '').split('-')[0].split('.').map(Number);
  const cleanB = b.replace(/^v/i, '').split('-')[0].split('.').map(Number);
  const len = Math.max(cleanA.length, cleanB.length);
  for (let i = 0; i < len; i++) {
    const x = cleanA[i] || 0;
    const y = cleanB[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function versionToCodeGuess(v: string): number {
  const parts = v.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const [maj = 1, min = 0, pat = 0] = parts;
  return maj * 10000 + min * 100 + pat;
}

const WEB_SEEN_VERSION_KEY = 'football_solitaire_web_seen_version';

export async function getInstalledAppInfo(): Promise<InstalledVersionInfo> {
  if (isAndroidNative()) {
    const info = await NativeUpdater.getInstalledVersion();
    return {
      ...info,
      isAndroidNative: true,
    };
  }

  // Web platform check
  let justUpdated = false;
  try {
    const prev = localStorage.getItem(WEB_SEEN_VERSION_KEY);
    if (!prev) {
      localStorage.setItem(WEB_SEEN_VERSION_KEY, APP_INFO.version);
    } else if (compareSemver(APP_INFO.version, prev) > 0) {
      justUpdated = true;
      localStorage.setItem(WEB_SEEN_VERSION_KEY, APP_INFO.version);
    }
  } catch {
    // ignore storage errors
  }

  return {
    versionName: APP_INFO.version,
    versionCode: APP_INFO.versionCode,
    justUpdated,
    updateNotes: APP_INFO.releaseNotes,
    downloadedReady: false,
    isAndroidNative: false,
  };
}

export async function checkForAppUpdate(currentVersion: string): Promise<RemoteReleaseInfo> {
  const repoUrl = `https://api.github.com/repos/${APP_INFO.githubOwner}/${APP_INFO.githubRepo}/releases/latest`;
  const webVersionUrl = `https://${APP_INFO.githubOwner.toLowerCase()}.github.io/${APP_INFO.githubRepo}/version.json?t=${Date.now()}`;

  try {
    const res = await fetch(repoUrl, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      const rawTag = String(data.tag_name || data.name || currentVersion).replace(/^v/i, '');
      const apkAsset = Array.isArray(data.assets)
        ? data.assets.find((a: { name?: string }) =>
            String(a.name || '').toLowerCase().endsWith('.apk')
          )
        : null;

      return {
        hasUpdate: compareSemver(rawTag, currentVersion) > 0,
        currentVersion,
        latestVersion: rawTag,
        versionCodeGuess: versionToCodeGuess(rawTag),
        releaseNotes: String(data.body || 'Bug fixes and improvements.').trim(),
        apkUrl: apkAsset?.browser_download_url ?? null,
        releaseUrl:
          data.html_url ||
          `https://github.com/${APP_INFO.githubOwner}/${APP_INFO.githubRepo}/releases`,
        publishedAt: data.published_at,
      };
    }
  } catch {
    // Fall through to version.json check
  }

  // Fallback to GitHub Pages version.json
  try {
    const res = await fetch(webVersionUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const rawVer = String(data.version || currentVersion).replace(/^v/i, '');
      return {
        hasUpdate: compareSemver(rawVer, currentVersion) > 0,
        currentVersion,
        latestVersion: rawVer,
        versionCodeGuess: Number(data.versionCode || versionToCodeGuess(rawVer)),
        releaseNotes: String(data.releaseNotes || 'Latest web & game updates.'),
        apkUrl: null,
        releaseUrl: `https://github.com/${APP_INFO.githubOwner}/${APP_INFO.githubRepo}/releases`,
        publishedAt: data.publishedAt,
      };
    }
  } catch {
    // Offline or no remote release yet
  }

  return {
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    versionCodeGuess: APP_INFO.versionCode,
    releaseNotes: APP_INFO.releaseNotes,
    apkUrl: null,
    releaseUrl: `https://github.com/${APP_INFO.githubOwner}/${APP_INFO.githubRepo}/releases`,
  };
}

export async function downloadAndroidApk(
  release: RemoteReleaseInfo,
  onProgress: (ev: DownloadProgressEvent) => void
): Promise<{ filePath: string; version: string }> {
  if (!isAndroidNative()) {
    throw new Error('In-app APK download is only available on the Android app.');
  }
  if (!release.apkUrl) {
    throw new Error('No APK attachment found on this release.');
  }

  const handle = await NativeUpdater.addListener('downloadProgress', onProgress);
  try {
    return await NativeUpdater.downloadUpdate({
      url: release.apkUrl,
      version: release.latestVersion,
      versionCode: release.versionCodeGuess,
      notes: release.releaseNotes,
    });
  } finally {
    await handle.remove();
  }
}

export async function installAndroidApk(
  onProgress: (ev: InstallProgressEvent) => void,
  onError: (msg: string) => void
): Promise<{ started?: boolean; needsPermission?: boolean }> {
  if (!isAndroidNative()) {
    throw new Error('APK installer is only available on Android.');
  }

  const perm = await NativeUpdater.checkInstallPermission();
  if (!perm.canInstall) {
    await NativeUpdater.requestInstallPermission();
    return { needsPermission: true };
  }

  const progHandle = await NativeUpdater.addListener('installProgress', onProgress);
  const errHandle = await NativeUpdater.addListener('installError', (e) => {
    onError(e.message || 'Install failed');
  });

  try {
    return await NativeUpdater.installUpdate();
  } catch (err) {
    await progHandle.remove();
    await errHandle.remove();
    throw err;
  }
}
