import assetManifestJson from '../data/assetManifest.json';

export interface ManifestEntry {
  badge?: string;
  trophy?: string;
  image?: string;
  isCutout?: boolean;
  source?: string;
}

const manifest = assetManifestJson as Record<string, ManifestEntry>;

const MEMORY_CACHE = new Map<string, string>();

function withBaseUrl(pathStr: string | undefined): string | null {
  if (!pathStr) return null;
  if (/^https?:\/\//i.test(pathStr)) return pathStr;
  const base = (import.meta.env.BASE_URL || './').replace(/\/+$/, '');
  const clean = pathStr.replace(/^\/+/, '');
  return base === '.' || base === '' ? `./${clean}` : `${base}/${clean}`;
}

export function resolveLocalAsset(
  assetId: string | undefined,
  prefer: 'badge' | 'trophy' | 'image' = 'badge'
): { src: string | null; isCutout: boolean; source: string | null } {
  if (!assetId) return { src: null, isCutout: false, source: null };
  const entry = manifest[assetId];
  if (!entry) return { src: null, isCutout: false, source: null };

  if (prefer === 'trophy') {
    const src = withBaseUrl(entry.trophy || entry.badge || entry.image);
    return { src, isCutout: true, source: entry.source ?? null };
  }
  if (prefer === 'image') {
    const src = withBaseUrl(entry.image || entry.badge || entry.trophy);
    return { src, isCutout: Boolean(entry.isCutout), source: entry.source ?? null };
  }
  const src = withBaseUrl(entry.badge || entry.image || entry.trophy);
  return { src, isCutout: Boolean(entry.isCutout || entry.badge), source: entry.source ?? null };
}

export function getManifestStats(): {
  totalAssets: number;
  withImages: number;
  theSportsDbCount: number;
  wikipediaCount: number;
} {
  const entries = Object.values(manifest);
  return {
    totalAssets: entries.length,
    withImages: entries.filter((e) => e.badge || e.image || e.trophy).length,
    theSportsDbCount: entries.filter((e) => e.source === 'thesportsdb').length,
    wikipediaCount: entries.filter((e) => e.source === 'wikipedia').length,
  };
}

/**
 * Live lookup helper against free public APIs (Wikipedia REST API & TheSportsDB free key 123)
 * Used in the Football Field Guide / Inspector and as dynamic fallback.
 */
export async function fetchLiveWikiSummary(title: string): Promise<{
  title: string;
  extract: string;
  thumbnail?: string;
  url?: string;
} | null> {
  const cacheKey = `wiki:${title}`;
  if (MEMORY_CACHE.has(cacheKey)) {
    try {
      return JSON.parse(MEMORY_CACHE.get(cacheKey)!);
    } catch {
      // ignore cache parse errors
    }
  }

  try {
    const encoded = encodeURIComponent(title.replace(/\s+/g, '_'));
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = {
      title: data.title as string,
      extract: (data.extract as string) || '',
      thumbnail: data.thumbnail?.source as string | undefined,
      url: data.content_urls?.desktop?.page as string | undefined,
    };
    MEMORY_CACHE.set(cacheKey, JSON.stringify(result));
    return result;
  } catch {
    return null;
  }
}

export async function searchLiveSportsDbTeam(teamName: string): Promise<{
  name: string;
  league?: string;
  stadium?: string;
  formedYear?: string;
  badge?: string;
  description?: string;
} | null> {
  const cacheKey = `sdb:${teamName.toLowerCase()}`;
  if (MEMORY_CACHE.has(cacheKey)) {
    try {
      return JSON.parse(MEMORY_CACHE.get(cacheKey)!);
    } catch {
      // ignore
    }
  }

  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(teamName)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const team = data?.teams?.find((t: { strSport?: string }) => t.strSport === 'Soccer') || data?.teams?.[0];
    if (!team) return null;
    const result = {
      name: team.strTeam as string,
      league: team.strLeague as string | undefined,
      stadium: team.strStadium as string | undefined,
      formedYear: team.intFormedYear as string | undefined,
      badge: team.strBadge as string | undefined,
      description: team.strDescriptionEN as string | undefined,
    };
    MEMORY_CACHE.set(cacheKey, JSON.stringify(result));
    return result;
  } catch {
    return null;
  }
}
