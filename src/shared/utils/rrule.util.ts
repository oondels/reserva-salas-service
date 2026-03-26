import { RRule } from 'rrule';

export interface OccurrenceSlot {
  startAt: Date;
  endAt: Date;
}

export function expandRecurrence(
  startAt: Date,
  endAt: Date,
  rruleString: string,
  maxOccurrences = 365,
): OccurrenceSlot[] {
  const durationMs = endAt.getTime() - startAt.getTime();

  // Prepend DTSTART to the rrule string to ensure the correct start time is used.
  // Spreading rule.options after fromString without DTSTART causes byhour/byminute/bysecond
  // to be inherited from the parse-time clock, which produces wrong occurrences.
  const dtStartStr = startAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('.000', '');
  const fullRruleString = `DTSTART:${dtStartStr}\n${rruleString}`;

  const rule = RRule.fromString(fullRruleString);

  // Apply maxOccurrences cap when no COUNT is set in the rule
  const ruleWithCap = rule.options.count
    ? rule
    : new RRule({ ...rule.options, count: maxOccurrences });

  const dates = ruleWithCap.all().slice(0, maxOccurrences);

  return dates.map((date) => ({
    startAt: date,
    endAt: new Date(date.getTime() + durationMs),
  }));
}
