(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  function setText(id, v) { const el = $(id); if (el) el.textContent = v; }

  // ─── Spieldaten ───
  const IDLE_KEY = 'kraftwerk-idle';
  const IDLE_OFFLINE_CAP = 12 * 3600;  // max. 12 h Offline-Gutschrift
  const IDLE_OFFLINE_CAP_H = IDLE_OFFLINE_CAP / 3600;
  const MAX_PER_GEN = 500;             // harte Obergrenze je Kraftwerkstyp
  const GAME_PACE = 0.7;               // <1 = langsameres Tempo (Einnahmen gedrosselt)
  const COST_GROWTH = 1.15;
  const GENERATORS = [
    { id: 'kurbel', name: 'Handkurbel',         cost: 15,       out: 0.1  },
    { id: 'solar',  name: 'Solarpanel',         cost: 100,      out: 1    },
    { id: 'wind',   name: 'Windrad',            cost: 1100,     out: 8    },
    { id: 'wasser', name: 'Wasserkraftwerk',    cost: 12000,    out: 47   },
    { id: 'bhkw',   name: 'Blockheizkraftwerk', cost: 130000,   out: 260  },
    { id: 'kern',   name: 'Kernkraftwerk',      cost: 1400000,  out: 1400 },
    { id: 'fusion', name: 'Fusionsreaktor',     cost: 20000000, out: 7800 }
  ];
  const UPGRADES = [
    { id: 'click', name: 'Stärkerer Impuls',   desc: '+1 Basisleistung pro Klick', baseCost: 50,  growth: 3 },
    { id: 'eff',   name: 'Wirkungsgrad +10 %', desc: 'Alle Kraftwerke leisten mehr', baseCost: 800, growth: 4 }
  ];

  // ─── Erfolge / Meilensteine ───
  // Jeder freigeschaltete Erfolg gibt dauerhaft +2 % Gesamtleistung.
  const ACH_BONUS = 0.02;
  function genTotal() { let s = 0; for (const g of GENERATORS) s += idle.gens[g.id]; return s; }
  function typesOwned() { let s = 0; for (const g of GENERATORS) if (idle.gens[g.id] > 0) s++; return s; }
  const ACHIEVEMENTS = [
    { id: 'spark',    icon: '✨', name: 'Erster Funke',       desc: '10 ⚡ erzeugt',            check: () => idle.total >= 10 },
    { id: 'kilo',     icon: '🔋', name: 'Kilowatt-Klub',      desc: '1 000 ⚡ erzeugt',         check: () => idle.total >= 1e3 },
    { id: 'mega',     icon: '⚙️', name: 'Megawatt',           desc: '1 Mio. ⚡ erzeugt',        check: () => idle.total >= 1e6 },
    { id: 'giga',     icon: '🚗', name: '1,21 Gigawatt!',     desc: '1,21 Mrd. ⚡ erzeugt',     check: () => idle.total >= 1.21e9 },
    { id: 'tera',     icon: '🌐', name: 'Terawatt',           desc: '1 Bio. ⚡ erzeugt',        check: () => idle.total >= 1e12 },
    { id: 'click100', icon: '👆', name: 'Kurbler',            desc: '100-mal geklickt',        check: () => idle.clicks >= 100 },
    { id: 'click1k',  icon: '💪', name: 'Dauerdrücker',       desc: '1 000-mal geklickt',      check: () => idle.clicks >= 1000 },
    { id: 'solar',    icon: '☀️', name: 'Sonnenanbeter',      desc: 'Erstes Solarpanel',       check: () => idle.gens.solar >= 1 },
    { id: 'kern',     icon: '☢️', name: 'Ja bitte',           desc: 'Erstes Kernkraftwerk',    check: () => idle.gens.kern >= 1 },
    { id: 'fusion',   icon: '⭐', name: 'Sonne im Keller',    desc: 'Erster Fusionsreaktor',   check: () => idle.gens.fusion >= 1 },
    { id: 'mix',      icon: '🔀', name: 'Voller Energiemix',  desc: 'Von jedem Typ mind. 1',   check: () => typesOwned() >= GENERATORS.length },
    { id: 'park50',   icon: '🏭', name: 'Kraftwerkspark',     desc: '50 Kraftwerke besitzen',  check: () => genTotal() >= 50 },
    { id: 'park250',  icon: '🏙️', name: 'Energiekonzern',     desc: '250 Kraftwerke besitzen', check: () => genTotal() >= 250 },
    { id: 'ms10',     icon: '🎯', name: 'Erster Meilenstein',  desc: '10 gleiche Kraftwerke',   check: () => GENERATORS.some(g => idle.gens[g.id] >= 10) },
    { id: 'ms100',    icon: '💯', name: 'Volle Hütte',         desc: '100 gleiche Kraftwerke',  check: () => GENERATORS.some(g => idle.gens[g.id] >= 100) },
    { id: 'eff10',    icon: '📈', name: 'Effizienzwunder',    desc: 'Wirkungsgrad Stufe 10',   check: () => idle.effLevel >= 10 },
    { id: 'grid1',    icon: '🔌', name: 'Netzausbau',         desc: 'Erster Netzausbau',       check: () => idle.prestige >= 1 },
    { id: 'grid10',   icon: '🏆', name: 'Netzbetreiber',      desc: '10 Ausbaupunkte',         check: () => idle.prestige >= 10 }
  ];

  const idle = {
    energy: 0, total: 0, gens: {}, clickLevel: 0, effLevel: 0,
    prestige: 0, lastSave: Date.now(), buyAmount: '1', started: false,
    clicks: 0, ach: [], speed: 1, play: 0, surges: 0,
    cheatsUnlocked: false, redeemed: []
  };
  GENERATORS.forEach(g => { idle.gens[g.id] = 0; });
  const achSet = new Set();

  // ─── Berechnungen ───
  function idleFmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '0';
    if (n < 1000) return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1);
    const units = ['', 'K', 'Mio.', 'Mrd.', 'Bio.', 'Brd.', 'Trd.', 'Qa', 'Qi', 'Sx'];
    let i = 0;
    while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + ' ' + units[i];
  }
  // ─── Temporäre Buffs (Stromstoß-Belohnungen; nicht persistent) ───
  let buffProdUntil = 0, buffProdMult = 1;
  let buffClickUntil = 0, buffClickMult = 1;
  function buffProd() { return Date.now() < buffProdUntil ? buffProdMult : 1; }
  function buffClick() { return Date.now() < buffClickUntil ? buffClickMult : 1; }

  function idlePrestigeMult() { return 1 + 0.02 * idle.prestige; }
  function idleAchBonus() { return 1 + ACH_BONUS * achSet.size; }
  function idleGlobalMult() { return idlePrestigeMult() * Math.pow(1.1, idle.effLevel) * idleAchBonus() * buffProd(); }

  // ─── Kraftwerks-Meilensteine ───
  // Ab bestimmten Stückzahlen verdoppelt sich die Leistung eines Kraftwerks.
  const MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
  function msCount(owned) { let c = 0; for (const t of MILESTONES) if (owned >= t) c++; return c; }
  function msMult(owned) { return Math.pow(2, msCount(owned)); }
  function msNext(owned) { for (const t of MILESTONES) if (owned < t) return t; return null; }
  function msPrev(owned) { let p = 0; for (const t of MILESTONES) { if (owned >= t) p = t; else break; } return p; }

  function idlePerSecond() {
    let base = 0;
    for (const g of GENERATORS) base += idle.gens[g.id] * g.out * msMult(idle.gens[g.id]);
    return base * idleGlobalMult() * GAME_PACE;
  }
  function idleClickGain() { return ((1 + idle.clickLevel) * idleGlobalMult() * GAME_PACE + 0.05 * idlePerSecond()) * buffClick(); }
  function idlePrestigePotential() { return Math.floor(Math.sqrt(idle.total / 1e6)); }
  function idlePrestigeGain() { return Math.max(0, idlePrestigePotential() - idle.prestige); }

  // Gesamtkosten für `count` Einheiten ab `owned` (geometrische Reihe)
  function idleGenCost(g, owned, count) {
    const first = g.cost * Math.pow(COST_GROWTH, owned);
    return first * (Math.pow(COST_GROWTH, count) - 1) / (COST_GROWTH - 1);
  }
  function idleMaxAffordable(g, owned, energy) {
    const first = g.cost * Math.pow(COST_GROWTH, owned);
    if (energy < first) return 0;
    const n = Math.log(energy * (COST_GROWTH - 1) / first + 1) / Math.log(COST_GROWTH);
    return Math.max(0, Math.floor(n + 1e-9));
  }
  function idleUpgradeCost(u) {
    const lvl = u.id === 'click' ? idle.clickLevel : idle.effLevel;
    return u.baseCost * Math.pow(u.growth, lvl);
  }

  // ─── DOM einmalig aufbauen ───
  let idleBuilt = false;
  let idleFirstRender = true;
  const idleRevealed = {};
  function buildIdle() {
    if (idleBuilt) return;
    const gc = $('idle-generators');
    gc.innerHTML = GENERATORS.map(g => `
      <div class="idle-row idle-locked" id="genrow-${g.id}">
        <span class="idle-row-icon">${window.KraftFX ? KraftFX.icon(g.id) : ''}</span>
        <div class="idle-row-info">
          <div class="idle-row-title">
            <span class="idle-row-name">${g.name}</span>
            <span class="idle-row-owned" id="genowned-${g.id}">×0</span>
          </div>
          <div class="idle-row-sub" id="genout-${g.id}"></div>
          <div class="idle-ms" id="genms-${g.id}">
            <div class="idle-ms-bar"><span id="gensbar-${g.id}"></span></div>
            <span class="idle-ms-txt" id="genmstxt-${g.id}"></span>
          </div>
        </div>
        <button class="idle-buy-btn" id="genbuy-${g.id}">
          <span id="genlbl-${g.id}">Kaufen</span>
          <span class="cost" id="gencost-${g.id}"></span>
        </button>
      </div>`).join('');
    GENERATORS.forEach(g => { $('genbuy-' + g.id).addEventListener('click', () => idleBuyGen(g.id)); });

    const uc = $('idle-upgrades');
    uc.innerHTML = UPGRADES.map(u => `
      <div class="idle-row" id="uprow-${u.id}">
        <div class="idle-row-info">
          <div class="idle-row-title">
            <span class="idle-row-name">${u.name}</span>
            <span class="idle-row-owned" id="uplvl-${u.id}">Stufe 0</span>
          </div>
          <div class="idle-row-sub">${u.desc}</div>
        </div>
        <button class="idle-buy-btn" id="upbuy-${u.id}">
          <span>Kaufen</span>
          <span class="cost" id="upcost-${u.id}"></span>
        </button>
      </div>`).join('');
    UPGRADES.forEach(u => { $('upbuy-' + u.id).addEventListener('click', () => idleBuyUpgrade(u.id)); });

    const ac = $('idle-achievements');
    if (ac) {
      ac.innerHTML = ACHIEVEMENTS.map(a => `
        <div class="ach locked" id="ach-${a.id}" title="${a.desc}">
          <span class="ach-ico">${a.icon}</span>
          <span class="ach-txt"><span class="ach-name">${a.name}</span><span class="ach-desc">${a.desc}</span></span>
        </div>`).join('');
    }

    idleBuilt = true;
  }

  // ─── Toast-Benachrichtigung ───
  function idleToast(icon, title, sub) {
    const box = $('kraft-toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'kraft-toast';
    el.innerHTML =
      `<span class="kraft-toast-ico">${icon}</span>` +
      `<span class="kraft-toast-txt"><strong>${title}</strong>${sub ? '<span>' + sub + '</span>' : ''}</span>`;
    box.appendChild(el);
    const kill = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 400); };
    setTimeout(kill, 5000);
    el.addEventListener('click', kill);
  }

  // Neu erfüllte Erfolge freischalten. silent=true => beim Laden ohne Ton/Toast.
  function checkAchievements(silent) {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (achSet.has(a.id)) continue;
      if (a.check()) {
        achSet.add(a.id);
        idle.ach.push(a.id);
        changed = true;
        if (!silent) {
          idleToast(a.icon, 'Erfolg: ' + a.name, a.desc + '  ·  +' + (ACH_BONUS * 100).toFixed(0) + ' % Leistung');
          if (window.KraftFX) KraftFX.unlock();
        }
      }
    }
    if (changed && !silent) saveIdle();
    return changed;
  }

  // ─── Aktionen ───
  function idleBuyGen(id) {
    const g = GENERATORS.find(x => x.id === id);
    const owned = idle.gens[id];
    let n = idle.buyAmount === 'max'
      ? idleMaxAffordable(g, owned, idle.energy)
      : parseInt(idle.buyAmount, 10);
    n = Math.min(n, MAX_PER_GEN - owned);   // Obergrenze je Typ
    if (n < 1) { if (window.KraftFX) KraftFX.denied(); return; }
    const cost = idleGenCost(g, owned, n);
    if (idle.energy < cost - 1e-6) { if (window.KraftFX) KraftFX.denied(); return; }
    idle.energy -= cost;
    idle.gens[id] += n;
    idle.started = true;
    if (window.KraftFX) KraftFX.buy();
    const btn = $('genbuy-' + id);
    btn.classList.remove('idle-pulse');
    void btn.offsetWidth;
    btn.classList.add('idle-pulse');
    if (window.KraftFX) { const r = btn.getBoundingClientRect(); KraftFX.sparkle(r.left + r.width / 2, r.top + r.height / 2, 9); }
    checkAchievements(false);
    renderIdleView();
    saveIdle();
  }

  function idleBuyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id);
    const cost = idleUpgradeCost(u);
    if (idle.energy < cost - 1e-6) return;
    idle.energy -= cost;
    if (id === 'click') idle.clickLevel++; else idle.effLevel++;
    if (window.KraftFX) KraftFX.upgrade();
    checkAchievements(false);
    renderIdleView();
    saveIdle();
  }

  function idleDoPrestige() {
    const gain = idlePrestigeGain();
    if (gain < 1) return;
    if (!window.confirm(`Netzausbau: +${gain} Ausbaupunkt(e) für dauerhaft +${(gain * 2)} % Leistung.\nEnergie, Kraftwerke und Upgrades werden zurückgesetzt. Fortfahren?`)) return;
    if (window.KraftFX) KraftFX.prestige();
    idle.prestige += gain;
    idle.energy = 0;
    idle.clickLevel = 0;
    idle.effLevel = 0;
    GENERATORS.forEach(g => { idle.gens[g.id] = 0; });
    checkAchievements(false);
    renderIdleView();
    saveIdle();
  }

  function idleClick(e) {
    const gain = idleClickGain();
    idle.energy += gain;
    idle.total += gain;
    idle.clicks++;
    idle.started = true;
    checkAchievements(false);
    if (window.KraftFX) {
      KraftFX.zap(gain);
      let x = window.innerWidth / 2, y = window.innerHeight / 2;
      if (e && typeof e.clientX === 'number' && (e.clientX || e.clientY)) { x = e.clientX; y = e.clientY; }
      else { const b = $('idle-click'); if (b) { const r = b.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; } }
      KraftFX.burst(x, y);
      KraftFX.floatText(x, y - 6, '+' + idleFmt(gain));
    }
    renderIdleView();
  }

  function idleResetSave() {
    if (!window.confirm('Spielstand wirklich unwiderruflich löschen?')) return;
    idle.energy = 0; idle.total = 0; idle.clickLevel = 0; idle.effLevel = 0;
    idle.prestige = 0; idle.buyAmount = '1'; idle.started = false;
    idle.clicks = 0; idle.ach = []; achSet.clear(); idle.speed = 1;
    idle.play = 0; idle.surges = 0;
    idle.redeemed = [];   // Freischaltung (cheatsUnlocked) bleibt bewusst erhalten
    buffProdUntil = 0; buffClickUntil = 0;
    GENERATORS.forEach(g => { idle.gens[g.id] = 0; });
    const r1 = document.querySelector('input[name="idle-buy"][value="1"]');
    if (r1) r1.checked = true;
    try { localStorage.removeItem(IDLE_KEY); } catch (e) { /* ignore */ }
    renderIdleView();
  }

  // ─── Anzeige aktualisieren ───
  function renderIdleView() {
    if (!idleBuilt) return;
    const perSec = idlePerSecond();
    setText('idle-energy', idleFmt(idle.energy) + ' ⚡');
    setText('idle-rate', idleFmt(perSec) + (idle.speed && idle.speed !== 1 ? ` · ×${idle.speed} Speed` : ''));
    setText('idle-total', idleFmt(idle.total) + ' ⚡');
    setText('idle-prestige-mult', '×' + idleGlobalMult().toFixed(2));
    setText('idle-clickgain', '+' + idleFmt(idleClickGain()));

    let prevOwned = 1;
    for (const g of GENERATORS) {
      const owned = idle.gens[g.id];
      const revealed = owned > 0 || idle.energy >= g.cost * 0.4 || prevOwned > 0;
      if (!idleFirstRender && revealed && !idleRevealed[g.id] && window.KraftFX) KraftFX.unlock();
      idleRevealed[g.id] = revealed;
      const atMax = owned >= MAX_PER_GEN;
      $('genrow-' + g.id).classList.toggle('idle-locked', !revealed);
      setText('genowned-' + g.id, '×' + owned + (atMax ? ' (max)' : ''));
      const mm = msMult(owned);
      const perUnit = g.out * idleGlobalMult() * mm;
      setText('genout-' + g.id,
        idleFmt(perUnit) + ' ⚡/s' +
        (owned > 0 ? '  ·  ∑ ' + idleFmt(owned * perUnit) + ' ⚡/s' : ''));

      // Meilenstein-Balken + Text (bei Maximum voll)
      const next = msNext(owned);
      const bar = $('gensbar-' + g.id);
      if (atMax) {
        if (bar) bar.style.width = '100%';
        setText('genmstxt-' + g.id, `×${idleFmt(mm)} · Maximum (${MAX_PER_GEN})`);
      } else if (next === null) {
        if (bar) bar.style.width = '100%';
        setText('genmstxt-' + g.id, `×${idleFmt(mm)} · alle Meilensteine`);
      } else {
        const prev = msPrev(owned);
        const frac = Math.max(0, Math.min(1, (owned - prev) / (next - prev)));
        if (bar) bar.style.width = (frac * 100).toFixed(1) + '%';
        const mmNext = idleFmt(mm * 2);
        setText('genmstxt-' + g.id,
          (mm > 1 ? `×${idleFmt(mm)} · ` : '') + `${owned}/${next} → ×${mmNext} (noch ${next - owned})`);
      }

      let n = idle.buyAmount === 'max'
        ? idleMaxAffordable(g, owned, idle.energy)
        : parseInt(idle.buyAmount, 10);
      n = Math.min(n, MAX_PER_GEN - owned);
      const showN = Math.max(1, n);
      const cost = idleGenCost(g, owned, showN);
      const affordable = !atMax && n >= 1 && idle.energy >= cost - 1e-6;
      setText('genlbl-' + g.id, atMax ? 'Max erreicht' : `Kaufen ×${showN}`);
      setText('gencost-' + g.id, atMax ? '—' : idleFmt(cost) + ' ⚡');
      $('genbuy-' + g.id).disabled = !affordable;
      prevOwned = owned;
    }

    for (const u of UPGRADES) {
      const lvl = u.id === 'click' ? idle.clickLevel : idle.effLevel;
      const cost = idleUpgradeCost(u);
      setText('uplvl-' + u.id, 'Stufe ' + lvl);
      setText('upcost-' + u.id, idleFmt(cost) + ' ⚡');
      $('upbuy-' + u.id).disabled = idle.energy < cost - 1e-6;
    }

    const pg = idlePrestigeGain();
    setText('idle-prestige-gain', '+' + pg);
    setText('idle-prestige-have', idle.prestige);
    $('idle-prestige').disabled = pg < 1;

    for (const a of ACHIEVEMENTS) {
      const el = $('ach-' + a.id);
      if (!el) continue;
      const got = achSet.has(a.id);
      el.classList.toggle('locked', !got);
      el.classList.toggle('unlocked', got);
    }
    setText('idle-ach-summary',
      achSet.size + ' / ' + ACHIEVEMENTS.length + ' · +' + Math.round(ACH_BONUS * 100 * achSet.size) + ' %');

    // Aktive Buffs (Stromstoß)
    const be = $('idle-buffs');
    if (be) {
      const now = Date.now();
      const parts = [];
      if (now < buffProdUntil) parts.push(`🔥 Produktion ×${buffProdMult} · ${Math.ceil((buffProdUntil - now) / 1000)} s`);
      if (now < buffClickUntil) parts.push(`👆 Klick ×${buffClickMult} · ${Math.ceil((buffClickUntil - now) / 1000)} s`);
      be.textContent = parts.join('   ·   ');
      be.classList.toggle('hidden', parts.length === 0);
    }

    updateStats();
    idleFirstRender = false;
  }

  // ─── Speichern / Laden ───
  function saveIdle() {
    idle.lastSave = Date.now();
    try {
      localStorage.setItem(IDLE_KEY, JSON.stringify({
        energy: idle.energy, total: idle.total, gens: idle.gens,
        clickLevel: idle.clickLevel, effLevel: idle.effLevel,
        prestige: idle.prestige, lastSave: idle.lastSave, buyAmount: idle.buyAmount,
        clicks: idle.clicks, ach: idle.ach, speed: idle.speed,
        play: idle.play, surges: idle.surges,
        cheatsUnlocked: idle.cheatsUnlocked, redeemed: idle.redeemed
      }));
    } catch (e) { /* Speicher voll o. deaktiviert */ }
  }
  function loadIdle() {
    let raw;
    try { raw = localStorage.getItem(IDLE_KEY); } catch (e) { return; }
    if (!raw) return;
    let s;
    try { s = JSON.parse(raw); } catch (e) { return; }
    idle.energy = +s.energy || 0;
    idle.total = +s.total || 0;
    idle.clickLevel = +s.clickLevel || 0;
    idle.effLevel = +s.effLevel || 0;
    idle.prestige = +s.prestige || 0;
    idle.buyAmount = s.buyAmount === '10' || s.buyAmount === 'max' ? s.buyAmount : '1';
    idle.lastSave = +s.lastSave || Date.now();
    idle.started = true;
    idle.clicks = +s.clicks || 0;
    idle.speed = +s.speed > 0 ? Math.min(1000, +s.speed) : 1;
    idle.play = +s.play || 0;
    idle.surges = +s.surges || 0;
    idle.cheatsUnlocked = !!s.cheatsUnlocked;
    idle.redeemed = Array.isArray(s.redeemed) ? s.redeemed.slice() : [];
    if (s.gens) GENERATORS.forEach(g => { idle.gens[g.id] = Math.min(MAX_PER_GEN, +s.gens[g.id] || 0); });
    // Erfolge wiederherstellen (nur bekannte IDs)
    idle.ach = [];
    achSet.clear();
    if (Array.isArray(s.ach)) {
      const known = new Set(ACHIEVEMENTS.map(a => a.id));
      s.ach.forEach(id => { if (known.has(id) && !achSet.has(id)) { achSet.add(id); idle.ach.push(id); } });
    }

    // Offline-Gutschrift (auf max. IDLE_OFFLINE_CAP begrenzt)
    const rawElapsed = Math.max(0, (Date.now() - idle.lastSave) / 1000);
    const elapsed = Math.min(IDLE_OFFLINE_CAP, rawElapsed);
    const capped = rawElapsed > IDLE_OFFLINE_CAP + 1;
    const gain = idlePerSecond() * elapsed;
    if (gain > 0) {
      idle.energy += gain;
      idle.total += gain;
      const dauer = elapsed < 3600 ? Math.round(elapsed / 60) + ' min' : (elapsed / 3600).toFixed(1) + ' h';
      const maxHint = capped ? ` (max ${IDLE_OFFLINE_CAP_H} h)` : '';
      const note = $('idle-offline');
      if (note) {
        note.textContent = `Willkommen zurück: +${idleFmt(gain)} ⚡ in ${dauer} offline${maxHint}`;
        note.classList.remove('hidden');
        setTimeout(() => note.classList.add('hidden'), 8000);
      }
      idleToast('🔌', 'Willkommen zurück!', `+${idleFmt(gain)} ⚡ in ${dauer} offline erzeugt${maxHint}`);
    }

    // Bereits erfüllte Erfolge lautlos übernehmen (z. B. alte Spielstände)
    checkAchievements(true);
  }

  // ─── Spiel-Loop ───
  let idleLast = 0;
  let idleSaveAcc = 0;
  let idleAchAcc = 0;
  function idleTick(now) {
    if (!idleLast) idleLast = now;
    const realDt = Math.min(1, (now - idleLast) / 1000);
    const dt = realDt * (idle.speed || 1);
    idleLast = now;
    if (idle.started) idle.play += realDt;   // echte Spielzeit (ohne Speed)
    const gain = idlePerSecond() * dt;
    if (gain > 0) { idle.energy += gain; idle.total += gain; }
    idleSaveAcc += realDt;
    if (idleSaveAcc >= 10) { idleSaveAcc = 0; saveIdle(); }
    idleAchAcc += realDt;
    if (idleAchAcc >= 1) { idleAchAcc = 0; checkAchievements(false); }
    renderIdleView();
    requestAnimationFrame(idleTick);
  }

  // ─── Codes: Geschenk-Codes (immer, einmalig) + Cheats (nur nach Freischaltung) ───
  // Freischalt-Code für den Cheat-Modus:
  const UNLOCK_CODES = ['tesla', 'cheatmodus'];

  // Geschenk-Codes: einmalig einlösbar, geben Belohnungen.
  const GIFTS = [
    { codes: ['willkommen'], desc: 'Startgeschenk',      run: () => { const a = Math.max(idlePerSecond() * 300, idleClickGain() * 100, 250); idle.energy += a; idle.total += a; return `🎁 Willkommensgeschenk: +${idleFmt(a)} ⚡`; } },
    { codes: ['hertz'],      desc: '+2 Ausbaupunkte',     run: () => { idle.prestige += 2; return '🎁 +2 Ausbaupunkte'; } },
    { codes: ['volt'],       desc: 'ein Stromstoß',       run: () => { setTimeout(spawnSurge, 30); return '🎁 Ein Stromstoß erscheint!'; } },
    { codes: ['watt'],       desc: '1 Stunde Produktion', run: () => { const a = Math.max(idlePerSecond() * 3600, 500); idle.energy += a; idle.total += a; return `🎁 +${idleFmt(a)} ⚡ (1 h Produktion)`; } },
    { codes: ['blitz'],      desc: 'Überspannung ×5 (60 s)', run: () => { buffProdMult = 5; buffProdUntil = Date.now() + 60000; return '🎁 Überspannung ×5 für 60 s'; } }
  ];

  // ─── Cheats (bleiben verborgen, bis der Freischalt-Code eingegeben wurde) ───
  const CHEATS = [
    { codes: ['geld', 'money'],          desc: 'sehr viel Energie (+1 Trilliarde ⚡)',   run: () => { idle.energy += 1e18; return '💰 Energie aufgeladen!'; } },
    { codes: ['reich'],                  desc: 'ordentlich Energie (+1 Mrd. ⚡)',        run: () => { idle.energy += 1e9;  return '💰 +1 Mrd. ⚡'; } },
    { codes: ['motherlode'],             desc: 'Energie-Bonus (+1 Bio. ⚡)',             run: () => { idle.energy += 1e15; return '💰 Motherlode!'; } },
    { codes: ['turbo'],                  desc: 'Spielgeschwindigkeit ×5',                run: () => { idle.speed = 5;  return '⏩ Speed ×5'; } },
    { codes: ['zeitraffer'],             desc: 'Spielgeschwindigkeit ×10',               run: () => { idle.speed = 10; return '⏩ Speed ×10'; } },
    { codes: ['hyper'],                  desc: 'Spielgeschwindigkeit ×25',               run: () => { idle.speed = 25; return '⏩ Speed ×25'; } },
    { codes: ['langsam', 'slow'],        desc: 'Spielgeschwindigkeit ×0,25',             run: () => { idle.speed = 0.25; return '⏪ Speed ×0,25'; } },
    { codes: ['normal', 'tempo'],        desc: 'Geschwindigkeit zurück auf ×1',          run: () => { idle.speed = 1;  return '⏱️ Normaltempo'; } },
    { codes: ['ausbau'],                 desc: '+10 Ausbaupunkte (Netz-Bonus)',          run: () => { idle.prestige += 10; return '🔌 +10 Ausbaupunkte'; } },
    { codes: ['vollausbau', 'maxbau'],   desc: 'alle Kraftwerke auf Maximum (500)',      run: () => { GENERATORS.forEach(g => { idle.gens[g.id] = MAX_PER_GEN; }); return '🏭 Alle Kraftwerke auf Max'; } },
    { codes: ['freischalten', 'unlock'], desc: 'von jedem Kraftwerk mind. 1',            run: () => { GENERATORS.forEach(g => { if (idle.gens[g.id] < 1) idle.gens[g.id] = 1; }); return '🔓 Alles freigeschaltet'; } },
    { codes: ['stromstoss', 'surge'],    desc: 'sofort einen Stromstoß erscheinen lassen', run: () => { setTimeout(spawnSurge, 30); return '⚡ Stromstoß kommt!'; } },
    { codes: ['loeschen', 'wipe'],       desc: 'Spielstand löschen (mit Rückfrage)',     run: () => { setTimeout(idleResetSave, 60); return '🗑️ Löschen…'; } }
  ];
  function finalizeRedeem(m, icon, title) {
    idle.started = true;
    checkAchievements(false);
    renderIdleView();
    saveIdle();
    idleToast(icon || '🎁', title || 'Code eingelöst', m);
  }
  // Wird von setupSettings gesetzt, um die Cheat-Liste nach Freischaltung einzublenden.
  let revealCheatUI = () => {};

  function redeemCode(raw) {
    const code = String(raw || '').trim().toLowerCase();
    if (!code) return { ok: false, msg: 'Bitte einen Code eingeben.' };

    // 1) Freischalt-Code für den Cheat-Modus
    if (UNLOCK_CODES.includes(code)) {
      if (idle.cheatsUnlocked) return { ok: false, msg: 'Cheat-Modus ist bereits freigeschaltet.' };
      idle.cheatsUnlocked = true;
      saveIdle();
      revealCheatUI();
      idleToast('🔓', 'Freigeschaltet', 'Cheat-Modus ist jetzt aktiv');
      return { ok: true, msg: '🔓 Cheat-Modus freigeschaltet! Die Codes sind jetzt sichtbar.' };
    }

    // 2) Geschenk-Code (einmalig)
    const gift = GIFTS.find(g => g.codes.includes(code));
    if (gift) {
      if (idle.redeemed.includes(gift.codes[0])) return { ok: false, msg: 'Diesen Code hast du bereits eingelöst.' };
      let m; try { m = gift.run(); } catch (e) { return { ok: false, msg: 'Fehler beim Einlösen.' }; }
      idle.redeemed.push(gift.codes[0]);
      finalizeRedeem(m, '🎁', 'Geschenk eingelöst');
      return { ok: true, msg: m };
    }

    // 3) Cheat-Code – nur wenn freigeschaltet
    const cheat = CHEATS.find(c => c.codes.includes(code));
    if (cheat) {
      if (!idle.cheatsUnlocked) return { ok: false, msg: '🔒 Gesperrt – erst mit dem Freischalt-Code aktivieren.' };
      let m; try { m = cheat.run(); } catch (e) { return { ok: false, msg: 'Fehler beim Ausführen.' }; }
      finalizeRedeem(m, '🎮', 'Cheat aktiviert');
      return { ok: true, msg: m };
    }

    return { ok: false, msg: `Unbekannter Code: „${code}"` };
  }

  // ─── Einstellungs-/Cheat-Modal ───
  function setupSettings() {
    const overlay = $('settings-overlay'), openBtn = $('open-settings'), closeBtn = $('settings-close');
    if (!overlay || !openBtn) return;
    const sliders = ['master', 'sfx', 'music', 'hum'];
    const syncVolumeUI = () => {
      if (!window.KraftFX || !KraftFX.getVolumes) return;
      const v = KraftFX.getVolumes();
      sliders.forEach(name => {
        const el = $('vol-' + name), val = $('volval-' + name);
        const pct = Math.round((v[name] || 0) * 100);
        if (el) el.value = pct;
        if (val) val.textContent = pct + '%';
      });
    };
    const open = () => { overlay.classList.remove('hidden'); syncVolumeUI(); };
    const close = () => overlay.classList.add('hidden');
    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close(); });

    // Tabs
    const TABS = ['sound', 'cheats', 'stats'];
    const showTab = (name) => {
      TABS.forEach(t => {
        const tab = $('tab-' + t), panel = $('panel-' + t);
        const on = t === name;
        if (tab) { tab.classList.toggle('is-active', on); tab.setAttribute('aria-selected', String(on)); }
        if (panel) panel.classList.toggle('hidden', !on);
      });
      if (name === 'stats') updateStats();
    };
    TABS.forEach(t => { const tab = $('tab-' + t); if (tab) tab.addEventListener('click', () => showTab(t)); });

    // Lautstärke-Regler
    sliders.forEach(name => {
      const el = $('vol-' + name);
      if (!el) return;
      el.addEventListener('input', () => {
        const pct = parseInt(el.value, 10) || 0;
        if (window.KraftFX && KraftFX.setVolume) KraftFX.setVolume(name, pct / 100);
        const val = $('volval-' + name);
        if (val) val.textContent = pct + '%';
      });
    });
    syncVolumeUI();

    // Code-Eingabe (Geschenke + Cheat-Freischaltung)
    const input = $('cheat-input'), applyBtn = $('cheat-apply'), msg = $('cheat-msg');
    const help = $('cheat-help'), badge = $('cheat-unlocked-badge'), list = $('cheat-list');
    // Cheat-Liste einblenden (nur nach Freischaltung)
    revealCheatUI = () => {
      if (badge) badge.classList.remove('hidden');
      if (help) help.classList.remove('hidden');
      if (list) list.innerHTML = CHEATS.map(c => `<li><code>${c.codes[0]}</code>${c.desc}</li>`).join('');
    };
    if (idle.cheatsUnlocked) revealCheatUI();

    const doApply = () => {
      const res = redeemCode(input ? input.value : '');
      if (msg) { msg.textContent = res.msg; msg.className = 'cheat-msg ' + (res.ok ? 'ok' : 'bad'); }
      if (res.ok) { if (input) input.value = ''; if (window.KraftFX) KraftFX.unlock(); }
      else if (window.KraftFX) KraftFX.denied();
    };
    if (applyBtn) applyBtn.addEventListener('click', doApply);
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doApply(); });
  }

  // ─── Stromstoß (zufälliger Klick-Bonus) ───
  function grantSurgeReward() {
    idle.surges = (idle.surges || 0) + 1;
    const perSec = idlePerSecond();
    const r = Math.random();
    if (r < 0.5) {
      const amount = Math.max(perSec * 90, idleClickGain() * 50, 25);
      idle.energy += amount; idle.total += amount;
      idleToast('⚡', 'Stromstoß eingefangen!', `+${idleFmt(amount)} ⚡ sofort`);
      if (window.KraftFX) KraftFX.prestige();
    } else if (r < 0.8) {
      buffProdMult = 7; buffProdUntil = Date.now() + 30000;
      idleToast('🔥', 'Überspannung!', 'Produktion ×7 für 30 s');
      if (window.KraftFX) KraftFX.unlock();
    } else {
      buffClickMult = 10; buffClickUntil = Date.now() + 20000;
      idleToast('👆', 'Klick-Rausch!', 'Klick ×10 für 20 s');
      if (window.KraftFX) KraftFX.unlock();
    }
    idle.started = true;
    checkAchievements(false);
    renderIdleView();
    saveIdle();
  }
  function spawnSurge() {
    if (document.hidden) { scheduleSurge(); return; }   // nicht spawnen, wenn Tab weg
    const el = document.createElement('button');
    el.className = 'power-surge';
    el.type = 'button';
    el.setAttribute('aria-label', 'Stromstoß einsammeln');
    el.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>';
    el.style.left = (8 + Math.random() * 82).toFixed(1) + 'vw';
    el.style.top = (16 + Math.random() * 66).toFixed(1) + 'vh';
    document.body.appendChild(el);
    let done = false;
    const finish = (caught) => {
      if (done) return; done = true;
      clearTimeout(to);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 350);
      if (caught) grantSurgeReward();
      scheduleSurge();
    };
    el.addEventListener('click', () => finish(true));
    const to = setTimeout(() => finish(false), 12000);   // verschwindet nach 12 s
  }
  function scheduleSurge() {
    const delay = 60000 + Math.random() * 60000;         // alle 60–120 s
    setTimeout(spawnSurge, delay);
  }

  // ─── Statistik ───
  function fmtTime(sec) {
    sec = Math.floor(sec || 0);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return `${h} h ${m} min`;
    if (m > 0) return `${m} min ${s} s`;
    return `${s} s`;
  }
  function updateStats() {
    const panel = $('panel-stats');
    if (!panel || panel.classList.contains('hidden')) return;
    setText('stat-play', fmtTime(idle.play));
    setText('stat-clicks', idleFmt(idle.clicks));
    setText('stat-total', idleFmt(idle.total) + ' ⚡');
    setText('stat-prestige', String(idle.prestige));
    setText('stat-ach', achSet.size + ' / ' + ACHIEVEMENTS.length);
    setText('stat-surges', idleFmt(idle.surges || 0));
    setText('stat-mult', '×' + idleGlobalMult().toFixed(2));
  }

  function init() {
    buildIdle();
    loadIdle();
    setupSettings();
    $('idle-click').addEventListener('click', idleClick);
    $('idle-prestige').addEventListener('click', idleDoPrestige);
    $('idle-reset').addEventListener('click', idleResetSave);
    document.querySelectorAll('input[name="idle-buy"]').forEach(el => {
      el.checked = el.value === idle.buyAmount;
      el.addEventListener('change', (e) => { idle.buyAmount = e.target.value; renderIdleView(); saveIdle(); });
    });
    // ── fx.js: Sound-/Brumm-Schalter ──
    if (window.KraftFX) {
      const sBtn = $('fx-sound'), hBtn = $('fx-hum'), mBtn = $('fx-music');
      const syncSound = () => { if (sBtn) { sBtn.setAttribute('aria-pressed', String(!KraftFX.isMuted())); sBtn.textContent = (KraftFX.isMuted() ? '🔇' : '🔊') + ' Sound'; } };
      const syncHum = () => { if (hBtn) hBtn.setAttribute('aria-pressed', String(KraftFX.humOn())); };
      const syncMusic = () => { if (mBtn) mBtn.setAttribute('aria-pressed', String(KraftFX.musicOn())); };
      syncSound(); syncHum(); syncMusic();
      if (sBtn) sBtn.addEventListener('click', () => { KraftFX.toggleMute(); syncSound(); syncHum(); syncMusic(); });
      if (hBtn) hBtn.addEventListener('click', () => { KraftFX.toggleHum(); syncHum(); });
      if (mBtn) mBtn.addEventListener('click', () => { KraftFX.toggleMusic(); syncMusic(); });
      // AudioContext darf erst nach einer Nutzer-Geste starten -> gespeicherte Loops dann wiederherstellen
      const kick = () => {
        if (!KraftFX.isMuted()) {
          if (KraftFX._restoreHum() && !KraftFX.humOn()) { KraftFX.toggleHum(); syncHum(); }
          if (KraftFX._restoreMusic() && !KraftFX.musicOn()) { KraftFX.toggleMusic(); syncMusic(); }
        }
        window.removeEventListener('pointerdown', kick);
      };
      window.addEventListener('pointerdown', kick, { once: true });
    }

    document.addEventListener('visibilitychange', () => { if (document.hidden) saveIdle(); });
    window.addEventListener('beforeunload', saveIdle);
    renderIdleView();
    requestAnimationFrame(idleTick);
    scheduleSurge();   // ersten Stromstoß planen
  }

  document.addEventListener('DOMContentLoaded', init);
})();
