/* 个人中心 */
(function () {
  'use strict';

  var TYPE_ORDER = ['xz', 'tk', 'js', 'jj', 'zm'];

  function statsRows() {
    var rows = '';
    ['A', 'B'].forEach(function (ch) {
      TYPE_ORDER.forEach(function (t) {
        var qs = GK.typeQuestions(ch, t);
        var done = 0, judged = 0, correct = 0;
        qs.forEach(function (q) {
          var r = GK.getRecord(q.id);
          if (r) {
            done++;
            if (typeof r.correct === 'boolean') { judged++; if (r.correct) correct++; }
          }
        });
        rows += '<tr><td>' + GK.CHAPTERS[ch].name + '<div class="muted">' + GK.TYPE_NAME[t] + '</div></td>' +
          '<td>' + done + ' / ' + qs.length + '</td>' +
          '<td>' + (qs.length ? Math.round(done / qs.length * 100) + '%' : '—') + '</td>' +
          '<td>' + (judged ? Math.round(correct / judged * 100) + '%' : '—') + '</td></tr>';
      });
    });
    return rows;
  }

  function render() {
    var st = GK.overallStats();
    var stats = GK.meta().stats || {};
    var h = '<section class="hero"><div class="kicker">个人中心</div><h1>学习进度与数据管理</h1>' +
      '<p class="sub">全部数据保存在本机 localStorage，刷新、关闭重开都不会丢失。换设备请用进度导出 / 导入。</p>' +
      '<div class="overview">' +
      '<div class="metric"><b>' + st.done + '</b><span>已做 / ' + st.total + '</span></div>' +
      '<div class="metric"><b>' + (st.accuracy == null ? '—' : Math.round(st.accuracy) + '%') + '</b><span>正确率</span></div>' +
      '<div class="metric"><b>' + st.wrong + '</b><span>错题数</span></div>' +
      '<div class="metric"><b>' + Math.round(st.pct) + '%</b><span>总完成度</span></div></div></section>';

    h += '<section class="section"><h2>各章各题型完成度</h2><div class="card" style="padding:8px 14px">' +
      '<table class="stats"><thead><tr><th>章节 / 题型</th><th>已做</th><th>完成度</th><th>正确率</th></tr></thead><tbody>' +
      statsRows() + '</tbody></table></div></section>';

    h += '<section class="section"><h2>数据管理</h2><div class="card">' +
      '<p class="muted small" style="margin-bottom:14px">建议先导出备份，再执行清空操作。</p>' +
      '<div class="row"><button type="button" class="btn" id="exportJson">导出进度（JSON）</button>' +
      '<button type="button" class="btn" id="importBtn">导入进度</button>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '</div><p class="muted small" style="margin-top:10px">导入为合并模式：同一题保留较新的作答记录，不会覆盖更晚的进度。</p></div>' +
      '<div class="danger-zone"><h2>危险操作</h2>' +
      '<p class="small muted">这两个操作不可撤销，且与常用按钮分开摆放，避免误触。</p>' +
      '<div class="row"><button type="button" class="btn danger" id="clearProgress">清空学习进度…</button>' +
      '<button type="button" class="btn danger" id="clearWrong">清空错题本…</button></div></div></section>';

    h += '<section class="section"><h2>题库说明</h2><div class="card">' +
      '<p><b>总量：</b>' + st.total + ' 题。1 极限与连续 ' + GK.chapterStats('A').total + ' 题，2 导数与微分 ' + GK.chapterStats('B').total + ' 题。精简版由原卷 736 题按考点覆盖与题型均衡抽选，ID 未重排；选项矛盾、答案缺失的存疑题已剔除。</p>' +
      '<p><b>公式处理：</b>能可靠辨认的公式转写为 LaTeX，用本地 KaTeX 离线渲染（共 ' + (stats.latexQuestions || 0) +
      ' 道题含可复制公式）；原卷为矢量图形、无法逐字确认的题干保留高清裁剪图（共 ' + (stats.imageQuestions || 0) +
      ' 道计算 / 解答 / 证明题）；其余 ' + (st.total - (stats.latexQuestions || 0) - (stats.imageQuestions || 0)) +
      ' 道为纯文字选择题。页面与数据中明确区分这几类，图片题不冒充文本公式。</p>' +
      '<p><b>解析等级：</b>精讲解析 ' + (stats.fullAnalysis || 0) + ' 道；答案核验 ' + (stats.briefAnalysis || 0) +
      ' 道；其余 ' + (stats.sourceAnswerOnly || 0) + ' 道原卷只给答案（选择题 / 填空题）或只保留原卷答案截图（计算 / 解答 / 证明）。原卷未提供过程的题不虚构推导，原卷答案与选项矛盾处已单独标注。</p>' +
      '<p><b>数据版本：</b><code>gskb_v2</code>，兼容旧版并迁移，不覆盖旧 key 数据。</p>' +
      '<p><b>错题包：</b>按 jinzhi.fun/correction/import 官方示例生成 manifest.json（format 为 jinzhi-mistake-package、schema_version 1），folders 按章节分组，选择题 interactive / 其余 legacy。官网示例未展示媒体文件的引用细节，因此错题包不带原卷截图，图片题在题干文字中注明。</p>' +
      '</div></section>';

    h += '<div class="footer">高数题库 · 纯静态 · 离线可用</div>';
    document.getElementById('app').innerHTML = h;
    bind();
  }

  function bind() {
    document.getElementById('exportJson').addEventListener('click', function () {
      var payload = {
        app: 'gskb', version: 2, exported_at: new Date().toISOString(),
        records: GK.state.records, wrong: GK.state.wrong, last: GK.state.last || null
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      var d = new Date();
      a.href = URL.createObjectURL(blob);
      a.download = '高数题库进度_' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      GK.toast('已导出进度');
    });

    var file = document.getElementById('importFile');
    document.getElementById('importBtn').addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var d = JSON.parse(String(reader.result));
          if (!d || (!d.records && !d.wrong)) throw new Error('bad');
          var recs = d.records || {};
          var added = 0, kept = 0;
          Object.keys(recs).forEach(function (id) {
            if (!GK.byId(id)) return;
            var incoming = recs[id] || {};
            var old = GK.state.records[id];
            var its = incoming.ts || 0;
            if (!old || its >= (old.ts || 0)) {
              GK.state.records[id] = {
                status: 'done', correct: typeof incoming.correct === 'boolean' ? incoming.correct : null,
                selected: incoming.selected || '', self: incoming.self || '', ts: its || Date.now()
              };
              added++;
            } else { kept++; }
          });
          Object.keys(d.wrong || {}).forEach(function (id) {
            if (GK.byId(id)) GK.state.wrong[id] = d.wrong[id] || { ts: Date.now(), auto: false };
          });
          GK.save();
          GK.toast('导入完成：更新 ' + added + ' 条，保留较新 ' + kept + ' 条');
          render();
        } catch (e) {
          GK.toast('导入失败：不是有效的进度 JSON');
        }
        file.value = '';
      };
      reader.readAsText(f, 'utf-8');
    });

    document.getElementById('clearProgress').addEventListener('click', function () {
      confirmDanger('清空学习进度', '将删除全部答题记录与正确率统计（错题本保留）。此操作不可撤销。', function () {
        GK.state.records = {};
        GK.save();
        GK.toast('已清空学习进度');
        render();
      });
    });
    document.getElementById('clearWrong').addEventListener('click', function () {
      confirmDanger('清空错题本', '将删除错题本中的全部题目（答题进度保留）。此操作不可撤销。', function () {
        GK.state.wrong = {};
        GK.save();
        GK.toast('已清空错题本');
        render();
      });
    });
  }

  function confirmDanger(title, desc, action) {
    var m = document.createElement('div');
    m.className = 'modal show';
    m.innerHTML = '<div class="mask"></div><div class="panel"><h3>' + title + '</h3>' +
      '<p class="small muted">' + desc + '</p>' +
      '<p class="small">请输入“<b>清空</b>”两个字以确认：</p>' +
      '<input type="text" id="confirmWord" autocomplete="off" placeholder="清空">' +
      '<div class="modal-actions"><button type="button" class="btn" id="cancel">取消</button>' +
      '<button type="button" class="btn danger" id="ok" disabled>确认' + title + '</button></div></div>';
    document.body.appendChild(m);
    var word = m.querySelector('#confirmWord'), ok = m.querySelector('#ok');
    word.addEventListener('input', function () { ok.disabled = word.value.trim() !== '清空'; });
    function close() { m.remove(); }
    m.querySelector('.mask').addEventListener('click', close);
    m.querySelector('#cancel').addEventListener('click', close);
    ok.addEventListener('click', function () { if (word.value.trim() !== '清空') return; close(); action(); });
    setTimeout(function () { word.focus(); }, 60);
  }

  render();
})();
