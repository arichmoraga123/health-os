export function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
}
