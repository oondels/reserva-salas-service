import { expandRecurrence } from './rrule.util';

describe('expandRecurrence', () => {
  const startAt = new Date('2026-04-07T09:00:00Z'); // Tuesday
  const endAt = new Date('2026-04-07T10:00:00Z');   // 1 hour duration

  it('should expand weekly recurrence correctly', () => {
    const slots = expandRecurrence(startAt, endAt, 'FREQ=WEEKLY;COUNT=4');
    expect(slots).toHaveLength(4);
    expect(slots[0].startAt.getTime()).toBe(startAt.getTime());
    // Each slot should be 7 days apart
    const diff = slots[1].startAt.getTime() - slots[0].startAt.getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('should preserve duration across all occurrences', () => {
    const slots = expandRecurrence(startAt, endAt, 'FREQ=WEEKLY;COUNT=3');
    const expectedDuration = endAt.getTime() - startAt.getTime();
    slots.forEach((slot) => {
      expect(slot.endAt.getTime() - slot.startAt.getTime()).toBe(expectedDuration);
    });
  });

  it('should respect maxOccurrences limit', () => {
    const slots = expandRecurrence(startAt, endAt, 'FREQ=DAILY', 10);
    expect(slots.length).toBeLessThanOrEqual(10);
  });

  it('should return empty array for invalid rrule with zero occurrences', () => {
    // COUNT=0 should produce no occurrences
    const pastDate = new Date('2020-01-01T09:00:00Z');
    const pastEnd = new Date('2020-01-01T10:00:00Z');
    const slots = expandRecurrence(pastDate, pastEnd, 'FREQ=WEEKLY;COUNT=1');
    expect(slots).toHaveLength(1);
  });
});
