/* Four in a Row web preview UI. Human plays red (1); the house plays ivory (2). */
(function () {
  'use strict';
  var F = window.FourEngine, C = F.COLS, R = F.ROWS;
  var root = document.getElementById('tgr-four-app');
  if (!root) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var boardEl = root.querySelector('.tgr-f-board'), statusEl = root.querySelector('.tgr-status'), live = root.querySelector('#tgr-f-live');
  var btnUndo = root.querySelector('[data-act=undo]'), btnHint = root.querySelector('[data-act=hint]'), btnNew = root.querySelector('[data-act=new]');
  var levelBtns = root.querySelectorAll('[data-level]'), firstBtns = root.querySelectorAll('[data-first]');
  var level = 'medium', humanFirst = true, board, moves, turn, over, busy, timer, cols = [], slots = [], winCells = null;

  function build() {
    boardEl.innerHTML = ''; cols = []; slots = [];
    for (var c = 0; c < C; c++) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tgr-f-col'; b.dataset.col = c;
      b.setAttribute('aria-label', 'Column ' + (c + 1));
      slots[c] = [];
      for (var r = 0; r < R; r++) { var s = document.createElement('span'); s.className = 'tgr-f-slot'; b.appendChild(s); slots[c][r] = s; }
      b.addEventListener('click', onCol); b.addEventListener('keydown', onKey);
      boardEl.appendChild(b); cols.push(b);
    }
  }
  function say(t, announce) { statusEl.textContent = t; if (announce !== false) live.textContent = t; }
  function colLabel(c) {
    var n = 0; for (var r = 0; r < R; r++) if (board[r * C + c]) n++;
    return 'Column ' + (c + 1) + ', ' + (R - n) + ' free';
  }
  function setDisc(r, c, p, animate) {
    var d = document.createElement('span'); d.className = 'tgr-f-disc tgr-p' + p;
    if (animate && !reduce) {
      var h = slots[c][r].getBoundingClientRect().height + 7;
      d.style.setProperty('--from', (-(r + 1) * h - 20) + 'px'); d.style.setProperty('--dur', (0.28 + r * 0.05) + 's'); d.classList.add('tgr-drop');
    }
    slots[c][r].appendChild(d); return d;
  }
  function render() {
    for (var c = 0; c < C; c++) {
      for (var r = 0; r < R; r++) {
        var s = slots[c][r], v = board[r * C + c], d = s.firstChild;
        if (v && (!d || !d.classList.contains('tgr-p' + v))) { s.innerHTML = ''; setDisc(r, c, v, false); }
        if (!v && d) s.innerHTML = '';
      }
      cols[c].disabled = over || busy || turn !== 1 || board[c] !== 0;
      cols[c].setAttribute('aria-label', colLabel(c));
    }
    btnUndo.disabled = busy || undoCount() === 0;
    btnHint.disabled = over || busy || turn !== 1;
  }
  function clearHint() { var h = boardEl.querySelector('.tgr-hint'); if (h) h.classList.remove('tgr-hint'); }
  function drop(c, p) {
    var r = F.dropRow(board, c);
    board = F.play(board, c, p); moves.push(c);
    clearHint();
    var d = setDisc(r, c, p, true);
    var res = F.result(board);
    if (res) { over = true; finish(res); } else turn = 3 - p;
    return d;
  }
  function finish(res) {
    if (res === 1) say('You win. Four in a row, well played.');
    else if (res === 2) say('The house wins this one. Undo a move or deal again.');
    else say('A draw: the board is full.');
    var w = F.findWin(board, res);
    if (w) setTimeout(function () { w.forEach(function (rc) { var d = slots[rc[1]][rc[0]].firstChild; if (d) d.classList.add('tgr-win'); }); }, reduce ? 0 : 400);
  }
  function onCol(e) {
    var c = +e.currentTarget.dataset.col;
    if (over || busy || turn !== 1 || board[c] !== 0) return;
    drop(c, 1); render();
    if (!over) { say('The house is thinking...', false); houseMove(); }
  }
  function houseMove() {
    busy = true; render();
    timer = setTimeout(function () {
      var c = F.chooseMove(board, 2, level);
      busy = false; drop(c, 2); render();
      if (!over) { say('Your move. Pick a column.', false); live.textContent = 'The house played column ' + (c + 1) + '. Your move.'; }
      else live.textContent = statusEl.textContent;
    }, reduce ? 150 : 650);
  }
  function onKey(e) {
    var c = +e.currentTarget.dataset.col, k = e.key;
    if (k === 'ArrowRight') { e.preventDefault(); cols[(c + 1) % C].focus(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); cols[(c + C - 1) % C].focus(); }
  }
  document.addEventListener('keydown', function (e) {
    if (/^[1-7]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      var b = cols[+e.key - 1]; if (b && !b.disabled) b.click();
    }
  });
  function newGame() {
    clearTimeout(timer); board = F.newBoard(); moves = []; turn = 1; over = false; busy = false; build();
    if (!humanFirst) { say('The house opens...', false); turn = 2; houseMove(); }
    else say('Your move. Drop a disc: tap a column, or press 1 to 7.'); render();
  }
  btnNew.addEventListener('click', newGame);
  function mover(i) { return (i % 2 === 0) === humanFirst ? 1 : 2; }
  function undoCount() {
    if (!moves.length) return 0;
    var n = mover(moves.length - 1) === 1 ? 1 : 2;
    if (n > moves.length || (n === moves.length && mover(0) === 2 && n === 1)) return 0;
    if (moves.length - n < 0) return 0;
    return n;
  }
  btnUndo.addEventListener('click', function () {
    if (busy) return;
    var n = undoCount(); if (!n) return;
    clearTimeout(timer);
    var keep = moves.slice(0, moves.length - n);
    board = F.newBoard(); moves = [];
    keep.forEach(function (c, i) { board = F.play(board, c, mover(i)); moves.push(c); });
    over = false; turn = 1; build(); render(); say('Move taken back. Your turn.');
  });
  btnHint.addEventListener('click', function () {
    if (over || busy || turn !== 1) return;
    var c = F.chooseMove(board, 1, 'hint'), r = F.dropRow(board, c);
    clearHint(); var g = document.createElement('span'); g.className = 'tgr-f-disc tgr-p1 tgr-hint'; g.style.opacity = '.55'; slots[c][r].appendChild(g);
    say('Try column ' + (c + 1) + '.'); cols[c].focus();
  });
  levelBtns.forEach(function (b) { b.addEventListener('click', function () {
    level = b.dataset.level; levelBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); newGame();
  }); });
  firstBtns.forEach(function (b) { b.addEventListener('click', function () {
    humanFirst = b.dataset.first === 'you'; firstBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); newGame();
  }); });
  newGame();
  window.__four = { get board() { return board; }, drop: function (c) { cols[c].click(); } };
})();
