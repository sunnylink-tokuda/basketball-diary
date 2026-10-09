import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { validDate, validateStoredAdvice, validateGeneratedAdvice, growthContext, guardPrompt, generationSchema } from './advice.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Sign in required' });
  const allowed = (Deno.env.get('CHAPPY_ALLOWED_USER_IDS') ?? '').split(',').map(id => id.trim()).filter(Boolean);
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!allowed.length || !apiKey) return reply(503, { error: 'Advice is not configured' });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  let date: string | undefined;
  let requestId: string | undefined;
  let userId: string | undefined;
  try {
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply(401, { error: 'Sign in required' });
    // Auth + allowlist + explicit ownership. Never infer ownership from dates.
    if (user.is_anonymous || !allowed.includes(user.id)) return reply(403, { error: 'Not authorized' });
    userId = user.id;
    const raw = await req.text();
    if (raw.length > 1024) return reply(413, { error: 'Request too large' });
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON' }); }
    if (!validDate(body?.date) || !['generate', 'read'].includes(body?.action)) return reply(400, { error: 'Invalid request' });
    date = body.date;
    const { data: source, error: recordError } = await db.rpc('chappy_growth_record', { p_user: user.id, p_date: date });
    const record = source ? { data: source } : null;
    if (recordError) throw new Error('Record read failed');
    if (!record) return reply(404, { error: 'Diary missing or ownership not registered' });
    // Saved advice is preserved, including legacy three-field advice.
    const { data: current, error: currentError } = await db.rpc('chappy_growth_saved', { p_user: user.id, p_date: date });
    if (currentError) throw new Error('Advice read failed');
    if (current) return reply(200, { status: 'ready', advice: validateStoredAdvice(current) });
    if (body.action === 'read') return reply(200, { status: 'missing' });
    const { data: history, error: historyError } = await db.rpc('chappy_growth_history', { p_user: user.id, p_date: date });
    if (historyError) throw new Error('History read failed');
    const context = growthContext(date, record.data, history ?? []);
    const input = JSON.stringify(context);
    requestId = crypto.randomUUID();
    const { data: claim, error: claimError } = await db.rpc('chappy_growth_claim', { p_date: date, p_source: record.data, p_request: requestId, p_user: user.id });
    if (claimError) throw new Error('Claim failed');
    if (claim === 'ready') {
      const { data: cached, error } = await db.rpc('chappy_growth_saved', { p_user: user.id, p_date: date });
      if (error || !cached) return reply(409, { status: 'changed' });
      return reply(200, { status: 'ready', advice: validateStoredAdvice(cached) });
    }
    if (claim !== 'claimed') return reply(claim === 'limited' ? 429 : 409, { status: claim });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini', store: false, max_completion_tokens: 1100,
        messages: [
          { role: 'system', content: guardPrompt },
          { role: 'user', content: input },
        ],
        response_format: { type: 'json_schema', json_schema: {
          name: 'chappy_advice', strict: true,
          schema: generationSchema,
        } },
      }),
    });
    if (!response.ok) throw new Error('Generation failed');
    const completion = await response.json();
    const message = completion.choices?.[0]?.message;
    if (message?.refusal || completion.choices?.[0]?.finish_reason !== 'stop') throw new Error('Incomplete advice');
    const advice = validateGeneratedAdvice(JSON.parse(message.content), context);
    const { data: saved, error: saveError } = await db.rpc('chappy_growth_finish', { p_user: user.id, p_date: date, p_request: requestId, p_advice: advice });
    if (saveError) throw new Error('Advice save failed');
    if (!saved) return reply(409, { status: 'changed' });
    return reply(200, { status: 'ready', advice });
  } catch {
    // Do not log/return diary text, provider response bodies, tokens or secrets.
    try {
      if (date && requestId && userId) await db.from('chappy_growth_advice').update({ request_id: null }).eq('user_id', userId).eq('date', date).eq('request_id', requestId).is('advice', null);
    } catch { /* Cleanup failure must not expose provider or database errors. */ }
    return reply(502, { error: 'Advice unavailable; diary remains saved' });
  }
});
