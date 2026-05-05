import { subDays } from "date-fns";

export function makeMockSnapshots(days = 30) {
  return Array.from({ length: days }).map((_, i) => {
    const d = subDays(new Date(), days - 1 - i);
    const base = 68 + Math.round(Math.sin(i / 3) * 10);
    return {
      date: d.toISOString().slice(0, 10),
      sleepScore: Math.max(50, Math.min(95, base + 5)),
      readinessScore: Math.max(45, Math.min(95, base + 2)),
      activityScore: Math.max(40, Math.min(95, base + 8)),
      hrv: 35 + ((i * 3) % 28),
      sleepDuration: 420 + ((i * 11) % 90),
      deepSleep: 80 + ((i * 7) % 40),
      remSleep: 70 + ((i * 5) % 50),
      lightSleep: 210 + ((i * 8) % 60),
      efficiency: 84 + (i % 12),
      steps: 6400 + ((i * 370) % 7000),
      activeCalories: 280 + ((i * 45) % 350),
      bodyTempDeviation: Number((((i % 8) - 4) * 0.07).toFixed(2)),
    };
  });
}
