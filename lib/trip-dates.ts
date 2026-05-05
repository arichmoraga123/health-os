import { addHours } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { dateKeyInTimeZone } from "@/lib/dates";

/** Interpret departure as wall-clock in `originTz`, add flight hours, return YYYY-MM-DD at destination. */
export function landingDateKeyInDestination(
  departureDate: string,
  departureTime: string,
  flightHours: number,
  originTz: string,
  destTz: string,
): string {
  const [y, mo, da] = departureDate.split("-").map(Number);
  const [hh, mm] = departureTime.split(":").map(Number);
  if (!y || !mo || !da || Number.isNaN(hh) || Number.isNaN(mm)) {
    return departureDate;
  }
  const wall = new Date(y, mo - 1, da, hh, mm, 0, 0);
  const depUtc = fromZonedTime(wall, originTz);
  const landUtc = addHours(depUtc, flightHours);
  return dateKeyInTimeZone(landUtc, destTz);
}
