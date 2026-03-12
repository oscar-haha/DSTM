export function formatUkDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function formatUkTime(timeStr: string) {
  return timeStr;
}

export function splitLocalDateTime(localIso: string) {
  const [date, time] = localIso.split('T');
  return { date, time };
}

export function formatUkDateTime(localIso: string) {
  const { date, time } = splitLocalDateTime(localIso);
  return `${formatUkDate(date)} · ${formatUkTime(time)}`;
}

export function formatOgDescription(localIso: string, location: string, goingCount: number) {
  const { date, time } = splitLocalDateTime(localIso);
  return `${formatUkDate(date)} ${time}, ${location} • ${goingCount} going`;
}
