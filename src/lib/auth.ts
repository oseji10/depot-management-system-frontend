import type { Session } from "./types";

/**
 * The frontend is a static site on its own domain, so the browser talks to the Laravel API directly.
 * Set NEXT_PUBLIC_API_URL when building, e.g. https://api.example.com/api/v1
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

const TOKEN = "depot.token";
const STORE = "depot.store";
const SESSION = "depot.session";
const BRANCH = "depot.branch";
const WAREHOUSE = "depot.warehouse";

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private mode */ }
}

export const getToken = () => (typeof window === "undefined" ? null : read(TOKEN));
export const getStoreId = () => (typeof window === "undefined" ? null : read(STORE));
export const setStoreId = (id: string | null) => write(STORE, id && /^\d+$/.test(id) ? id : null);

/** The branch / warehouse a business-wide user narrowed the app to. Empty = everything. */
export const getBranchId = () => (typeof window === "undefined" ? null : read(BRANCH));
export const getWarehouseId = () => (typeof window === "undefined" ? null : read(WAREHOUSE));
export function setWorkspace(branch: string | null, warehouse: string | null) {
  write(BRANCH, branch && /^\d+$/.test(branch) ? branch : null);
  write(WAREHOUSE, warehouse && /^\d+$/.test(warehouse) ? warehouse : null);
}

export function signIn(token: string, session?: Session) {
  write(TOKEN, token);
  write(STORE, null);
  setWorkspace(null, null);
  if (session) cacheSession(session);
}

/** The last session the server vouched for. Lets a salesperson open the app with no signal. */
export const cacheSession = (s: Session) => write(SESSION, JSON.stringify(s));
export function cachedSession(): Session | null {
  const raw = read(SESSION);
  try { return raw ? (JSON.parse(raw) as Session) : null; } catch { return null; }
}

export function signOutLocally() {
  write(TOKEN, null);
  write(STORE, null);
  write(SESSION, null);
  setWorkspace(null, null);
}

/** Headers every API call carries. X-Store-Id only matters to platform admins; the API ignores it for everyone else. */
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  const store = getStoreId();
  if (token) h.Authorization = `Bearer ${token}`;
  if (store) h["X-Store-Id"] = store;
  const branch = getBranchId();
  const warehouse = getWarehouseId();
  if (branch) h["X-Branch-Id"] = branch;
  if (warehouse) h["X-Warehouse-Id"] = warehouse;
  return h;
}
