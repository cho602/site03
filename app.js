(function () {
  'use strict';

  const KEY = 'reading-tree:v1';

  const GENRES = [
    { id: 'novel', label: '소설', color: '#4f9a5a' },
    { id: 'essay', label: '에세이', color: '#93c25b' },
    { id: 'humanities', label: '인문·사회', color: '#2f7a62' },
    { id: 'science', label: '과학·기술', color: '#45a0a0' },
    { id: 'self', label: '자기계발·경제', color: '#c8ad3a' },
    { id: 'poetry', label: '시', color: '#e0866a' },
    { id: 'history', label: '역사', color: '#b07a3e' },
    { id: 'comic', label: '만화·그림책', color: '#e6a530' },
    { id: 'etc', label: '기타', color: '#7aa870' },
  ];
  const genreOf = (id) => GENRES.find((g) => g.id === id) || GENRES[GENRES.length - 1];

  const STAGES = [
    { min: 0, name: '씨앗', desc: '아직 땅속에 잠든 씨앗이에요. 첫 책을 기록하면 싹이 터요.' },
    { min: 1, name: '새싹', desc: '첫 잎이 돋았어요! 독서 습관이 막 움트기 시작했네요.' },
    { min: 3, name: '떡잎', desc: '줄기가 갈라지기 시작했어요.' },
    { min: 8, name: '묘목', desc: '제법 나무의 모양을 갖췄어요.' },
    { min: 15, name: '어린 나무', desc: '가지가 무성해지고 있어요.' },
    { min: 30, name: '나무', desc: '그늘을 만들 만큼 자랐어요.' },
    { min: 60, name: '큰 나무', desc: '새들이 쉬어 갈 만한 큰 나무가 되었어요.' },
    { min: 100, name: '책의 숲지기', desc: '백 권의 이야기가 이 나무에 깃들었어요.' },
  ];
  const stageIndex = (n) => STAGES.reduce((acc, s, i) => (n >= s.min ? i : acc), 0);

  // ---------- 상태 ----------
  let records = load();
  let editingId = null;
  let rating = 0;

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
    } catch (e) {
      toast('저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.');
    }
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const starText = (r) => (r ? '★'.repeat(r) + '☆'.repeat(5 - r) : '');
  const $ = (id) => document.getElementById(id);

  // ---------- 초기 UI ----------
  const optHtml = GENRES.map((g) => `<option value="${g.id}">${g.label}</option>`).join('');
  $('fGenre').innerHTML = optHtml;
  $('genreFilter').innerHTML = `<option value="">모든 장르</option>` + optHtml;
  $('fDate').value = today();
  $('legend').innerHTML =
    GENRES.map((g) => `<li><i style="background:${g.color}"></i>${g.label}</li>`).join('') +
    `<li><i class="flower"></i>★5 = 꽃</li>`;

  const starsEl = $('fRating');
  starsEl.innerHTML = [1, 2, 3, 4, 5]
    .map((i) => `<button type="button" role="radio" aria-checked="false" aria-label="${i}점" data-v="${i}">★</button>`)
    .join('');
  starsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const v = Number(b.dataset.v);
    setRating(v === rating ? 0 : v);
  });
  function setRating(v) {
    rating = v;
    starsEl.querySelectorAll('button').forEach((b) => {
      const on = Number(b.dataset.v) <= v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(Number(b.dataset.v) === v));
    });
  }

  const month = new Date().getMonth() + 1;
  $('sky').classList.add(
    month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter'
  );

  // ---------- 렌더 ----------
  function render(opts = {}) {
    renderTree(opts);
    renderStage();
    renderStats();
    renderList();
  }

  function renderTree(opts) {
    const ordered = [...records].sort((a, b) => a.createdAt - b.createdAt);
    const leaves = ordered.map((r) => ({
      id: r.id,
      title: r.title + (r.author ? ` — ${r.author}` : ''),
      color: genreOf(r.genre).color,
      bloom: r.rating === 5,
    }));
    ReadingTree.render($('tree'), leaves, opts);
  }

  function renderStage() {
    const n = records.length;
    const i = stageIndex(n);
    const cur = STAGES[i];
    const next = STAGES[i + 1];
    $('stageName').textContent = cur.name;
    $('stageCount').textContent = `${n}권`;
    $('stageDesc').textContent = cur.desc;
    if (next) {
      const pct = ((n - cur.min) / (next.min - cur.min)) * 100;
      $('progressBar').style.width = pct + '%';
      $('stageNext').textContent = `'${next.name}'까지 ${next.min - n}권 남았어요`;
    } else {
      $('progressBar').style.width = '100%';
      $('stageNext').textContent = '가장 높은 단계에 도달했어요. 나무는 계속 자라요!';
    }
  }

  function renderStats() {
    const now = new Date();
    const y = String(now.getFullYear());
    const ym = `${y}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rated = records.filter((r) => r.rating);
    $('statTotal').textContent = records.length;
    $('statYear').textContent = records.filter((r) => (r.date || '').startsWith(y)).length;
    $('statMonth').textContent = records.filter((r) => (r.date || '').startsWith(ym)).length;
    $('statAvg').textContent = rated.length
      ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1)
      : '–';
  }

  function renderList() {
    const q = $('search').value.trim().toLowerCase();
    const g = $('genreFilter').value;
    const list = records
      .filter((r) => !g || r.genre === g)
      .filter((r) => !q || [r.title, r.author, r.quote, r.note].some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);

    $('bookList').innerHTML = list
      .map((r) => {
        const gn = genreOf(r.genre);
        return `<li>
          <button class="book" data-id="${esc(r.id)}">
            <span class="spine" style="background:${gn.color}"></span>
            <span class="book-body">
              <span class="book-title">${esc(r.title)}</span>
              <span class="book-meta">${esc(r.author || '저자 미상')} · ${gn.label}${r.date ? ' · ' + esc(r.date) : ''}</span>
              ${r.rating ? `<span class="book-stars" aria-label="별점 ${r.rating}점">${starText(r.rating)}</span>` : ''}
              ${r.quote ? `<span class="book-quote">“${esc(r.quote)}”</span>` : ''}
            </span>
          </button>
        </li>`;
      })
      .join('');

    const empty = $('emptyMsg');
    if (!records.length) {
      empty.hidden = false;
      empty.textContent = '아직 기록이 없어요. 최근에 읽은 책 한 권으로 씨앗을 깨워 보세요.';
    } else if (!list.length) {
      empty.hidden = false;
      empty.textContent = '조건에 맞는 책이 없어요.';
    } else {
      empty.hidden = true;
    }
  }

  // ---------- 폼 ----------
  $('recordForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: $('fTitle').value.trim(),
      author: $('fAuthor').value.trim(),
      genre: $('fGenre').value,
      date: $('fDate').value,
      rating,
      quote: $('fQuote').value.trim(),
      note: $('fNote').value.trim(),
    };
    if (!data.title) return $('fTitle').focus();

    if (editingId) {
      const r = records.find((x) => x.id === editingId);
      if (r) Object.assign(r, data);
      save();
      endEdit();
      render();
      toast('기록을 고쳤어요.');
      return;
    }

    const before = stageIndex(records.length);
    const rec = { id: uid(), createdAt: Date.now(), ...data };
    records.push(rec);
    save();
    resetForm();
    render({ newId: rec.id, animate: true });
    const after = stageIndex(records.length);
    const kind = rec.rating === 5 ? '꽃이 한 송이 피었어요' : '잎이 하나 돋아났어요';
    toast(after > before ? `나무가 '${STAGES[after].name}'(으)로 자랐어요! ${kind}.` : `${kind}. 지금까지 ${records.length}권!`);
    document.querySelector('.tree-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  function resetForm() {
    $('recordForm').reset();
    $('fDate').value = today();
    setRating(0);
  }
  function startEdit(id) {
    const r = records.find((x) => x.id === id);
    if (!r) return;
    editingId = id;
    $('fTitle').value = r.title;
    $('fAuthor').value = r.author || '';
    $('fGenre').value = genreOf(r.genre).id;
    $('fDate').value = r.date || '';
    $('fQuote').value = r.quote || '';
    $('fNote').value = r.note || '';
    setRating(r.rating || 0);
    $('formTitle').textContent = '기록 고치기';
    $('submitBtn').textContent = '수정 저장';
    $('cancelEdit').hidden = false;
    $('recordForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('fTitle').focus({ preventScroll: true });
  }
  function endEdit() {
    editingId = null;
    resetForm();
    $('formTitle').textContent = '새 기록 남기기';
    $('submitBtn').textContent = '기록하고 나무 키우기';
    $('cancelEdit').hidden = true;
  }
  $('cancelEdit').addEventListener('click', endEdit);

  // ---------- 목록 / 상세 ----------
  $('search').addEventListener('input', renderList);
  $('genreFilter').addEventListener('change', renderList);

  const list = $('bookList');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.book');
    if (b) openDetail(b.dataset.id);
  });
  list.addEventListener('mouseover', (e) => glow(e.target.closest('.book')?.dataset.id));
  list.addEventListener('mouseleave', () => glow(null));
  list.addEventListener('focusin', (e) => glow(e.target.closest('.book')?.dataset.id));
  list.addEventListener('focusout', () => glow(null));

  function glow(id) {
    $('tree').querySelectorAll('.leaf.glow').forEach((el) => el.classList.remove('glow'));
    if (!id) return;
    const el = $('tree').querySelector(`.leaf[data-id="${CSS.escape(id)}"]`);
    if (el) el.classList.add('glow');
  }

  $('tree').addEventListener('click', (e) => {
    const leaf = e.target.closest('.leaf');
    if (leaf) openDetail(leaf.dataset.id);
  });

  let detailId = null;
  const dlg = $('detail');
  function openDetail(id) {
    const r = records.find((x) => x.id === id);
    if (!r) return;
    detailId = id;
    const gn = genreOf(r.genre);
    $('dMeta').innerHTML = `<span class="chip" style="--c:${gn.color}">${gn.label}</span>${r.date ? esc(r.date) + ' 완독' : ''}`;
    $('dTitle').textContent = r.title;
    $('dAuthor').textContent = r.author || '';
    $('dStars').textContent = starText(r.rating);
    $('dQuote').textContent = r.quote || '';
    $('dQuote').hidden = !r.quote;
    $('dNote').textContent = r.note || '남긴 감상이 없어요.';
    $('dNote').classList.toggle('muted', !r.note);
    dlg.showModal();
  }
  $('dClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('dEdit').addEventListener('click', () => { dlg.close(); startEdit(detailId); });
  $('dDelete').addEventListener('click', () => {
    const r = records.find((x) => x.id === detailId);
    if (!r || !confirm(`'${r.title}' 기록을 삭제할까요? 나무에서 잎 하나가 떨어져요.`)) return;
    records = records.filter((x) => x.id !== detailId);
    if (editingId === detailId) endEdit();
    save();
    dlg.close();
    render({ animate: true });
    toast('기록을 삭제했어요.');
  });

  // ---------- 백업 ----------
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'reading-tree', version: 1, records }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `책나무-백업-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(incoming)) throw new Error('bad');
      const ids = new Set(records.map((r) => r.id));
      let added = 0;
      incoming.forEach((r) => {
        if (!r || typeof r.title !== 'string' || !r.title.trim()) return;
        const rec = {
          id: typeof r.id === 'string' && !ids.has(r.id) ? r.id : uid(),
          createdAt: Number(r.createdAt) || Date.now(),
          title: r.title.trim(),
          author: String(r.author || ''),
          genre: genreOf(r.genre).id,
          date: String(r.date || ''),
          rating: Math.max(0, Math.min(5, Number(r.rating) || 0)),
          quote: String(r.quote || ''),
          note: String(r.note || ''),
        };
        if (typeof r.id === 'string' && ids.has(r.id)) return; // 이미 있는 기록은 건너뜀
        ids.add(rec.id);
        records.push(rec);
        added++;
      });
      save();
      render({ animate: true });
      toast(added ? `${added}권의 기록을 불러왔어요.` : '새로 불러올 기록이 없었어요.');
    } catch (err) {
      toast('백업 파일을 읽지 못했어요.');
    }
  });

  // ---------- 토스트 ----------
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderTree({}), 150);
  });

  render();
})();
