import * as cheerio from "cheerio";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import dns from "dns";
import net from "net";

const URL_FETCH_TIMEOUT_MS = 10000;
const MAX_URL_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_URL_REDIRECTS = 3;

// Reject loopback, private, link-local (incl. cloud metadata 169.254.169.254),
// unspecified, and other non-routable ranges to prevent SSRF.
function isBlockedIp(ip) {
    const type = net.isIP(ip);
    if (type === 4) {
        const parts = ip.split('.').map(Number);
        const [a, b] = parts;
        if (a === 0) return true;                                // 0.0.0.0/8 (unspecified)
        if (a === 127) return true;                              // 127.0.0.0/8 loopback
        if (a === 10) return true;                               // 10.0.0.0/8 private
        if (a === 172 && b >= 16 && b <= 31) return true;        // 172.16.0.0/12 private
        if (a === 192 && b === 168) return true;                 // 192.168.0.0/16 private
        if (a === 169 && b === 254) return true;                 // 169.254.0.0/16 link-local + metadata
        if (a === 100 && b >= 64 && b <= 127) return true;       // 100.64.0.0/10 CGNAT
        if (a >= 224) return true;                               // multicast / reserved
        return false;
    }
    if (type === 6) {
        const lower = ip.toLowerCase();
        if (lower === '::' || lower === '::1') return true;       // unspecified / loopback
        if (lower.startsWith('fe80') || lower.startsWith('fe9') ||
            lower.startsWith('fea') || lower.startsWith('feb')) return true; // fe80::/10 link-local
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true;   // fc00::/7 unique local
        // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check the embedded IPv4.
        const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isBlockedIp(mapped[1]);
        return false;
    }
    // Not a recognizable IP literal — treat as blocked to be safe.
    return true;
}

// Validate a user-supplied URL: require http/https and ensure the host does
// not resolve to a blocked (internal/loopback/link-local) address.
async function assertSafeUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http and https URLs are allowed');
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
        hostname.endsWith('.internal')) {
        throw new Error('URL host is not allowed');
    }

    // If the host is already an IP literal, validate it directly.
    if (net.isIP(hostname)) {
        if (isBlockedIp(hostname)) {
            throw new Error('URL resolves to a blocked address');
        }
        return parsed;
    }

    // Otherwise resolve all addresses and reject if any is blocked.
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses.length) {
        throw new Error('URL host could not be resolved');
    }
    for (const { address } of addresses) {
        if (isBlockedIp(address)) {
            throw new Error('URL resolves to a blocked address');
        }
    }

    return parsed;
}

// Fetch with SSRF protection: per-hop host validation, manual redirect handling,
// a request timeout, and a response-size cap.
async function safeFetch(rawUrl) {
    let currentUrl = rawUrl;

    for (let redirects = 0; redirects <= MAX_URL_REDIRECTS; redirects++) {
        await assertSafeUrl(currentUrl);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(currentUrl, {
                redirect: 'manual',
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timer);
        }

        // Manually follow redirects so each hop's host is re-validated
        // (defends against redirect-to-internal / DNS-rebind bypass).
        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location');
            if (!location) {
                throw new Error('Redirect response missing Location header');
            }
            if (redirects === MAX_URL_REDIRECTS) {
                throw new Error('Too many redirects');
            }
            currentUrl = new URL(location, currentUrl).toString();
            continue;
        }

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        // Enforce response-size cap, honoring Content-Length when present.
        const contentLength = Number(res.headers.get('content-length'));
        if (Number.isFinite(contentLength) && contentLength > MAX_URL_RESPONSE_BYTES) {
            throw new Error('URL response exceeds maximum allowed size');
        }

        return await readBodyWithLimit(res, MAX_URL_RESPONSE_BYTES);
    }

    throw new Error('Too many redirects');
}

