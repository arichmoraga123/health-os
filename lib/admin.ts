/** App owner allowlist — used by middleware, APIs, and sidebar. */
export const ADMIN_EMAILS = ["a.rich.moraga@gmail.com"] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return (ADMIN_EMAILS as readonly string[]).map((x) => x.toLowerCase()).includes(e);
}

export function maskOuraToken(token: string | null | undefined): string {
  if (!token || token.length < 4) return token ? "●●●●" : "—";
  return `${token.slice(0, 4)}…●●●●`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (phone.length <= 5) return "●●●●";
  return `${phone.slice(0, 3)}…${phone.slice(-2)}`;
}
