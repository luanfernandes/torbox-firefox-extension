import { findCandidate, type CandidateLink, type CatalogMatcher } from "../domain/catalog";

export const DEFAULT_CANDIDATE_CAP = 100;

export interface ScanResult {
  candidates: CandidateLink[];
  truncated: boolean;
}

export function scanDocument(
  sourceDocument: Document,
  matcher: CatalogMatcher,
  cap = DEFAULT_CANDIDATE_CAP,
): ScanResult {
  const candidates: CandidateLink[] = [];
  const seen = new Set<string>();

  for (const element of sourceDocument.querySelectorAll<HTMLAnchorElement | HTMLAreaElement>("a[href], area[href]")) {
    const candidate = findCandidate(element.href, matcher);
    if (!candidate || seen.has(candidate.url)) continue;
    if (candidates.length === cap) return { candidates, truncated: true };
    seen.add(candidate.url);
    candidates.push(candidate);
  }

  return { candidates, truncated: false };
}
