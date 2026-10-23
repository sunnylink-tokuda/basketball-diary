export type PreviousGoal = { date: string; goal: string };
export type GoalReview = { date: string | null; goal: string | null; status: 'done' | 'partial' | 'not_yet' | 'unknown' | 'no_goal'; comment: string };
export type CycleAdvice = { practice_advice: string; priority_goal: string; previous_goal_review: GoalReview };
export const cycleKeys = ['practice_advice', 'priority_goal', 'previous_goal_review'];

export function validateCycleStored(obj: Record<string, unknown>): CycleAdvice {
  const short = (v: unknown, max: number) => typeof v === 'string' && !!v.trim() && [...v].length <= max;
  const review = obj.previous_goal_review as GoalReview;
  if (!short(obj.practice_advice, 120) || !short(obj.priority_goal, 120) || obj.priority_goal !== obj.mission || !review || typeof review !== 'object' || Object.keys(review).length !== 4 || !['done', 'partial', 'not_yet', 'unknown', 'no_goal'].includes(review.status) || !short(review.comment, 160)) throw new Error('Invalid goal cycle');
  if (review.status === 'no_goal' ? review.date !== null || review.goal !== null : typeof review.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(review.date) || !short(review.goal, 120)) throw new Error('Invalid previous goal');
  return { practice_advice: obj.practice_advice as string, priority_goal: obj.priority_goal as string, previous_goal_review: review };
}

export function assessGoalCycle(value: unknown, mission: string, focus: string, previous: PreviousGoal | null, input: unknown): CycleAdvice {
  const obj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const validPractice = typeof value === 'string' && value.trim() && [...value].length <= 120;
  let status: GoalReview['status'] = previous ? 'unknown' : 'no_goal';
  if (previous && obj.goal_date === previous.date && obj.goal === previous.goal && ['done', 'partial', 'not_yet'].includes(obj.status as string)) status = obj.status as GoalReview['status'];
  const comments = {
    done: '「できた」と振り返ったね。どの場面で試せたかも次の日記に書くと、変化を確かめやすいよ。',
    partial: '「少しできた」と振り返ったね。試せた場面を大切にして、次も同じ場面で1回試そう。',
    not_yet: '「できなかった」と振り返ったね。責めなくて大丈夫。次は試す場面を1つに絞ろう。',
    unknown: '前の目標を試せたかは、まだ確認できないよ。日記の「前回のアドバイスを実践できた？」で教えてね。',
    no_goal: '前回の目標はありません。今回の重点目標から始めよう。',
  };
  return { practice_advice: validPractice ? (value as string).trim() : focus, priority_goal: mission, previous_goal_review: { date: previous?.date ?? null, goal: previous?.goal ?? null, status, comment: comments[status] } };
}
