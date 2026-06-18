const Leaderboard = (() => {
  const DB_PREFIX = 'lb_';
  let db = null;
  let useFirebase = false;

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

  async function init(firebaseConfig) {
    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
      try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        useFirebase = true;
      } catch (e) {
        console.warn('Firebase init failed, using localStorage', e);
      }
    }
    getDeviceId();
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

    const entry = { name, score, deviceId: getDeviceId(), date: new Date().toISOString() };

    if (useFirebase) {
      const ref = db.ref('scores/' + game);
      const snap = await ref.orderByChild('name').equalTo(name).limitToFirst(1).get();
      let existing = null;
      snap.forEach(c => { existing = { key: c.key, ...c.val() }; });

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

  async function getRankings(game, limit = 20) {
    if (useFirebase) {
      const snap = await db.ref('scores/' + game).orderByChild('score').limitToLast(limit).get();
      const results = [];
      snap.forEach(c => results.push(c.val()));
      results.sort((a, b) => b.score - a.score);
      return results;
    } else {
      const key = DB_PREFIX + 'scores_' + game;
      const scores = JSON.parse(localStorage.getItem(key) || '[]');
      scores.sort((a, b) => b.score - a.score);
      return scores.slice(0, limit);
    }
  }

  async function getAllGamesRankings(limit = 10) {
    const games = ['void-runner', 'signal', 'lattice'];
    const result = {};
    for (const g of games) {
      result[g] = await getRankings(g, limit);
    }
    return result;
  }

  function isFirebaseActive() { return useFirebase; }

  return { init, getDeviceId, getName, registerName, submitScore, getRankings, getAllGamesRankings, isFirebaseActive };
})();
