export const achievementOptions = [['done', 'できた'], ['partial', '少しできた'], ['not_yet', 'できなかった']];
export const reflectionFields = [['content', '① 今日の練習・試合内容'], ['good', '③ 今日うまくできたこと'], ['improve', '④ 今日うまくできなかったこと'], ['next', '⑤ 次回の目標']];
export function initialReflection(record = {}) {
  if (record.practiceReflection) return { ...record.practiceReflection, goal_review: { ...record.practiceReflection.goal_review } };
  // Legacy values are copied into an editor only; reading never migrates records.
  const teams = record.teams || (record.team ? [record.team] : []);
  const solos = record.solos || (record.solo ? [record.solo] : []);
  const games = record.games || [];
  const join = values => values.filter(value => typeof value === 'string' && value.trim()).join('\n');
  return {
    content: join([...teams.map(t => t.content), ...solos.map(s => (s.drills || []).join('、')), ...solos.map(s => s.memo), record.daySummary?.memo]),
    good: join([...teams.map(t => t.good), ...games.map(g => g.good), record.daySummary?.good]),
    improve: join([...teams.map(t => t.improve), ...games.map(g => g.reflect), record.daySummary?.reflect]),
    next: join([...teams.map(t => t.next), record.daySummary?.next]),
    goal_review: {},
  };
}
