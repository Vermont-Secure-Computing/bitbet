import { getConstants } from "../../constants";

const { FALLBACK_RPC_URLS, DEFAULT_RPC_URL } = getConstants();

let idx = 0;
let current = DEFAULT_RPC_URL;

async function ping(url, timeoutMs = 2500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal }).catch(() => fetch(url, { method: "GET", signal: ctrl.signal }));
    return !!res;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export const rpcManager = {
  storageKeys: {
    DONT_SHOW_MODAL: "dismissRpcHelp",
    CUSTOM_RPC: "customRpcUrl",
  },

  get() {
    return current;
  },

  async pickBest() {
    // Honor user custom RPC first
    try {
      const custom = localStorage.getItem(this.storageKeys.CUSTOM_RPC);
      if (custom) {
        current = custom;
        return current;
      }
    } catch {}

    // Try current index first
    const candidates = [current, ...FALLBACK_RPC_URLS.filter(u => u !== current)];
    for (let i = 0; i < candidates.length; i++) {
      const url = candidates[i];
      const ok = await ping(url);
      if (ok) {
        current = url;
        idx = Math.max(0, FALLBACK_RPC_URLS.indexOf(url));
        console.info("[rpcManager] Using RPC:", current);
        return current;
      }
    }
    // If nothing passes, keep current anyway
    console.warn("[rpcManager] No healthy RPC found, keeping:", current);
    return current;
  },

  async ensureHealthy() {
    const ok = await ping(current);
    if (ok) return current;

    // rotate through fallbacks
    for (let i = 0; i < FALLBACK_RPC_URLS.length; i++) {
      idx = (idx + 1) % FALLBACK_RPC_URLS.length;
      const next = FALLBACK_RPC_URLS[idx];
      if (await ping(next)) {
        current = next;
        console.warn("[rpcManager] Switched to fallback RPC:", current);
        return current;
      }
    }
    console.error("[rpcManager] All fallbacks unhealthy; staying on:", current);
    return current;
  },
};
