/* ═══════════════════════════════════════════
   billing.js — 請求書・見積書・領収書で共有する計算コア
   ここを一箇所にしておかないと、書類ごとに税額がズレる。
   ═══════════════════════════════════════════ */
(function (global) {
  'use strict';

  var WH_RATE      = 0.1021;    // 源泉徴収税率
  var WH_RATE_HI   = 0.2042;    // 100万円を超える部分
  var WH_THRESHOLD = 1000000;

  function yen(n) { return '¥' + Math.round(n).toLocaleString('ja-JP'); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function jpDate(v) {
    if (!v) return '';
    var p = String(v).split('-');
    if (p.length < 3) return '';
    return p[0] + '年' + (+p[1]) + '月' + (+p[2]) + '日';
  }

  function blankItem() { return { desc: '', qty: 1, price: 0, rate: 10 }; }

  /* 消費税の端数処理は「1つの書類につき、税率ごとに1回」。
     行ごとに丸めるのはインボイス制度の要件違反になる。 */
  function calc(items, opts) {
    opts = opts || {};
    var groups = {}, lines = [];

    (items || []).forEach(function (it) {
      var amount = (+it.qty || 0) * (+it.price || 0);
      lines.push({ desc: it.desc, qty: it.qty, price: it.price, rate: +it.rate, amount: amount });
      if (!amount && !it.desc) return;
      groups[it.rate] = (groups[it.rate] || 0) + amount;
    });

    var subtotal = 0, tax = 0;
    var perRate = [10, 8, 0]
      .filter(function (r) { return groups[r] !== undefined; })
      .map(function (r) {
        var base = groups[r];
        var t = Math.floor(base * r / 100);   // 税率ごとに1回だけ切り捨て
        subtotal += base; tax += t;
        return { rate: r, base: base, tax: t };
      });

    var total = subtotal + tax;

    /* 源泉徴収は、消費税額が明確に区分されている場合は税抜額に対して計算できる。
       本ツールは税率ごとに区分表示しているため税抜額（subtotal）を基礎とする。 */
    var wh = 0;
    if (opts.withholding) {
      wh = subtotal <= WH_THRESHOLD
        ? Math.floor(subtotal * WH_RATE)
        : Math.floor(WH_THRESHOLD * WH_RATE + (subtotal - WH_THRESHOLD) * WH_RATE_HI);
    }

    return {
      lines: lines, perRate: perRate,
      subtotal: subtotal, tax: tax, total: total,
      wh: wh, grand: total - wh,
      hasReduced: perRate.some(function (g) { return g.rate === 8; }),
      hasTaxable: perRate.some(function (g) { return g.rate > 0; })
    };
  }

  /* 明細行の合計欄（請求書・見積書で共通の見た目） */
  function sumRows(c, grandLabel) {
    var rows = ['<tr><td class="k">小計</td><td class="v">' + yen(c.subtotal) + '</td></tr>'];
    c.perRate.forEach(function (g) {
      if (g.rate === 0) {
        rows.push('<tr><td class="k">　非課税対象</td><td class="v">' + yen(g.base) + '</td></tr>');
      } else {
        rows.push('<tr><td class="k">　' + g.rate + '% 対象</td><td class="v">' + yen(g.base) + '</td></tr>');
        rows.push('<tr><td class="k">　消費税（' + g.rate + '%）</td><td class="v">' + yen(g.tax) + '</td></tr>');
      }
    });
    rows.push('<tr><td class="k">合計（税込）</td><td class="v">' + yen(c.total) + '</td></tr>');
    if (c.wh > 0) rows.push('<tr class="wh"><td class="k">源泉徴収税</td><td class="v">- ' + yen(c.wh) + '</td></tr>');
    rows.push('<tr class="grand"><td>' + (grandLabel || 'ご請求金額') + '</td><td class="v">' + yen(c.grand) + '</td></tr>');
    return rows.join('');
  }

  /* 明細テーブルの本体 */
  function itemRows(c, emptyText) {
    var html = c.lines.map(function (l) {
      if (!l.desc && !l.amount) return '';
      return '<tr>' +
        '<td>' + esc(l.desc) + (l.rate === 8 ? ' ※' : '') + '</td>' +
        '<td class="n">' + (l.qty || '') + '</td>' +
        '<td class="n">' + (l.price ? yen(l.price) : '') + '</td>' +
        '<td class="c">' + (l.rate === 0 ? '—' : l.rate + '%') + '</td>' +
        '<td class="n">' + yen(l.amount) + '</td>' +
        '</tr>';
    }).join('');
    return html || '<tr><td colspan="5" style="color:#aaa;text-align:center;padding:8mm 0;">' +
                   (emptyText || '品目を入力してください') + '</td></tr>';
  }

  /* A4プレビューを列幅に合わせて縮小（印刷時はCSS側で等倍に戻す） */
  function fitPreview(wrapId, docId) {
    var wrap = document.getElementById(wrapId), doc = document.getElementById(docId);
    if (!wrap || !doc) return;
    var col = wrap.parentElement;
    wrap.style.transform = 'none';
    wrap.style.height = 'auto';
    var avail = col.clientWidth, natural = doc.offsetWidth;
    if (!avail || !natural) return;
    var k = Math.min(1, avail / natural);
    wrap.style.transform = 'scale(' + k + ')';
    wrap.style.height = (doc.offsetHeight * k) + 'px';
  }

  /* 書類番号の連番を1つ進める（末尾の数字部分のみ、桁は維持） */
  function nextNumber(no) {
    var m = String(no || '').match(/^(.*?)(\d+)$/);
    return m ? m[1] + String(+m[2] + 1).padStart(m[2].length, '0') : '';
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function store(key) {
    return {
      save: function (data) {
        try { localStorage.setItem(key, JSON.stringify(data)); return true; }
        catch (e) { return false; }
      },
      load: function () {
        try {
          var raw = localStorage.getItem(key);
          if (!raw) return null;
          var got = JSON.parse(raw);
          return (got && typeof got === 'object') ? got : null;
        } catch (e) { return null; }
      },
      clear: function () { try { localStorage.removeItem(key); } catch (e) {} }
    };
  }

  global.Billing = {
    WH_RATE: WH_RATE, WH_RATE_HI: WH_RATE_HI, WH_THRESHOLD: WH_THRESHOLD,
    yen: yen, esc: esc, jpDate: jpDate, blankItem: blankItem,
    calc: calc, sumRows: sumRows, itemRows: itemRows,
    fitPreview: fitPreview, nextNumber: nextNumber, today: today, store: store
  };
})(window);
