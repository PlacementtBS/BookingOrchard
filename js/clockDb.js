// clockDb.js
import { select, insert } from "./db.js";

/** Return last clock entry for user (most recent). */
export async function lastClockForUser(uId) {
  const rows = await select("clock", "*", { column: "uId", operator: "eq", value: uId }, { orderBy: "ts", direction: "desc", limit: 1 });
  return rows && rows.length ? rows[0] : null;
}

/** Insert a clock action (in | out) */
export async function addClockEntry({ uId, oId, action, ts = new Date().toISOString() }) {
  const newEntry = {
    uId,
    oId,
    action,
    ts // assuming ts column is text or timestamptz accepts ISO string
  };
  return await insert("clock", newEntry);
}

/** Get clock entries for user between fromTs and toTs (ISO strings) */
export async function getUserClocksBetween(uId, fromTs, toTs) {
  // you may need to adjust select signature to support range queries; otherwise fetch all and filter
  const rows = await select("clock", "*", { column: "uId", operator: "eq", value: uId });
  return rows.filter(r => {
    const t = new Date(r.ts || r.timestamp).toISOString();
    return t >= new Date(fromTs).toISOString() && t <= new Date(toTs).toISOString();
  }).sort((a,b) => new Date(a.ts) - new Date(b.ts));
}
