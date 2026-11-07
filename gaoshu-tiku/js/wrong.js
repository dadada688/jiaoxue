/* 错题本 */
(function () {
  'use strict';

  var activeTag = GK.qs('tag') || '';
  var limits = { A: 20, B: 20 };
  var TYPE_NAME = { xz: '选择题', tk: '填空题', js: '计算题', jj: '解答题', zm: '证明题' };
  var LETTERS = ['A', 'B', 'C', 'D'];

  function wrongQs() {
    return GK.questions().filter(function (q) { return GK.isWrong(q.id); });
  }

  function expandPanelHTML(q) {
    var h = '<div class="answer-panel" hidden><div class="answer-head"><b>答案与解析</b>' +
      '<span class="chip">' + (GK.BADGE_NAME[q.badge] || q.badge) + '</span></div><div class="answer-body">';
    h += '<p><b>正确答案：</b>' + (q.type === 'xz' && q.answer ? '<b>' + GK.escapeHTML(q.answer) + '</b>' : GK.renderMixed(q.answer || '原卷未提供')) + '</p>';
    if (q.analysis) h += '<div class="analysis">' + GK.analysisHTML(q.analysis) + '</div>';
    if (q.note) h += '<div class="answer-note">' + GK.escapeHTML(q.note) + '</div>';
    if (q.aimg && q.aimg.length) {
      h += '<div class="orig-ans"><div class="cap">原卷答案与过程截图</div>';
      q.aimg.forEach(function (src) { h += '<img loading="lazy" src="' + GK.escapeHTML(src) + '" alt="原卷答案截图">'; });
      h += '</div>';
    }
    return h + '</div></div>';
  }

  function itemHTML(q) {
    var h = '<div class="card wrong-item" data-id="' + q.id + '"><div class="q-meta">' +
      '<span class="chip">' + GK.CHAPTERS[q.ch].name + '</span><span class="chip">' + TYPE_NAME[q.type] + '</span>' +
      '<span class="chip">第 ' + q.num + ' 题</span>' + q.tags.map(function (t) {
        return '<span class="chip tag">' + GK.escapeHTML(t) + '</span>';
      }).join('') + '</div>';
    if (q.stem) h += '<div class="q-stem">' + GK.stemRender(q.stem) + '</div>';
    if (q.simg && q.simg.length) {
      h += '<div class="q-stem"><div class="img-label">题干原卷截图 · 矢量公式保留原图</div>';
      q.simg.forEach(function (src) { h += '<img loading="lazy" src="' + GK.escapeHTML(src) + '" alt="题干原卷截图">'; });
      h += '</div>';
    }
    if (q.type === 'xz') {
      h += '<div class="options">';
      q.options.forEach(function (o, i) {
        h += '<div class="opt" data-key="' + LETTERS[i] + '"><span class="key">' + LETTERS[i] + '</span>' +
          '<span class="opt-text">' + GK.optionHTML(o) + '</span></div>';
      });
      h += '</div>';
    }
    h += '<div class="wrong-tools"><button type="button" class="btn soft expand">展开答案与解析</button>' +
      '<button type="button" class="btn danger remove">移出错题本</button>' +
      '<a class="btn" href="quiz.html?id=' + encodeURIComponent(q.id) + '">去做这题</a></div>';
    h += expandPanelHTML(q) + '</div>';
    return h;
  }

  function topTags(qs) {
    var count = {};
    qs.forEach(function (q) {
      q.tags.forEach(function (t) { count[t] = (count[t] || 0) + 1; });
    });
    return Object.keys(count).sort(function (a, b) { return count[b] - count[a] || a.localeCompare(b); })
      .slice(0, 10).map(function (t) { return { tag: t, n: count[t] }; });
  }

  function render() {
    var all = wrongQs();
    var tags = topTags(all);
    var filtered = activeTag ? all.filter(function (q) { return q.tags.indexOf(activeTag) >= 0; }) : all;

    var h = '<section class="hero"><div class="kicker">错题本</div><h1>错题 ' + all.length + ' 道</h1>' +
      '<p class="sub">题目完整显示，答案与解析默认收起。可按知识点筛选，也可导出为今知错题包。</p></section>';

    // 统计
    h += '<div class="card"><div class="spread"><h2 style="margin:0">错题最多的 10 个知识点</h2>' +
      '<span class="muted small">按错题数降序</span></div>';
    if (!tags.length) {
      h += '<div class="empty"><div class="big">还没有错题</div><p>答错或自评“不会”后会出现在这里。</p></div>';
    } else {
      h += '<div class="tag-rank" style="margin-top:12px">';
      tags.forEach(function (t) {
        h += '<button type="button" class="' + (activeTag === t.tag ? 'active' : '') + '" data-tag="' + GK.escapeHTML(t.tag) + '">' +
          '<span>' + GK.escapeHTML(t.tag) + '</span><span class="n">' + t.n + ' 道' +
          (activeTag === t.tag ? ' · 点击取消筛选' : '') + '</span></button>';
      });
      h += '</div>';
      if (activeTag) {
        h += '<div class="row" style="margin-top:10px"><span class="chip red">筛选中：' + GK.escapeHTML(activeTag) +
          '</span><button type="button" class="btn small ghost" id="clearFilter">取消筛选</button>' +
          '<span class="muted small">共 ' + filtered.length + ' 道</span></div>';
      }
    }
    h += '<div class="row" style="margin-top:14px"><button type="button" class="btn" id="exportBtn">导出错题包（ZIP）</button>' +
      '<a class="btn" href="practice.html">去错题重练</a></div>' +
      '<p class="muted small" style="margin-top:10px">导出格式依据 jinzhi.fun/correction/import 官方页面示例：manifest.json + 逻辑章节文件夹 + legacy / interactive 字段。详见个人中心说明。</p></div>';

    // 列表
    if (!filtered.length) {
      h += '<div class="empty"><div class="big">没有可显示的错题</div><p>' +
        (activeTag ? '该知识点下暂无错题，可取消筛选。' : '去答题页做几道题吧。') + '</p></div>';
    } else {
      ['A', 'B'].forEach(function (ch) {
        var list = filtered.filter(function (q) { return q.ch === ch; });
        if (!list.length) return;
        h += '<section class="section"><div class="spread"><h2>' + GK.CHAPTERS[ch].name + '</h2>' +
          '<span class="muted small">' + list.length + ' 道</span></div>';
        var shown = list.slice(0, limits[ch]);
        shown.forEach(function (q) { h += itemHTML(q); });
        if (list.length > shown.length) {
          h += '<div class="row" style="margin-top:12px"><button type="button" class="btn block" data-more="' + ch + '">加载更多（还有 ' +
            (list.length - shown.length) + ' 道）</button></div>';
        }
        h += '</section>';
      });
    }

    h += '<div class="footer">错题数据只保存在本机浏览器</div>';
    document.getElementById('app').innerHTML = h;
    bind();
  }

  function bind() {
    document.querySelectorAll('.tag-rank button').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tag');
        activeTag = (activeTag === t) ? '' : t;
        render();
      });
    });
    var cf = document.getElementById('clearFilter');
    if (cf) cf.addEventListener('click', function () { activeTag = ''; render(); });

    document.querySelectorAll('.wrong-item').forEach(function (card) {
      var q = GK.byId(card.getAttribute('data-id'));
      var panel = card.querySelector('.answer-panel');
      var btn = card.querySelector('.expand');
      if (btn) btn.addEventListener('click', function () {
        panel.hidden = !panel.hidden;
        btn.textContent = panel.hidden ? '展开答案与解析' : '收起答案与解析';
        if (!panel.hidden && q && q.type === 'xz' && q.answer) {
          card.querySelectorAll('.opt').forEach(function (o) {
            if (o.getAttribute('data-key') === q.answer) o.classList.add('correct');
          });
        }
      });
      var rm = card.querySelector('.remove');
      if (rm) rm.addEventListener('click', function () {
        GK.removeWrong(q.id);
        GK.toast('已移出错题本');
        render();
      });
    });

    document.querySelectorAll('[data-more]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ch = b.getAttribute('data-more');
        limits[ch] += 20;
        render();
      });
    });

    var ex = document.getElementById('exportBtn');
    if (ex) ex.addEventListener('click', exportZip);
  }

  /* ---------- 导出 ZIP（官方 manifest 格式） ---------- */
  function plain(s) {
    return String(s || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\$|\\\(|\\\)/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function qText(q) {
    var t = '';
    if (q.stem) t = plain(q.stem);
    if (q.simg && q.simg.length) {
      t += (t ? '\n' : '') + '（题干为原卷矢量公式截图，未在错题包内附图片，请回原站查看）';
    }
    if (q.type === 'xz') {
      q.options.forEach(function (o, i) {
        t += '\n' + LETTERS[i] + '. ' + plain(o);
      });
    }
    return t || ('第 ' + q.num + ' 题（原卷题干截图题）');
  }

  function buildManifest() {
    var qs = wrongQs();
    var now = new Date().toISOString();
    var folders = [
      { id: 'ch_A', name: '1 极限与连续', parent_id: null },
      { id: 'ch_B', name: '2 导数与微分', parent_id: null }
    ];
    var mistakes = qs.map(function (q) {
      var base = {
        id: q.id,
        kind: q.type === 'xz' ? 'interactive' : 'legacy',
        folder_id: q.ch === 'A' ? 'ch_A' : 'ch_B',
        question: { text: qText(q), images: [], audio: [] },
        standard_answer: {
          text: q.type === 'xz' ? ('答案：' + (q.answer || '原卷未提供')) : plain(q.answer || '原卷未提供'),
          images: [], audio: []
        },
        user_solution: { text: '', images: [], audio: [] },
        note: plain(q.analysis || '') + (q.note ? (' ' + plain(q.note)) : ''),
        tags: ['高等数学', GK.CHAPTERS[q.ch].short, TYPE_NAME[q.type]],
        knowledge_points: q.tags.slice(),
        created_at: now
      };
      if (q.type === 'xz') {
        base.interaction = {
          type: 'single',
          options: q.options.map(function (o, i) {
            return { key: LETTERS[i], text: plain(o), is_correct: !!q.answer && LETTERS[i] === q.answer };
          }),
          answer: q.answer || '',
          analysis: plain(q.analysis || ''),
          passage: null
        };
      }
      return base;
    });
    return {
      format: 'jinzhi-mistake-package',
      schema_version: 1,
      title: '高数错题本（极限与连续 / 导数与微分）',
      created_at: now,
      folders: folders,
      mistakes: mistakes,
      media: []
    };
  }

  function crc32(bytes) {
    var table = crc32.table;
    if (!table) {
      table = crc32.table = new Uint32Array(256);
      for (var i = 0; i < 256; i++) {
        var c = i;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var j = 0; j < bytes.length; j++) crc = (crc >>> 8) ^ table[(crc ^ bytes[j]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function makeZip(files) {
    var enc = new TextEncoder();
    var chunks = [], central = [], offset = 0;
    function u16(n) { return [n & 255, (n >>> 8) & 255]; }
    function u32(n) { n = n >>> 0; return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      var local = [];
      local = local.concat([0x50, 0x4B, 0x03, 0x04]);
      local = local.concat(u16(20)); local = local.concat(u16(0x0800)); local = local.concat(u16(0));
      local = local.concat(u16(0)); local = local.concat(u16(0x5D67)); // 时间 00:00 / 日期 2026-11-07
      local = local.concat(u32(crc)); local = local.concat(u32(data.length)); local = local.concat(u32(data.length));
      local = local.concat(u16(name.length)); local = local.concat(u16(0));
      var localBytes = new Uint8Array(local);
      chunks.push(localBytes, name, data);
      var c = [];
      c = c.concat([0x50, 0x4B, 0x01, 0x02]);
      c = c.concat(u16(20)); c = c.concat(u16(20)); c = c.concat(u16(0x0800)); c = c.concat(u16(0));
      c = c.concat(u16(0)); c = c.concat(u16(0x5D67));
      c = c.concat(u32(crc)); c = c.concat(u32(data.length)); c = c.concat(u32(data.length));
      c = c.concat(u16(name.length)); c = c.concat(u16(0)); c = c.concat(u16(0));
      c = c.concat(u16(0)); c = c.concat(u16(0)); c = c.concat(u32(0));
      c = c.concat(u32(offset));
      central.push(new Uint8Array(c), name);
      offset += localBytes.length + name.length + data.length;
    });
    var centralStart = offset, centralSize = 0;
    central.forEach(function (b) { offset += b.length; centralSize += b.length; });
    var end = [];
    end = end.concat([0x50, 0x4B, 0x05, 0x06]);
    end = end.concat(u16(0)); end = end.concat(u16(0));
    end = end.concat(u16(files.length)); end = end.concat(u16(files.length));
    end = end.concat(u32(centralSize)); end = end.concat(u32(centralStart)); end = end.concat(u16(0));
    var all = chunks.concat(central, [new Uint8Array(end)]);
    return new Blob(all, { type: 'application/zip' });
  }

  function exportZip() {
    var qs = wrongQs();
    if (!qs.length) { GK.toast('错题本为空，无法导出'); return; }
    var manifest = buildManifest();
    var readme = '高数题库 · 错题包\n\n格式依据 https://www.jinzhi.fun/correction/import 官网示例：\n' +
      '- manifest.json：format=jinzhi-mistake-package，schema_version=1\n' +
      '- folders 按章节建立逻辑文件夹（ch_A / ch_B）\n' +
      '- 选择题为 interactive（single），其余为 legacy\n' +
      '- 图片题未附带原卷截图，题干以文字注明，避免引用无效媒体\n';
    var zip = makeZip([
      { name: 'manifest.json', text: JSON.stringify(manifest, null, 2) },
      { name: 'README.txt', text: readme }
    ]);
    var d = new Date();
    var name = '高数错题包_' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.zip';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(zip);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    GK.toast('已导出 ' + qs.length + ' 道错题');
  }

  render();
})();
