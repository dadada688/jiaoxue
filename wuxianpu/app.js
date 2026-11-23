/* =========================================================
   五线谱入门 · 交互脚本
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. 音高数据
     --------------------------------------------------------- */
  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var SOLFEGE = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
  var JIANPU = ['1', '2', '3', '4', '5', '6', '7'];
  var SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var POSITION = {
    '-2': '下加一线', '-1': '下加一间',
    '0': '第 1 线', '1': '第 1 间', '2': '第 2 线', '3': '第 2 间',
    '4': '第 3 线', '5': '第 3 间', '6': '第 4 线', '7': '第 4 间',
    '8': '第 5 线', '9': '第 5 线上方', '10': '上加一线', '11': '上加一间'
  };
  var CLEF_BASE = {
    treble: { index: 2, octave: 4 }, // 第 1 线 E4
    bass: { index: 4, octave: 2 }    // 第 1 线 G2
  };

  // 每种谱表都以第 1 线为 step = 0，每上升一线 / 间加 1
  function info(step, clef, acc) {
    clef = clef || 'treble';
    acc = acc === undefined ? 0 : Number(acc);
    var base = CLEF_BASE[clef] || CLEF_BASE.treble;
    var absolute = base.octave * 7 + base.index + step;
    var idx = ((absolute % 7) + 7) % 7;
    var oct = Math.floor(absolute / 7);
    var letter = LETTERS[idx];
    var accidental = acc === 1 ? '♯' : acc === -1 ? '♭' : '';
    return {
      step: step,
      clef: clef,
      acc: acc,
      letter: letter,
      oct: oct,
      name: letter + accidental + oct,
      sol: SOLFEGE[idx],
      jp: accidental + JIANPU[idx],
      midi: 12 * (oct + 1) + SEMITONE[letter] + acc,
      pos: POSITION[String(step)] || ''
    };
  }

  /* ---------------------------------------------------------
     2. 音频
     --------------------------------------------------------- */
  var actx = null;

  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function playMidi(midi, dur, at) {
    var c = audio();
    if (!c) return;
    dur = dur || 0.9;
    var t = at || (c.currentTime + 0.02);
    var f0 = 440 * Math.pow(2, (midi - 69) / 12);

    var bus = c.createGain();
    var oscillators = [];
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.4;
    lp.frequency.setValueAtTime(Math.min(9000, f0 * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(700, f0 * 2.4), t + dur * 0.9);
    lp.connect(bus);
    bus.connect(c.destination);

    var partials = [[1, 0.30, 'triangle'], [2, 0.11, 'sine'], [3, 0.055, 'sine'], [4, 0.028, 'sine']];
    partials.forEach(function (p) {
      var o = c.createOscillator();
      o.type = p[2];
      o.frequency.value = f0 * p[0];
      var g = c.createGain();
      g.gain.value = p[1];
      o.connect(g);
      g.connect(lp);
      oscillators.push(o);
      o.start(t);
      o.stop(t + dur + 0.9);
    });

    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(0.85, t + 0.008);
    bus.gain.exponentialRampToValueAtTime(0.30, t + 0.16);
    bus.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.45, dur) + 0.55);

    return {
      stop: function () {
        var now = c.currentTime;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setTargetAtTime(0.0001, now, 0.015);
        oscillators.forEach(function (o) {
          try { o.stop(now + 0.06); } catch (err) {}
        });
      }
    };
  }

  function playStep(step, dur, clef, acc) {
    playMidi(info(step, clef, acc).midi, dur);
  }

  /* ---------------------------------------------------------
     3. 谱面绘制
     --------------------------------------------------------- */
  var LINE_TOP = 60;
  var LINE_GAP = 18;
  var STAFF_BOTTOM = LINE_TOP + LINE_GAP * 4; // 132

  function yOf(step) {
    return STAFF_BOTTOM - step * (LINE_GAP / 2);
  }

  function staffLines(x1, x2) {
    var s = '';
    for (var i = 0; i < 5; i++) {
      var y = LINE_TOP + i * LINE_GAP;
      s += '<line class="staff-line" x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '"/>';
    }
    return s;
  }

  function clefMarkup(x, clef) {
    var cx = (x === undefined) ? 28 : x;
    var bass = clef === 'bass';
    return '<text class="clef-glyph" x="' + cx + '" y="132" font-size="' + (bass ? 92 : 100) + '" fill="#8a6a34">' +
      (bass ? '𝄢' : '𝄞') + '</text>';
  }

  function accidentalMarkup(x, y, acc) {
    var glyph = acc === 1 ? '♯' : acc === -1 ? '♭' : '♮';
    return '<text class="accidental-glyph" x="' + x + '" y="' + (y + 8) + '" font-size="27" text-anchor="middle">' + glyph + '</text>';
  }

  function keySignatureMarkup(x, clef, key) {
    if (key !== '1s') return '';
    var step = clef === 'bass' ? 6 : 8;
    return accidentalMarkup(x, yOf(step), 1);
  }

  function timeSignatureMarkup(x) {
    return '<g class="time-signature" text-anchor="middle">' +
      '<text x="' + x + '" y="85">4</text><text x="' + x + '" y="121">4</text></g>';
  }

  function ledgerLines(step, x) {
    var out = '';
    var s;
    if (step <= -2) {
      for (s = -2; s >= step; s -= 2) {
        out += '<line class="staff-ledger" x1="' + (x - 15) + '" y1="' + yOf(s) + '" x2="' + (x + 15) + '" y2="' + yOf(s) + '"/>';
      }
    } else if (step >= 10) {
      for (s = 10; s <= step; s += 2) {
        out += '<line class="staff-ledger" x1="' + (x - 15) + '" y1="' + yOf(s) + '" x2="' + (x + 15) + '" y2="' + yOf(s) + '"/>';
      }
    }
    return out;
  }

  function restGlyph(dur, x, opt) {
    opt = opt || {};
    var glyph = dur === 0.5 ? '𝄾' : dur === 4 ? '𝄻' : dur === 2 ? '𝄼' : '𝄽';
    return '<g class="svg-rest" data-dur="' + dur + '"' +
      (opt.idx !== undefined ? ' data-idx="' + opt.idx + '"' : '') +
      (opt.staffIdx !== undefined ? ' data-staff-idx="' + opt.staffIdx + '"' : '') + '>' +
      '<text class="rest-glyph" x="' + x + '" y="116" text-anchor="middle">' + glyph + '</text></g>';
  }

  /**
   * 画一个音符；dur 以四分音符为 1，支持 0.5 / 1 / 1.5 / 2 / 3 / 4。
   */
  function noteGlyph(step, x, opt) {
    opt = opt || {};
    var clef = opt.clef || 'treble';
    var acc = opt.acc === undefined ? 0 : Number(opt.acc);
    var it = info(step, clef, acc);
    var y = yOf(step);
    var dur = opt.dur || (opt.hollow ? 2 : 1);
    var stemUp = step < 4;
    var stemX = stemUp ? x + 7.4 : x - 7.4;
    var stemY2 = stemUp ? y - 42 : y + 42;
    var hollow = opt.hollow !== undefined ? !!opt.hollow : dur >= 2;
    var out = '';

    out += '<g class="svg-note" data-step="' + step + '" data-clef="' + clef + '" data-acc="' + acc + '"' +
      (opt.idx !== undefined ? ' data-idx="' + opt.idx + '"' : '') +
      (opt.staffIdx !== undefined ? ' data-staff-idx="' + opt.staffIdx + '"' : '') +
      ' tabindex="0" role="button" aria-label="' + it.name + '，' + it.pos + '">';
    out += '<circle class="hit" cx="' + x + '" cy="' + y + '" r="19"/>';
    out += ledgerLines(step, x);

    if (opt.printAcc) out += accidentalMarkup(x - 22, y, acc);
    out += '<ellipse class="note-head' + (hollow ? ' is-hollow' : '') + '" cx="' + x + '" cy="' + y +
      '" rx="8.2" ry="6" transform="rotate(-18 ' + x + ' ' + y + ')"/>';

    if (dur !== 4) {
      out += '<line class="note-stem" x1="' + stemX + '" y1="' + y + '" x2="' + stemX + '" y2="' + stemY2 + '"/>';
      if (dur <= 0.75) {
        out += '<path class="note-flag" d="M' + stemX + ' ' + stemY2 +
          (stemUp
            ? ' C' + (stemX + 13) + ' ' + (stemY2 + 9) + ' ' + (stemX + 13) + ' ' + (stemY2 + 24) + ' ' + (stemX + 1) + ' ' + (stemY2 + 31)
            : ' C' + (stemX - 13) + ' ' + (stemY2 - 9) + ' ' + (stemX - 13) + ' ' + (stemY2 - 24) + ' ' + (stemX - 1) + ' ' + (stemY2 - 31)) + '"/>';
      }
    }
    if (dur === 1.5 || dur === 3 || dur === 0.75) {
      out += '<circle class="note-dot" cx="' + (x + 14) + '" cy="' + y + '" r="2.2"/>';
    }

    if (opt.showLabel !== false) {
      var ly = opt.labelY || 206;
      out += '<line class="ladder-dot" x1="' + x + '" y1="' + (y + 10) + '" x2="' + x + '" y2="' + (ly - 12) + '"/>';
      out += '<text class="note-label" x="' + x + '" y="' + ly + '" text-anchor="middle">' + it.name + '</text>';
    }

    out += '</g>';
    return out;
  }

  /* ---------------------------------------------------------
     4. 各示意图
     --------------------------------------------------------- */
  function svgWrap(w, h, body, cls, label) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="' + (cls || '') + '" role="img" aria-label="' + (label || '五线谱示意图') + '">' + body + '</svg>';
  }

  /* 4.1 五线四间解剖图（可交互） */
  function renderAnatomy() {
    var host = document.getElementById('anatomy');
    if (!host) return;
    var W = 700, H = 250;
    var s = staffLines(64, 520);

    // 交互热区：先画线区，再画间区，保证都能点
    var lineYs = [60, 78, 96, 114, 132];
    var spaceYs = [69, 87, 105, 123];
    var i;
    for (i = 0; i < lineYs.length; i++) {
      s += '<rect class="band" data-band="第 ' + (5 - i) + ' 线" x="64" y="' + (lineYs[i] - 5) + '" width="456" height="10"/>';
    }
    for (i = 0; i < spaceYs.length; i++) {
      s += '<rect class="band" data-band="第 ' + (4 - i) + ' 间" x="64" y="' + (spaceYs[i] - 5) + '" width="456" height="10"/>';
    }

    // 右侧两列标注，避免线与间的文字挤在一起
    s += '<text class="band-tag" x="534" y="42" font-weight="600" fill="#4c4438">线</text>';
    s += '<text class="band-tag" x="624" y="42" font-weight="600" fill="#b8873f">间</text>';
    var j;
    for (j = 0; j < lineYs.length; j++) {
      s += '<text class="band-tag band-line-tag" x="534" y="' + (lineYs[j] + 4) + '">第 ' + (5 - j) + ' 线</text>';
    }
    for (j = 0; j < spaceYs.length; j++) {
      s += '<text class="band-tag" x="624" y="' + (spaceYs[j] + 4) + '">第 ' + (4 - j) + ' 间</text>';
    }

    // 左侧箭头：越往上越高
    s += '<g stroke="#c9b291" stroke-width="1.4">' +
      '<line x1="46" y1="140" x2="46" y2="58"/>' +
      '<path d="M41 64L46 55L51 64" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</g>';
    s += '<text x="46" y="160" text-anchor="middle" font-size="11" fill="#a9906a" font-family="Microsoft YaHei UI, sans-serif">音更高</text>';
    s += '<text x="90" y="212" font-size="11.5" fill="#b3a595" font-family="Microsoft YaHei UI, sans-serif">点任意一条线或一个间</text>';

    host.innerHTML = svgWrap(W, H, s, 'anatomy-svg', '五线谱的五条线与四个间');

    var caption = document.getElementById('anatomyCaption');
    var bands = host.querySelectorAll('.band');
    function activate(band) {
      Array.prototype.forEach.call(bands, function (b) { b.classList.remove('is-on'); });
      band.classList.add('is-on');
      if (caption) caption.textContent = '这是' + band.dataset.band + '。';
    }
    Array.prototype.forEach.call(bands, function (band) {
      band.addEventListener('mouseenter', function () { activate(band); });
      band.addEventListener('click', function () { activate(band); });
    });
  }

  /* 4.2 谱号演示：G4 */
  function renderClefDemo() {
    var host = document.getElementById('clefDemo');
    if (!host) return;
    var body = staffLines(26, 420) + clefMarkup() + noteGlyph(2, 250, { labelY: 200, showLabel: true });
    host.innerHTML = svgWrap(440, 225, body, 'show-names', '高音谱号圈住第二线，也就是 G');
  }

  /* 4.3 中央 C */
  function renderMiddleC() {
    var host = document.getElementById('middleC');
    if (!host) return;
    var body = staffLines(26, 420) + clefMarkup() + noteGlyph(-2, 250, { labelY: 200, showLabel: true });
    host.innerHTML = svgWrap(440, 225, body, 'show-names', '中央 C 在下加一线上');
  }

  /* 4.4 C4 - G4 */
  function renderFiveNotes() {
    var host = document.getElementById('fiveNotes');
    if (!host) return;
    var body = staffLines(26, 620) + clefMarkup();
    var steps = [-2, -1, 0, 1, 2];
    for (var i = 0; i < steps.length; i++) {
      body += noteGlyph(steps[i], 190 + i * 85, { labelY: 206, showLabel: true });
    }
    host.innerHTML = svgWrap(650, 235, body, 'show-names', 'C4 到 G4 五个音在五线谱上的位置');
  }

  /* 4.5 音位阶梯：高音与低音共用绘制逻辑 */
  function ladderSVG(clef, steps, label) {
    var W = 780, H = 268;
    var body = staffLines(60, 742) + clefMarkup(64, clef);
    var startX = 140, gap = steps.length === 11 ? 54 : 51;

    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      var it = info(step, clef);
      var x = startX + i * gap;
      var y = yOf(step);
      body += noteGlyph(step, x, { clef: clef, showLabel: false });
      body += '<line class="ladder-dot" x1="' + x + '" y1="' + (y + 10) + '" x2="' + x + '" y2="196"/>';
      body += '<text class="ladder-label" x="' + x + '" y="214">' + it.name + '</text>';
      body += '<text class="ladder-jp" x="' + x + '" y="231">' + it.jp + ' · ' + it.sol + '</text>';
    }
    return svgWrap(W, H, body, '', label);
  }

  function renderLadder() {
    var host = document.getElementById('ladder');
    if (host) host.innerHTML = ladderSVG('treble', [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], '高音谱表上 C4 到 G5 的十二个音位');
  }

  function renderBassClefDemo() {
    var host = document.getElementById('bassClefDemo');
    if (!host) return;
    var body = staffLines(26, 420) + clefMarkup(28, 'bass') + noteGlyph(6, 250, { clef: 'bass', labelY: 200, showLabel: true });
    host.innerHTML = svgWrap(440, 225, body, 'show-names', '低音谱号的两个点夹着第四线，也就是 F3');
  }

  function renderBassLadder() {
    var host = document.getElementById('bassLadder');
    if (host) host.innerHTML = ladderSVG('bass', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], '低音谱表上 G2 到中央 C 的十一个音位');
  }

  function renderGrandStaffDemo() {
    var host = document.getElementById('grandStaffDemo');
    if (!host) return;
    var body = '<path class="grand-brace" d="M30 45 C15 45 15 65 15 85 L15 135 C15 155 5 160 5 165 C5 170 15 175 15 195 L15 245 C15 265 15 285 30 285"/>';
    body += '<text class="staff-name" x="85" y="30">右手 · 高音谱表</text>';
    body += staffLines(85, 690) + clefMarkup(58, 'treble');
    body += noteGlyph(2, 280, { dur: 4, labelY: 160, showLabel: true });
    body += noteGlyph(5, 470, { dur: 4, labelY: 160, showLabel: true });
    body += '<g transform="translate(0 150)">';
    body += '<text class="staff-name" x="85" y="30">左手 · 低音谱表</text>';
    body += staffLines(85, 690) + clefMarkup(58, 'bass');
    body += noteGlyph(6, 280, { clef: 'bass', dur: 4, labelY: 160, showLabel: true });
    body += noteGlyph(10, 470, { clef: 'bass', dur: 4, labelY: 160, showLabel: true });
    body += '</g>';
    host.innerHTML = svgWrap(720, 350, body, 'show-names', '钢琴大谱表，上方高音谱表下方低音谱表');
  }

  /* 4.6 一小节 4 拍 */
  function renderTimeDemo() {
    var host = document.getElementById('timeDemo');
    if (!host) return;
    var body = staffLines(26, 440) + clefMarkup() + timeSignatureMarkup(100);
    var steps = [-2, -1, 0, 1];
    for (var i = 0; i < steps.length; i++) {
      body += noteGlyph(steps[i], 180 + i * 65, { dur: 1, labelY: 200, showLabel: true });
    }
    body += '<line class="staff-bar" x1="415" y1="60" x2="415" y2="132"/>';
    body += '<line class="staff-bar" x1="420" y1="60" x2="420" y2="132" stroke-width="3"/>';
    host.innerHTML = svgWrap(470, 228, body, 'show-names', '一小节四个四分音符');
  }

  function renderEighthDemo() {
    var host = document.getElementById('eighthDemo');
    if (!host) return;
    var body = staffLines(26, 590) + clefMarkup() + timeSignatureMarkup(100);
    var counts = ['1', '和', '2', '和', '3', '和', '4', '和'];
    for (var i = 0; i < 8; i++) {
      var x = 150 + i * 52;
      body += noteGlyph(0, x, { dur: 0.5, showLabel: false });
      body += '<text class="beat-label" x="' + x + '" y="184" text-anchor="middle">' + counts[i] + '</text>';
    }
    body += '<line class="staff-bar" x1="570" y1="60" x2="570" y2="132"/>';
    host.innerHTML = svgWrap(610, 210, body, '', '八个八分音符，两个一组共四拍');
  }

  function renderRhythmDemo() {
    var host = document.getElementById('rhythmDemo');
    if (!host) return;
    var notes = [
      { step: -2, dur: 1 }, { step: -1, dur: 0.5 }, { step: 0, dur: 0.5 }, { rest: true, dur: 1 }, { step: 2, dur: 1 },
      { step: 1, dur: 1.5 }, { step: 0, dur: 0.5 }, { step: -1, dur: 1 }, { rest: true, dur: 1 }
    ];
    var counts = ['1', '2', '2 和', '3', '4', '1', '2 和', '3', '4'];
    var left = 150, unit = 62, W = left + 8 * unit + 55;
    var body = staffLines(26, W - 20) + clefMarkup() + timeSignatureMarkup(105);
    var t = 0;
    notes.forEach(function (n, i) {
      var x = left + (t + Math.min(n.dur, 1) / 2) * unit;
      body += n.rest ? restGlyph(n.dur, x) : noteGlyph(n.step, x, { dur: n.dur, showLabel: false });
      body += '<text class="beat-label" x="' + x + '" y="184" text-anchor="middle">' + counts[i] + '</text>';
      t += n.dur;
      if (t === 4) body += '<line class="staff-bar" x1="' + (left + 4 * unit) + '" y1="60" x2="' + (left + 4 * unit) + '" y2="132"/>';
    });
    body += '<line class="staff-bar" x1="' + (left + 8 * unit) + '" y1="60" x2="' + (left + 8 * unit) + '" y2="132"/>';
    host.innerHTML = svgWrap(W, 210, body, '', '两小节节奏，包含八分音符附点和休止符');
  }

  function renderAccidentalDemo() {
    var host = document.getElementById('accidentalDemo');
    if (!host) return;
    var notes = [
      { step: 1, dur: 1, acc: 1, printAcc: true },
      { step: 1, dur: 1, acc: 1 },
      { step: 1, dur: 1, acc: 0, printAcc: true },
      { step: 0, dur: 1 },
      { step: 1, dur: 4 }
    ];
    var left = 145, unit = 70, W = left + 8 * unit + 50;
    var body = staffLines(26, W - 20) + clefMarkup() + timeSignatureMarkup(108);
    var t = 0;
    notes.forEach(function (n) {
      var x = left + (t + n.dur / 2) * unit;
      body += noteGlyph(n.step, x, { dur: n.dur, acc: n.acc, printAcc: n.printAcc, labelY: 200, showLabel: true });
      t += n.dur;
      if (t === 4) body += '<line class="staff-bar" x1="' + (left + 4 * unit) + '" y1="60" x2="' + (left + 4 * unit) + '" y2="132"/>';
    });
    body += '<line class="staff-bar" x1="' + (left + 8 * unit) + '" y1="60" x2="' + (left + 8 * unit) + '" y2="132"/>';
    host.innerHTML = svgWrap(W, 225, body, 'show-names', '临时升降与还原号在两个小节中的作用');
  }

  function renderKeySignatureDemo() {
    var host = document.getElementById('keySignatureDemo');
    if (!host) return;
    var left = 155, unit = 65, W = left + 8 * unit + 50;
    var body = staffLines(26, W - 20) + clefMarkup() + keySignatureMarkup(102, 'treble', '1s') + timeSignatureMarkup(130);
    body += noteGlyph(1, left + 2 * unit, { dur: 4, acc: 1, labelY: 200, showLabel: true });
    body += '<line class="staff-bar" x1="' + (left + 4 * unit) + '" y1="60" x2="' + (left + 4 * unit) + '" y2="132"/>';
    body += noteGlyph(8, left + 6 * unit, { dur: 4, acc: 1, labelY: 200, showLabel: true });
    body += '<line class="staff-bar" x1="' + (left + 8 * unit) + '" y1="60" x2="' + (left + 8 * unit) + '" y2="132"/>';
    host.innerHTML = svgWrap(W, 225, body, 'show-names', '一升号调号让不同八度的 F 都升高半音');
  }

  /* ---------------------------------------------------------
     5. 认音小测
     --------------------------------------------------------- */
  var QUIZ_RANGES = {
    base: { clef: 'treble', min: -2, max: 2 },
    mid: { clef: 'treble', min: -2, max: 5 },
    hard: { clef: 'treble', min: -2, max: 9 },
    bass: { clef: 'bass', min: 0, max: 10 }
  };
  var TOTAL_QUESTIONS = 10;

  var quiz = {
    level: 'base',
    format: 'name',
    clef: 'treble',
    step: null,
    lastStep: null,
    answered: false,
    correct: 0,
    done: 0,
    finished: false
  };

  var quizStage = document.getElementById('quizStage');
  var quizOptions = document.getElementById('quizOptions');
  var quizFb = document.getElementById('quizFb');
  var quizQ = document.getElementById('quizQ');
  var quizScoreEl = document.getElementById('quizScore');
  var quizTotalEl = document.getElementById('quizTotal');
  var quizLevels = document.getElementById('quizLevels');
  var quizRestart = document.getElementById('quizRestart');

  function quizStaffSVG(step, clef) {
    var body = staffLines(30, 400) + clefMarkup(28, clef) + noteGlyph(step, 250, { clef: clef, showLabel: false });
    return '<svg viewBox="0 0 430 215" role="img" aria-label="谱面上的一个待识别音符">' + body + '</svg>';
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function updateQuizScore() {
    if (quizScoreEl) quizScoreEl.textContent = quiz.correct;
    if (quizTotalEl) quizTotalEl.textContent = quiz.done;
  }

  function nextQuestion() {
    if (!quizStage) return;
    if (quiz.done >= TOTAL_QUESTIONS) {
      quiz.finished = true;
      quizStage.innerHTML = quizStaffSVG(quiz.clef === 'bass' ? 10 : -2, quiz.clef);
      quizQ.textContent = '本轮结束';
      quizOptions.innerHTML = '';
      quizFb.className = 'quiz-fb';
      quizFb.innerHTML = '10 题答对 <b>' + quiz.correct + '</b> 题。' +
        (quiz.correct >= 9 ? '非常好，可以换另一个难度了。' : quiz.correct >= 7 ? '不错，再刷一轮会更快。' : '别急，回第 ' + (quiz.clef === 'bass' ? '4' : '3') + ' 课把锚点再看一遍。');
      return;
    }

    var range = QUIZ_RANGES[quiz.level];
    quiz.clef = range.clef;
    var pool = [];
    for (var s = range.min; s <= range.max; s++) pool.push(s);

    var step;
    do {
      step = pool[Math.floor(Math.random() * pool.length)];
    } while (pool.length > 1 && step === quiz.lastStep);

    quiz.step = step;
    quiz.lastStep = step;
    quiz.answered = false;

    quizStage.innerHTML = quizStaffSVG(step, quiz.clef);
    quizQ.textContent = quiz.format === 'jp' ? '这个音符的简谱是几？' : '这个音符是哪个音？';

    if (quiz.format === 'jp') {
      var digits = ['1', '2', '3', '4', '5', '6', '7'];
      var correctJp = info(step, quiz.clef).jp;
      var picks = shuffle(digits.filter(function (d) { return d !== correctJp; })).slice(0, 3);
      picks.push(correctJp);
      quizOptions.innerHTML = shuffle(picks).map(function (d) {
        return '<button type="button" class="quiz-opt quiz-opt--jp" data-jp="' + d + '">' + d +
          '<small>简谱</small></button>';
      }).join('');
    } else {
      var options = shuffle(pool.filter(function (v) { return v !== step; })).slice(0, 3);
      options.push(step);
      options = shuffle(options);
      quizOptions.innerHTML = options.map(function (v) {
        var it = info(v, quiz.clef);
        return '<button type="button" class="quiz-opt" data-step="' + v + '">' + it.name +
          '<small>' + it.sol + ' · ' + it.jp + '</small></button>';
      }).join('');
    }

    quizFb.className = 'quiz-fb';
    quizFb.textContent = '';
  }

  function answer(btn) {
    if (quiz.answered || quiz.finished) return;
    quiz.answered = true;
    quiz.done++;

    var it = info(quiz.step, quiz.clef);
    var isJp = quiz.format === 'jp';
    var ok = isJp ? (btn.dataset.jp === it.jp) : (Number(btn.dataset.step) === quiz.step);
    var rightBtn = isJp
      ? quizOptions.querySelector('[data-jp="' + it.jp + '"]')
      : quizOptions.querySelector('[data-step="' + quiz.step + '"]');

    Array.prototype.forEach.call(quizOptions.querySelectorAll('button'), function (b) {
      b.disabled = true;
    });
    if (rightBtn) rightBtn.classList.add('is-right');
    if (!ok) btn.classList.add('is-wrong');

    if (ok) quiz.correct++;
    updateQuizScore();

    quizFb.className = 'quiz-fb ' + (ok ? 'ok' : 'no');
    if (isJp) {
      quizFb.innerHTML = ok
        ? '对了，它在' + it.pos + '，简谱是 <b>' + it.jp + '</b>（' + it.name + '）。'
        : '正确答案是 <b>' + it.jp + '</b>（' + it.name + '），它在' + it.pos + '。';
    } else {
      quizFb.innerHTML = ok
        ? '对了，<b>' + it.name + '</b> 在' + it.pos + '。'
        : '正确答案是 <b>' + it.name + '</b>，它在' + it.pos +
          (quiz.level === 'base' ? '；从下往上数第 ' + (quiz.step + 3) + ' 格。' : '；先找最近的锚点再数。');
    }

    playMidi(it.midi, 0.9);
    setTimeout(nextQuestion, 1400);
  }

  function resetQuiz() {
    quiz.correct = 0;
    quiz.done = 0;
    quiz.finished = false;
    quiz.lastStep = null;
    updateQuizScore();
    nextQuestion();
  }

  if (quizOptions) {
    quizOptions.addEventListener('click', function (e) {
      var btn = e.target.closest('.quiz-opt');
      if (btn) answer(btn);
    });
  }
  if (quizLevels) {
    quizLevels.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-level]');
      if (!btn) return;
      Array.prototype.forEach.call(quizLevels.querySelectorAll('button'), function (b) {
        b.classList.toggle('is-on', b === btn);
      });
      quiz.level = btn.dataset.level;
      resetQuiz();
    });
  }
  var quizFormat = document.getElementById('quizFormat');
  if (quizFormat) {
    quizFormat.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-format]');
      if (!btn) return;
      Array.prototype.forEach.call(quizFormat.querySelectorAll('button'), function (b) {
        b.classList.toggle('is-on', b === btn);
      });
      quiz.format = btn.dataset.format;
      resetQuiz();
    });
  }
  if (quizRestart) quizRestart.addEventListener('click', resetQuiz);

  /* ---------------------------------------------------------
     6. 谱例练习
     --------------------------------------------------------- */
  var MELODIES = {
    twinkle: {
      bpm: 100,
      staves: [{
        clef: 'treble', key: null,
        notes: [
          { step: -2, dur: 1 }, { step: -2, dur: 1 }, { step: 2, dur: 1 }, { step: 2, dur: 1 },
          { step: 3, dur: 1 }, { step: 3, dur: 1 }, { step: 2, dur: 2 },
          { step: 1, dur: 1 }, { step: 1, dur: 1 }, { step: 0, dur: 1 }, { step: 0, dur: 1 },
          { step: -1, dur: 1 }, { step: -1, dur: 1 }, { step: -2, dur: 2 }
        ]
      }]
    },
    bassSteps: {
      bpm: 88,
      staves: [{
        clef: 'bass', key: null,
        notes: [
          { step: 0, dur: 1 }, { step: 2, dur: 1 }, { step: 4, dur: 1 }, { step: 6, dur: 1 },
          { step: 6, dur: 1, acc: 1, printAcc: true }, { step: 6, dur: 1, acc: 1 }, { step: 6, dur: 2, acc: 0, printAcc: true },
          { step: 6, dur: 1 }, { step: 4, dur: 1 }, { step: 2, dur: 2 },
          { step: 0, dur: 4 }
        ]
      }]
    },
    grand: {
      bpm: 92,
      staves: [
        {
          clef: 'treble', key: '1s',
          notes: [
            { step: 2, dur: 1 }, { step: 2, dur: 1 }, { step: 3, dur: 1 }, { step: 3, dur: 1 },
            { step: 4, dur: 1 }, { step: 4, dur: 1 }, { step: 3, dur: 1 }, { step: 3, dur: 1 },
            { step: 2, dur: 1 }, { step: 3, dur: 1 }, { step: 4, dur: 1 }, { step: 1, dur: 1 },
            { step: 2, dur: 2 }, { step: 1, dur: 1 }, { step: 2, dur: 1 }
          ]
        },
        {
          clef: 'bass', key: '1s',
          notes: [{ step: 0, dur: 4 }, { step: 4, dur: 4 }, { step: 0, dur: 4 }, { step: 3, dur: 4 }]
        }
      ]
    }
  };

  function effectiveAcc(n, stave) {
    if (n.acc !== undefined) return Number(n.acc);
    if (stave.key === '1s' && info(n.step, stave.clef).letter === 'F') return 1;
    return 0;
  }

  function staffBeats(stave) {
    return stave.notes.reduce(function (sum, n) { return sum + n.dur; }, 0);
  }

  function melodySVG(melody) {
    var unit = 44, left = 155, right = 60;
    var total = Math.max.apply(null, melody.staves.map(staffBeats));
    var W = left + total * unit + right;
    var grand = melody.staves.length > 1;
    var offset = 180;
    var H = grand ? 390 : 258;
    var body = '';

    if (grand) {
      body += '<path class="grand-brace" d="M30 45 C15 45 15 65 15 90 L15 145 C15 165 5 172 5 178 C5 184 15 191 15 211 L15 265 C15 290 15 315 30 315"/>';
      body += '<text class="staff-name" x="28" y="30">右手</text><text class="staff-name" x="28" y="210">左手</text>';
    }

    melody.staves.forEach(function (stave, staffIdx) {
      var t = 0;
      var group = staffLines(26, W - 20) + clefMarkup(28, stave.clef) +
        keySignatureMarkup(100, stave.clef, stave.key) + timeSignatureMarkup(stave.key ? 128 : 108);

      for (var b = 4; b < total; b += 4) {
        var bx = left + b * unit;
        group += '<line class="staff-bar" x1="' + bx + '" y1="60" x2="' + bx + '" y2="132"/>';
      }
      var endX = left + total * unit;
      group += '<line class="staff-bar" x1="' + endX + '" y1="60" x2="' + endX + '" y2="132"/>';
      group += '<line class="staff-bar" x1="' + (endX + 4) + '" y1="60" x2="' + (endX + 4) + '" y2="132" stroke-width="3"/>';

      stave.notes.forEach(function (n, i) {
        var x = left + (t + n.dur / 2) * unit;
        var opts = { dur: n.dur, idx: i, staffIdx: staffIdx, labelY: grand ? 158 : 212, showLabel: true };
        if (n.rest) {
          group += restGlyph(n.dur, x, opts);
        } else {
          opts.clef = stave.clef;
          opts.acc = effectiveAcc(n, stave);
          opts.printAcc = n.printAcc;
          group += noteGlyph(n.step, x, opts);
        }
        t += n.dur;
      });
      body += grand ? '<g transform="translate(0 ' + (staffIdx * offset) + ')">' + group + '</g>' : group;
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (grand ? '大谱表综合视读练习' : '单谱表视读练习') + '">' + body + '</svg>';
  }

  var playTimers = [];
  var playVoices = [];

  function stopPlayback() {
    playTimers.forEach(function (t) { clearTimeout(t); });
    playTimers = [];
    playVoices.forEach(function (v) { if (v && v.stop) v.stop(); });
    playVoices = [];
    Array.prototype.forEach.call(document.querySelectorAll('.is-playing'), function (n) {
      n.classList.remove('is-playing');
    });
  }

  function playExercise(ex) {
    var melody = MELODIES[ex.dataset.melody];
    if (!melody) return;
    stopPlayback();
    var c = audio();
    if (!c) return;
    var svg = ex.querySelector('svg');
    var beat = 60 / melody.bpm;
    var start = c.currentTime + 0.12;
    var total = Math.max.apply(null, melody.staves.map(staffBeats));
    ex.classList.add('is-playing');

    melody.staves.forEach(function (stave, staffIdx) {
      var t = 0;
      stave.notes.forEach(function (n, i) {
        var when = start + t * beat;
        var delay = Math.max(0, (when - c.currentTime) * 1000);
        var g = svg.querySelector('[data-staff-idx="' + staffIdx + '"][data-idx="' + i + '"]');
        if (!n.rest) {
          var voice = playMidi(info(n.step, stave.clef, effectiveAcc(n, stave)).midi, n.dur * beat * 0.95, when);
          playVoices.push(voice);
        }
        playTimers.push(setTimeout(function () {
          if (g) g.classList.add('is-playing');
        }, delay));
        playTimers.push(setTimeout(function () {
          if (g) g.classList.remove('is-playing');
        }, delay + n.dur * beat * 1000));
        t += n.dur;
      });
    });

    playTimers.push(setTimeout(function () {
      Array.prototype.forEach.call(svg.querySelectorAll('.is-playing'), function (el) {
        el.classList.remove('is-playing');
      });
      ex.classList.remove('is-playing');
      playVoices = [];
    }, (total * beat + 0.5) * 1000));
  }

  function initExercises() {
    Array.prototype.forEach.call(document.querySelectorAll('.exercise'), function (ex) {
      var melody = MELODIES[ex.dataset.melody];
      if (!melody) return;
      var host = ex.querySelector('.ex-staff');
      if (!host) return;
      host.innerHTML = melodySVG(melody);

      ex.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var act = btn.dataset.act;
        var svg = ex.querySelector('svg');

        if (act === 'play') {
          playExercise(ex);
        } else if (act === 'stop') {
          stopPlayback();
        } else if (act === 'names') {
          svg.classList.toggle('show-names');
          btn.textContent = svg.classList.contains('show-names') ? '隐藏音名' : '显示音名';
        }
      });
    });
  }

  /* ---------------------------------------------------------
     7. 点击音符发声
     --------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var g = e.target.closest('.svg-note');
    if (!g) return;
    if (g.closest('.quiz-stage')) return;
    var step = Number(g.dataset.step);
    playStep(step, 0.9, g.dataset.clef, Number(g.dataset.acc || 0));
    g.classList.add('is-on');
    setTimeout(function () { g.classList.remove('is-on'); }, 1600);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var g = document.activeElement;
    if (!g || !g.classList || !g.classList.contains('svg-note')) return;
    if (g.closest('.quiz-stage')) return;
    e.preventDefault();
    playStep(Number(g.dataset.step), 0.9, g.dataset.clef, Number(g.dataset.acc || 0));
    g.classList.add('is-on');
    setTimeout(function () { g.classList.remove('is-on'); }, 1600);
  });

  /* ---------------------------------------------------------
     8. 进度 / 导航
     --------------------------------------------------------- */
  var store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem('staffSchool.' + k);
        return v ? JSON.parse(v) : d;
      } catch (err) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('staffSchool.' + k, JSON.stringify(v)); } catch (err) {}
    }
  };

  var OLD_COURSE_MAP = {
    '1': 'lines', '2': 'treble', '3': 'treble-notes', '4': 'rhythm',
    '5': 'quiz', '6': 'sight', '7': 'review'
  };
  var courseIds = Array.prototype.map.call(document.querySelectorAll('.toc a[data-course]'), function (a) {
    return a.dataset.course;
  });
  var doneList = store.get('done', []);
  var doneSet = {};
  doneList.forEach(function (n) {
    var old = String(n);
    var id = OLD_COURSE_MAP[old] || old;
    if (courseIds.indexOf(id) !== -1) doneSet[id] = true;
  });

  function renderDone() {
    var count = 0;
    courseIds.forEach(function (id) { if (doneSet[id]) count++; });

    Array.prototype.forEach.call(document.querySelectorAll('.done-btn'), function (b) {
      var on = !!doneSet[b.dataset.done];
      var lesson = b.closest('.lesson');
      var number = lesson ? lesson.dataset.lesson : '';
      b.classList.toggle('is-done', on);
      b.textContent = on ? '已完成 · 点击取消' : '标记第 ' + number + ' 课已完成';
    });

    Array.prototype.forEach.call(document.querySelectorAll('.toc a, .dir-item'), function (a) {
      a.classList.toggle('is-done', !!doneSet[a.dataset.course]);
    });

    var percent = Math.min(100, (count / courseIds.length) * 100) + '%';
    var c = document.getElementById('doneCount');
    if (c) c.textContent = count;
    var total = document.getElementById('doneTotal');
    if (total) total.textContent = courseIds.length;
    var bar = document.getElementById('doneBar');
    if (bar) bar.style.width = percent;

    var dirCount = document.getElementById('dirDoneCount');
    if (dirCount) dirCount.textContent = count;
    var dirTotal = document.getElementById('dirDoneTotal');
    if (dirTotal) dirTotal.textContent = courseIds.length;
    var dirBar = document.getElementById('dirDoneBar');
    if (dirBar) dirBar.style.width = percent;

    store.set('done', courseIds.filter(function (k) { return doneSet[k]; }));
  }

  Array.prototype.forEach.call(document.querySelectorAll('.done-btn'), function (b) {
    b.addEventListener('click', function () {
      var id = b.dataset.done;
      if (doneSet[id]) delete doneSet[id];
      else doneSet[id] = true;
      renderDone();
    });
  });

  // 移动端抽屉
  var navBtn = document.getElementById('navBtn');
  var sidebar = document.getElementById('sidebar');
  var scrim = document.getElementById('scrim');

  function closeDrawer() {
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    if (scrim) scrim.classList.remove('is-on');
    if (navBtn) navBtn.setAttribute('aria-expanded', 'false');
  }

  if (navBtn) {
    navBtn.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      if (scrim) scrim.classList.toggle('is-on', open);
      navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  if (scrim) scrim.addEventListener('click', closeDrawer);
  if (sidebar) {
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('.toc a')) closeDrawer();
    });
  }

  // 目录高亮
  if ('IntersectionObserver' in window) {
    var tocLinks = document.querySelectorAll('.toc a');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        if (en.target.classList.contains('hero')) {
          Array.prototype.forEach.call(tocLinks, function (a) { a.classList.remove('is-active'); });
          return;
        }
        var id = en.target.id;
        Array.prototype.forEach.call(tocLinks, function (a) {
          a.classList.toggle('is-active', a.dataset.toc === id);
        });
      });
    }, { rootMargin: '-15% 0px -70% 0px' });

    Array.prototype.forEach.call(document.querySelectorAll('.lesson'), function (s) {
      observer.observe(s);
    });
    var heroSection = document.querySelector('.hero');
    if (heroSection) observer.observe(heroSection);
  }

  // 阅读进度
  var readbar = document.getElementById('readbar');
  function onScroll() {
    if (!readbar) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    readbar.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------
     9. 初始化
     --------------------------------------------------------- */
  function init() {
    renderAnatomy();
    renderClefDemo();
    renderMiddleC();
    renderFiveNotes();
    renderLadder();
    renderBassClefDemo();
    renderBassLadder();
    renderGrandStaffDemo();
    renderTimeDemo();
    renderEighthDemo();
    renderRhythmDemo();
    renderAccidentalDemo();
    renderKeySignatureDemo();
    initExercises();
    updateQuizScore();
    nextQuestion();
    renderDone();
    onScroll();

    // 页面里的谱图是脚本生成的，深链接可能因高度变化而偏移，这里校正一次
    if (location.hash && location.hash.length > 1) {
      var target = document.querySelector(location.hash);
      if (target) {
        setTimeout(function () {
          document.documentElement.style.scrollBehavior = 'auto';
          var top = target.getBoundingClientRect().top + window.pageYOffset - 26;
          window.scrollTo(0, top);
        }, 120);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
