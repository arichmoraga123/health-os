import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google";

export async function GET() {
  const redirect = `${process.env.NEXTAUTH_URL}/api/calendar/callback`;
  const client = getOAuthClient(redirect);
  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    prompt: "consent",
  });
  return NextResponse.redirect(url);
}
