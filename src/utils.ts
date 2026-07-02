/**
 * Format raw bytes into human readable size
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * Convert a File or Blob to a Base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Strip the data:URL prefix (e.g. "data:image/png;base64,") to get pure base64
      const base64 = base64String.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Validates and normalizes username
 */
export function normalizeUsername(username: string): string {
  let cleaned = username.trim().toLowerCase();
  if (!cleaned) return "";
  if (cleaned.startsWith("#")) {
    return "#" + cleaned.substring(1).replace(/[^a-z0-9_]/g, "");
  }
  if (!cleaned.startsWith("@")) {
    cleaned = "@" + cleaned;
  }
  // Remove spaces or extra symbols
  cleaned = cleaned.replace(/[^a-z0-9_@#]/g, "");
  return cleaned;
}

/**
 * Synthesize a classic messenger nudge alert sound using Web Audio API
 */
export function playNudgeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // MSN Messenger-like classic attention buzzer / nudge sounds:
    // First high beep, followed by secondary resonance
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(520, ctx.currentTime);
    osc1.frequency.setValueAtTime(520, ctx.currentTime + 0.05);
    osc1.frequency.exponentialRampToValueAtTime(1040, ctx.currentTime + 0.15);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.22);
    gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start();
    osc1.stop(ctx.currentTime + 0.25);
    
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.3);
  } catch (err) {
    console.warn("Failed to play nudge sound:", err);
  }
}

/**
 * Synthesize a gentle receive message sound using Web Audio API
 */
export function playMessageSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // High A note
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08); // E note transition
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (err) {
    console.warn("Failed to play message sound:", err);
  }
}