// Read a response body as text while enforcing a hard byte limit.
async function readBodyWithLimit(res, maxBytes) {
    if (!res.body) {
        const text = await res.text();
        if (Buffer.byteLength(text) > maxBytes) {
            throw new Error('URL response exceeds maximum allowed size');
        }
        return text;
    }

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        if (received > maxBytes) {
            await reader.cancel();
            throw new Error('URL response exceeds maximum allowed size');
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf-8');
}

export async function extractTextFromPdf(buffer) {
    try {
        // PDF text extraction disabled - file stored without content
        // For production, consider using services like AWS Textract or Google Document AI
        return 'PDF uploaded';
    } catch (error) {
        console.error("Error handling PDF:", error);
        throw new Error(`Failed to process PDF: ${error.message}`);
    }
}

export async function extractTextFromDocx(buffer) {
    try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value.trim();
    } catch (error) {
        console.error("Error parsing DOCX:", error);
        throw new Error("Failed to parse DOCX");
    }
}

// SECURITY (zip-bomb / decompression-bomb guards for user-uploaded spreadsheets):
// - Pre-parse byte cap: matches the 50MB multer cap on POST /ai/knowledge
//   (routes/aiRoutes.js) and protects any future caller that bypasses multer.
// - sheetRows: caps how many rows XLSX.read materialises per sheet — the only
//   density limiter xlsx@0.18.x exposes. 50k rows is far beyond any legitimate
//   knowledge-base spreadsheet.
// RESIDUAL RISK: the npm `xlsx` package (last npm release 0.18.5) has a known
// high-severity advisory (prototype pollution / ReDoS) with NO fix published to
// npm, and a crafted sharedStrings.xml can still inflate substantially within the
// 50MB/50k-row bounds before row trimming applies. The parse is wrapped in
// try/catch and the route is admin/instructor-only, which bounds exposure.
// RECOMMENDED MIGRATION: move to the maintained SheetJS distribution
// (https://cdn.sheetjs.com, >=0.20.x, where the advisories are fixed) or a
// streaming parser such as exceljs, and run extraction in a worker with a memory
// ceiling.
const MAX_XLSX_BYTES = 50 * 1024 * 1024; // 50 MB — keep in sync with aiRoutes.js multer limit
const MAX_XLSX_ROWS_PER_SHEET = 50000;

export async function extractTextFromXlsx(buffer) {
    try {
        if (!Buffer.isBuffer(buffer)) {
            throw new Error("XLSX input must be a buffer");
        }
        if (buffer.length > MAX_XLSX_BYTES) {
            throw new Error(`XLSX file exceeds maximum allowed size of ${MAX_XLSX_BYTES / (1024 * 1024)} MB`);
        }
        const workbook = XLSX.read(buffer, { type: 'buffer', sheetRows: MAX_XLSX_ROWS_PER_SHEET });
        let text = "";
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            text += XLSX.utils.sheet_to_txt(sheet) + "\n";
        });
        return text.trim();
    } catch (error) {
        console.error("Error parsing XLSX:", error);
        throw new Error(`Failed to parse XLSX: ${error.message}`);
    }
}

export async function extractTextFromTxt(buffer) {
    try {
        return buffer.toString('utf-8').trim();
    } catch (error) {
        console.error("Error parsing TXT:", error);
        throw new Error("Failed to parse TXT");
    }
}

export async function extractTextFromUrl(url) {
    try {
        const html = await safeFetch(url);
        const $ = cheerio.load(html);

        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('footer').remove();

        const text = $('body').text().replace(/\s+/g, ' ').trim();

        if (!text) {
            throw new Error('No text content found in URL');
        }

        return text;
    } catch (error) {
        console.error('Error extracting text from URL:', error);
        throw new Error(`Failed to fetch URL: ${error.message}`);
    }
}

export function chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = []
    let start = 0

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length)
        chunks.push(text.slice(start, end))
        start += chunkSize - overlap
    }

    return chunks
}
