import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { getGoogleOAuthRedirectUri, getOAuthClient } from "@/lib/google";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const redirect = getGoogleOAuthRedirectUri();
  const client = getOAuthClient(redirect);
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ],
    prompt: "consent",
  });
  return NextResponse.redirect(url);
}
