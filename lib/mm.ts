import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { tokenizeHouse, mmSetDraw, getPool, type PoolState } from "./sui";

/**
 * Market maker. Drives the shared lending Pool's utilization up and down on-chain
 * (via bridge::house::mm_set_draw) so the borrow rate — and thus the treasury
 * yield — varies in real time. One dedicated MM vault carries the outstanding
 * draw; each tick re-targets it. Real Sui transactions, real pool state.
 */

const FILE = path.join(process.cwd(), ".mm.json");
const CAPACITY = 1_000_000; // matches the Pool's default capacity (€1M treasury)

type MmState = { vaultId: string; step: number };

async function read(): Promise<MmState> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as MmState;
  } catch {
    return { vaultId: "", step: 0 };
  }
}
async function write(s: MmState): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(s), "utf8");
}

/**
 * Target draw for a step: a smooth sine sweep across the utilization curve
 * (crossing the 80% kink so the rate visibly accelerates), with light jitter.
 */
function targetDraw(step: number): number {
  const base = 0.5, amp = 0.42;
  const jitter = (Math.sin(step * 2.3) + Math.sin(step * 0.7)) * 0.03;
  const util = Math.min(0.96, Math.max(0.04, base + amp * Math.sin(step * 0.45) + jitter));
  return Math.round(util * CAPACITY);
}

export async function mmTick(): Promise<{ pool: PoolState | null; draw: number; digest: string; demo: boolean; created?: boolean }> {
  const s = await read();

  // First tick just provisions the MM's vault (one tx). Drawing starts next tick
  // — keeping tokenize and mm_set_draw in separate requests avoids a stale-gas race.
  if (!s.vaultId?.startsWith("0x")) {
    const t = await tokenizeHouse({ owner: "", article: "MM", docHashHex: "00", vpt: CAPACITY });
    await write({ vaultId: t.vaultId || "", step: 0 });
    const pool = await getPool();
    return { pool, draw: 0, digest: t.digest, demo: t.demo, created: true };
  }

  const draw = targetDraw(s.step);
  const res = await mmSetDraw({ vaultId: s.vaultId, newDraw: draw });
  await write({ ...s, step: s.step + 1 });
  const pool = await getPool();
  return { pool, draw, digest: res.digest, demo: res.demo };
}

export async function mmReset(): Promise<void> {
  const s = await read();
  if (s.vaultId?.startsWith("0x")) await mmSetDraw({ vaultId: s.vaultId, newDraw: 0 });
  await write({ ...s, step: 0 });
}
