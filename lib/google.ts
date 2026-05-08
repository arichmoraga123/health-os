import { google } from "googleapis";

/** Must match the authorized redirect URI in Google Cloud (e.g. production Vercel URL or localhost). */
export function getGoogleOAuthRedirectUri(): string {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    `${(process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")}/api/calendar/callback`
  );
}

export function getOAuthClient(redirectUri?: string) {
  const uri = redirectUri ?? getGoogleOAuthRedirectUri();
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, uri);
}
