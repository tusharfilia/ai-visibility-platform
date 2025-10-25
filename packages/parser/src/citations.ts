/**
 * Citation parsing utilities
 * Extracts and normalizes URLs from text
 */

export interface Citation {
  url: string;
  domain: string;
  confidence?: number;
  rank?: number;
}

export interface CitationExtractionOptions {
  removeUtm?: boolean;
  removeTracking?: boolean;
  normalizeDomains?: boolean;
  minConfidence?: number;
}

/**
 * Extract citations from text
 */
export function extractCitations(
  text: string,
  options: CitationExtractionOptions = {}
): Citation[] {
  const {
    removeUtm = true,
    removeTracking = true,
    normalizeDomains = true,
    minConfidence = 0.5,
  } = options;

  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  
  const citations: Citation[] = [];
  const seenUrls = new Set<string>();
  
  for (let i = 0; i < matches.length; i++) {
    const rawUrl = matches[i];
    const normalizedUrl = normalizeUrl(rawUrl, { removeUtm, removeTracking });
    
    if (seenUrls.has(normalizedUrl)) {
      continue;
    }
    
    const domain = extractDomain(normalizedUrl);
    const confidence = calculateUrlConfidence(normalizedUrl, text);
    
    if (confidence >= minConfidence) {
      citations.push({
        url: normalizedUrl,
        domain: normalizeDomains ? normalizeDomain(domain) : domain,
        confidence,
        rank: i + 1,
      });
      
      seenUrls.add(normalizedUrl);
    }
  }
  
  return citations.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

/**
 * Normalize URL by removing tracking parameters and standardizing format
 */
export function normalizeUrl(
  url: string,
  options: { removeUtm?: boolean; removeTracking?: boolean } = {}
): string {
  const { removeUtm = true, removeTracking = true } = options;
  
  try {
    const urlObj = new URL(url);
    
    // Remove UTM parameters
    if (removeUtm) {
      const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
      utmParams.forEach(param => urlObj.searchParams.delete(param));
    }
    
    // Remove tracking parameters
    if (removeTracking) {
      const trackingParams = [
        'fbclid', 'gclid', 'msclkid', 'twclid', 'li_fat_id',
        'ref', 'source', 'campaign', 'medium', 'content'
      ];
      trackingParams.forEach(param => urlObj.searchParams.delete(param));
    }
    
    // Remove empty query string
    if (urlObj.search === '?') {
      urlObj.search = '';
    }
    
    // Remove trailing slash for consistency
    if (urlObj.pathname === '/' && urlObj.search === '' && urlObj.hash === '') {
      urlObj.pathname = '';
    }
    
    return urlObj.toString();
  } catch (error) {
    // Return original URL if parsing fails
    return url;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch (error) {
    // Fallback to simple domain extraction
    const match = url.match(/https?:\/\/([^\/\s]+)/);
    return match ? match[1].toLowerCase() : '';
  }
}

/**
 * Normalize domain name
 */
export function normalizeDomain(domain: string): string {
  // Remove www. prefix
  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }
  
  // Remove common subdomains
  const commonSubdomains = ['blog', 'news', 'support', 'help', 'docs', 'api'];
  const parts = domain.split('.');
  if (parts.length > 2 && commonSubdomains.includes(parts[0])) {
    domain = parts.slice(1).join('.');
  }
  
  return domain;
}

/**
 * Calculate confidence score for URL
 */
function calculateUrlConfidence(url: string, context: string): number {
  let confidence = 0.5;
  
  // Boost confidence for HTTPS
  if (url.startsWith('https://')) {
    confidence += 0.2;
  }
  
  // Boost confidence for well-known domains
  const wellKnownDomains = [
    'github.com', 'stackoverflow.com', 'wikipedia.org', 'reddit.com',
    'medium.com', 'dev.to', 'hashnode.com', 'freecodecamp.org'
  ];
  
  const domain = extractDomain(url);
  if (wellKnownDomains.some(d => domain.includes(d))) {
    confidence += 0.3;
  }
  
  // Boost confidence if URL appears in structured context
  if (context.includes('[') && context.includes('](') && context.includes(')')) {
    confidence += 0.2; // Markdown link
  }
  
  if (context.includes('<a href=')) {
    confidence += 0.2; // HTML link
  }
  
  // Reduce confidence for suspicious patterns
  if (url.includes('bit.ly') || url.includes('tinyurl.com') || url.includes('t.co')) {
    confidence -= 0.1; // Shortened URLs
  }
  
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    confidence -= 0.3; // Local URLs
  }
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract URLs from markdown text
 */
export function extractMarkdownLinks(text: string): string[] {
  const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const matches: string[] = [];
  let match;
  
  while ((match = markdownRegex.exec(text)) !== null) {
    const url = match[2];
    if (isValidUrl(url)) {
      matches.push(url);
    }
  }
  
  return matches;
}

/**
 * Extract URLs from HTML text
 */
export function extractHtmlLinks(text: string): string[] {
  const htmlRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const matches: string[] = [];
  let match;
  
  while ((match = htmlRegex.exec(text)) !== null) {
    const url = match[1];
    if (isValidUrl(url)) {
      matches.push(url);
    }
  }
  
  return matches;
}

/**
 * Group citations by domain
 */
export function groupCitationsByDomain(citations: Citation[]): Map<string, Citation[]> {
  const grouped = new Map<string, Citation[]>();
  
  for (const citation of citations) {
    const domain = citation.domain;
    if (!grouped.has(domain)) {
      grouped.set(domain, []);
    }
    grouped.get(domain)!.push(citation);
  }
  
  return grouped;
}

/**
 * Get top domains by citation count
 */
export function getTopDomains(
  citations: Citation[],
  limit: number = 10
): Array<{ domain: string; count: number; citations: Citation[] }> {
  const grouped = groupCitationsByDomain(citations);
  const topDomains = Array.from(grouped.entries())
    .map(([domain, citations]) => ({
      domain,
      count: citations.length,
      citations,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  
  return topDomains;
}
