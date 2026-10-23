/* Games index: narrow the list by category, tag and typed text.
   Without JavaScript the filter bar stays hidden and every game stays listed. */
{
  const bar = document.querySelector('#tgr-filters');
  const grid = document.querySelector('#tgr-list');
  if (bar && grid) {
    const items = [...grid.querySelectorAll(':scope > li')];
    const box = bar.querySelector('input');
    const tally = document.querySelector('#tgr-count');
    const none = document.querySelector('#tgr-empty');
    const want = { cat: '', tags: new Set(), words: '' };

    const matches = (li) => {
      const mine = li.dataset.tags.split('|');
      return (want.cat === '' || li.dataset.cat === want.cat)
        && [...want.tags].every((t) => mine.includes(t))
        && li.dataset.text.includes(want.words);
    };
    const refresh = () => {
      let n = 0;
      for (const li of items) { li.hidden = !matches(li); n += li.hidden ? 0 : 1; }
      tally.textContent = n === items.length ? `${n} games` : `${n} of ${items.length} games`;
      none.hidden = n > 0;
    };
    const pickCategory = (btn) => {
      want.cat = btn.dataset.cat;
      bar.querySelectorAll('button[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      history.replaceState?.(null, '', want.cat ? `#${want.cat}` : location.pathname);
    };

    bar.addEventListener('click', ({ target }) => {
      const btn = target.closest('button');
      if (!btn) return;
      if (btn.dataset.tag) {
        const on = !want.tags.delete(btn.dataset.tag);
        if (on) want.tags.add(btn.dataset.tag);
        btn.setAttribute('aria-pressed', String(on));
      } else pickCategory(btn);
      refresh();
    });
    box.addEventListener('input', () => { want.words = box.value.trim().toLowerCase(); refresh(); });

    const start = bar.querySelector(`button[data-cat="${location.hash.slice(1)}"]`);
    if (start && start.dataset.cat) pickCategory(start);
    bar.hidden = false;
    refresh();
  }
}
