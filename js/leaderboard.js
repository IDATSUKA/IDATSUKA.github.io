const Leaderboard = (() => {
  const DB_PREFIX = 'lb_';
  const FIREBASE_APP_JS = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js';
  const FIREBASE_DB_JS = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js';

  let db = null;
  let useFirebase = false;
  let ctx = null; // { os, country, region, code } — collected once, cached for the session
  let firebaseSDKPromise = null;

  // ══ Device / player context ═══════════════════════════════════════════

  function getDeviceId() {
    let id = localStorage.getItem(DB_PREFIX + 'device_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DB_PREFIX + 'device_id', id);
    }
    return id;
  }

  function getName() {
    return localStorage.getItem(DB_PREFIX + 'player_name') || null;
  }

  // Detects a coarse OS family. Prefers the modern userAgentData API and
  // falls back to a small UA-string parser for browsers that don't support it.
  // iPadOS identifies itself as "Mac" in both APIs, so we disambiguate using
  // touch support (real Macs report maxTouchPoints <= 1).
  function detectOS() {
    try {
      const uaData = navigator.userAgentData;
      if (uaData && uaData.platform) {
        const p = String(uaData.platform);
        if (/iphone|ipad|ipod/i.test(p)) return 'iOS';
        if (/android/i.test(p)) return 'Android';
        if (/mac/i.test(p)) return (navigator.maxTouchPoints || 0) > 1 ? 'iOS' : 'macOS';
        if (/win/i.test(p)) return 'Windows';
        if (/cros|chrome ?os/i.test(p)) return 'ChromeOS';
        if (/linux/i.test(p)) return 'Linux';
        return 'Other';
      }
    } catch (e) { /* userAgentData not available */ }

    const ua = (navigator.userAgent || '');
    if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/CrOS/.test(ua)) return 'ChromeOS';
    if (/Mac OS X|Macintosh/.test(ua)) {
      return (navigator.maxTouchPoints || 0) > 1 ? 'iOS' : 'macOS';
    }
    if (/Windows/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Other';
  }

  // Extracts a 2-letter region subtag from a BCP-47 locale string,
  // e.g. "ja-JP" -> "JP", "zh-Hans-CN" -> "CN", "en" -> null.
  function countryFromLocale(loc) {
    if (!loc || typeof loc !== 'string') return null;
    const parts = loc.split('-');
    for (let i = 1; i < parts.length; i++) {
      if (/^[A-Za-z]{2}$/.test(parts[i])) return parts[i].toUpperCase();
    }
    return null;
  }

  // Compact timezone -> country table covering ~40 of the most common IANA zones.
  // Used only as a fallback when the locale string carries no region subtag.
  const TZ_COUNTRY = {
    'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW',
    'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID',
    'Asia/Manila': 'PH', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Kolkata': 'IN',
    'Asia/Dubai': 'AE', 'Asia/Jerusalem': 'IL', 'Asia/Istanbul': 'TR', 'Asia/Karachi': 'PK',
    'Asia/Dhaka': 'BD', 'Asia/Riyadh': 'SA',
    'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES',
    'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Moscow': 'RU', 'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO', 'Europe/Warsaw': 'PL', 'Europe/Zurich': 'CH', 'Europe/Dublin': 'IE',
    'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR', 'Europe/Brussels': 'BE', 'Europe/Vienna': 'AT',
    'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Prague': 'CZ', 'Europe/Kyiv': 'UA',
    'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
    'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX',
    'America/Sao_Paulo': 'BR', 'America/Bogota': 'CO', 'America/Argentina/Buenos_Aires': 'AR',
    'America/Santiago': 'CL', 'America/Lima': 'PE',
    'Africa/Cairo': 'EG', 'Africa/Johannesburg': 'ZA', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE',
    'Africa/Casablanca': 'MA',
    'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Perth': 'AU',
    'Pacific/Auckland': 'NZ',
  };

  // Country -> region fallback, used when the timezone continent segment
  // itself doesn't map cleanly (or is unavailable).
  const COUNTRY_REGION = {
    JP: 'Asia', CN: 'Asia', HK: 'Asia', TW: 'Asia', KR: 'Asia', SG: 'Asia', TH: 'Asia', ID: 'Asia',
    PH: 'Asia', MY: 'Asia', VN: 'Asia', IN: 'Asia', AE: 'Asia', IL: 'Asia', TR: 'Asia', PK: 'Asia',
    BD: 'Asia', SA: 'Asia',
    GB: 'Europe', FR: 'Europe', DE: 'Europe', ES: 'Europe', IT: 'Europe', NL: 'Europe', RU: 'Europe',
    SE: 'Europe', NO: 'Europe', PL: 'Europe', CH: 'Europe', IE: 'Europe', PT: 'Europe', GR: 'Europe',
    BE: 'Europe', AT: 'Europe', DK: 'Europe', FI: 'Europe', CZ: 'Europe', UA: 'Europe',
    US: 'Americas', CA: 'Americas', MX: 'Americas', BR: 'Americas', CO: 'Americas', AR: 'Americas',
    CL: 'Americas', PE: 'Americas',
    EG: 'Africa', ZA: 'Africa', NG: 'Africa', KE: 'Africa', MA: 'Africa',
    AU: 'Oceania', NZ: 'Oceania', FJ: 'Oceania',
  };

  // Returns a region from the timezone's continent segment, or null when the
  // segment carries no real geographic info (e.g. "Etc/UTC") — in that case
  // the caller falls back to the country -> region table instead.
  function regionFromTimezone(tz) {
    if (!tz || typeof tz !== 'string') return null;
    const seg = tz.split('/')[0];
    if (seg === 'Asia') return 'Asia';
    if (seg === 'Europe') return 'Europe';
    if (seg === 'America') return 'Americas';
    if (seg === 'Africa') return 'Africa';
    if (seg === 'Australia' || seg === 'Pacific') return 'Oceania';
    return null;
  }

  // Simple, dependency-free, deterministic string hash (two rounds of FNV-1a)
  // producing 16 stable hex digits. Not cryptographic — only used to derive a
  // shareable friend code from the device id.
  function hashString(str) {
    let h1 = 0x811c9dc5, h2 = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 ^= c; h1 = Math.imul(h1, 0x01000193);
      h2 ^= (c + i); h2 = Math.imul(h2, 0x01000193);
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }

  // Friend code: first 8 chars of the device-id hash, formatted XXXX-XXXX (uppercase).
  function friendCodeFromDeviceId(deviceId) {
    const eight = hashString(deviceId).toUpperCase().slice(0, 8);
    return eight.slice(0, 4) + '-' + eight.slice(4, 8);
  }

  function buildContext() {
    const os = detectOS();

    let country = countryFromLocale(navigator.language);
    if (!country && Array.isArray(navigator.languages)) {
      for (const l of navigator.languages) {
        country = countryFromLocale(l);
        if (country) break;
      }
    }

    let tz = null;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignore */ }

    if (!country && tz && TZ_COUNTRY[tz]) country = TZ_COUNTRY[tz];
    if (!country) country = 'ZZ';

    const region = regionFromTimezone(tz) || COUNTRY_REGION[country] || 'Other';
    const code = friendCodeFromDeviceId(getDeviceId());

    return { os, country, region, code };
  }

  function getContext() {
    if (!ctx) ctx = buildContext();
    return ctx;
  }

  function getFriendCode() {
    return getContext().code;
  }

  // ══ Firebase bootstrap ════════════════════════════════════════════════

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function loadFirebaseSDK() {
    if (typeof firebase !== 'undefined' && firebase.apps) return Promise.resolve();
    if (!firebaseSDKPromise) {
      firebaseSDKPromise = loadScript(FIREBASE_APP_JS).then(() => loadScript(FIREBASE_DB_JS));
    }
    return firebaseSDKPromise;
  }

  // init() accepts an explicit Firebase config, but falls back to
  // window.FIREBASE_CONFIG (set by js/firebase-config.js) so that game pages
  // which call Leaderboard.init() with no arguments go online automatically
  // once a config is pasted in — no per-page edits required.
  async function init(firebaseConfig) {
    const cfg = firebaseConfig || (typeof window !== 'undefined' ? window.FIREBASE_CONFIG : null);
    if (cfg && cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY') {
      try {
        await loadFirebaseSDK();
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        db = firebase.database();
        useFirebase = true;
      } catch (e) {
        console.warn('Firebase init failed, using localStorage', e);
        useFirebase = false;
        db = null;
      }
    }
    getDeviceId();
    getContext();
  }

  async function registerName(name) {
    name = name.trim();
    if (!name || name.length > 16) return { ok: false, msg: '名前は1〜16文字で入力してください' };
    if (!/^[a-zA-Z0-9぀-ゟ゠-ヿ一-鿿_\-]+$/.test(name)) {
      return { ok: false, msg: '使用できない文字が含まれています' };
    }

    const deviceId = getDeviceId();
    const currentName = getName();

    if (currentName === name) return { ok: true };

    if (useFirebase) {
      const ref = db.ref('names/' + name);
      const snap = await ref.get();
      if (snap.exists() && snap.val().deviceId !== deviceId) {
        return { ok: false, msg: 'この名前は既に使われています' };
      }
      if (currentName && currentName !== name) {
        await db.ref('names/' + currentName).remove();
      }
      await ref.set({ deviceId, createdAt: Date.now() });
    } else {
      const names = JSON.parse(localStorage.getItem(DB_PREFIX + 'names') || '{}');
      if (names[name] && names[name] !== deviceId) {
        return { ok: false, msg: 'この名前は既に使われています' };
      }
      if (currentName && currentName !== name) delete names[currentName];
      names[name] = deviceId;
      localStorage.setItem(DB_PREFIX + 'names', JSON.stringify(names));
    }

    localStorage.setItem(DB_PREFIX + 'player_name', name);
    return { ok: true };
  }

  async function submitScore(game, score) {
    const name = getName();
    if (!name) return { ok: false, msg: '名前を登録してください' };

    const c = getContext();
    const entry = {
      name,
      score,
      deviceId: getDeviceId(),
      code: c.code,
      os: c.os,
      country: c.country,
      region: c.region,
      date: new Date().toISOString(),
    };

    if (useFirebase) {
      const ref = db.ref('scores/' + game);
      const snap = await ref.orderByChild('name').equalTo(name).limitToFirst(1).get();
      let existing = null;
      snap.forEach(child => { existing = { key: child.key, ...child.val() }; });

      if (existing && existing.score >= score) {
        return { ok: true, isNew: false, best: existing.score };
      }
      if (existing) {
        await ref.child(existing.key).set(entry);
      } else {
        await ref.push(entry);
      }
      return { ok: true, isNew: true, best: score };
    } else {
      const key = DB_PREFIX + 'scores_' + game;
      const scores = JSON.parse(localStorage.getItem(key) || '[]');
      const idx = scores.findIndex(s => s.name === name);

      if (idx >= 0 && scores[idx].score >= score) {
        return { ok: true, isNew: false, best: scores[idx].score };
      }
      if (idx >= 0) {
        scores[idx] = entry;
      } else {
        scores.push(entry);
      }
      scores.sort((a, b) => b.score - a.score);
      localStorage.setItem(key, JSON.stringify(scores));
      return { ok: true, isNew: true, best: score };
    }
  }

  // ══ Friends ════════════════════════════════════════════════════════════

  function normalizeCode(code) {
    return (code || '').trim().toUpperCase();
  }

  function isValidCode(code) {
    return /^[0-9A-F]{4}-[0-9A-F]{4}$/.test(normalizeCode(code));
  }

  function getFriends() {
    try {
      return JSON.parse(localStorage.getItem(DB_PREFIX + 'friends') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveFriends(list) {
    localStorage.setItem(DB_PREFIX + 'friends', JSON.stringify(list));
  }

  function addFriend(code) {
    const c = normalizeCode(code);
    if (!isValidCode(c)) return { ok: false, msg: 'コードの形式が正しくありません（例: XXXX-XXXX）' };
    if (c === getFriendCode()) return { ok: false, msg: '自分のコードは追加できません' };
    const friends = getFriends();
    if (friends.includes(c)) return { ok: false, msg: 'すでに追加されています' };
    friends.push(c);
    saveFriends(friends);
    return { ok: true, friends };
  }

  function removeFriend(code) {
    const c = normalizeCode(code);
    const friends = getFriends().filter(f => f !== c);
    saveFriends(friends);
    return { ok: true, friends };
  }

  // ══ Rankings / filters ═══════════════════════════════════════════════
  //
  // Firebase mode: we always query `orderByChild('score').limitToLast(300)`
  // — a single-key ordering that Realtime Database can serve without any
  // composite index — then apply the os/region/country/friends filter and
  // the requested `limit` client-side. For the score volumes this site
  // expects (a handful of hundreds of entries per game) this keeps reads
  // cheap while avoiding any index configuration in the Firebase console.

  async function fetchAllScores(game) {
    if (useFirebase) {
      const snap = await db.ref('scores/' + game).orderByChild('score').limitToLast(300).get();
      const results = [];
      snap.forEach(c => results.push(c.val()));
      return results;
    }
    const key = DB_PREFIX + 'scores_' + game;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  function matchesFilter(entry, filter) {
    if (!filter || filter.scope === 'all') return true;
    switch (filter.scope) {
      case 'os':
        return !!entry.os && entry.os === filter.os;
      case 'region':
        return !!entry.region && entry.region === filter.region;
      case 'country':
        return !!entry.country && entry.country === filter.country;
      case 'friends': {
        const friends = getFriends();
        return !!entry.code && friends.includes(entry.code);
      }
      default:
        return true;
    }
  }

  function sortAndFilter(all, filter) {
    const sorted = all.slice().sort((a, b) => b.score - a.score);
    return sorted.filter(e => matchesFilter(e, filter));
  }

  async function getRankings(game, limit = 20, filter = { scope: 'all' }) {
    const all = await fetchAllScores(game);
    return sortAndFilter(all, filter).slice(0, limit);
  }

  async function getAllGamesRankings(limit = 10) {
    const games = ['void-runner', 'signal', 'orbit', 'stack'];
    const result = {};
    for (const g of games) {
      result[g] = await getRankings(g, limit);
    }
    return result;
  }

  // Returns { rank, total } for the current player within the given scope,
  // or null if no name is registered / player has no score in that scope.
  async function getRank(game, filter = { scope: 'all' }) {
    const name = getName();
    if (!name) return null;
    const all = await fetchAllScores(game);
    const filtered = sortAndFilter(all, filter);
    const idx = filtered.findIndex(e => e.name === name);
    return { rank: idx >= 0 ? idx + 1 : null, total: filtered.length };
  }

  function isFirebaseActive() { return useFirebase; }

  return {
    init,
    getDeviceId,
    getName,
    registerName,
    submitScore,
    getRankings,
    getAllGamesRankings,
    getRank,
    isFirebaseActive,
    getContext,
    getFriendCode,
    getFriends,
    addFriend,
    removeFriend,
  };
})();
