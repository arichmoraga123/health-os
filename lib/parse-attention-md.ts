export interface AttentionEntry {
  dateUtc: string;
  localDate: string;
  startUtc: string;
  endUtc: string;
  location: string;
  timezone: string;
  startLocal: string;
  endLocal: string;
  withPerson: string;
  activity: string;
  category: string;
  notes: string;
}

export function parseAttentionMarkdown(content: string): AttentionEntry[] {
  const entries: AttentionEntry[] = [];
  const lines = content.split("\n");

  let inTable = false;
  let headerParsed = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("| Date (UTC)") || trimmed.startsWith("|Date (UTC)")) {
      inTable = true;
      headerParsed = false;
      continue;
    }

    if (!inTable) continue;

    if (trimmed.startsWith("|---") || trimmed.startsWith("| ---")) {
      headerParsed = true;
      continue;
    }

    if (!headerParsed) continue;

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cols = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1);

      if (cols.length >= 12) {
        entries.push({
          dateUtc: cols[0],
          localDate: cols[1],
          startUtc: cols[2],
          endUtc: cols[3],
          location: cols[4],
          timezone: cols[5],
          startLocal: cols[6],
          endLocal: cols[7],
          withPerson: cols[8],
          activity: cols[9],
          category: cols[10],
          notes: cols[11] || "",
        });
      }
    }

    if (trimmed === "" && headerParsed) {
      inTable = false;
    }
  }

  return entries;
}

export function entriesToCalendarEvents(
  entries: AttentionEntry[],
): Array<{
  title: string;
  startDateTime: Date;
  endDateTime: Date;
  description: string;
  location: string;
  category: string;
  withPerson: string;
  notes: string;
}> {
  return entries.map((entry) => {
    const startDateTime = new Date(`${entry.dateUtc}T${entry.startUtc}:00Z`);
    const endDateTime = new Date(`${entry.dateUtc}T${entry.endUtc}:00Z`);

    if (endDateTime.getTime() <= startDateTime.getTime()) {
      endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);
    }

    return {
      title: entry.activity,
      startDateTime,
      endDateTime,
      description: [
        `Category: ${entry.category}`,
        entry.withPerson ? `With: ${entry.withPerson}` : "",
        entry.location ? `Location: ${entry.location}` : "",
        entry.notes ? `Notes: ${entry.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      location: entry.location,
      category: entry.category,
      withPerson: entry.withPerson,
      notes: entry.notes,
    };
  });
}
