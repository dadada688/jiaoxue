/* 答题页 / 随机练习共用的答题引擎 */
(function () {
  'use strict';

  var TYPE_NAME = { xz: '选择题', tk: '填空题', js: '计算题', jj: '解答题', zm: '证明题' };
  var LETTERS = ['A', 'B', 'C', 'D'];

  function esc(s) { return GK.escapeHTML(s); }

  function mount(opts) {
    var ids = opts.ids || [];
    var mode = opts.mode || 'formal';
    var container = document.getElementById('quiz');
    var bar = document.getElementById('bar');
    var idx = 0;
    if (opts.startId) {
      var k = ids.indexOf(opts.startId);
      if (k >= 0) idx = k;
    }
    var sessionDone = {};

    function q() { return GK.byId(ids[idx]); }

    function positionHTML() {
      if (mode === 'practice') {
        var doneN = Object.keys(sessionDone).length;
        return '<span class="pos">第 ' + (idx + 1) + ' / 共 ' + ids.length + ' 题 · 本次已作答 ' + doneN + '</span>';
      }
      return '<span class="pos">第 ' + (idx + 1) + ' / 共 ' + ids.length + ' 题</span>';
    }

    function barHTML() {
      if (mode === 'practice') {
        var pct = ids.length ? (Object.keys(sessionDone).length / ids.length * 100) : 0;
        return '<div class="bar bar-sm"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
          '<div class="bar-label"><span>本次练习</span><span>' + Math.round(pct) + '%</span></div>';
      }
      var st = GK.chapterStats(q().ch);
      return '<div class="bar"><i style="width:' + st.pct.toFixed(1) + '%"></i></div>' +
        '<div class="bar-label"><span>本章进度 ' + st.done + ' / ' + st.total + '</span><span>' + Math.round(st.pct) + '%</span></div>';
    }

    function stemHTML(item) {
      var h = '';
      if (item.stem) h += '<div class="q-stem">' + GK.stemRender(item.stem) + '</div>';
      if (item.simg && item.simg.length) {
        h += '<div class="q-stem"><div class="img-label">题干原卷截图 · 矢量公式保留原图</div>';
        item.simg.forEach(function (src) {
          h += '<img loading="lazy" src="' + esc(src) + '" alt="' + esc(item.ch + '卷第' + item.num + '题题干截图') + '">';
        });
        h += '</div>';
      }
      return h;
    }

    function answerText(item) {
      if (item.type === 'xz' && item.answer) return '<b>' + esc(item.answer) + '</b>';
      if (item.aimg && item.aimg.length && (!item.answer || item.answer.indexOf('见') >= 0 || item.answer.indexOf('未提供') >= 0)) {
        return item.answer ? GK.renderMixed(item.answer) : '见原卷截图';
      }
      return GK.renderMixed(item.answer || '原卷未提供');
    }

    function answerPanelHTML(item) {
      var h = '<div class="answer-panel" id="answerPanel" hidden><div class="answer-head">' +
        '<b>答案与解析</b><span class="chip ' + (item.badge === '精讲' ? 'green' : item.badge === '原卷截图' ? 'gold' : '') + '">' +
        (GK.BADGE_NAME[item.badge] || item.badge) + '</span></div><div class="answer-body">';
      h += '<p><b>正确答案：</b>' + answerText(item) + '</p>';
      if (item.analysis) h += '<div class="analysis">' + GK.analysisHTML(item.analysis) + '</div>';
      if (item.note) h += '<div class="answer-note">' + esc(item.note) + '</div>';
      if (item.aimg && item.aimg.length) {
        h += '<div class="orig-ans"><div class="cap">原卷答案与过程截图（取自 PDF，未作文字改写）</div>';
        item.aimg.forEach(function (src) {
          h += '<img loading="lazy" src="' + esc(src) + '" alt="原卷答案截图">';
        });
        h += '</div>';
      }
      h += '</div></div>';
      return h;
    }

    function render() {
      var item = q();
      if (!item) {
        container.innerHTML = '<div class="card empty"><div class="big">没有题目</div><p>请返回首页选择范围。</p></div>';
        bar.innerHTML = '';
        return;
      }
      var rec = GK.getRecord(item.id);
      var selected = rec && rec.selected ? rec.selected : null;
      var locked = !!(rec && rec.status === 'done');
      var self = rec && rec.self ? rec.self : '';
      var correct = rec ? rec.correct : null;

      var chips = '<span class="chip">' + esc(GK.CHAPTERS[item.ch].name) + '</span>' +
        '<span class="chip">' + TYPE_NAME[item.type] + '</span>' +
        '<span class="chip">第 ' + item.group + ' 组 · 组内 ' + item.gidx + '</span>';
      var tags = item.tags.map(function (t) { return '<span class="chip tag">' + esc(t) + '</span>'; }).join('');

      var h = '<div class="quiz-top"><div><a class="back" href="' + (mode === 'practice' ? 'practice.html' : 'index.html') + '">← ' + (mode === 'practice' ? '结束练习' : '返回首页') + '</a></div>' + positionHTML() + '</div>';
      h += '<div class="chapter-bar">' + barHTML() + '</div>';
      h += '<div class="card q-card"><div class="q-meta">' + chips + tags + '</div>';
      h += stemHTML(item);

      if (item.type === 'xz') {
        h += '<div class="options" id="options">';
        item.options.forEach(function (opt, i) {
          var L = LETTERS[i] || String(i + 1);
          var cls = 'opt';
          if (locked) {
            if (item.answer && L === item.answer) cls += ' correct';
            else if (selected === L && item.answer && selected !== item.answer) cls += ' wrong';
          } else if (selected === L) cls += ' sel';
          h += '<button type="button" class="' + cls + '" data-key="' + L + '"' + (locked ? ' disabled' : '') + '>' +
            '<span class="key">' + L + '</span><span class="opt-text">' + GK.optionHTML(opt) + '</span></button>';
        });
        h += '</div>';
        if (!locked) {
          h += '<div class="actions"><button type="button" class="btn primary" id="submitBtn"' + (selected ? '' : ' disabled') + '>提交答案</button></div>';
          h += '<div class="hint">先点选项，再点“提交答案”才判分；提交后不可更改。</div>';
        } else {
          if (correct === true) h += '<div class="result-line"><span class="chip green">回答正确</span>已记录</div>';
          else if (correct === false) h += '<div class="result-line"><span class="chip red">回答错误</span>已自动加入错题本</div>';
          else h += '<div class="result-line"><span class="chip gold">原卷无答案字母</span>本题无法自动判分</div>';
        }
      } else {
        if (!locked) {
          h += '<div class="actions"><button type="button" class="btn soft" data-self="know">自评：会</button>' +
            '<button type="button" class="btn" data-self="no">自评：不会</button></div>';
          h += '<div class="hint">非选择题无标准客观答案，用自评记录掌握情况；“不会”会自动加入错题本。</div>';
        } else {
          if (self === 'know') h += '<div class="result-line"><span class="chip green">自评：会</span>已记录</div>';
          else if (self === 'no') h += '<div class="result-line"><span class="chip red">自评：不会</span>已自动加入错题本</div>';
          else h += '<div class="result-line"><span class="chip">已做过</span></div>';
        }
      }

      h += '<div class="actions">' +
        '<button type="button" class="btn" id="toggleAns">查看答案与解析</button>' +
        '<button type="button" class="btn" id="wrongBtn">' + (GK.isWrong(item.id) ? '移出错题本' : '加入错题本') + '</button>' +
        (locked ? '<button type="button" class="btn ghost" id="redoBtn">重做本题</button>' : '') +
        '</div>';
      h += answerPanelHTML(item);
      h += '</div>';

      container.innerHTML = h;

      bar.innerHTML = '<div class="fixedbar-in">' +
        '<button type="button" class="btn" id="prevBtn"' + (idx === 0 ? ' disabled' : '') + '>上一题</button>' +
        '<button type="button" class="btn primary" id="nextBtn"' + (idx >= ids.length - 1 ? ' disabled' : '') + '>下一题</button>' +
        '</div>';

      bind(item, locked);
      GK.state.last = { id: item.id, ch: item.ch, type: item.type, group: item.group };
      GK.save();
    }

    function bind(item, locked) {
      var panel = document.getElementById('answerPanel');
      var toggle = document.getElementById('toggleAns');
      function openPanel(force) {
        panel.hidden = !(force === undefined ? panel.hidden : force);
        toggle.textContent = panel.hidden ? '查看答案与解析' : '收起答案与解析';
      }
      toggle.addEventListener('click', function () { openPanel(); });

      if (!locked) {
        var submit = document.getElementById('submitBtn');
        var selected = null;
        document.querySelectorAll('#options .opt').forEach(function (b) {
          b.addEventListener('click', function () {
            selected = b.getAttribute('data-key');
            document.querySelectorAll('#options .opt').forEach(function (x) { x.classList.remove('sel'); });
            b.classList.add('sel');
            if (submit) submit.disabled = false;
          });
        });
        if (submit) {
          submit.addEventListener('click', function () {
            if (!selected) { GK.toast('请先选择一个选项'); return; }
            var ok = item.answer ? selected === item.answer : null;
            GK.setRecord(item.id, { correct: ok, selected: selected, self: '' });
            if (ok === false) GK.addWrong(item.id, true);
            sessionDone[item.id] = true;
            GK.toast(ok === true ? '回答正确' : ok === false ? '回答错误，已加入错题本' : '原卷未提供答案，已记录作答');
            render();
            var p = document.getElementById('answerPanel');
            if (p) { p.hidden = false; document.getElementById('toggleAns').textContent = '收起答案与解析'; }
          });
        }
        document.querySelectorAll('[data-self]').forEach(function (b) {
          b.addEventListener('click', function () {
            var know = b.getAttribute('data-self') === 'know';
            GK.setRecord(item.id, { correct: know, selected: '', self: know ? 'know' : 'no' });
            if (!know) GK.addWrong(item.id, true);
            sessionDone[item.id] = true;
            GK.toast(know ? '已记录：会' : '已记录：不会，已加入错题本');
            render();
            var p = document.getElementById('answerPanel');
            if (p) { p.hidden = false; document.getElementById('toggleAns').textContent = '收起答案与解析'; }
          });
        });
      }

      var wb = document.getElementById('wrongBtn');
      if (wb) {
        wb.addEventListener('click', function () {
          var added = GK.toggleWrong(item.id);
          GK.toast(added ? '已加入错题本' : '已移出错题本');
          wb.textContent = added ? '移出错题本' : '加入错题本';
        });
      }

      var redo = document.getElementById('redoBtn');
      if (redo) {
        redo.addEventListener('click', function () {
          GK.removeRecord(item.id);
          delete sessionDone[item.id];
          render();
          GK.toast('已重置本题，可重新作答');
        });
      }
    }

    function go(n) {
      idx = Math.max(0, Math.min(ids.length - 1, n));
      render();
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }

    document.getElementById('quiz').addEventListener('click', function (e) {
      if (e.target.closest('#prevBtn')) go(idx - 1);
      if (e.target.closest('#nextBtn')) go(idx + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') go(idx - 1);
      if (e.key === 'ArrowRight') go(idx + 1);
    });

    render();
    return { go: go, render: render };
  }

  window.GKQuiz = { mount: mount };
})();
