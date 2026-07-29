// Shared, concurrency-gated Puppeteer PDF renderer.
//
// DoS hardening: previously every PDF request (certificate view/download,
// invoice generation) called puppeteer.launch() — a brand-new ~150-200MB
// Chromium process per request, with no cap. A burst of authenticated requests
// could fork dozens of Chromiums and OOM the Node process. This module:
//
//   1. keeps ONE long-lived shared browser (launched lazily on first use,
//      relaunched automatically if it crashes/disconnects),
//   2. gates rendering behind a small semaphore: at most MAX_CONCURRENT_RENDERS
//      pages render at once, up to MAX_QUEUE further renders wait their turn,
//      and anything beyond that is rejected immediately with a 503-shaped
//      error (err.statusCode = 503, err.retryAfter in seconds),
//   3. opens a fresh page per render and ALWAYS closes the page in finally —
//      never the shared browser.

import puppeteer from "puppeteer";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--disable-gpu",
];

// ---------------------------------------------------------------------------
// Shared browser (lazy singleton; relaunch on disconnect)
// ---------------------------------------------------------------------------

let browserPromise = null;

async function launchBrowser() {
  // Prefer the bundled Chromium (what certificate rendering has always used);
  // fall back to system Chrome (what the invoice helpers used on hosts where
  // only a system install exists — see render-chrome-install.sh).
  try {
    return await puppeteer.launch({ headless: "new", args: LAUNCH_ARGS });
  } catch (err) {
    console.warn(
      "Bundled Chromium launch failed, falling back to /usr/bin/google-chrome:",
      err?.message
    );
    return await puppeteer.launch({
      headless: "new",
      executablePath: "/usr/bin/google-chrome",
      args: LAUNCH_ARGS,
    });
  }
}

async function getBrowser() {
  if (!browserPromise) {
    const promise = launchBrowser().then((browser) => {
      // If Chromium crashes or is killed, drop the cached instance so the
      // next render relaunches instead of failing forever.
      browser.once("disconnected", () => {
        if (browserPromise === promise) browserPromise = null;
      });
      return browser;
    });
    browserPromise = promise;
    try {
      return await promise;
    } catch (err) {
      if (browserPromise === promise) browserPromise = null; // allow retry
      throw err;
    }
  }

  const browser = await browserPromise;
  // Stale handle (the 'disconnected' listener may not have fired yet).
  const connected =
    typeof browser.connected === "boolean"
      ? browser.connected
      : browser.isConnected();
  if (!connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

// ---------------------------------------------------------------------------
// Concurrency gate (semaphore with a bounded wait queue)
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_RENDERS = 2; // pages rendering simultaneously
const MAX_QUEUE = 10; // renders allowed to wait; beyond this => 503

let activeRenders = 0;
const waitQueue = [];

function acquireRenderSlot() {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders += 1;
    return Promise.resolve();
  }
  if (waitQueue.length >= MAX_QUEUE) {
    const err = new Error(
      "PDF renderer is busy. Please retry in a few seconds."
    );
    err.statusCode = 503;
    err.retryAfter = 10; // seconds — HTTP callers surface this as Retry-After
    return Promise.reject(err);
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releaseRenderSlot() {
  const next = waitQueue.shift();
  if (next) {
    next(); // hand the slot straight to the next waiter (activeRenders unchanged)
  } else {
    activeRenders -= 1;
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Render an HTML string to a PDF buffer using the shared browser.
 *
 * @param {string} html
 * @param {object} [options]
 * @param {object|null} [options.viewport]  e.g. { width: 1122, height: 794, deviceScaleFactor: 1 }
 * @param {string}  [options.waitUntil]     page.setContent waitUntil (default "load")
 * @param {boolean} [options.waitForImages] wait (max 5s) for <img> elements to settle
 * @param {object}  [options.pdfOptions]    passed to page.pdf()
 * @returns {Promise<Buffer|Uint8Array>}
 */
export async function renderHtmlToPdf(html, options = {}) {
  const {
    viewport = null,
    waitUntil = "load",
    waitForImages = false,
    pdfOptions = { format: "A4", printBackground: true },
  } = options;

  await acquireRenderSlot();
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    if (viewport) {
      await page.setViewport(viewport);
    }

    await page.setContent(html, { waitUntil });

    if (waitForImages) {
      // Allow a short time for images to resolve (forced 5s timeout so PDF
      // generation never hangs forever on an image).
      await page.evaluate(() => {
        return new Promise((resolve) => {
          const images = Array.from(document.images);
          let loaded = 0;
          if (images.length === 0) return resolve();

          images.forEach((img) => {
            if (img.complete) {
              loaded++;
            } else {
              img.addEventListener("load", () => {
                loaded++;
                if (loaded === images.length) resolve();
              });
              img.addEventListener("error", () => {
                loaded++; // resolve even on error to prevent hanging
                if (loaded === images.length) resolve();
              });
            }
          });

          if (loaded === images.length) resolve();
          setTimeout(resolve, 5000);
        });
      });
    }

    return await page.pdf(pdfOptions);
  } finally {
    // Always close the per-request PAGE — never the shared browser.
    if (page) {
      try {
        await page.close();
      } catch (closeErr) {
        // Page may already be gone if the browser crashed mid-render.
        console.error("Error closing PDF page:", closeErr?.message);
      }
    }
    releaseRenderSlot();
  }
}

export default renderHtmlToPdf;
