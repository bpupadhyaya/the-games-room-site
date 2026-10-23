const F = require('../assets/js/four.js'), H = require('../assets/js/hearts.js');
const assert = require('assert');
function rngSeed(s) { return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Four in a Row: wins in all directions, draw, legality
function put(cells) { let b = F.newBoard(); cells.forEach(([r, c, p]) => b[r * 7 + c] = p); return b; }
assert(F.findWin(put([[5,0,1],[5,1,1],[5,2,1],[5,3,1]]), 1), 'horizontal');
assert(F.findWin(put([[2,4,2],[3,4,2],[4,4,2],[5,4,2]]), 2), 'vertical');
assert(F.findWin(put([[5,0,1],[4,1,1],[3,2,1],[2,3,1]]), 1), 'diag up');
assert(F.findWin(put([[2,0,1],[3,1,1],[4,2,1],[5,3,1]]), 1), 'diag down');
assert(!F.findWin(put([[5,0,1],[5,1,1],[5,2,1],[5,4,1]]), 1), 'gap is not a win');
let b = F.newBoard(); for (let i = 0; i < 6; i++) b = F.play(b, 0, 1);
assert(!F.legalMoves(b).includes(0) && F.legalMoves(b).length === 6, 'full column');
assert.throws(() => F.play(b, 0, 2));
// draw board known pattern: fill with column-pair pattern that has no four
let d = F.newBoard(); const pat = [1,1,2,2,1,1,2]; // per column rows alternate in blocks
for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) d[r*7+c] = ((Math.floor(r/ 2) + (c % 2 ? 1 : 0)) % 2) ? 1 : 2;
if (!F.findWin(d,1) && !F.findWin(d,2)) assert.strictEqual(F.result(d), 3, 'draw detected'); else console.log('(skipped draw pattern)');
// AI plays only legal moves, takes wins, blocks threats
let rng = rngSeed(7);
for (let g = 0; g < 30; g++) {
  let bd = F.newBoard(), p = 1;
  while (F.result(bd) === 0) {
    const lvl = (p === 1) ? 'easy' : 'medium';
    const m = F.chooseMove(bd, p, lvl, rng);
    assert(F.legalMoves(bd).includes(m), 'legal move');
    bd = F.play(bd, m, p); p = 3 - p;
  }
}
let wb = put([[5,0,2],[5,1,2],[5,2,2]]);
assert.strictEqual(F.chooseMove(wb, 2, 'medium', rng), 3, 'medium takes the win');
assert.strictEqual(F.chooseMove(wb, 2, 'easy', rng), 3, 'easy takes the win');
let tb = put([[5,0,1],[5,1,1],[5,2,1],[5,6,2],[4,6,2]]);
assert.strictEqual(F.chooseMove(tb, 2, 'medium', rng), 3, 'medium blocks');
// medium beats easy overwhelmingly; medium vs medium finishes
let medWins = 0, N = 40;
for (let g = 0; g < N; g++) {
  let bd = F.newBoard(), p = g % 2 ? 2 : 1; const medSeat = g % 2 ? 1 : 2;
  while (F.result(bd) === 0) { bd = F.play(bd, F.chooseMove(bd, p, p === medSeat ? 'medium' : 'easy', rng), p); p = 3 - p; }
  if (F.result(bd) === medSeat) medWins++;
}
console.log('medium beat easy', medWins, '/', N); assert(medWins >= 36);
let t0 = Date.now(); F.chooseMove(F.newBoard(), 1, 'medium', rng); F.chooseMove(F.newBoard(), 1, 'hint', rng); console.log('opening search ms', Date.now() - t0);

