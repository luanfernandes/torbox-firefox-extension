export interface HosterCatalogEntry {
  id: number;
  name: string;
  type: string;
  domains: string[];
  status: boolean;
  nsfw: boolean;
  note?: string | null;
  daily_link_limit?: number;
  daily_link_used?: number;
  daily_bandwidth_limit?: number;
  daily_bandwidth_used?: number;
  per_link_size_limit?: number;
  regex?: string;
}

export interface CandidateLink {
  url: string;
  hosterId: number;
  hosterName: string;
  hostname: string;
}

interface MatcherDomain {
  domain: string;
  hosterId: number;
  hosterName: string;
}

const FRAGMENT_SENSITIVE_HOSTS = new Set(["mega.nz", "mega.io", "mega.co.nz"]);

export interface CatalogMatcher {
  domains: readonly MatcherDomain[];
}

function normalizeDomain(domain: string): string | null {
  try {
    const url = new URL(`https://${domain.trim().replace(/^\.+|\.+$/g, "")}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function regexMatchesDomains(entry: HosterCatalogEntry): boolean {
  if (!entry.regex) return true;
  const prefix = "^https?://(?:[^./]+\\.)*(";
  const suffix = ")(/|$)";
  if (!entry.regex.startsWith(prefix) || !entry.regex.endsWith(suffix)) return false;
  const body = entry.regex.slice(prefix.length, -suffix.length);
  if (!body) return false;
  const regexDomains = body.split("|").map((domain) => domain.replaceAll("\\.", ".").replaceAll("\\-", "-"));
  if (regexDomains.some((domain) => /[\\^$*+?()[\]{}]/.test(domain))) return false;
  const fromRegex = new Set(regexDomains.map(normalizeDomain).filter((domain): domain is string => Boolean(domain)));
  const fromDomains = new Set(entry.domains.map(normalizeDomain).filter((domain): domain is string => Boolean(domain)));
  return fromRegex.size === fromDomains.size && [...fromRegex].every((domain) => fromDomains.has(domain));
}

export function buildMatcher(
  entries: readonly HosterCatalogEntry[],
  options: { includeNsfw: boolean },
): CatalogMatcher {
  const seen = new Set<string>();
  const domains: MatcherDomain[] = [];

  for (const entry of entries) {
    if (entry.type !== "hoster" || !entry.status || (entry.nsfw && !options.includeNsfw) || !regexMatchesDomains(entry)) {
      continue;
    }

    for (const sourceDomain of entry.domains) {
      const domain = normalizeDomain(sourceDomain);
      const key = `${entry.id}:${domain ?? ""}`;
      if (!domain || seen.has(key)) {
        continue;
      }
      seen.add(key);
      domains.push({ domain, hosterId: entry.id, hosterName: entry.name });
    }
  }

  domains.sort((left, right) => right.domain.length - left.domain.length);
  return { domains };
}

export function normalizeSourceUrl(source: string): URL | null {
  try {
    const url = new URL(source);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function normalizeCandidateSourceUrl(source: string): URL | null {
  try {
    const url = new URL(source);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    const hostname = url.hostname.toLowerCase();
    const keepsFragment = [...FRAGMENT_SENSITIVE_HOSTS].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    if (!keepsFragment) url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function findCandidate(source: string, matcher: CatalogMatcher): CandidateLink | null {
  const url = normalizeCandidateSourceUrl(source);
  if (!url) {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const match = matcher.domains.find(
    ({ domain }) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
  if (!match) {
    return null;
  }

  return {
    url: url.href,
    hosterId: match.hosterId,
    hosterName: match.hosterName,
    hostname,
  };
}
