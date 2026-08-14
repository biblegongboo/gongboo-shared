(function() {
  'use strict';

  var config = window.BIBLE_SUPABASE_CONFIG || {};
  var baseUrl = String(config.url || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  var publishableKey = String(config.publishableKey || '');
  var STORAGE_KEY = 'bible_supabase_auth_v1';

  function configured_() {
    return config.enabled === true && !!baseUrl && !!publishableKey;
  }

  function legacyCompatiblePassword_(password) {
    var value = String(password || '');
    return value.length < 6 ? 'GB!' + value : value;
  }

  function readSession_() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function writeSession_(session) {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  }

  async function request_(path, options) {
    var response = await fetch(baseUrl + path, Object.assign({}, options || {}, {
      headers: Object.assign({
        apikey: publishableKey,
        'Content-Type': 'application/json;charset=utf-8'
      }, options && options.headers || {})
    }));
    var data = await response.json().catch(function() { return {}; });
    if (!response.ok) {
      throw new Error(data.msg || data.message || data.error_description || 'Authentication failed.');
    }
    return data;
  }

  async function refresh_() {
    var saved = readSession_();
    if (!saved || !saved.refresh_token) return null;
    var data = await request_('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: saved.refresh_token })
    });
    writeSession_(data);
    return data;
  }

  async function session_() {
    var saved = readSession_();
    if (!saved || !saved.access_token) return null;
    var expiresAt = Number(saved.expires_at || 0);
    if (expiresAt && expiresAt * 1000 < Date.now() + 60000) {
      return refresh_();
    }
    return saved;
  }

  async function profile_(accessToken) {
    var rows = await request_('/rest/v1/rpc/get_my_bible_membership', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken },
      body: '{}'
    });
    if (!Array.isArray(rows) || !rows[0]) {
      throw new Error('Membership profile is unavailable.');
    }
    return rows[0];
  }

  function mapUser_(authUser, profile, authSession) {
    return {
      id: authUser && authUser.id || profile.id,
      name: profile.display_name || '',
      email: profile.email || authUser && authUser.email || '',
      phone: profile.phone || '',
      expired_date: profile.expired_date || '',
      access_subjects: Array.isArray(profile.access_subjects) ? profile.access_subjects : [],
      payment_status: profile.payment_status || '',
      account_type: profile.account_type || 'personal',
      is_trial: profile.is_trial === true,
      trial_start: Number(profile.trial_start || 1),
      trial_limit: Number(profile.trial_limit || 20),
      set_size: Number(profile.set_size || 120),
      active: profile.active !== false,
      session_token: authSession.access_token,
      refresh_token: authSession.refresh_token || ''
    };
  }

  async function signIn(email, password) {
    if (!configured_()) throw new Error('Supabase login is not configured.');
    var data = await request_('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({
        email: email,
        password: legacyCompatiblePassword_(password)
      })
    });
    writeSession_(data);
    var profile = await profile_(data.access_token);
    if (!profile.active) {
      writeSession_(null);
      throw new Error('This account is inactive.');
    }
    return mapUser_(data.user, profile, data);
  }

  async function signUp(email, password, metadata) {
    if (!configured_()) throw new Error('Supabase login is not configured.');
    var data = await request_('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: email,
        password: password,
        data: metadata || {}
      })
    });
    if (data.access_token) writeSession_(data);
    return data;
  }

  async function changePassword(email, oldPassword, newPassword) {
    var login = await request_('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({
        email: email,
        password: legacyCompatiblePassword_(oldPassword)
      })
    });
    await request_('/auth/v1/user', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + login.access_token },
      body: JSON.stringify({ password: newPassword })
    });
    writeSession_(login);
  }

  async function restoreUser() {
    var current = await session_();
    if (!current) return null;
    var profile = await profile_(current.access_token);
    return mapUser_(current.user, profile, current);
  }

  function signOut() {
    writeSession_(null);
    localStorage.removeItem('quiz_current_user_v1');
  }

  // Used only by the organization PIN sign-in page after Supabase has issued
  // a normal Auth session. The PIN itself is never retained in the browser.
  function adoptSession(session) {
    if (!session || !session.access_token || !session.refresh_token) {
      throw new Error('A valid organization session is required.');
    }
    writeSession_(session);
  }

  window.BibleSupabaseAuth = Object.freeze({
    isConfigured: configured_,
    signIn: signIn,
    signUp: signUp,
    changePassword: changePassword,
    restoreUser: restoreUser,
    getSession: session_,
    adoptSession: adoptSession,
    signOut: signOut
  });
})();


