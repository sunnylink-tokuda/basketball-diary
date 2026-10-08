import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createRecoveryController, recoveryLink } from '../src/passwordRecovery.js';

// Real installed SDK, fake Auth HTTP responses. No email, real token, live
// account, or network is needed. This catches event semantics missed by stubs.
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', email: 'test@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const jwt = () => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'test-only-signature',
].join('.');

function browser(url: string) {
  const b = {
    location: new URL(url),
    sessionStorage: {
      getItem() { throw Error('Safari storage blocked'); },
      setItem() { throw Error('Safari storage blocked'); },
      removeItem() { throw Error('Safari storage blocked'); },
    },
    history: { replaceState(_state, _title, path) { b.location = new URL(path, b.location); } },
  };
  return b;
}

test('real SDK supports fragment/query tokens, token_hash, and PKCE without sending email', async () => {
  for (const kind of ['fragment', 'query', 'token_hash', 'code']) {
    const access = jwt();
    const params = new URLSearchParams({ type: 'recovery', access_token: access, refresh_token: 'test-refresh' });
    const url = kind === 'fragment' ? `https://preview.invalid/#${params}`
      : kind === 'query' ? `https://preview.invalid/?${params}`
      : kind === 'token_hash' ? 'https://preview.invalid/?type=recovery&token_hash=test-hash'
      : 'https://preview.invalid/?code=test-code';
    const requests: { path: string, body: any }[] = [];
    const values = new Map();
    if (kind === 'code') values.set('recovery-test-code-verifier', JSON.stringify('test-verifier/recovery'));
    const client = createClient('https://example.supabase.co', 'test-public-key', {
      auth: { detectSessionInUrl: false, autoRefreshToken: false, persistSession: true, storageKey: 'recovery-test', flowType: kind === 'code' ? 'pkce' : 'implicit', storage: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); },
      } },
      global: { fetch: async (input, options) => {
        const path = new URL(String(input)).pathname;
        const body = options?.body ? JSON.parse(String(options.body)) : null;
        requests.push({ path, body });
        assert.ok(['/auth/v1/user', '/auth/v1/verify', '/auth/v1/token'].includes(path), `Unexpected endpoint ${path}`);
        if (path === '/auth/v1/user') return new Response(JSON.stringify(user), { status: 200 });
        if (path === '/auth/v1/verify') { assert.equal(body.token_hash, 'test-hash'); assert.equal(body.type, 'recovery'); }
        if (path === '/auth/v1/token') { assert.equal(body.auth_code, 'test-code'); assert.equal(body.code_verifier, 'test-verifier'); }
        return new Response(JSON.stringify({ access_token: access, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user }), { status: 200 });
      } },
    });
    const events: string[] = [];
    const subscription = client.auth.onAuthStateChange(event => { events.push(event); });
    const b = browser(url);
    const controller = createRecoveryController(client.auth, b, recoveryLink(b.location));
    await controller.initialized;
    assert.equal(controller.getSnapshot().ready, true, kind);
    assert.equal(controller.getSnapshot().error, false, kind);
    assert.equal(controller.getSnapshot().session.user.id, user.id, kind);
    assert.equal((await client.auth.getSession()).data.session?.user.id, user.id);
    if (kind === 'fragment' || kind === 'query') {
      assert.ok(events.includes('SIGNED_IN'));
      assert.equal(events.includes('PASSWORD_RECOVERY'), false);
    }
    assert.equal(b.location.hash, '');
    assert.equal(b.location.search, '');
    assert.equal(requests.length, 1);
    subscription.data.subscription.unsubscribe();
  }
});

test('real SDK rejects invalid tokens and PKCE without a verifier; no saved-session fallback', async () => {
  let requests = 0;
  const client = createClient('https://example.supabase.co', 'test-public-key', {
    auth: { detectSessionInUrl: false, autoRefreshToken: false, persistSession: false, flowType: 'pkce' },
    global: { fetch: async () => { requests++; return new Response(JSON.stringify({ code: 'otp_expired', msg: 'expired' }), { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } }); } },
  });
  const codeBrowser = browser('https://preview.invalid/?code=test-code');
  const missingVerifier = createRecoveryController(client.auth, codeBrowser, recoveryLink(codeBrowser.location));
  await missingVerifier.initialized;
  assert.equal(missingVerifier.getSnapshot().reason, 'pkce');
  assert.equal(missingVerifier.getSnapshot().session, null);
  assert.equal(requests, 0);
  const invalidBrowser = browser('https://preview.invalid/#type=recovery&access_token=invalid&refresh_token=test');
  const invalid = createRecoveryController(client.auth, invalidBrowser, recoveryLink(invalidBrowser.location));
  await invalid.initialized;
  assert.equal(invalid.getSnapshot().error, true);
  assert.equal(invalid.getSnapshot().session, null);
  assert.equal(requests, 0);
  const expiredBrowser = browser('https://preview.invalid/?type=recovery&token_hash=test-expired');
  const expired = createRecoveryController(client.auth, expiredBrowser, recoveryLink(expiredBrowser.location));
  await expired.initialized;
  assert.equal(expired.getSnapshot().reason, 'expired');
  assert.equal(requests, 1);
});
