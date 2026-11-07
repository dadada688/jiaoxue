/* 首页 */
(function () {
  'use strict';

  function groupProgress(ch, type, group) {
    var qs = GK.questions().filter(function (q) { return q.ch === ch && q.type === type && q.group === group; });
    var done = qs.filter(function (q) { return GK.getRecord(q.id); }).length;
    return { total: qs.length, done: done };
  }

  function render() {
    var st = GK.overallStats();
    var first = GK.firstUndone({});
    var resume = first ? ('quiz.html?id=' + encodeURIComponent(first.id)) : 'quiz.html';
    var resumeText = st.done ? ('继续第 ' + first.num + ' 题') : '开始第一题';

    var m = '<section class="hero"><div class="kicker">高等数学 · 章节题库</div>' +
      '<h1>把 ' + st.total + ' 道题，拆成今天能做完的一小组</h1>' +
      '<p class="sub">极限与连续、导数与微分两章精选 ' + st.total + ' 题。一题一页，答案默认收起，错题自动归档，进度保存在本机浏览器。</p>' +
      '<div class="overview">' +
      '<div class="metric"><b>' + st.done + '</b><span>已做题 / ' + st.total + '</span></div>' +
      '<div class="metric"><b>' + (st.accuracy == null ? '—' : Math.round(st.accuracy) + '%') + '</b><span>正确率</span></div>' +
      '<div class="metric"><b>' + st.wrong + '</b><span>错题本</span></div>' +
      '<div class="metric"><b>' + Math.round(st.pct) + '%</b><span>总进度</span></div>' +
      '</div>' +
      '<div class="card progress-card"><div class="spread"><div><div class="muted small">总体学习进度</div>' +
      '<div class="pct">' + Math.round(st.pct) + '%</div></div>' +
      '<div class="row"><a class="btn primary" href="' + resume + '">' + resumeText + '</a>' +
      '<a class="btn" href="practice.html">随机练习</a></div></div>' +
      '<div class="bar" style="margin-top:12px"><i style="width:' + st.pct.toFixed(1) + '%"></i></div>' +
      '<div class="bar-label"><span>已做 ' + st.done + ' 题</span><span>共 ' + st.total + ' 题</span></div></div>' +
      '</section>';

    var chapters = '<section class="section"><div class="spread"><h2>按章节进入</h2>' +
      '<span class="muted small">每 50 题为一组</span></div>';

    ['A', 'B'].forEach(function (ch) {
      var cst = GK.chapterStats(ch);
      chapters += '<div class="card chapter-card"><div class="chapter-head"><div>' +
        '<div class="no">CHAPTER ' + (ch === 'A' ? '01' : '02') + '</div>' +
        '<h2>' + GK.CHAPTERS[ch].name + '</h2>' +
        '<div class="muted small">' + cst.total + ' 题 · 已做 ' + cst.done + ' · 正确率 ' +
        (cst.judged ? Math.round(cst.correct / cst.judged * 100) + '%' : '暂无') + '</div></div>' +
        '<a class="btn small" href="quiz.html?ch=' + ch + '">进入本章</a></div>' +
        '<div style="margin-top:14px">' + GK.chapterProgressHTML(ch) + '</div>';

      ['xz', 'tk', 'js', 'jj', 'zm'].forEach(function (type) {
        var groups = GK.groupList(ch, type);
        if (!groups.length) return;
        var tq = GK.typeQuestions(ch, type);
        var tdone = tq.filter(function (q) { return GK.getRecord(q.id); }).length;
        chapters += '<div class="type-block"><div class="type-head"><h3>' + GK.TYPE_NAME[type] + '</h3>' +
          '<span class="muted">' + tq.length + ' 题 · 已做 ' + tdone + '</span></div><div class="group-list">';
        groups.forEach(function (g) {
          var gp = groupProgress(ch, type, g.no);
          var pct = gp.total ? gp.done / gp.total * 100 : 0;
          chapters += '<a class="group-row' + (gp.done === gp.total ? ' done' : '') + '" href="quiz.html?ch=' + ch + '&type=' + type + '&group=' + g.no + '">' +
            '<span class="g-label">' + g.label + '</span>' +
            '<span class="g-meta">' + gp.done + '/' + gp.total + '</span>' +
            '<span class="g-bar bar bar-sm"><i style="width:' + pct.toFixed(1) + '%"></i></span></a>';
        });
        chapters += '</div></div>';
      });
      chapters += '</div>';
    });
    chapters += '</section>';

    // 知识点
    var tagCount = {};
    GK.questions().forEach(function (q) {
      q.tags.forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; });
    });
    var tags = Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a]; }).slice(0, 24);
    var tagH = '<section class="section"><div class="spread"><h2>按知识点进入</h2><span class="muted small">共 ' +
      Object.keys(tagCount).length + ' 个标签</span></div><div class="card"><div class="tag-cloud">';
    tags.forEach(function (t) {
      tagH += '<a class="chip tag" href="tags.html?tag=' + encodeURIComponent(t) + '">' + t +
        '<span class="count">' + tagCount[t] + '</span></a>';
    });
    tagH += '</div></div></section>';

    var stats = (GK.meta().stats || {});
    var restText = st.total - (stats.latexQuestions || 0) - (stats.imageQuestions || 0);
    var notice = '<section class="section"><div class="notice">题库如实构成：共 ' + st.total +
      ' 题；含可复制 LaTeX 公式的题 ' + (stats.latexQuestions || 0) + ' 道，含原卷矢量截图题 ' +
      (stats.imageQuestions || 0) + ' 道' + (restText > 0 ? '，其余 ' + restText + ' 道为纯文字选择题' : '') +
      '。解析等级：精讲 ' + (stats.fullAnalysis || 0) +
      ' 道、答案核验 ' + (stats.briefAnalysis || 0) + ' 道、原卷仅答案 ' + (stats.sourceAnswerOnly || 0) +
      ' 道。原卷未给过程的题不虚构推导。<a href="profile.html">查看完整说明</a></div></section>';

    document.getElementById('app').innerHTML = m + chapters + tagH + notice +
      '<div class="footer">高数题库 · 纯静态 · 数据只保存在本机</div>';
  }

  render();
})();
