/* 随机练习：范围可选 全部 / 未做 / 错题 */
(function () {
  'use strict';

  var SEL = { ch: 'all', scope: 'all', count: '20' };

  function pool() {
    var qs = GK.questions();
    if (SEL.ch !== 'all') qs = qs.filter(function (q) { return q.ch === SEL.ch; });
    if (SEL.scope === 'undone') qs = qs.filter(function (q) { return !GK.getRecord(q.id); });
    if (SEL.scope === 'wrong') qs = qs.filter(function (q) { return GK.isWrong(q.id); });
    return qs;
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function setupHTML() {
    var total = GK.questions().length;
    return '<section class="hero"><div class="kicker">随机练习</div><h1>抽一组题，专注做十分钟</h1>' +
      '<p class="sub">抽题后的作答方式与正式答题页完全一致：选择题先选再提交，非选择题自评，答案与解析默认收起。</p></section>' +
      '<div class="card section"><div class="field"><label>章节</label><div class="seg" data-group="ch">' +
      '<label class="' + (SEL.ch === 'all' ? 'on' : '') + '"><input type="radio" name="ch" value="all"' + (SEL.ch === 'all' ? ' checked' : '') + '>全部（' + total + ' 题）</label>' +
      '<label class="' + (SEL.ch === 'A' ? 'on' : '') + '"><input type="radio" name="ch" value="A"' + (SEL.ch === 'A' ? ' checked' : '') + '>1 极限与连续</label>' +
      '<label class="' + (SEL.ch === 'B' ? 'on' : '') + '"><input type="radio" name="ch" value="B"' + (SEL.ch === 'B' ? ' checked' : '') + '>2 导数与微分</label>' +
      '</div></div>' +
      '<div class="field"><label>范围</label><div class="seg" data-group="scope">' +
      '<label class="' + (SEL.scope === 'all' ? 'on' : '') + '"><input type="radio" name="scope" value="all"' + (SEL.scope === 'all' ? ' checked' : '') + '>全部题</label>' +
      '<label class="' + (SEL.scope === 'undone' ? 'on' : '') + '"><input type="radio" name="scope" value="undone"' + (SEL.scope === 'undone' ? ' checked' : '') + '>未做题</label>' +
      '<label class="' + (SEL.scope === 'wrong' ? 'on' : '') + '"><input type="radio" name="scope" value="wrong"' + (SEL.scope === 'wrong' ? ' checked' : '') + '>错题（只练错题）</label>' +
      '</div></div>' +
      '<div class="field"><label>题量</label><div class="seg" data-group="count">' +
      ['10', '20', '30', '50', 'all'].map(function (v) {
        return '<label class="' + (SEL.count === v ? 'on' : '') + '"><input type="radio" name="count" value="' + v + '"' +
          (SEL.count === v ? ' checked' : '') + '>' + (v === 'all' ? '全部' : v + ' 题') + '</label>';
      }).join('') +
      '</div></div>' +
      '<div class="spread" style="margin-top:18px"><span class="muted small" id="poolInfo"></span>' +
      '<button type="button" class="btn primary" id="startBtn">开始练习</button></div></div>';
  }

  function refreshPoolInfo() {
    var n = pool().length;
    var el = document.getElementById('poolInfo');
    if (el) el.textContent = '可选 ' + n + ' 题';
  }

  function renderSetup() {
    document.getElementById('setup').innerHTML = setupHTML();
    document.getElementById('bar').hidden = true;
    document.getElementById('quiz').innerHTML = '';
    document.querySelectorAll('.seg').forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var lab = e.target.closest('label');
        if (!lab) return;
        var input = lab.querySelector('input');
        if (!input) return;
        var group = seg.getAttribute('data-group');
        SEL[group] = input.value;
        seg.querySelectorAll('label').forEach(function (x) { x.classList.remove('on'); });
        lab.classList.add('on');
        input.checked = true;
        refreshPoolInfo();
      });
    });
    refreshPoolInfo();
    document.getElementById('startBtn').addEventListener('click', start);
  }

  function start() {
    var qs = pool();
    if (!qs.length) {
      GK.toast(SEL.scope === 'wrong' ? '错题本里还没有题目' : '该范围暂时没有题目');
      return;
    }
    var n = SEL.count === 'all' ? qs.length : Math.min(Number(SEL.count), qs.length);
    var picked = shuffle(qs.slice()).slice(0, n);
    document.getElementById('setup').innerHTML = '';
    document.getElementById('bar').hidden = false;
    GKQuiz.mount({
      ids: picked.map(function (q) { return q.id; }),
      mode: 'practice'
    });
    GK.toast('已抽取 ' + picked.length + ' 题');
  }

  renderSetup();
})();
