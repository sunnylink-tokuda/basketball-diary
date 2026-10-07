export const adviceKeys = ['good', 'focus', 'mission'] as const;
export type Advice = Record<typeof adviceKeys[number], string>;

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateAdvice(value: unknown): Advice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid advice');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== 3 || adviceKeys.some(key => typeof result[key] !== 'string' || !(result[key] as string).trim() || [...(result[key] as string)].length > 120)) throw new Error('Invalid advice');
  return Object.fromEntries(adviceKeys.map(key => [key, (result[key] as string).trim()])) as Advice;
}

// Only basketball and reflection fields leave Supabase. Exclude money, parent
// comments, team names, opponents, timestamps, and unrelated profile data.
export function diaryInput(record: Record<string, unknown>) {
  const pick = (value: unknown, fields: string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(fields.filter(key => obj[key] !== undefined).map(key => [key, obj[key]]));
  };
  const list = (value: unknown, fields: string[]) => Array.isArray(value) ? value.slice(0, 20).map(item => pick(item, fields)) : [];
  return {
    solos: list(record.solos ?? (record.solo ? [record.solo] : []), ['drills', 'memo']),
    teams: list(record.teams ?? (record.team ? [record.team] : []), ['content', 'taught', 'good', 'improve', 'next']),
    training: pick(record.training, ['menus']),
    games: list(record.games, ['playTime', 'shot2a', 'shot2m', 'shot3a', 'shot3m', 'fta', 'ftm', 'ast', 'reb', 'stl', 'tov', 'foul', 'good', 'reflect']),
    daySummary: pick(record.daySummary, ['memo', 'good', 'reflect', 'next']),
  };
}
