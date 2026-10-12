/* UI：index.html をダブルクリックして使える、完全ローカルWebアプリ */
(function () {
  'use strict';
  const Calc = window.KojoCalc;
  if (!Calc) throw new Error('calculator.js が読み込めませんでした。');
  const DRAFT_KEY = 'shinsen.kojo.v0.1.draft';
  const PRESETS_KEY = 'shinsen.kojo.v0.1.presets';
  const LETTERS = ['A', 'B', 'C'];
  const COLORS = ['#16848a', '#ae6d42', '#8268ac'];
  const SOFTS = ['#e0f1ef', '#f8ede1', '#f0eafd'];
  const $ = selector => document.querySelector(selector);
  const format = value => Number(value).toLocaleString('ja-JP');
  const limit = (v, min, max, fallback) => Calc.integer(v, fallback, min, max);
  let state = loadDraft();
  let presets = loadPresets();
  const cards = [];

  function defaultState() {
    return { count: 1, available: 40, power: 290, stamina: 90, cities: [
      { name: '攻城A', level: '6', durability: 100000, troops: 40 },
      { name: '攻城B', level: '5', durability: 50000, troops: 0 },
      { name: '攻城C', level: '4', durability: 15000, troops: 0 },
    ] };
  }
  function safeStorageGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }
  function safeStorageSet(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); return true; } catch (_) { return false; }
  }
  function normalize(raw) {
    const init = defaultState();
    if (!raw || typeof raw !== 'object') return init;
    const cities = Array.isArray(raw.cities) ? raw.cities : [];
    return {
      count: limit(raw.count, 1, 3, init.count),
      available: limit(raw.available, 0, 1000000, init.available),
      power: limit(raw.power, 1, 1000000, init.power),
      stamina: Math.floor(limit(raw.stamina, 0, 100, init.stamina) / 10) * 10,
      cities: init.cities.map((d, idx) => {
        const c = cities[idx] && typeof cities[idx] === 'object' ? cities[idx] : {};
        const level = ['4', '5', '6', '7', 'custom'].includes(String(c.level)) ? String(c.level) : d.level;
        const name = typeof c.name === 'string' ? c.name.slice(0, 36) : d.name;
        return { name, level, durability: limit(c.durability, 1, 1000000000, Calc.DURABILITY[level] || d.durability), troops: limit(c.troops, 0, 1000000, d.troops) };
      }),
    };
  }
  function loadDraft() { return normalize(safeStorageGet(DRAFT_KEY)); }
  function loadPresets() {
    const obj = safeStorageGet(PRESETS_KEY);
    if (!Array.isArray(obj)) return [];
    return obj.filter(x => x && typeof x.name === 'string' && typeof x.id === 'string' && x.data).slice(0, 20)
      .map(x => ({ id: x.id, name: x.name.slice(0, 40), data: normalize(x.data) }));
  }
  function autosave() { safeStorageSet(DRAFT_KEY, state); }
  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

  function createCard(index) {
    const section = document.createElement('article');
    section.className = 'city-card';
    section.style.setProperty('--city-color', COLORS[index]);
    section.style.setProperty('--city-soft', SOFTS[index]);
    section.dataset.index = String(index);
    section.innerHTML = `
      <div class="city-label"><div class="city-letter"><span class="city-icon">${LETTERS[index]}</span> 攻城 ${LETTERS[index]}</div><span class="city-status" data-out="status">計算中</span></div>
      <div class="city-fields">
        <label class="field span2"><span class="field-label">城名メモ <small>任意</small></span><input data-field="name" type="text" maxlength="36" placeholder="例：加治木城"></label>
        <label class="field"><span class="field-label">城レベル</span><select data-field="level"><option value="4">Lv4</option><option value="5">Lv5</option><option value="6">Lv6</option><option value="7">Lv7</option><option value="custom">任意設定 / 関所など</option></select></label>
        <label class="field"><span class="field-label">耐久度</span><input data-field="durability" type="number" inputmode="numeric" min="1" max="1000000000" step="1"></label>
        <label class="field span2"><span class="field-label">この城へ割り当てる兵器 <small>部隊</small></span><input data-field="troops" type="number" inputmode="numeric" min="0" max="1000000" step="1"></label>
      </div>
      <div class="city-calc">
        <div class="city-facts">
          <div><span class="row-key">必要攻撃回数</span><strong data-out="rounds">—</strong></div>
          <div><span class="row-key">所要時間</span><strong data-out="minutes">—</strong></div>
          <div><span class="row-key">体力で攻撃できる回数</span><strong class="small-num" data-out="max-rounds">—</strong></div>
          <div><span class="row-key">この条件で必要な兵器</span><strong class="small-num" data-out="min-units">—</strong></div>
        </div>
        <div class="bar-label"><span>体力内で削れる耐久</span><strong data-out="progress-text">—</strong></div>
        <div class="progress-track" role="progressbar" aria-label="体力内で削れる耐久の割合" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" data-out="progress"></div></div>
        <p class="city-note" data-out="note"></p>
      </div>`;
    section.addEventListener('input', event => {
      const element = event.target;
      const field = element.dataset.field;
      if (!field || field === 'level') return;
      if (field === 'name') state.cities[index].name = element.value.slice(0, 36);
      else if (field === 'durability') state.cities[index].durability = limit(element.value, 1, 1000000000, 1);
      else if (field === 'troops') state.cities[index].troops = limit(element.value, 0, 1000000, 0);
      changed();
    });
    section.addEventListener('change', event => {
      const element = event.target;
      const field = element.dataset.field;
      if (!field) return;
      if (field === 'level') {
        state.cities[index].level = element.value;
        if (Object.prototype.hasOwnProperty.call(Calc.DURABILITY, element.value)) {
          state.cities[index].durability = Calc.DURABILITY[element.value];
          section.querySelector('[data-field="durability"]').value = state.cities[index].durability;
        }
      } else if (field === 'durability') {
        // 耐久値を手入力した場合でも、城レベルは参考ラベルとして残す。
        state.cities[index].durability = limit(element.value, 1, 1000000000, 1);
        element.value = String(state.cities[index].durability);
      } else if (field === 'troops') {
        state.cities[index].troops = limit(element.value, 0, 1000000, 0);
        element.value = String(state.cities[index].troops);
      }
      changed();
    });
    $('#city-grid').appendChild(section);
    return section;
  }

  function setText(card, name, value) { card.querySelector(`[data-out="${name}"]`).textContent = value; }
  function syncFields() {
    $('#available').value = state.available;
    $('#power').value = state.power;
    $('#stamina').value = state.stamina;
    state.cities.forEach((city, i) => {
      const card = cards[i];
      for (const field of ['name', 'level', 'durability', 'troops']) card.querySelector(`[data-field="${field}"]`).value = city[field];
    });
    reflectCount();
    render();
  }
  function reflectCount() {
    $('#city-grid').dataset.count = state.count;
    cards.forEach((card, i) => { card.classList.toggle('is-hidden', i >= state.count); });
    document.querySelectorAll('[data-count]').forEach(button => {
      const active = Number(button.dataset.count) === state.count;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function changed() { autosave(); render(); }

  function renderCity(card, result) {
    const tag = card.querySelector('[data-out="status"]');
    tag.classList.toggle('invalid', !result.feasible);
    tag.textContent = result.feasible ? '耐久削り成立' : '耐久削り不足';
    setText(card, 'rounds', result.requiredRounds === null ? '—' : `${format(result.requiredRounds)}回`);
    setText(card, 'minutes', result.projectedMinutes === null ? '—' : `${format(result.projectedMinutes)}分${result.feasible ? '' : '（理論）'}`);
    const timeDisplay = card.querySelector('[data-out="minutes"]');
    timeDisplay.classList.remove('time-safe', 'time-tight', 'time-danger', 'time-over');
    if (result.risk !== 'unknown') timeDisplay.classList.add(`time-${result.risk}`);
    setText(card, 'max-rounds', `${result.maxRounds}回`);
    setText(card, 'min-units', result.neededUnits === null ? '—' : `${format(result.neededUnits)}部隊`);
    const minTag = card.querySelector('[data-out="min-units"]');
    minTag.classList.toggle('warn-num', !result.feasible);
    const percentage = Math.round(result.progress * 100);
    setText(card, 'progress-text', `${format(Math.min(result.hp, result.damageCapacity))} / ${format(result.hp)} (${percentage}%)`);
    const track = card.querySelector('.progress-track');
    track.setAttribute('aria-valuenow', String(percentage));
    track.querySelector('[data-out="progress"]').style.width = `${Math.max(0, Math.min(100, result.progress * 100))}%`;
    const note = card.querySelector('[data-out="note"]');
    note.classList.toggle('danger', !result.feasible);
    if (result.maxRounds === 0) note.textContent = '体力が0のため攻撃できません。';
    else if (result.perRound === 0) note.textContent = `兵器が未配分です。最低${format(result.neededUnits)}部隊必要。`;
    else if (!result.feasible) {
      const riskText = result.projectedMinutes > 60 ? ' 理論所要時間も60分を超過します。' : result.projectedMinutes === 60 ? ' 理論所要60分は回復開始に重なる危険域です。' : result.projectedMinutes === 55 ? ' 理論所要55分で時間的にもギリギリです。' : '';
      note.textContent = `体力内で${format(result.remaining)}残ります。兵器あと${format(result.missingUnits)}部隊。${riskText}`;
    } else {
      note.textContent = `あと${format(result.extraUnits)}部隊減らしても、同じ体力条件で削り切れます。`;
    }
  }

  function renderSummary(plan) {
    const banner = $('#overall-banner');
    const strings = {
      clear: ['すべての城で耐久削り可能', '割り当てた兵器数・体力の範囲で、各城の耐久を削り切れる計算です。', 'ok'],
      overallocated: ['使用可能な兵器数を超過', `手持ちより${format(plan.overage)}部隊多く割り当てています。配分を見直してください。`, 'danger'],
      'no-stamina': ['体力不足で攻撃できません', '全兵器共通の現在体力が0です。', 'danger'],
      'insufficient-pool': ['兵器の総数が不足', `現在の体力で各城を削り切るには、最低あと${format(plan.minRequired - plan.pool)}部隊必要です。`, 'danger'],
      adjust: ['配分の調整が必要', '手持ちの総数は足りていますが、割り当て数の不足している城があります。', 'warn'],
    };
    const [heading, desc, severity] = strings[plan.status];
    banner.className = `overall-banner${severity === 'danger' ? ' danger' : severity === 'warn' ? ' warn' : ''}`;
    banner.replaceChildren();
    const strong = document.createElement('strong'); strong.textContent = heading;
    const p = document.createElement('p'); p.textContent = desc;
    banner.append(strong, p);
    $('#total-available').textContent = format(plan.pool);
    $('#total-allocated').textContent = format(plan.allocated);
    $('#total-required').textContent = plan.minRequired === null ? '—' : format(plan.minRequired);
    $('#total-spare').textContent = plan.overage > 0 ? `${format(plan.overage)}超過` : format(plan.unallocated);
  }

  function renderTimeline(rows) {
    const width = 720, height = 269, left = 53, right = 18, top = 18, bottom = 42;
    const w = width - left - right, h = height - top - bottom;
    const x = n => left + w * n / 10;
    const y = percentRemaining => top + h * (1 - percentRemaining);
    const chunks = [];
    chunks.push(`<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="開始から0分から50分の残耐久率の変化">`);
    for (let percent = 0; percent <= 100; percent += 25) {
      const yy = y(percent / 100);
      chunks.push(`<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="#e4edeb" stroke-width="1"/>`);
      chunks.push(`<text x="${left-11}" y="${yy+4}" text-anchor="end" font-size="12" fill="#71868b">${percent}%</text>`);
    }
    for (let i = 0; i <= 10; i += 2) {
      const xx = x(i);
      chunks.push(`<line x1="${xx}" y1="${top}" x2="${xx}" y2="${top+h}" stroke="#e4edeb" stroke-dasharray="3 5"/>`);
      chunks.push(`<text x="${xx}" y="${height-18}" text-anchor="middle" font-size="12" fill="#71868b">${i*5}</text>`);
    }
    chunks.push(`<text x="${width-right}" y="${height-2}" text-anchor="end" font-size="11" fill="#829298">経過時間（分）</text>`);
    rows.forEach((row, index) => {
      const points = [];
      let zeroAt = null;
      for (let i = 0; i <= 10; i++) {
        const hits = Math.min(i, row.maxRounds);
        const remainingPercent = Math.max(0, 1 - hits * row.perRound / row.hp);
        points.push([x(i), y(remainingPercent)]);
        if (i > 0 && zeroAt === null && remainingPercent === 0) zeroAt = i;
      }
      const d = points.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(' ');
      chunks.push(`<path d="${d}" stroke="${COLORS[index]}" fill="none" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"><title>攻城${LETTERS[index]} 残耐久率</title></path>`);
      if (zeroAt !== null) chunks.push(`<circle cx="${x(zeroAt)}" cy="${y(0)}" r="5" fill="${COLORS[index]}" stroke="white" stroke-width="2"/>`);
    });
    chunks.push('</svg>');
    $('#timeline').innerHTML = chunks.join('');
    $('#chart-legend').innerHTML = rows.map((_, i) => {
      const name = state.cities[i].name.trim() || `攻城${LETTERS[i]}`;
      return `<span class="legend-item"><span class="legend-dot" style="--dot:${COLORS[i]}"></span>${escapeHTML(LETTERS[i])}：${escapeHTML(name)}</span>`;
    }).join('');
  }

  function render() {
    const visible = state.cities.slice(0, state.count);
    const plan = Calc.simulatePlan({ cities: visible, available: state.available, power: state.power, stamina: state.stamina });
    plan.rows.forEach((row, i) => renderCity(cards[i], row));
    renderSummary(plan);
    renderTimeline(plan.rows);
    return plan;
  }

  function copyText(plan) {
    const lines = [
      '【信長の野望・真戦｜攻城シミュレーション】',
      `使用可能兵器：${plan.pool}部隊 / 配分：${plan.allocated}部隊`,
      `兵器攻城値：${state.power} / 現在体力：${state.stamina}（最大${Calc.maxAttackRounds(state.stamina)}回攻撃）`,
      `全体判定：${plan.status === 'clear' ? '耐久削り成立' : '要調整'}`,
      '',
    ];
    plan.rows.forEach((row, i) => {
      const city = state.cities[i];
      const level = city.level === 'custom' ? '任意設定' : `Lv${city.level}`;
      lines.push(`■ ${city.name.trim() || `攻城${LETTERS[i]}`}（${level}）`);
      lines.push(`耐久${format(row.hp)} / 割当${row.units}部隊 / 最低必要${row.neededUnits === null ? '算出不可' : row.neededUnits + '部隊'}`);
      lines.push(`攻城値${format(row.perRound)}/回 / 必要${row.requiredRounds === null ? '算出不可' : row.requiredRounds + '回'} / ${row.projectedMinutes === null ? '所要時間算出不可' : row.projectedMinutes + '分' + (row.feasible ? '' : '（理論値・体力不足）')}`);
      lines.push(`判定：${row.feasible ? '耐久削り成立' : `不成立（残耐久${format(row.remaining)}）`}`);
      lines.push('');
    });
    lines.push('※全兵器の体力は共通値。守備軍殲滅・到着時差・兵損・回復は計算外。');
    return lines.join('\n');
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.focus(); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { /* nothing */ }
    ta.remove();
    return ok;
  }
  function updatePresets(selected = '') {
    const list = $('#preset-list');
    list.replaceChildren();
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = presets.length ? '選択してください' : '保存なし'; list.appendChild(empty);
    presets.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id; option.textContent = item.name;
      list.appendChild(option);
    });
    if (presets.some(item => item.id === selected)) list.value = selected;
    $('#load-button').disabled = presets.length === 0;
    $('#delete-button').disabled = presets.length === 0;
  }
  function reportStorage(message, error = false) {
    const feedback = $('#storage-feedback');
    feedback.textContent = message; feedback.style.color = error ? 'var(--danger)' : 'var(--teal)';
  }

  function bind() {
    for (const id of ['available', 'power']) {
      $(`#${id}`).addEventListener('input', event => {
        state[id] = id === 'available' ? limit(event.target.value, 0, 1000000, 0) : limit(event.target.value, 1, 1000000, 1);
        changed();
      });
      $(`#${id}`).addEventListener('change', event => { event.target.value = state[id]; });
    }
    $('#stamina').addEventListener('change', event => { state.stamina = Number(event.target.value); changed(); });
    document.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => {
      state.count = Number(button.dataset.count);
      reflectCount(); changed();
    }));
    $('#reset-button').addEventListener('click', () => {
      if (!confirm('入力中の条件を初期設定に戻しますか？ 名前付きの保存済み条件は消えません。')) return;
      state = defaultState(); syncFields(); autosave(); reportStorage('入力中の条件を初期設定に戻しました。');
    });
    $('#allocate-button').addEventListener('click', () => {
      const plan = render();
      if (plan.minRequired === null) { reportStorage('体力が0のため必要部隊数を計算できません。', true); return; }
      plan.rows.forEach((result, index) => { state.cities[index].troops = result.neededUnits; });
      syncFields(); autosave();
      if (plan.minRequired > plan.pool) reportStorage(`最低必要数${format(plan.minRequired)}部隊は手持ち${format(plan.pool)}部隊を超えます。`, true);
      else reportStorage('各城の最低必要部隊数を割り当てました。');
    });
    $('#copy-button').addEventListener('click', () => {
      const text = copyText(render());
      const feedback = $('#copy-feedback');
      const success = () => { feedback.textContent = 'コピーしました。Discordなどに貼り付けられます。'; };
      const fail = () => { feedback.textContent = '自動コピーできませんでした。ブラウザの権限を確認してください。'; };
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') navigator.clipboard.writeText(text).then(success).catch(() => fallbackCopy(text) ? success() : fail());
      else fallbackCopy(text) ? success() : fail();
    });
    $('#save-button').addEventListener('click', () => {
      const name = $('#preset-name').value.trim();
      if (!name) { reportStorage('保存名を入力してください。', true); $('#preset-name').focus(); return; }
      const existing = presets.find(item => item.name === name);
      if (!existing && presets.length >= 20) { reportStorage('保存は20件までです。不要な条件を削除してください。', true); return; }
      const next = existing ? presets.map(item => item.id === existing.id ? { ...item, data: normalize(state) } : item)
        : [...presets, { id: `saved-${Date.now()}-${presets.length}`, name: name.slice(0, 40), data: normalize(state) }];
      if (!safeStorageSet(PRESETS_KEY, next)) { reportStorage('保存に失敗しました。ブラウザの保存領域が使用できません。', true); return; }
      presets = next; const selected = existing ? existing.id : presets[presets.length-1].id;
      updatePresets(selected); reportStorage(existing ? '同名の保存内容を更新しました。' : 'このブラウザに条件を保存しました。');
    });
    $('#load-button').addEventListener('click', () => {
      const current = presets.find(item => item.id === $('#preset-list').value);
      if (!current) { reportStorage('読み込む条件を選択してください。', true); return; }
      state = normalize(current.data); syncFields(); autosave(); reportStorage(`「${current.name}」を読み込みました。`);
    });
    $('#delete-button').addEventListener('click', () => {
      const selected = presets.find(item => item.id === $('#preset-list').value);
      if (!selected) { reportStorage('削除する条件を選択してください。', true); return; }
      if (!confirm(`保存済みの「${selected.name}」を削除しますか？`)) return;
      const next = presets.filter(item => item.id !== selected.id);
      if (!safeStorageSet(PRESETS_KEY, next)) { reportStorage('削除情報の保存に失敗しました。', true); return; }
      presets = next; updatePresets(); reportStorage('保存済みの条件を削除しました。現在の入力条件はそのままです。');
    });
  }

  for (let i = 0; i < 3; i++) cards.push(createCard(i));
  bind();
  syncFields();
  updatePresets();
})();
