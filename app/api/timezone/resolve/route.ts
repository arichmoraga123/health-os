import { NextResponse } from "next/server";
import { resolveCityTimeZone } from "@/lib/city-tz";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ timeZone: null });
  }
  const timeZone = resolveCityTimeZone(q);
  return NextResponse.json({ timeZone: timeZone ?? null, query: q });
}
