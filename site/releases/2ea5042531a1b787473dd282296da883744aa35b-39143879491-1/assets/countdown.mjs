// The date is known; the ceremony time is not. Count down to the start of
// the wedding day in France (CEST), independently of the visitor’s timezone.
export const WEDDING_START = Date.parse('2028-06-10T00:00:00+02:00');
export const WEDDING_END = Date.parse('2028-06-11T00:00:00+02:00');

export function getCountdown(now = Date.now()) {
  if (!Number.isFinite(now)) throw new TypeError('La date doit être un timestamp valide.');
  const totalSeconds = Math.max(0, Math.ceil((WEDDING_START - now) / 1000));
  return {
    state: now < WEDDING_START ? 'upcoming' : now < WEDDING_END ? 'today' : 'past',
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  };
}
