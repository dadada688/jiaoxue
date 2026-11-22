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
    '8': '第 5 线', '9': '第 5 线上方'
  };

  // step: 以「第 1 线 = E4」为 0，每上升一格 +1
  function info(step) {
    var idx = ((step + 2) % 7 + 7) % 7;
    var oct = 4 + Math.floor((step + 2) / 7);
    var letter = LETTERS[idx];
    return {
      step: step,
      letter: letter,
      oct: oct,
      name: letter + oct,
      sol: SOLFEGE[idx],
      jp: JIANPU[idx],
      midi: 12 * (oct + 1) + SEMITONE[letter],
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
      o.start(t);
      o.stop(t + dur + 0.9);
    });

    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.linearRampToValueAtTime(0.85, t + 0.008);
    bus.gain.exponentialRampToValueAtTime(0.30, t + 0.16);
    bus.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.45, dur) + 0.55);
  }

  function playStep(step, dur) {
    playMidi(info(step).midi, dur);
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

  function clefMarkup(x) {
    var cx = (x === undefined) ? 28 : x;
    return '<text class="clef-glyph" x="' + cx + '" y="132" font-size="100" fill="#8a6a34">\uD834\uDD1E</text>';
  }

  /**
   * 画一个音符
   * opt: { hollow, mag, idx, labelY, showLabel, interactive }
   */
  function noteGlyph(step, x, opt) {
    opt = opt || {};
    var it = info(step);
    var y = yOf(step);
    var stemUp = step < 4;
    var stemX = stemUp ? x + 7.4 : x - 7.4;
    var stemY2 = stemUp ? y - 42 : y + 42;
    var hollow = !!opt.hollow;
    var out = '';

    out += '<g class="svg-note" data-step="' + step + '"' +
      (opt.idx !== undefined ? ' data-idx="' + opt.idx + '"' : '') +
      ' tabindex="0" role="button" aria-label="' + it.name + '，' + it.pos + '">';
    out += '<circle class="hit" cx="' + x + '" cy="' + y + '" r="19"/>';

    if (step <= -2) {
      out += '<line class="staff-ledger" x1="' + (x - 15) + '" y1="' + y + '" x2="' + (x + 15) + '" y2="' + y + '"/>';
    }

    out += '<ellipse class="note-head' + (hollow ? ' is-hollow' : '') + '" cx="' + x + '" cy="' + y +
      '" rx="8.2" ry="6" transform="rotate(-18 ' + x + ' ' + y + ')"/>';
    out += '<line class="note-stem" x1="' + stemX + '" y1="' + y + '" x2="' + stemX + '" y2="' + stemY2 + '"/>';

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
      s += '<rect class="band" data-band="第 ' + (i + 1) + ' 线" x="64" y="' + (lineYs[i] - 5) + '" width="456" height="10"/>';
    }
    for (i = 0; i < spaceYs.length; i++) {
      s += '<rect class="band" data-band="第 ' + (i + 1) + ' 间" x="64" y="' + (spaceYs[i] - 5) + '" width="456" height="10"/>';
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

  /* 4.5 全谱表 C4 - G5 */
  function renderLadder() {
    var host = document.getElementById('ladder');
    if (!host) return;
    var W = 780, H = 268;
    var body = staffLines(60, 742) + clefMarkup(64);
    var steps = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    var startX = 140, gap = 51;

    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      var it = info(step);
      var x = startX + i * gap;
      var y = yOf(step);
      if (step <= -2) {
        body += '<line class="staff-ledger" x1="' + (x - 15) + '" y1="' + y + '" x2="' + (x + 15) + '" y2="' + y + '"/>';
      }
      body += '<g class="svg-note" data-step="' + step + '" tabindex="0" role="button" aria-label="' + it.name + '，' + it.pos + '">' +
        '<circle class="hit" cx="' + x + '" cy="' + y + '" r="18"/>' +
        '<ellipse class="note-head" cx="' + x + '" cy="' + y + '" rx="8" ry="5.9" transform="rotate(-18 ' + x + ' ' + y + ')"/>' +
        '<line class="note-stem" x1="' + (step < 4 ? x + 7.2 : x - 7.2) + '" y1="' + y + '" x2="' + (step < 4 ? x + 7.2 : x - 7.2) + '" y2="' + (step < 4 ? y - 40 : y + 40) + '"/>' +
        '</g>';
      body += '<line class="ladder-dot" x1="' + x + '" y1="' + (y + 10) + '" x2="' + x + '" y2="196"/>';
      body += '<text class="ladder-label" x="' + x + '" y="214">' + it.name + '</text>';
      body += '<text class="ladder-jp" x="' + x + '" y="231">' + it.jp + ' · ' + it.sol + '</text>';
    }
    host.innerHTML = svgWrap(W, H, body, '', '高音谱表上 C4 到 G5 的十二个音位');
  }

  /* 4.6 一小节 4 拍 */
  function renderTimeDemo() {
    var host = document.getElementById('timeDemo');
    if (!host) return;
    var W = 470, H = 220;
    var body = staffLines(26, 440) + clefMarkup();
    var steps = [-2, -1, 0, 1];
    for (var i = 0; i < steps.length; i++) {
      body += noteGlyph(steps[i], 180 + i * 65, { labelY: 200, showLabel: true });
    }
    body += '<line class="staff-bar" x1="415" y1="60" x2="415" y2="132"/>';
    body += '<line class="staff-bar" x1="420" y1="60" x2="420" y2="132" stroke-width="3"/>';
    host.innerHTML = svgWrap(W, 228, body, 'show-names', '一小节四个四分音符');
  }

  /* ---------------------------------------------------------
     5. 认音小测
     --------------------------------------------------------- */
  var QUIZ_RANGES = { base: [-2, 2], mid: [-2, 5], hard: [-2, 9] };
  var TOTAL_QUESTIONS = 10;

  var quiz = {
    level: 'base',
    format: 'name',
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

  function quizStaffSVG(step) {
    var body = staffLines(30, 400) + clefMarkup() + noteGlyph(step, 250, { showLabel: false });
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
      quizStage.innerHTML = quizStaffSVG(-2);
      quizQ.textContent = '本轮结束';
      quizOptions.innerHTML = '';
      quizFb.className = 'quiz-fb';
      quizFb.innerHTML = '10 题答对 <b>' + quiz.correct + '</b> 题。' +
        (quiz.correct >= 9 ? '非常好，可以换更高的难度了。' : quiz.correct >= 7 ? '不错，再刷一轮会更快。' : '别急，回第 3 课把锚点再看一遍。');
      return;
    }

    var range = QUIZ_RANGES[quiz.level];
    var pool = [];
    for (var s = range[0]; s <= range[1]; s++) pool.push(s);

    var step;
    do {
      step = pool[Math.floor(Math.random() * pool.length)];
    } while (pool.length > 1 && step === quiz.lastStep);

    quiz.step = step;
    quiz.lastStep = step;
    quiz.answered = false;

    quizStage.innerHTML = quizStaffSVG(step);
    quizQ.textContent = quiz.format === 'jp' ? '这个音符的简谱是几？' : '这个音符是哪个音？';

    if (quiz.format === 'jp') {
      var digits = ['1', '2', '3', '4', '5', '6', '7'];
      var correctJp = info(step).jp;
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
        var it = info(v);
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

    var it = info(quiz.step);
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
      notes: [[-2, 1], [-2, 1], [2, 1], [2, 1], [3, 1], [3, 1], [2, 2], [1, 1], [1, 1], [0, 1], [0, 1], [-1, 1], [-1, 1], [-2, 2]]
    },
    ode: {
      bpm: 96,
      notes: [[0, 1], [0, 1], [1, 1], [2, 1], [2, 1], [1, 1], [0, 1], [-1, 1], [-2, 1], [-2, 1], [-1, 1], [0, 1], [0, 1], [-1, 1], [-1, 2]]
    },
    mary: {
      bpm: 100,
      notes: [[0, 1], [-1, 1], [-2, 1], [-1, 1], [0, 1], [0, 1], [0, 2], [-1, 1], [-1, 1], [-1, 2], [0, 1], [2, 1], [2, 2]]
    }
  };

  function melodySVG(melody) {
    var unit = 36, left = 100, right = 56;
    var total = melody.notes.reduce(function (a, n) { return a + n[1]; }, 0);
    var W = left + total * unit + right;
    var H = 258;
    var body = staffLines(26, W - 20) + clefMarkup();

    for (var b = 4; b < total; b += 4) {
      var bx = left + b * unit;
      body += '<line class="staff-bar" x1="' + bx + '" y1="60" x2="' + bx + '" y2="132"/>';
    }
    var endX = left + total * unit;
    body += '<line class="staff-bar" x1="' + endX + '" y1="60" x2="' + endX + '" y2="132"/>';
    body += '<line class="staff-bar" x1="' + (endX + 4) + '" y1="60" x2="' + (endX + 4) + '" y2="132" stroke-width="3"/>';

    var t = 0;
    melody.notes.forEach(function (n, i) {
      body += noteGlyph(n[0], left + t * unit + 15, { hollow: n[1] >= 2, idx: i, labelY: 212 });
      t += n[1];
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="练习谱例">' + body + '</svg>';
  }

  var playTimers = [];

  function stopPlayback() {
    playTimers.forEach(function (t) { clearTimeout(t); });
    playTimers = [];
    Array.prototype.forEach.call(document.querySelectorAll('.svg-note.is-playing'), function (n) {
      n.classList.remove('is-playing');
    });
  }

  function playExercise(ex) {
    var melody = MELODIES[ex.dataset.melody];
    if (!melody) return;
    stopPlayback();
    var svg = ex.querySelector('svg');
    var beat = 60 / melody.bpm;
    var t = 0;
    var start = (audio() ? actx.currentTime : 0) + 0.12;

    melody.notes.forEach(function (n, i) {
      var when = start + t * beat;
      playMidi(info(n[0]).midi, n[1] * beat * 0.95, when);
      var delay = (when - actx.currentTime) * 1000;
      playTimers.push(setTimeout(function () {
        Array.prototype.forEach.call(svg.querySelectorAll('.is-playing'), function (el) {
          el.classList.remove('is-playing');
        });
        var g = svg.querySelector('[data-idx="' + i + '"]');
        if (g) g.classList.add('is-playing');
      }, Math.max(0, delay)));
      t += n[1];
    });

    playTimers.push(setTimeout(function () {
      Array.prototype.forEach.call(svg.querySelectorAll('.is-playing'), function (el) {
        el.classList.remove('is-playing');
      });
    }, (t * beat + 0.5) * 1000));
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
    playStep(step, 0.9);
    g.classList.add('is-on');
    setTimeout(function () { g.classList.remove('is-on'); }, 1600);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var g = document.activeElement;
    if (!g || !g.classList || !g.classList.contains('svg-note')) return;
    if (g.closest('.quiz-stage')) return;
    e.preventDefault();
    playStep(Number(g.dataset.step), 0.9);
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

  var doneList = store.get('done', []);
  var doneSet = {};
  doneList.forEach(function (n) { doneSet[String(n)] = true; });

  function renderDone() {
    var count = 0;
    Object.keys(doneSet).forEach(function (k) { if (doneSet[k]) count++; });

    Array.prototype.forEach.call(document.querySelectorAll('.done-btn'), function (b) {
      var on = !!doneSet[b.dataset.done];
      b.classList.toggle('is-done', on);
      b.textContent = on ? '已完成 · 点击取消' : '标记第 ' + b.dataset.done + ' 课已完成';
    });

    Array.prototype.forEach.call(document.querySelectorAll('.toc a'), function (a) {
      var id = (a.dataset.toc || '').replace('lesson', '');
      a.classList.toggle('is-done', !!doneSet[id]);
    });

    var c = document.getElementById('doneCount');
    if (c) c.textContent = count;
    var bar = document.getElementById('doneBar');
    if (bar) bar.style.width = Math.min(100, (count / 7) * 100) + '%';

    store.set('done', Object.keys(doneSet).filter(function (k) { return doneSet[k]; }));
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
    renderTimeDemo();
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
