export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function initialsFromEmail(email: string) {
  const token = email.split("@")[0] || "HO";
  const chars = token.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  return chars || "HO";
}

export function dateKey(input = new Date()) {
  return input.toISOString().slice(0, 10);
}

export function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
