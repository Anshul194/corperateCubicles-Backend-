// config/firebase.js
import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import path from "path";

// SECURITY: the service-account private key must NOT live in the repo. Prefer
// credentials supplied via environment (FIREBASE_SERVICE_ACCOUNT as a JSON string,
// or FIREBASE_SERVICE_ACCOUNT_PATH pointing at a file outside version control).
// The committed ./config/firebase-service-account.json is only a last-resort local
// fallback and is now git-ignored — the leaked key it contained MUST be rotated.
const loadServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT is not valid JSON:", e.message);
      return null;
    }
  }

  const candidatePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.resolve("./config/firebase-service-account.json");

  if (existsSync(candidatePath)) {
    try {
      return JSON.parse(readFileSync(candidatePath, "utf8"));
    } catch (e) {
      console.error("❌ Failed to read Firebase service account file:", e.message);
      return null;
    }
  }

  return null;
};

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.warn(
      "⚠️  Firebase service account not configured. Firebase Admin features (FCM, etc.) are disabled. " +
        "Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH."
    );
  }
}

export default admin;
