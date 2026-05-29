// src/lib/demoSimulator.ts
// Client-side "living demo" driver. Runs only while a demo visitor has the tab open.

const API_BASE = import.meta.env.VITE_API_URL || '';
const MIN_INTERVAL_MS = 8000;
const MAX_INTERVAL_MS = 12000;

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

function getToken(): string | null {
  return localStorage.getItem('haulflow_token') || localStorage.getItem('token') || null;
}

async function tickOnce(onTick?: () => void) {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/api/demo/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.actions?.length && onTick) onTick();
    } else if (res.status === 403 || res.status === 401) {
      stopDemoSimulator();
    }
  } catch { /* retry next tick */ }
}

function scheduleNext(onTick?: () => void) {
  if (!running) return;
  const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
  timer = setTimeout(async () => { await tickOnce(onTick); scheduleNext(onTick); }, delay);
}

export function startDemoSimulator(onTick?: () => void): () => void {
  if (running) return stopDemoSimulator;
  running = true;
  scheduleNext(onTick);
  return stopDemoSimulator;
}

export function stopDemoSimulator() {
  running = false;
  if (timer) { clearTimeout(timer); timer = null; }
}
