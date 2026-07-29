// routes/chunkUpload.js
import express from "express";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import passport from "passport";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const chunkRouter = express.Router();

const UPLOAD_DIR = path.resolve("uploads/chunks");
const FINAL_DIR = path.resolve("uploads");

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// SECURITY: these routes write attacker-controlled bytes to disk. Previously they
// were completely unauthenticated AND used `fileId` / `fileName` directly in
// path.join(), allowing path traversal (e.g. fileName="../config/x.json") to write
// or overwrite arbitrary files on the server. Both routes now require an authenticated
// admin/instructor and every path component is sanitised + containment-checked.
chunkRouter.use(
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin
);

// SECURITY (DoS/disk-exhaustion limits):
// - MAX_CHUNK_BYTES caps the raw bytes accepted per chunk request. The admin panel
//   slices files into 100MB chunks (admin_panel .../VideoLesson.tsx CHUNK_SIZE) and
//   sends each as a multipart/form-data body, so the wire size is slightly above
//   100MB — the cap must stay above that or existing uploads break. 110MB leaves
//   headroom for the multipart envelope while still bounding each request
//   (previously unbounded up to nginx's client_max_body_size of 2G).
// - MAX_TOTAL_CHUNKS was 100000, which with large chunks allowed ~ multi-TB per
//   fileId. 1000 chunks x 100MB = ~100GB still comfortably exceeds any legitimate
//   course video while acting as a cumulative per-upload ceiling.
const MAX_CHUNK_BYTES = Number(process.env.CHUNK_MAX_BYTES) || 110 * 1024 * 1024; // 110 MB
const MAX_TOTAL_CHUNKS = Number(process.env.CHUNK_MAX_TOTAL_CHUNKS) || 1000;

// Reduce any value to a single safe path segment (no separators, no traversal).
const safeSegment = (value) => {
  if (value === undefined || value === null) return null;
  const base = path.basename(String(value));
  // basename strips directory separators; reject anything that still looks unsafe.
  if (!base || base === "." || base === ".." || base.includes("/") || base.includes("\\") || base.includes("\0")) {
    return null;
  }
  return base;
};

// Ensure `candidate` resolves to a path inside `root` (defence in depth).
const isInside = (root, candidate) => {
  const resolved = path.resolve(candidate);
  return resolved === root || resolved.startsWith(root + path.sep);
};

// Handle chunk upload
chunkRouter.post("/upload-chunk", async (req, res) => {
  try {
    const fileId = safeSegment(req.headers["fileid"]);
    const chunkIndexRaw = req.headers["chunkindex"];
    const totalChunks = Number(req.headers["totalchunks"]);

    const chunkIndex = Number(chunkIndexRaw);
    if (
      !fileId ||
      chunkIndexRaw === undefined ||
      !Number.isInteger(chunkIndex) ||
      chunkIndex < 0 ||
      !Number.isInteger(totalChunks) ||
      totalChunks <= 0 ||
      totalChunks > MAX_TOTAL_CHUNKS ||
      chunkIndex >= totalChunks
    ) {
      return res.status(400).json({ error: "Missing or invalid chunk headers" });
    }

    const chunkDir = path.join(UPLOAD_DIR, fileId);
    if (!isInside(UPLOAD_DIR, chunkDir)) {
      return res.status(400).json({ error: "Invalid fileId" });
    }
    if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true });

    const chunkPath = path.join(chunkDir, String(chunkIndex));
    const writeStream = fs.createWriteStream(chunkPath);

    // SECURITY: enforce a per-chunk byte ceiling while streaming. Previously the
    // body was piped to disk with no size accounting at all, so a single
    // authenticated admin/instructor could fill the disk with arbitrarily large
    // "chunks" (nginx allows up to 2G per request). Count bytes as they arrive
    // and abort with 413 the moment the cap is exceeded, removing the partial
    // chunk so failed attempts do not accumulate on disk.
    let receivedBytes = 0;
    let aborted = false;
    req.on("data", (buf) => {
      receivedBytes += buf.length;
      if (receivedBytes > MAX_CHUNK_BYTES && !aborted) {
        aborted = true;
        req.unpipe(writeStream);
        writeStream.destroy();
        fs.rm(chunkPath, { force: true }, () => {});
        if (!res.headersSent) {
          res.status(413).json({ error: `Chunk exceeds maximum allowed size of ${MAX_CHUNK_BYTES} bytes` });
        }
        req.destroy();
      }
    });

    req.pipe(writeStream);

    writeStream.on("finish", () => {
      if (!aborted) res.json({ success: true, chunkIndex });
    });

    writeStream.on("error", (err) => {
      if (aborted) return; // expected destroy after over-limit abort
      console.error("Chunk write error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to write chunk" });
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Server error" });
  }
});

// Merge chunks
chunkRouter.post("/merge-chunks", async (req, res) => {
  try {
    const fileId = safeSegment(req.body?.fileId);
    const fileName = safeSegment(req.body?.fileName);
    const totalChunks = Number(req.body?.totalChunks);

    if (
      !fileId ||
      !fileName ||
      !Number.isInteger(totalChunks) ||
      totalChunks <= 0 ||
      totalChunks > MAX_TOTAL_CHUNKS
    ) {
      return res.status(400).json({ error: "Missing or invalid merge parameters" });
    }

    const chunkDir = path.join(UPLOAD_DIR, fileId);
    const finalPath = path.join(FINAL_DIR, fileName);
    if (!isInside(UPLOAD_DIR, chunkDir) || !isInside(FINAL_DIR, finalPath)) {
      return res.status(400).json({ error: "Invalid fileId or fileName" });
    }

    // Validate every chunk exists before writing anything.
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, String(i));
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ error: `Missing chunk ${i}` });
      }
    }

    const writeStream = fs.createWriteStream(finalPath);

    // Stream each chunk sequentially into the destination. createReadStream +
    // pipeline copies in small, backpressure-aware buffers, so memory stays flat
    // and the event loop is never blocked (unlike fs.readFileSync of whole chunks).
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, String(i));
        await pipeline(fs.createReadStream(chunkPath), writeStream, { end: false });
      }
      // Close the destination stream and wait for all bytes to be flushed.
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        writeStream.end();
      });
    } catch (err) {
      writeStream.destroy();
      console.error("Merge write error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to merge chunks" });
      return;
    }

    // Cleanup chunk dir
    fs.rmSync(chunkDir, { recursive: true, force: true });
    res.json({ success: true, fileName });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to merge chunks" });
  }
});

export default chunkRouter;
