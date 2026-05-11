import { processNewFiles } from "@/lib/process-drive-files";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceState = request.headers.get("x-goog-resource-state");
  const userId = request.headers.get("x-goog-channel-token");

  if (resourceState === "sync") {
    return new Response("ok", { status: 200 });
  }

  if (!userId || !channelId) {
    return new Response("missing headers", { status: 400 });
  }

  void processNewFiles(userId).catch((err) => {
    console.error("[drive-webhook] processing error", err);
  });

  return new Response("ok", { status: 200 });
}
