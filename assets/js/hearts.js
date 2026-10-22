/* Hearts engine: four players, pass three, 2 of clubs leads, hearts broken, Queen of Spades = 13,
   shoot the moon, first to 100 loses. Card id = suit*13 + (rank-2); suits: 0 clubs, 1 diamonds, 2 spades, 3 hearts. */
(function (root) {
  'use strict';
  var CLUBS = 0, DIAMONDS = 1, SPADES = 2, HEARTS = 3;
  var QS = SPADES * 13 + 10; // queen = rank 12
  var TWO_CLUBS = 0;
  var SUIT_SYMBOL = ['♣', '♦', '♠', '♥'];
  var SUIT_NAME = ['clubs', 'diamonds', 'spades', 'hearts'];
  var RANK_NAME = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

  function suitOf(c) { return Math.floor(c / 13); }
  function rankOf(c) { return (c % 13) + 2; }
  function rankLabel(c) { var r = rankOf(c); return RANK_NAME[r] || String(r); }
  function cardName(c) { var r = rankOf(c); var n = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' }[r] || String(r); return n + ' of ' + SUIT_NAME[suitOf(c)]; }
  function points(c) { return suitOf(c) === HEARTS ? 1 : (c === QS ? 13 : 0); }
  function sortHand(h) { return h.slice().sort(function (a, b) { return a - b; }); }

  function shuffle(rng) {
    var d = [], i;
    for (i = 0; i < 52; i++) d.push(i);
    for (i = 51; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }
  /* Pass direction by hand number: 0 left, 1 right, 2 across, 3 hold. Returns offset (+1 = to the left player). */
  function passOffset(handNo) { return [1, 3, 2, 0][handNo % 4]; }
  function passLabel(handNo) { return ['Pass left', 'Pass right', 'Pass across', 'Hold: no passing'][handNo % 4]; }

  function deal(rng) {
    var d = shuffle(rng), hands = [[], [], [], []];
    for (var i = 0; i < 52; i++) hands[i % 4].push(d[i]);
    return hands.map(sortHand);
  }

  /* Game state for one hand. Seats 0..3 clockwise. */
  function newHand(handNo, rng, scores) {
    var hands = deal(rng);
    var s = { handNo: handNo, hands: hands, scores: (scores || [0, 0, 0, 0]).slice(), phase: passOffset(handNo) === 0 ? 'play' : 'pass',
      pending: [null, null, null, null], trick: [], leader: 0, turn: 0, broken: false, taken: [[], [], [], []],
      played: [], trickNo: 0, lastTrick: null, handPoints: null, moonBy: -1 };
    if (s.phase === 'play') startPlay(s);
    return s;
  }
  function startPlay(s) {
    var lead = 0;
    for (var p = 0; p < 4; p++) if (s.hands[p].indexOf(TWO_CLUBS) >= 0) lead = p;
    s.phase = 'play'; s.leader = lead; s.turn = lead; s.trick = []; s.trickNo = 0;
  }
  /* Apply everyone's passes at once. picks[p] = three card ids. */
  function applyPass(s, picks) {
    var off = passOffset(s.handNo), p, i;
    var hands = s.hands.map(function (h) { return h.slice(); });
    for (p = 0; p < 4; p++) picks[p].forEach(function (c) { hands[p].splice(hands[p].indexOf(c), 1); });
    for (p = 0; p < 4; p++) {
      var to = (p + off) % 4;
      for (i = 0; i < 3; i++) hands[to].push(picks[p][i]);
    }
    s.received = [0, 1, 2, 3].map(function (q) { return picks[(q - off + 4) % 4].slice(); });
    s.hands = hands.map(sortHand);
    startPlay(s);
  }

  function hasSuit(h, su) { for (var i = 0; i < h.length; i++) if (suitOf(h[i]) === su) return true; return false; }

  /* Legal cards for seat p right now. */
  function legalPlays(s, p) {
    var h = s.hands[p], out = [], i;
    if (s.trick.length === 0) {
      if (s.trickNo === 0) return h.indexOf(TWO_CLUBS) >= 0 ? [TWO_CLUBS] : h.slice();
      if (s.broken) return h.slice();
      var nonHeart = h.filter(function (c) { return suitOf(c) !== HEARTS; });
      return nonHeart.length ? nonHeart : h.slice();
    }
    var lead = suitOf(s.trick[0].card);
    var follow = h.filter(function (c) { return suitOf(c) === lead; });
    if (follow.length) return follow;
    if (s.trickNo === 0) { // first trick: no point cards unless nothing else is held
      var clean = h.filter(function (c) { return points(c) === 0; });
      return clean.length ? clean : h.slice();
    }
    return h.slice();
  }

  function trickWinnerIndex(trick) {
    var lead = suitOf(trick[0].card), best = 0;
    for (var i = 1; i < trick.length; i++) {
      if (suitOf(trick[i].card) === lead && rankOf(trick[i].card) > rankOf(trick[best].card)) best = i;
    }
    return best;
  }
  function trickPoints(trick) { return trick.reduce(function (a, t) { return a + points(t.card); }, 0); }

  /* Play a card for seat s.turn. Returns {complete, winner, pts} when the trick finishes. */
  function playCard(s, p, card) {
    if (s.turn !== p) throw new Error('not your turn');
    if (legalPlays(s, p).indexOf(card) < 0) throw new Error('illegal card');
    s.hands[p].splice(s.hands[p].indexOf(card), 1);
    s.trick.push({ seat: p, card: card });
    s.played.push(card);
    if (suitOf(card) === HEARTS) s.broken = true;
    if (s.trick.length < 4) { s.turn = (p + 1) % 4; return { complete: false }; }
    var w = s.trick[trickWinnerIndex(s.trick)].seat, pts = trickPoints(s.trick);
    s.taken[w] = s.taken[w].concat(s.trick.map(function (t) { return t.card; }));
    s.lastTrick = { cards: s.trick.slice(), winner: w, pts: pts };
    s.trick = []; s.trickNo++; s.leader = w; s.turn = w;
    var res = { complete: true, winner: w, pts: pts, handOver: s.trickNo === 13 };
    if (res.handOver) finishHand(s);
    return res;
  }
  function finishHand(s) {
    var pts = s.taken.map(function (t) { return t.reduce(function (a, c) { return a + points(c); }, 0); });
    var moon = pts.indexOf(26);
    s.moonBy = moon;
    if (moon >= 0) pts = pts.map(function (_, i) { return i === moon ? 0 : 26; });
    s.handPoints = pts;
    s.scores = s.scores.map(function (v, i) { return v + pts[i]; });
    s.phase = 'done';
  }
  /* Match over once someone is at 100+. Winners = lowest score (ties share). */
  function matchOver(scores) { return scores.some(function (v) { return v >= 100; }); }
  function matchWinners(scores) { var m = Math.min.apply(null, scores); return scores.map(function (v, i) { return v === m ? i : -1; }).filter(function (i) { return i >= 0; }); }

  /* ---------- computer players ---------- */
  function choosePass(hand, level, rng) {
    rng = rng || Math.random;
    var sc = hand.map(function (c) {
      var su = suitOf(c), r = rankOf(c), n = hand.filter(function (x) { return suitOf(x) === su; }).length, v = 0;
      if (level === 'easy') v = r + rng() * 6 + (su === HEARTS ? 4 : 0);
      else {
        v = r;
        if (c === QS) v += (n >= 5 ? -6 : 30); // keep a well-guarded queen only when long in spades
        else if (su === SPADES && r >= 13) v += (hand.indexOf(QS) >= 0 ? -4 : (n <= 4 ? 16 : 4)); // A/K of spades are dangerous while the queen lurks
        else if (su === HEARTS) v += r >= 10 ? 14 : (r >= 6 ? 3 : -4);
        else if (n <= 2 && su !== CLUBS) v += 7 - n * 2; // shortening a suit to make a void
        if (r >= 12 && su !== SPADES && su !== HEARTS) v += 3;
        if (c === TWO_CLUBS) v -= 8;
      }
      return { c: c, v: v };
    });
    sc.sort(function (a, b) { return b.v - a.v; });
    return sc.slice(0, 3).map(function (x) { return x.c; });
  }

  function remainingHigher(s, card) { // unseen cards of the same suit that outrank `card` (not in my hand), approximate memory
    var su = suitOf(card), n = 0;
    for (var r = rankOf(card) + 1; r <= 14; r++) { var id = su * 13 + r - 2; if (s.played.indexOf(id) < 0 && s.hands[s.turn].indexOf(id) < 0) n++; }
    return n;
  }

  function choosePlay(s, p, level, rng) {
    rng = rng || Math.random;
    var legal = legalPlays(s, p);
    if (legal.length === 1) return legal[0];
    if (level === 'easy') {
      // legal but unfocused: low-ish cards, avoids obviously eating the queen when it can
      var pick = legal.slice();
      if (s.trick.length && rng() < 0.7) {
        var lead0 = suitOf(s.trick[0].card);
        var safe = pick.filter(function (c) { return !(c === QS && lead0 === SPADES) });
        if (safe.length) pick = safe;
      }
      pick.sort(function (a, b) { return (rankOf(a) + rng() * 5) - (rankOf(b) + rng() * 5); });
      return pick[Math.floor(rng() * Math.min(3, pick.length))];
    }
    var hand = s.hands[p], i, c;
    if (s.trick.length === 0) { // leading: low cards from safe suits; avoid leading spades while holding the queen unprotected
      var bestC = legal[0], bestV = Infinity;
      for (i = 0; i < legal.length; i++) {
        c = legal[i];
        var su = suitOf(c), r = rankOf(c), v = r + remainingHigher(s, c) * -0.0;
        var held = hand.filter(function (x) { return suitOf(x) === su; }).length;
        v = r * 1.0;
        if (su === HEARTS) v += 8;
        if (su === SPADES) { if (c === QS) v += 50; else if (r >= 13) v += 12; else if (hand.indexOf(QS) < 0 && r < 12) v -= 6; else v += 14; }
        if (su === CLUBS && s.trickNo === 0) v -= 20;
        v += held * 0.15; // slightly prefer long-suit exits
        v += rng() * 0.4;
        if (v < bestV) { bestV = v; bestC = c; }
      }
      return bestC;
    }
    var lead = suitOf(s.trick[0].card);
    var curBest = s.trick[trickWinnerIndex(s.trick)].card, curPts = trickPoints(s.trick), last = s.trick.length === 3;
    var follows = legal.every(function (x) { return suitOf(x) === lead; });
    if (follows) {
      var under = legal.filter(function (x) { return rankOf(x) < rankOf(curBest) && suitOf(curBest) === lead; });
      if (under.length) return under.sort(function (a, b) { return rankOf(b) - rankOf(a); })[0]; // duck with the highest safe card
      // must win (or can only win): if last and trick is clean, take it with the highest harmless card; else go as low as possible
      var sorted = legal.slice().sort(function (a, b) { return rankOf(a) - rankOf(b); });
      if (last && curPts === 0) {
        var harmless = sorted.filter(function (x) { return x !== QS; });
        return (harmless.length ? harmless : sorted)[(harmless.length ? harmless : sorted).length - 1];
      }
      if (lead === SPADES && sorted.indexOf(QS) >= 0 && sorted.length > 1) { sorted = sorted.filter(function (x) { return x !== QS; }); }
      return sorted[0];
    }
    // void in the led suit: dump the most dangerous card
    var dump = legal.slice().sort(function (a, b) {
      function d(x) { var su2 = suitOf(x), r2 = rankOf(x), v2 = r2; if (x === QS) v2 += 60; else if (su2 === HEARTS) v2 += 30; else if (su2 === SPADES && r2 >= 13 && hand.indexOf(QS) < 0) v2 += 20; return v2; }
      return d(b) - d(a);
    });
    return dump[0];
  }

  var api = { CLUBS: CLUBS, DIAMONDS: DIAMONDS, SPADES: SPADES, HEARTS: HEARTS, QS: QS, TWO_CLUBS: TWO_CLUBS, SUIT_SYMBOL: SUIT_SYMBOL, SUIT_NAME: SUIT_NAME,
    suitOf: suitOf, rankOf: rankOf, rankLabel: rankLabel, cardName: cardName, points: points, sortHand: sortHand, shuffle: shuffle,
    passOffset: passOffset, passLabel: passLabel, newHand: newHand, applyPass: applyPass, legalPlays: legalPlays, playCard: playCard,
    trickWinnerIndex: trickWinnerIndex, trickPoints: trickPoints, matchOver: matchOver, matchWinners: matchWinners,
    choosePass: choosePass, choosePlay: choosePlay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HeartsEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
