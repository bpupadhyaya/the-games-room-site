/* Four in a Row engine: 7 columns x 6 rows, gravity, first to connect four wins.
   Board: array of 42 cells, index = row*7 + col, row 0 is the TOP row. Cell: 0 empty, 1 or 2 a player. */
(function (root) {
  'use strict';
  var COLS = 7, ROWS = 6;

  function newBoard() { return new Array(COLS * ROWS).fill(0); }
  function legalMoves(b) {
    var m = [];
    for (var c = 0; c < COLS; c++) if (b[c] === 0) m.push(c);
    return m;
  }
  function dropRow(b, c) {
    for (var r = ROWS - 1; r >= 0; r--) if (b[r * COLS + c] === 0) return r;
    return -1;
  }
  function play(b, c, p) {
    var r = dropRow(b, c);
    if (r < 0) throw new Error('column full');
    var n = b.slice();
    n[r * COLS + c] = p;
    return n;
  }
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  /* Returns the 4 winning cell indices [r,c] pairs for player p, or null. */
  function findWin(b, p) {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      if (b[r * COLS + c] !== p) continue;
      for (var d = 0; d < 4; d++) {
        var dr = DIRS[d][0], dc = DIRS[d][1], cells = [[r, c]], k;
        for (k = 1; k < 4; k++) {
          var rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr * COLS + cc] !== p) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) return cells;
      }
    }
    return null;
  }
  function isFull(b) { for (var c = 0; c < COLS; c++) if (b[c] === 0) return false; return true; }
  /* 0 = ongoing, 1/2 = winner, 3 = draw */
  function result(b) {
    if (findWin(b, 1)) return 1;
    if (findWin(b, 2)) return 2;
    return isFull(b) ? 3 : 0;
  }

  /* Windows of four for evaluation. */
  var WINDOWS = (function () {
    var w = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) for (var d = 0; d < 4; d++) {
      var cells = [], ok = true;
      for (var k = 0; k < 4; k++) {
        var rr = r + DIRS[d][0] * k, cc = c + DIRS[d][1] * k;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) { ok = false; break; }
        cells.push(rr * COLS + cc);
      }
      if (ok) w.push(cells);
    }
    return w;
  })();

  function evaluate(b, me) { // heuristic from `me` perspective
    var opp = 3 - me, s = 0, i, j;
    for (i = 0; i < WINDOWS.length; i++) {
      var a = 0, o = 0, w = WINDOWS[i];
      for (j = 0; j < 4; j++) { var v = b[w[j]]; if (v === me) a++; else if (v === opp) o++; }
      if (a && o) continue;
      if (a === 3) s += 5; else if (a === 2) s += 2; else if (a === 1) s += 0.2;
      if (o === 3) s -= 5.5; else if (o === 2) s -= 2; else if (o === 1) s -= 0.2;
    }
    for (i = 0; i < ROWS; i++) { // centre preference
      if (b[i * COLS + 3] === me) s += 3; else if (b[i * COLS + 3] === opp) s -= 3;
    }
    return s;
  }

  var ORDER = [3, 2, 4, 1, 5, 0, 6];
  function search(b, depth, alpha, beta, p, me, ply) {
    var res = result(b);
    if (res === me) return 100000 - ply;
    if (res === 3) return 0;
    if (res !== 0) return -100000 + ply;
    if (depth === 0) return evaluate(b, me);
    var best = p === me ? -Infinity : Infinity;
    for (var i = 0; i < 7; i++) {
      var c = ORDER[i];
      if (b[c] !== 0) continue;
      var v = search(play(b, c, p), depth - 1, alpha, beta, 3 - p, me, ply + 1);
      if (p === me) { if (v > best) best = v; if (best > alpha) alpha = best; }
      else { if (v < best) best = v; if (best < beta) beta = best; }
      if (alpha >= beta) break;
    }
    return best;
  }

  /* Score every legal move for player p: array of {col, score}. */
  function scoreMoves(b, p, depth) {
    var out = [], moves = legalMoves(b);
    for (var i = 0; i < moves.length; i++) {
      var c = moves[i];
      out.push({ col: c, score: search(play(b, c, p), depth - 1, -Infinity, Infinity, 3 - p, p, 1) });
    }
    return out;
  }

  /* level: 'easy' | 'medium' | 'hint'. rng: function returning [0,1). */
  function chooseMove(b, p, level, rng) {
    rng = rng || Math.random;
    var moves = legalMoves(b);
    if (!moves.length) return -1;
    var i, c;
    if (level === 'easy') {
      // takes a win when it sees one, blocks about two times in three, otherwise wanders (leaning to the middle)
      for (i = 0; i < moves.length; i++) if (findWin(play(b, moves[i], p), p)) return moves[i];
      if (rng() < 0.65) for (i = 0; i < moves.length; i++) if (findWin(play(b, moves[i], 3 - p), 3 - p)) return moves[i];
      var safe = moves.filter(function (m) { // avoid handing over an instant win most of the time
        var nb = play(b, m, p);
        if (nb[m] !== 0) return true; // column still has room above? (index m is the top cell)
        return !findWin(play(nb, m, 3 - p), 3 - p);
      });
      var pool = (safe.length && rng() < 0.7) ? safe : moves;
      var weights = pool.map(function (m) { return 4 - Math.abs(m - 3); });
      var tot = weights.reduce(function (a, x) { return a + x; }, 0), t = rng() * tot;
      for (i = 0; i < pool.length; i++) { t -= weights[i]; if (t <= 0) return pool[i]; }
      return pool[pool.length - 1];
    }
    var depth = level === 'hint' ? 7 : 6;
    var sc = scoreMoves(b, p, depth);
    var top = -Infinity;
    sc.forEach(function (s) { if (s.score > top) top = s.score; });
    if (level === 'hint' || top >= 90000 || top <= -90000) {
      var cands = sc.filter(function (s) { return s.score === top; });
      return cands[0].col;
    }
    // medium: among moves within a hair of the best, pick one at random so games differ
    var near = sc.filter(function (s) { return s.score >= top - 1.5; });
    return near[Math.floor(rng() * near.length)].col;
  }

  var api = { COLS: COLS, ROWS: ROWS, newBoard: newBoard, legalMoves: legalMoves, dropRow: dropRow, play: play,
    findWin: findWin, isFull: isFull, result: result, evaluate: evaluate, chooseMove: chooseMove, scoreMoves: scoreMoves };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FourEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
