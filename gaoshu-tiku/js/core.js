/* 高数题库 · 通用逻辑（存储 / 渲染 / 导航） */
(function () {
  'use strict';

  var KEY = 'gskb_v2';
  var OLD_KEYS = ['gskb_v1', 'gskb'];

  var CHAPTERS = {
    A: { key: 'A', name: '1 极限与连续', short: '极限与连续', total: 382 },
    B: { key: 'B', name: '2 导数与微分', short: '导数与微分', total: 354 }
  };

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function blankState() {
    return { version: 2, createdAt: Date.now(), records: {}, wrong: {}, last: null };
  }

  function migrate(old) {
    var st = blankState();
    if (!old || typeof old !== 'object') return st;
    // 只做字段映射，不覆盖新数据（新 key 优先）
    var recs = old.records || old.progress || {};
    Object.keys(recs).forEach(function (id) {
      var r = recs[id];
      if (!r) return;
      st.records[id] = {
        status: 'done',
        correct: typeof r.correct === 'boolean' ? r.correct : null,
        selected: r.selected || '',
        self: r.self || '',
        ts: r.ts || Date.now()
      };
    });
    var wr = old.wrong || old.wrongbook || {};
    (Array.isArray(wr) ? wr : Object.keys(wr)).forEach(function (id) {
      if (id) st.wrong[id] = { ts: Date.now(), auto: false };
    });
    if (old.last) st.last = old.last;
    return st;
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (raw) {
      var d = safeParse(raw);
      if (d && typeof d === 'object') {
        d.version = 2;
        d.records = d.records || {};
        d.wrong = d.wrong || {};
        return d;
      }
    }
    for (var i = 0; i < OLD_KEYS.length; i++) {
      try {
        var oldRaw = localStorage.getItem(OLD_KEYS[i]);
        if (oldRaw) {
          var old = safeParse(oldRaw);
          if (old) {
            var st = migrate(old);
            save(st);
            return st;
          }
        }
      } catch (e) {}
    }
    return blankState();
  }

  var state = load();

  function save(st) {
    state = st || state;
    state.version = 2;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      toast('浏览器存储不可用，进度无法保存');
      return false;
    }
  }

  function getRecord(id) { return state.records[id] || null; }

  function setRecord(id, patch) {
    var old = state.records[id] || { status: 'done', correct: null, selected: '', self: '', ts: 0 };
    state.records[id] = Object.assign(old, patch, { status: 'done', ts: Date.now() });
    save();
    return state.records[id];
  }

  function removeRecord(id) {
    if (state.records[id]) { delete state.records[id]; save(); }
  }

  function isWrong(id) { return !!state.wrong[id]; }

  function addWrong(id, auto) {
    if (!state.wrong[id]) state.wrong[id] = { ts: Date.now(), auto: !!auto };
    save();
  }

  function removeWrong(id) {
    if (state.wrong[id]) { delete state.wrong[id]; save(); }
  }

  function toggleWrong(id) {
    if (isWrong(id)) { removeWrong(id); return false; }
    addWrong(id, false); return true;
  }

  function questions() { return window.QUESTIONS || []; }
  function meta() { return window.BANK_META || { groups: [], chapters: [] }; }
  function byId(id) { return questions().find(function (q) { return q.id === id; }) || null; }

  function chapterQuestions(ch) { return questions().filter(function (q) { return q.ch === ch; }); }

  function typeQuestions(ch, type) {
    return questions().filter(function (q) { return q.ch === ch && q.type === type; });
  }

  function groupList(ch, type) {
    return meta().groups.filter(function (g) { return g.ch === ch && g.type === type; });
  }

  function chapterStats(ch) {
    var qs = chapterQuestions(ch);
    var done = 0, judged = 0, correct = 0;
    qs.forEach(function (q) {
      var r = state.records[q.id];
      if (r) {
        done++;
        if (typeof r.correct === 'boolean') { judged++; if (r.correct) correct++; }
      }
    });
    return { total: qs.length, done: done, judged: judged, correct: correct, pct: qs.length ? (done / qs.length * 100) : 0 };
  }

  function overallStats() {
    var total = questions().length, done = 0, judged = 0, correct = 0, wrong = 0;
    questions().forEach(function (q) {
      if (state.wrong[q.id]) wrong++;
      var r = state.records[q.id];
      if (r) {
        done++;
        if (typeof r.correct === 'boolean') { judged++; if (r.correct) correct++; }
      }
    });
    return {
      total: total, done: done, judged: judged, correct: correct,
      wrong: wrong,
      pct: total ? done / total * 100 : 0,
      accuracy: judged ? correct / judged * 100 : null
    };
  }

  function firstUndone(opts) {
    opts = opts || {};
    var qs = opts.ch ? chapterQuestions(opts.ch) : questions();
    if (opts.type) qs = qs.filter(function (q) { return q.type === opts.type; });
    if (opts.group) qs = qs.filter(function (q) { return q.group === opts.group; });
    var startIdx = 0;
    if (opts.fromId) {
      var i = qs.findIndex(function (q) { return q.id === opts.fromId; });
      if (i >= 0) startIdx = i;
    }
    for (var k = 0; k < qs.length; k++) {
      var q = qs[(startIdx + k) % qs.length];
      if (!state.records[q.id]) return q;
    }
    return qs[startIdx] || null;
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mathHTML(expr) {
    try {
      if (window.katex) {
        return katex.renderToString(expr, { throwOnError: false, strict: false, displayMode: false });
      }
    } catch (e) {}
    return '<code class="math-raw">' + escapeHTML(expr) + '</code>';
  }

  // 处理字符串中的 $...$ 数学段，其余按 HTML 原样保留
  function renderMath(text) {
    if (text == null) return '';
    var s = String(text);
    if (!s) return '';
    var out = '', last = 0, m;
    var re = /\$([^$]+)\$/g;
    while ((m = re.exec(s))) {
      out += s.slice(last, m.index);
      out += mathHTML(m[1]);
      last = m.index + m[0].length;
    }
    out += s.slice(last);
    return out;
  }

  function hasCJK(s) { return /[\u4e00-\u9fff]/.test(s); }

  // 纯文本/混合文本格式化：无 $ 时，把 LaTeX 片段包进 $ 再渲染
  function renderMixed(text) {
    var s = String(text == null ? '' : text);
    if (!s) return '';
    if (s.indexOf('$') >= 0) return renderMath(s);
    if (!/[\\_^]/.test(s)) return s;
    if (!hasCJK(s)) return mathHTML(s);
    // 中英文/公式混排：按中文片段切分，仅含 LaTeX 特征的片段转公式
    var parts = s.split(/([\u4e00-\u9fff，。；：、（）]+)/);
    return parts.map(function (p) {
      if (!p) return '';
      if (hasCJK(p)) return p;
      if (/[\\_^]/.test(p)) return mathHTML(p.trim());
      return p;
    }).join('');
  }

  function optionHTML(text) {
    var s = String(text == null ? '' : text);
    if (!s) return '';
    if (s.indexOf('$') >= 0) return renderMath(s);
    if (!/[\\_^]/.test(s)) return s;
    if (!hasCJK(s)) return mathHTML(s);
    return renderMixed(s);
  }

  function analysisHTML(s) {
    var t = String(s == null ? '' : s);
    if (!t) return '';
    return /<[a-zA-Z]/.test(t) ? renderMath(t) : renderMixed(t);
  }

  // 题干：有 $ 定界按定界渲染；无定界但含 LaTeX 时按混合文本处理
  function stemRender(s) {
    var t = String(s == null ? '' : s);
    if (!t) return '';
    return t.indexOf('$') >= 0 ? renderMath(t) : renderMixed(t);
  }

  var TYPE_NAME = { xz: '选择题', tk: '填空题', js: '计算题', jj: '解答题', zm: '证明题' };
  var BADGE_NAME = {
    '精讲': '精讲解析', '答案核验': '答案核验', '原卷答案': '原卷答案',
    '原卷截图': '原卷截图'
  };

  function groupsFor(ch) {
    return meta().groups.filter(function (g) { return g.ch === ch; });
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  function chapterProgressHTML(ch, small) {
    var st = chapterStats(ch);
    return '<div class="bar' + (small ? ' bar-sm' : '') + '"><i style="width:' + st.pct.toFixed(1) + '%"></i></div>' +
      '<div class="bar-label"><span>' + st.done + ' / ' + st.total + ' 题</span><span>' + Math.round(st.pct) + '%</span></div>';
  }

  function updateHeaderNav() {
    var path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('href') === path) a.classList.add('active');
    });
  }

  function formatDate(ts) {
    try {
      var d = new Date(ts);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    } catch (e) { return ''; }
  }

  document.addEventListener('DOMContentLoaded', updateHeaderNav);

  window.GK = {
    KEY: KEY, CHAPTERS: CHAPTERS, TYPE_NAME: TYPE_NAME, BADGE_NAME: BADGE_NAME,
    get state() { return state; },
    save: save, getRecord: getRecord, setRecord: setRecord, removeRecord: removeRecord,
    isWrong: isWrong, addWrong: addWrong, removeWrong: removeWrong, toggleWrong: toggleWrong,
    questions: questions, meta: meta, byId: byId, chapterQuestions: chapterQuestions,
    typeQuestions: typeQuestions, groupList: groupList, chapterStats: chapterStats,
    overallStats: overallStats, firstUndone: firstUndone, groupsFor: groupsFor,
    escapeHTML: escapeHTML, renderMath: renderMath, renderMixed: renderMixed,
    optionHTML: optionHTML, toast: toast, qs: qs, chapterProgressHTML: chapterProgressHTML,
    analysisHTML: analysisHTML, stemRender: stemRender, formatDate: formatDate
  };
})();
