const base = process.env.OURA_WORKER_URL;

function buildUrl(path: string, searchParams?: Record<string, string>) {
  if (!base) throw new Error("OURA_WORKER_URL is not configured");
  const cleanBase = base.replace(/\/$/, "");
  const cleanPath = path.replace(/^\//, "");
  const url = new URL(`${cleanBase}/${cleanPath}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function ouraFetch(path: string, token: string, searchParams?: Record<string, string>) {
  const response = await fetch(buildUrl(path, searchParams), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Oura request failed: ${response.status}`);
  }
  return response.json();
}

export async function validateOuraToken(token: string) {
  return ouraFetch("v2/usercollection/personal_info", token);
}
