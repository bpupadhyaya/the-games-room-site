/* Hearts web preview UI. You are seat 0 (south); West = 1, North = 2, East = 3. */
(function () {
  'use strict';
  var H = window.HeartsEngine, root = document.getElementById('tgr-hearts-app');
  if (!root) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAMES = ['You', 'West', 'North', 'East'];
  var $ = function (q) { return root.querySelector(q); };
  var elHand = $('.tgr-h-hand'), elTrick = $('.tgr-h-trick'), elStatus = $('.tgr-status'), elTip = $('.tgr-h-tooltip'), elPill = $('.tgr-h-pill'), live = $('#tgr-h-live'), elScore = $('#tgr-h-score');
  var seatEl = [null, $('.tgr-h-west'), $('.tgr-h-north'), $('.tgr-h-east')];
  var btnUndo = $('[data-act=undo]'), btnHint = $('[data-act=hint]'), btnNew = $('[data-act=new]');
  var levelBtns = root.querySelectorAll('[data-level]');
  var level = 'medium', s, handNo = 0, scores = [0, 0, 0, 0], history = [], snaps = [], display = [], busy = false, sel = [], hintCard = -1, timers = [], matchDone = false, receivedMsg = '';

  function later(fn, ms) { var t = setTimeout(fn, reduce ? Math.min(ms, 120) : ms); timers.push(t); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function say(t, announce) { elStatus.textContent = t; if (announce !== false) live.textContent = t; }

  function cardEl(c) {
    var d = document.createElement('div'), su = H.suitOf(c), sym = H.SUIT_SYMBOL[su];
    d.className = 'tgr-card-face' + (su === 1 || su === 3 ? ' tgr-red' : '') + (c === H.QS ? ' tgr-q-spades' : '');
    d.innerHTML = '<span class="tgr-c1"><span>' + H.rankLabel(c) + '</span><s>' + sym + '</s></span><span class="tgr-mid" aria-hidden="true">' + sym + '</span>';
    return d;
  }
  function backs(n, vertical) {
    var w = document.createElement('div'); w.className = 'tgr-h-backs' + (vertical ? ' tgr-v' : ''); w.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < Math.min(n, 13); i++) { var b = document.createElement('span'); b.className = 'tgr-cb'; w.appendChild(b); }
    return w;
  }
  function renderSeats() {
    for (var p = 1; p < 4; p++) {
      var e = seatEl[p]; e.innerHTML = '';
      var nm = document.createElement('b'); nm.textContent = NAMES[p]; e.appendChild(nm);
      var tg = document.createElement('span'); tg.className = 'tgr-tag'; tg.textContent = s.hands[p].length + ' cards · ' + scores[p] + ' pts'; e.appendChild(tg);
      e.appendChild(backs(s.hands[p].length, p !== 2));
      e.classList.toggle('tgr-turn', s.phase === 'play' && s.turn === p && !busy);
      e.setAttribute('aria-label', NAMES[p] + ', ' + s.hands[p].length + ' cards, ' + scores[p] + ' points');
    }
  }
  function renderHand() {
    elHand.innerHTML = '';
    var legal = (s.phase === 'play' && s.turn === 0 && !busy) ? H.legalPlays(s, 0) : [];
    var passing = s.phase === 'pass';
    s.hands[0].forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tgr-hc'; b.dataset.card = c;
      var ok = passing ? !busy : legal.indexOf(c) >= 0;
      if (passing && sel.indexOf(c) >= 0) { b.classList.add('tgr-sel'); b.setAttribute('aria-pressed', 'true'); }
      if (c === hintCard) b.classList.add('tgr-hint');
      if (!ok && s.phase === 'play' && s.turn === 0 && !busy) b.classList.add('tgr-dim');
      b.disabled = !ok && !passing;
      if (!ok && s.phase === 'play') b.setAttribute('aria-disabled', 'true');
      b.setAttribute('aria-label', H.cardName(c) + (passing ? (sel.indexOf(c) >= 0 ? ', selected to pass' : ', tap to select to pass') : (ok ? ', playable' : '')));
      b.appendChild(cardEl(c));
      b.addEventListener('click', function () { onCard(c); });
      b.addEventListener('keydown', function (e) {
        var sib = e.key === 'ArrowRight' ? b.nextElementSibling : e.key === 'ArrowLeft' ? b.previousElementSibling : null;
        if (sib) { e.preventDefault(); sib.focus(); }
      });
      elHand.appendChild(b);
    });
  }
  function renderTrick(taker) {
    elTrick.innerHTML = '';
    display.forEach(function (t) {
      var w = document.createElement('div'); w.className = 'tgr-tc tgr-s' + t.seat + (taker != null ? ' tgr-take' + taker : ''); w.appendChild(cardEl(t.card)); elTrick.appendChild(w);
    });
  }
  function renderScore() {
    var h = '<caption class="tgr-sr">Score by hand</caption><thead><tr><th scope="col">Hand</th>' + NAMES.map(function (n) { return '<th scope="col">' + n + '</th>'; }).join('') + '</tr></thead><tbody>';
    history.forEach(function (row, i) { h += '<tr><td>' + (i + 1) + '</td>' + row.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr>'; });
    h += '<tr class="tgr-tot"><td>Total</td>' + scores.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr></tbody>';
    elScore.innerHTML = h;
  }
  function renderBar() {
    btnUndo.disabled = busy || !snaps.length || s.phase !== 'play';
    btnHint.disabled = busy || matchDone || (s.phase === 'play' && s.turn !== 0) || s.phase === 'done';
  }
  function showPill(html, btnText, fn) {
    elPill.hidden = false; elPill.innerHTML = '<div>' + html + '</div>';
    if (btnText) { var b = document.createElement('button'); b.className = 'tgr-btn tgr-small'; b.type = 'button'; b.textContent = btnText; b.addEventListener('click', fn); elPill.appendChild(b); setTimeout(function () { b.focus({ preventScroll: true }); }, 30); }
  }
  function renderAll() { renderSeats(); renderHand(); renderTrick(); renderScore(); renderBar(); }

  function startHand() {
    clearTimers(); busy = false; sel = []; hintCard = -1; snaps = []; display = []; elPill.hidden = true; elTip.textContent = '';
    s = H.newHand(handNo, Math.random, scores);
    if (s.phase === 'pass') {
      renderAll();
      say('Hand ' + (handNo + 1) + ': ' + H.passLabel(handNo) + '. Choose three cards.');
      elPill.hidden = false;
      updatePassBtn();
    } else { renderAll(); say('Hand ' + (handNo + 1) + ': no passing. The 2 of clubs leads.'); afterStep(); }
  }
  function passText() { var o = H.passOffset(handNo); return o === 1 ? 'to the player on your left' : o === 3 ? 'to the player on your right' : 'across the table'; }
  function updatePassBtn() {
    elPill.innerHTML = '<div>Choose three cards to pass ' + passText() + '.<br><small>' + sel.length + ' of 3 selected</small></div>';
    var b = document.createElement('button'); b.className = 'tgr-btn tgr-small'; b.type = 'button'; b.textContent = 'Pass cards'; b.disabled = sel.length !== 3; b.addEventListener('click', doPass); elPill.appendChild(b);
  }
  function doPass() {
    if (sel.length !== 3) return;
    var picks = [sel.slice(), H.choosePass(s.hands[1], level), H.choosePass(s.hands[2], level), H.choosePass(s.hands[3], level)];
    H.applyPass(s, picks);
    var got = s.received[0].map(H.cardName).join(', ');
    sel = []; hintCard = -1; elPill.hidden = true;
    renderAll(); say('You received: ' + got + '. ' + NAMES[s.turn] + (s.turn === 0 ? ' (you) hold the 2 of clubs and lead.' : ' holds the 2 of clubs and leads.'));
    afterStep();
  }
  function onCard(c) {
    if (busy) return;
    if (s.phase === 'pass') {
      var i = sel.indexOf(c);
      if (i >= 0) sel.splice(i, 1); else if (sel.length < 3) sel.push(c);
      renderHand(); updatePassBtn(); restoreFocus(c); return;
    }
    if (s.phase !== 'play' || s.turn !== 0) return;
    if (H.legalPlays(s, 0).indexOf(c) < 0) { elTip.textContent = whyIllegal(c); return; }
    snaps.push(snapshot()); hintCard = -1; elTip.textContent = '';
    doPlay(0, c);
  }
  function restoreFocus(c) { var b = elHand.querySelector('[data-card="' + c + '"]'); if (b) b.focus({ preventScroll: true }); }
  function whyIllegal(c) {
    if (s.trickNo === 0 && s.trick.length === 0) return 'The 2 of clubs must lead the first trick.';
    if (s.trick.length) {
      var lead = H.suitOf(s.trick[0].card);
      if (H.suitOf(c) !== lead && s.hands[0].some(function (x) { return H.suitOf(x) === lead; })) return 'You must follow suit: play a ' + H.SUIT_NAME[lead].replace(/s$/, '') + '.';
      if (s.trickNo === 0) return 'No hearts or the Queen of spades on the first trick.';
    } else if (H.suitOf(c) === 3 && !s.broken) return 'Hearts cannot lead until a heart has been played.';
    return 'That card cannot be played now.';
  }
  function snapshot() { return { s: JSON.parse(JSON.stringify(s)), display: display.slice() }; }

  function doPlay(seat, card) {
    var before = s.trick.slice();
    var res = H.playCard(s, seat, card);
    display = before.concat([{ seat: seat, card: card }]);
    if (!res.complete) { renderAll(); afterStep(); return; }
    busy = true; renderAll();
    var w = res.winner;
    var msg = NAMES[w] + (w === 0 ? ' take the trick' : ' takes the trick') + (res.pts ? ' (' + res.pts + ' point' + (res.pts > 1 ? 's' : '') + ')' : '') + '.';
    say(msg);
    later(function () {
      renderTrick(w);
      later(function () {
        display = []; busy = false;
        if (res.handOver) return endHand();
        renderAll(); afterStep();
      }, 380);
    }, 1050);
  }
  function afterStep() {
    renderSeats(); renderHand(); renderBar();
    if (s.phase !== 'play') return;
    if (s.turn === 0) { say(s.trick.length ? 'Your turn. ' + (H.legalPlays(s, 0).length === 1 ? 'One card is legal.' : 'Follow suit if you can.') : 'You lead. Play any legal card.', false); live.textContent = 'Your turn.'; renderHand(); return; }
    busy = true; renderHand(); renderBar(); renderSeats();
    say(NAMES[s.turn] + ' is playing...', false);
    later(function () {
      busy = false;
      var seat = s.turn, c = H.choosePlay(s, seat, level);
      doPlay(seat, c);
    }, 650);
  }
  function endHand() {
    var pts = s.handPoints; history.push(pts); scores = s.scores.slice();
    renderAll();
    var moon = s.moonBy >= 0 ? NAMES[s.moonBy] + (s.moonBy === 0 ? ' shot the moon! Everyone else takes 26.' : ' shot the moon! Everyone else takes 26.') : '';
    if (H.matchOver(scores)) {
      matchDone = true; var w = H.matchWinners(scores);
      var winTxt = w.indexOf(0) >= 0 ? (w.length > 1 ? 'You share the win with the lowest score.' : 'You win the match with the lowest score.') : NAMES[w[0]] + ' wins with the lowest score.';
      say('Match over. ' + winTxt); showPill('<strong>Match over</strong><br>' + (moon ? moon + '<br>' : '') + winTxt + '<br><small>Final: ' + NAMES.map(function (n, i) { return n + ' ' + scores[i]; }).join(' · ') + '</small>', 'New match', newMatch);
    } else {
      say('Hand ' + (handNo + 1) + ' complete.');
      showPill('<strong>Hand ' + (handNo + 1) + ' complete</strong><br>' + (moon ? moon + '<br>' : '') + 'This hand: ' + NAMES.map(function (n, i) { return n + ' +' + pts[i]; }).join(' · '), 'Deal next hand', function () { handNo++; startHand(); });
    }
    renderBar();
  }
  function newMatch() { clearTimers(); scores = [0, 0, 0, 0]; history = []; handNo = 0; matchDone = false; startHand(); }

  btnNew.addEventListener('click', newMatch);
  btnUndo.addEventListener('click', function () {
    if (busy || !snaps.length) return;
    clearTimers(); var sn = snaps.pop(); s = sn.s; display = sn.display; hintCard = -1; elPill.hidden = true; elTip.textContent = '';
    renderAll(); say('Your last card was taken back.'); afterStep();
  });
  btnHint.addEventListener('click', function () {
    if (busy) return;
    if (s.phase === 'pass') {
      sel = H.choosePass(s.hands[0], 'medium', function () { return .5; }); renderHand(); updatePassBtn();
      elTip.textContent = 'Suggestion: pass your riskiest cards (high hearts, the high spades, the Queen of spades). Change them if you like.'; return;
    }
    if (s.phase !== 'play' || s.turn !== 0) return;
    var c = H.choosePlay(s, 0, 'medium', function () { return .5; });
    hintCard = c; renderHand(); restoreFocus(c);
    elTip.textContent = 'Hint: ' + H.cardName(c) + '. ' + reason(c);
  });
  function reason(c) {
    var su = H.suitOf(c);
    if (s.trick.length === 0) return c === H.TWO_CLUBS ? 'The 2 of clubs always leads and is the safest card there is.' : 'A low card from a safe suit keeps the lead cheap.';
    var lead = H.suitOf(s.trick[0].card), cur = s.trick[H.trickWinnerIndex(s.trick)].card;
    if (su !== lead) return c === H.QS ? 'You are out of ' + H.SUIT_NAME[lead] + ': a perfect moment to hand someone the Queen of spades.' : 'You are out of ' + H.SUIT_NAME[lead] + ', so shed a dangerous card.';
    if (H.rankOf(c) < H.rankOf(cur) && H.suitOf(cur) === lead) return 'It slips under the current winner, so you take nothing.';
    return s.trick.length === 3 && !H.trickPoints(s.trick) ? 'The trick holds no points, so winning it costs nothing.' : 'You cannot duck this trick, so keep your loss as small as you can.';
  }
  levelBtns.forEach(function (b) { b.addEventListener('click', function () {
    level = b.dataset.level; levelBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); newMatch();
  }); });
  newMatch();
  window.__hearts = { get s() { return s; }, get scores() { return scores; } };
})();
