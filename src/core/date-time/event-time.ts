import { isLocalDate, isTimezone, localDateAt } from './local-date.ts';

export function localTimeAt(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

/** Rejeita horários inexistentes ou ambíguos nas mudanças de horário de verão. */
export function eventInstant(
  date: string,
  time: string,
  timezone: string,
  original?: string,
): string {
  if (!isLocalDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !isTimezone(timezone))
    throw new Error('Informe data, horário e fuso válidos.');
  const matches = (d: Date) =>
    localDateAt(d, timezone) === date && localTimeAt(d, timezone) === time;
  if (original && matches(new Date(original))) return original;
  const wall = Date.parse(`${date}T${time}:00.000Z`);
  const candidates = new Set<string>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = new Date(wall + hours * 3600000);
    const localWall = Date.parse(
      `${localDateAt(probe, timezone)}T${localTimeAt(probe, timezone)}:00Z`,
    );
    const candidate = new Date(wall - (localWall - probe.valueOf()));
    if (matches(candidate)) candidates.add(candidate.toISOString());
  }
  if (candidates.size !== 1)
    throw new Error('Horário inexistente ou ambíguo nesse fuso. Escolha outro horário.');
  return [...candidates][0]!;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return localDateAt(d, 'UTC');
}