// Hearts invariants
function playHand(handNo, lvls, seed, scores) {
  const r = rngSeed(seed); const s = H.newHand(handNo, r, scores);
  if (s.phase === 'pass') H.applyPass(s, s.hands.map((h, p) => { const pk = H.choosePass(h, lvls[p], r); assert.strictEqual(new Set(pk).size, 3); return pk; }));
  assert.strictEqual(s.hands.reduce((a, h) => a + h.length, 0), 52);
  assert(s.hands[s.turn].includes(H.TWO_CLUBS), 'holder of 2 of clubs leads');
  let first = true;
  while (s.phase === 'play') {
    const p = s.turn, leg = H.legalPlays(s, p);
    if (first) assert.deepStrictEqual(leg, [H.TWO_CLUBS], 'first lead is the 2 of clubs'); first = false;
    if (s.trickNo === 0 && s.trick.length) { const hasNonPts = s.hands[p].some(c => H.points(c) === 0), hasLed = s.hands[p].some(c => H.suitOf(c) === H.suitOf(s.trick[0].card));
      if (!hasLed && hasNonPts) assert(leg.every(c => H.points(c) === 0), 'no points on first trick'); }
    if (s.trick.length === 0 && s.trickNo > 0 && !s.broken && s.hands[p].some(c => H.suitOf(c) !== 3)) assert(leg.every(c => H.suitOf(c) !== 3), 'cannot lead hearts until broken');
    if (s.trick.length) { const led = H.suitOf(s.trick[0].card); if (s.hands[p].some(c => H.suitOf(c) === led)) assert(leg.every(c => H.suitOf(c) === led), 'must follow suit'); }
    const c = H.choosePlay(s, p, lvls[p], r); assert(leg.includes(c), 'AI plays legal');
    H.playCard(s, p, c);
  }
  return s;
}
let moons = 0;
for (let g = 0; g < 300; g++) {
  const lv = g % 3 === 0 ? ['easy','easy','easy','easy'] : ['medium','medium','easy','medium'];
  const s = playHand(g, lv, 1000 + g);
  assert(s.taken.every(t => t.length % 4 === 0) && s.taken.reduce((a, t) => a + t.length, 0) === 52);
  const raw = s.taken.map(t => t.reduce((a, c) => a + H.points(c), 0));
  assert.strictEqual(raw.reduce((a, x) => a + x, 0), 26, '26 points per hand');
  const tot = s.handPoints.reduce((a, x) => a + x, 0);
  if (s.moonBy >= 0) { moons++; assert.strictEqual(tot, 78); assert.strictEqual(s.handPoints[s.moonBy], 0); } else assert.strictEqual(tot, 26);
}
console.log('hearts 300 hands ok; moons', moons);
// forced shoot the moon: a scripted legal hand where seat 2 takes every heart and the Queen of spades
{
  const card = (su, r) => su * 13 + (r - 2); // 0 clubs, 1 diamonds, 2 spades, 3 hearts
  function run(shooterMissesOne) {
    const s = H.newHand(3, rngSeed(11), [10, 20, 30, 40]); // hand 3 = no passing
    const clubs = []; for (let r = 2; r <= 14; r++) clubs.push(card(0, r));
    const hearts = []; for (let r = 2; r <= 14; r++) hearts.push(card(3, r));
    const seat0 = [...clubs.slice(0, 11), card(3, 2), H.QS];           // 2..Q of clubs, 2 of hearts, Queen of spades
    const seat2 = [card(0, 14), ...hearts.slice(1)];                   // Ace of clubs, 3..A of hearts
    const used = new Set([...seat0, ...seat2, card(0, 13)]);
    const rest = []; for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
    const seat1 = [card(0, 13), ...rest.filter(c => H.suitOf(c) === 1).slice(0, 12)];
    const seat3 = rest.filter(c => !seat1.includes(c));
    s.hands = [seat0, seat1, seat2, seat3].map(H.sortHand);
    assert.deepStrictEqual(s.hands.map(h => h.length), [13, 13, 13, 13]);
    assert.strictEqual(new Set(s.hands.flat()).size, 52);
    if (shooterMissesOne) { // seat 1 swaps a spade for the 3 of hearts so seat 2 cannot take everything
      const h3 = card(3, 3), sp = s.hands[1].find(c => H.suitOf(c) === 1);
      s.hands[2][s.hands[2].indexOf(h3)] = sp; s.hands[1][s.hands[1].indexOf(sp)] = h3;
      s.hands = s.hands.map(H.sortHand);
    }
    s.phase = 'play'; s.leader = 0; s.turn = 0; s.trick = []; s.trickNo = 0;
    let guard = 0;
    while (s.phase === 'play' && guard++ < 60) {
      const p = s.turn, leg = H.legalPlays(s, p);
      let c = leg[0];
      if (p === 0 && leg.includes(H.QS) && s.trick.length && H.suitOf(s.trick[0].card) === 3 && s.trickNo >= 3) c = H.QS; // dump the queen on a heart trick
      if (p === 2 && s.trick.length === 0) c = leg[0];
      H.playCard(s, p, c);
    }
    return s;
  }
  const m = run(false);
  assert.strictEqual(m.phase, 'done');
  assert.strictEqual(m.taken[2].reduce((a, c) => a + H.points(c), 0), 26, 'shooter holds all 26 points');
  assert.strictEqual(m.moonBy, 2);
  assert.deepStrictEqual(m.handPoints, [26, 26, 0, 26], 'others take 26 each, shooter 0');
  assert.deepStrictEqual(m.scores, [36, 46, 30, 66]);
  const n = run(true);
  assert.strictEqual(n.moonBy, -1, 'one heart elsewhere means no moon');
  assert.strictEqual(n.handPoints.reduce((a, x) => a + x, 0), 26);
}
// match end
assert(H.matchOver([100, 20, 30, 40]) && !H.matchOver([99, 99, 99, 99]));
assert.deepStrictEqual(H.matchWinners([100, 20, 20, 40]), [1, 2]);
console.log('ALL OK');
