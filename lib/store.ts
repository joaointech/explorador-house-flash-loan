import "server-only";
import { promises as fs } from "fs";
import path from "path";

/**
 * Tiny collection store shared by the loan / KYC / agreement registries.
 *
 * On Cloud Run the container filesystem is ephemeral and PER-INSTANCE, so the old
 * JSON files lost state between requests that hit different instances. With
 * USE_FIRESTORE=1 each collection is one Firestore document ({ items: [...] })
 * that every instance shares. Without the flag it falls back to the local JSON
 * file, so local dev needs no GCP credentials.
 *
 * On Cloud Run, `new Firestore()` authenticates automatically via the service
 * account (Application Default Credentials) — no connection string or secret.
 */

const USE_FIRESTORE = process.env.USE_FIRESTORE === "1";
const ROOT = process.env.FIRESTORE_ROOT || "explorador"; // Firestore collection namespace

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
async function db() {
  if (!_db) {
    const { Firestore } = await import("@google-cloud/firestore");
    // ignoreUndefinedProperties: optional fields (sandbox?, morada?, repaidUsdc?…)
    // arrive as `undefined`, which Firestore rejects unless told to skip them.
    _db = new Firestore({ ignoreUndefinedProperties: true }); // creds from ADC (auto on Cloud Run)
  }
  return _db;
}

const file = (name: string) => path.join(process.cwd(), `.${name}.json`);

export async function readCollection<T>(name: string): Promise<T[]> {
  if (USE_FIRESTORE) {
    try {
      const snap = await (await db()).collection(ROOT).doc(name).get();
      return (snap.exists ? (snap.data()?.items ?? []) : []) as T[];
    } catch {
      return [];
    }
  }
  try {
    return JSON.parse(await fs.readFile(file(name), "utf8")) as T[];
  } catch {
    return [];
  }
}

export async function writeCollection<T>(name: string, items: T[]): Promise<void> {
  if (USE_FIRESTORE) {
    await (await db()).collection(ROOT).doc(name).set({ items });
    return;
  }
  await fs.writeFile(file(name), JSON.stringify(items, null, 2), "utf8");
}
