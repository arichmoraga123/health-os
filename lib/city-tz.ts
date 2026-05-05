/** Minimal city → IANA timezone map; extend as needed */
const CITY_MAP: Record<string, string> = {
  "new york": "America/New_York",
  nyc: "America/New_York",
  boston: "America/New_York",
  miami: "America/New_York",
  chicago: "America/Chicago",
  dallas: "America/Chicago",
  denver: "America/Denver",
  phoenix: "America/Phoenix",
  "los angeles": "America/Los_Angeles",
  la: "America/Los_Angeles",
  seattle: "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
  london: "Europe/London",
  paris: "Europe/Paris",
  berlin: "Europe/Berlin",
  madrid: "Europe/Madrid",
  rome: "Europe/Rome",
  dubai: "Asia/Dubai",
  tokyo: "Asia/Tokyo",
  singapore: "Asia/Singapore",
  sydney: "Australia/Sydney",
  melbourne: "Australia/Melbourne",
  auckland: "Pacific/Auckland",
  honolulu: "Pacific/Honolulu",
  toronto: "America/Toronto",
  vancouver: "America/Vancouver",
  mexico: "America/Mexico_City",
  sao: "America/Sao_Paulo",
  "são paulo": "America/Sao_Paulo",
  tel: "Asia/Jerusalem",
  jerusalem: "Asia/Jerusalem",
  cairo: "Africa/Cairo",
  lagos: "Africa/Lagos",
  mumbai: "Asia/Kolkata",
  delhi: "Asia/Kolkata",
  bangkok: "Asia/Bangkok",
  hong: "Asia/Hong_Kong",
  shanghai: "Asia/Shanghai",
  beijing: "Asia/Shanghai",
};

export function resolveCityTimeZone(city: string): string | null {
  const key = city.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  if (CITY_MAP[key]) return CITY_MAP[key];
  for (const [k, tz] of Object.entries(CITY_MAP)) {
    if (key.includes(k) || k.includes(key)) return tz;
  }
  return null;
}
