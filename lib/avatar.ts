const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function pickInitial(input: { displayName?: string | null; name?: string | null; email?: string | null }): string {
  const candidates = [input.displayName, input.name, input.email];
  for (const c of candidates) {
    if (!c) continue;
    const trimmed = c.trim();
    if (!trimmed) continue;
    const ch = trimmed[0].toUpperCase();
    if (ALPHABET.includes(ch)) return ch;
  }
  return "?";
}

const TINT_PALETTE = [
  { bg: "#e0457a", fg: "#ffffff" },
  { bg: "#3a76d8", fg: "#ffffff" },
  { bg: "#2c8aa6", fg: "#ffffff" },
  { bg: "#7a52b8", fg: "#ffffff" },
  { bg: "#d68545", fg: "#ffffff" },
  { bg: "#2f8a52", fg: "#ffffff" },
] as const;

export function avatarTint(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return TINT_PALETTE[Math.abs(hash) % TINT_PALETTE.length];
}
