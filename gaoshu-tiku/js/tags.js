/* 知识点页 */
(function () {
  'use strict';

  var tag = GK.qs('tag');
  var limit = 50;
  var TYPE_NAME = { xz: '选择题', tk: '填空题', js: '计算题', jj: '解答题', zm: '证明题' };

  function counts() {
    var c = {};
    GK.questions().forEach(function (q) {
      q.tags.forEach(function (t) { c[t] = (c[t] || 0) + 1; });
    });
    return c;
  }

  function render() {
    var c = counts();
    var all = Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); });

    if (!tag) {
      var h = '<section class="hero"><div class="kicker">知识点</div><h1>按知识点浏览题库</h1>' +
        '<p class="sub">共 ' + all.length + ' 个统一标签。点击进入可看该知识点下的全部题目。</p></section>';
      h += '<section class="section"><div class="card"><div class="tag-cloud">';
      all.forEach(function (t) {
        h += '<a class="chip tag" href="tags.html?tag=' + encodeURIComponent(t) + '">' + GK.escapeHTML(t) +
          '<span class="count">' + c[t] + '</span></a>';
      });
      h += '</div></div></section>';
      document.getElementById('app').innerHTML = h;
      return;
    }

    var qs = GK.questions().filter(function (q) { return q.tags.indexOf(tag) >= 0; });
    var h = '<section class="hero"><div class="kicker">知识点</div><h1>' + GK.escapeHTML(tag) + '</h1>' +
      '<p class="sub">共 ' + qs.length + ' 题 · <a href="tags.html" style="text-decoration:underline">全部知识点</a></p></section>';

    if (!qs.length) {
      h += '<div class="empty"><div class="big">没有匹配的题目</div></div>';
    } else {
      h += '<section class="section"><div class="card" style="padding:10px 14px"><div class="group-list">';
      qs.slice(0, limit).forEach(function (q) {
        var preview = q.stem ? q.stem.replace(/\$[^$]*\$/g, '…').slice(0, 34) : '原卷截图题';
        h += '<a class="group-row" href="quiz.html?id=' + encodeURIComponent(q.id) + '">' +
          '<span class="g-label">' + GK.CHAPTERS[q.ch].short + ' · ' + TYPE_NAME[q.type] + ' 第 ' + q.num + ' 题' +
          '<span class="muted" style="display:block;font-size:12px">' + GK.escapeHTML(preview) + '</span></span>' +
          '<span class="g-meta">' + (GK.getRecord(q.id) ? '已做' : '未做') + '</span></a>';
      });
      h += '</div>';
      if (qs.length > limit) h += '<div class="row" style="margin-top:12px"><button class="btn block" id="more">加载更多（还有 ' + (qs.length - limit) + ' 题）</button></div>';
      h += '</div></section>';
    }
    document.getElementById('app').innerHTML = h;

    var more = document.getElementById('more');
    if (more) more.addEventListener('click', function () { limit += 50; render(); });
  }

  render();
})();
