const markerKey = 'basketball-diary-password-recovery';
const sensitive = ['access_token', 'refresh_token', 'token_hash', 'token', 'code', 'type', 'expires_in', 'expires_at', 'token_type', 'error', 'error_code', 'error_description', 'sb_flow_id'];

// Snapshot before any SDK initialization clears the callback URL. Never log it.
export function recoveryLink(location) {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  const get = key => hash.get(key) ?? query.get(key);
  const type = get('type');
  const invalid = ['error', 'error_code', 'error_description'].some(key => get(key) !== null);
  const expired = ['otp_expired', 'refresh_token_not_found', 'refresh_token_already_used'].includes(get('error_code'));
  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  const tokenHash = get('token_hash');
  const code = get('code');
  // This app supports password login, not OAuth callbacks. A bare PKCE code
  // callback is handled here; its verifier must exist in the sending browser.
  const recovery = invalid || type === 'recovery' || (!type && Boolean(accessToken || refreshToken || code));
  let kind = 'none';
  if (recovery) {
    if (invalid) kind = 'error';
    else if (accessToken && refreshToken) kind = 'tokens';
    else if (tokenHash && type === 'recovery') kind = 'token_hash';
    else if (code) kind = 'code';
    else kind = 'malformed';
  }
  return { recovery, invalid, kind, accessToken, refreshToken, tokenHash, code, flowId: get('sb_flow_id'), errorReason: expired ? 'expired' : 'session' };
}

export function createRecoveryController(auth, browser, link) {
  const storage = (method, ...args) => {
    try { return browser.sessionStorage[method](...args); } catch { return null; }
  };
  const cleanUrl = () => {
    try {
      const url = new URL(browser.location.href);
      sensitive.forEach(key => url.searchParams.delete(key));
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      sensitive.forEach(key => hash.delete(key));
      url.hash = hash.toString();
      browser.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch { /* A history restriction must not prevent authentication. */ }
  };
  let confirmed = !link.recovery && storage('getItem', markerKey) === 'pending';
  let state = { ready: false, recovery: link.recovery || confirmed, session: null, error: false, reason: null };
  let recoveryEventObserved = false;
  const listeners = new Set();
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const accept = session => {
    confirmed = true;
    storage('setItem', markerKey, 'pending');
    publish({ recovery: true, session, error: !session, reason: session ? null : 'session' });
  };
  // No Auth API calls inside the event callback (avoids auth-lock deadlocks).
  auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && !link.recovery) {
      recoveryEventObserved = true;
      accept(session);
    } else if (state.recovery && !link.recovery) {
      recoveryEventObserved = true;
      publish({ session, error: state.ready && (!session || !confirmed), reason: !session ? 'session' : null });
    } else if (state.ready && confirmed && state.recovery && ['USER_UPDATED', 'TOKEN_REFRESHED', 'SIGNED_OUT'].includes(event)) {
      publish({ session, error: !session, reason: !session ? 'session' : null });
    }
  });
  const initialized = (async () => {
    if (!link.recovery) {
      try {
        const { data, error } = await auth.getSession();
        const session = state.recovery && recoveryEventObserved ? state.session : data?.session ?? null;
        publish({ ready: true, session, error: state.recovery && (Boolean(error) || !confirmed || !session), reason: error || !session ? 'session' : null });
      } catch { publish({ ready: true, session: null, error: state.recovery, reason: 'network' }); }
      return;
    }
    // SDK auto-URL handling is disabled for this callback, so exactly one
    // explicit request consumes a code/token. Clear sensitive URL material now.
    cleanUrl();
    const kind = link.kind;
    try {
      let result;
      if (kind === 'tokens') result = await auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
      else if (kind === 'token_hash') result = await auth.verifyOtp({ token_hash: link.tokenHash, type: 'recovery' });
      else if (kind === 'code') result = await auth.exchangeCodeForSession(link.code, link.flowId ? { flowId: link.flowId } : undefined);
      else {
        publish({ ready: true, error: true, reason: kind === 'error' ? link.errorReason : 'format', session: null });
        return;
      }
      if (result.error || !result.data?.session) {
        const code = result.error?.code;
        const reason = ['flow_state_not_found', 'bad_code_verifier', 'flow_state_expired', 'pkce_verifier_missing', 'pkce_code_verifier_not_found'].includes(code) ? 'pkce'
          : ['otp_expired', 'refresh_token_not_found', 'refresh_token_already_used'].includes(code) ? 'expired'
          : result.error?.status === 0 || result.error?.name === 'AuthRetryableFetchError' ? 'network' : 'session';
        publish({ ready: true, error: true, reason, session: null });
        return;
      }
      // The API response validates the new link, regardless of whether the SDK
      // emits SIGNED_IN, INITIAL_SESSION, PASSWORD_RECOVERY, or a delayed event.
      accept(result.data.session);
      publish({ ready: true });
    } catch { publish({ ready: true, error: true, reason: 'network', session: null }); }
    finally {
      link.accessToken = link.refreshToken = link.tokenHash = link.code = link.flowId = null;
    }
  })();
  return {
    initialized,
    getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    complete: () => {
      storage('removeItem', markerKey);
      confirmed = false;
      cleanUrl();
      publish({ recovery: false, error: false, reason: null });
    },
  };
}
