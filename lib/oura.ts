const base = process.env.OURA_WORKER_URL;

export async function ouraFetch(path: string, token: string) {
  if (!base) throw new Error("OURA_WORKER_URL is not configured");
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Oura request failed: ${response.status}`);
  }
  return response.json();
}

export async function validateOuraToken(token: string) {
  const data = await ouraFetch("/v2/usercollection/personal_info", token);
  return data;
}
