const markerKey = 'basketball-diary-password-recovery';

// Capture before the SDK consumes/removes the URL fragment. This is UI intent,
// never authentication: a new recovery link still needs PASSWORD_RECOVERY.
export function recoveryLink(location) {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  return {
    recovery: hash.get('type') === 'recovery' || query.get('type') === 'recovery',
    invalid: hash.has('error') || hash.has('error_code') || query.has('error') || query.has('error_code'),
  };
}

export function createRecoveryController(auth, browser, link) {
  const storage = (method, ...args) => {
    try { return browser.sessionStorage[method](...args); } catch { return null; }
  };
  let confirmed = !link.recovery && !link.invalid && storage('getItem', markerKey) === 'pending';
  let state = { ready: false, recovery: link.recovery || link.invalid || confirmed, session: null, error: false };
  let recoveryEventObserved = false;
  const listeners = new Set();
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  // Registered once, outside React, before any page mounts. Callback never
  // awaits another Auth API (avoids SDK auth-lock deadlocks).
  auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryEventObserved = true;
      confirmed = true;
      storage('setItem', markerKey, 'pending');
      publish({ recovery: true, session, error: !session });
    } else if (state.recovery) {
      recoveryEventObserved = true;
      publish({ session, error: state.ready && (!session || !confirmed) });
    }
  });
  const initialized = auth.getSession().then(({ data, error }) => {
    const session = state.recovery && recoveryEventObserved ? state.session : data?.session ?? null;
    publish({ ready: true, session, error: state.recovery && (Boolean(error) || !confirmed || !session) });
  }).catch(() => publish({ ready: true, session: null, error: state.recovery }));
  return {
    initialized,
    getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    complete: () => {
      storage('removeItem', markerKey);
      confirmed = false;
      // Expired-link errors may remain in the URL; do not retain auth material.
      const url = new URL(browser.location.href);
      for (const key of ['type', 'code', 'token_hash', 'error', 'error_code', 'error_description']) url.searchParams.delete(key);
      url.hash = '';
      browser.history.replaceState(null, '', url.pathname + url.search);
      publish({ recovery: false, error: false });
    },
  };
}
