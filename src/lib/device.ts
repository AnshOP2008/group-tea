// Device identity + lightweight fingerprint
const KEY = "gt_device_id";
const GROUP_KEY = "gt_chosen_group";
const TEA_KEY = "gt_tea_submitted";

function rand() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = rand();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getFingerprint(): string {
  if (typeof window === "undefined") return "";
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width) + "x" + String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency || ""),
    String((navigator as any).deviceMemory || ""),
  ];
  return btoa(parts.join("|")).slice(0, 64);
}

export function isLikelyIncognito(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const fs = (navigator as any).storage?.estimate?.();
      if (fs && fs.then) {
        fs.then((r: any) => resolve((r.quota || 0) < 120_000_000)).catch(() => resolve(false));
      } else resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export function getChosenGroup(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(GROUP_KEY);
  return v ? Number(v) : null;
}
export function setChosenGroup(g: number) {
  localStorage.setItem(GROUP_KEY, String(g));
}

export function hasSubmittedTea(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(TEA_KEY) === "1";
}
export function markTeaSubmitted() {
  localStorage.setItem(TEA_KEY, "1");
}
