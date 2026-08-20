(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  function setText(id, v) { const el = $(id); if (el) el.textContent = v; }

  // ─── Spieldaten ───
  const IDLE_KEY = 'kraftwerk-idle';
  const IDLE_OFFLINE_CAP = 8 * 3600;   // max. 8 h Offline-Gutschrift
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
    { id: 'eff10',    icon: '📈', name: 'Effizienzwunder',    desc: 'Wirkungsgrad Stufe 10',   check: () => idle.effLevel >= 10 },
    { id: 'grid1',    icon: '🔌', name: 'Netzausbau',         desc: 'Erster Netzausbau',       check: () => idle.prestige >= 1 },
    { id: 'grid10',   icon: '🏆', name: 'Netzbetreiber',      desc: '10 Ausbaupunkte',         check: () => idle.prestige >= 10 }
  ];

  const idle = {
    energy: 0, total: 0, gens: {}, clickLevel: 0, effLevel: 0,
    prestige: 0, lastSave: Date.now(), buyAmount: '1', started: false,
    clicks: 0, ach: []
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
  function idlePrestigeMult() { return 1 + 0.02 * idle.prestige; }
  function idleAchBonus() { return 1 + ACH_BONUS * achSet.size; }
  function idleGlobalMult() { return idlePrestigeMult() * Math.pow(1.1, idle.effLevel) * idleAchBonus(); }
  function idlePerSecond() {
    let base = 0;
    for (const g of GENERATORS) base += idle.gens[g.id] * g.out;
    return base * idleGlobalMult();
  }
  function idleClickGain() { return (1 + idle.clickLevel) * idleGlobalMult() + 0.05 * idlePerSecond(); }
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
    const n = idle.buyAmount === 'max'
      ? idleMaxAffordable(g, owned, idle.energy)
      : parseInt(idle.buyAmount, 10);
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
    }
    renderIdleView();
  }

  function idleResetSave() {
    if (!window.confirm('Spielstand wirklich unwiderruflich löschen?')) return;
    idle.energy = 0; idle.total = 0; idle.clickLevel = 0; idle.effLevel = 0;
    idle.prestige = 0; idle.buyAmount = '1'; idle.started = false;
    idle.clicks = 0; idle.ach = []; achSet.clear();
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
    setText('idle-rate', idleFmt(perSec));
    setText('idle-total', idleFmt(idle.total) + ' ⚡');
    setText('idle-prestige-mult', '×' + idleGlobalMult().toFixed(2));
    setText('idle-clickgain', '+' + idleFmt(idleClickGain()));

    let prevOwned = 1;
    for (const g of GENERATORS) {
      const owned = idle.gens[g.id];
      const revealed = owned > 0 || idle.energy >= g.cost * 0.4 || prevOwned > 0;
      if (!idleFirstRender && revealed && !idleRevealed[g.id] && window.KraftFX) KraftFX.unlock();
      idleRevealed[g.id] = revealed;
      $('genrow-' + g.id).classList.toggle('idle-locked', !revealed);
      setText('genowned-' + g.id, '×' + owned);
      setText('genout-' + g.id,
        idleFmt(g.out * idleGlobalMult()) + ' ⚡/s' +
        (owned > 0 ? '  ·  ∑ ' + idleFmt(owned * g.out * idleGlobalMult()) + ' ⚡/s' : ''));

      const n = idle.buyAmount === 'max'
        ? Math.max(1, idleMaxAffordable(g, owned, idle.energy))
        : parseInt(idle.buyAmount, 10);
      const cost = idleGenCost(g, owned, n);
      const affordable = idle.energy >= cost - 1e-6 &&
        (idle.buyAmount !== 'max' || idleMaxAffordable(g, owned, idle.energy) >= 1);
      setText('genlbl-' + g.id, `Kaufen ×${n}`);
      setText('gencost-' + g.id, idleFmt(cost) + ' ⚡');
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
        clicks: idle.clicks, ach: idle.ach
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
    if (s.gens) GENERATORS.forEach(g => { idle.gens[g.id] = +s.gens[g.id] || 0; });
    // Erfolge wiederherstellen (nur bekannte IDs)
    idle.ach = [];
    achSet.clear();
    if (Array.isArray(s.ach)) {
      const known = new Set(ACHIEVEMENTS.map(a => a.id));
      s.ach.forEach(id => { if (known.has(id) && !achSet.has(id)) { achSet.add(id); idle.ach.push(id); } });
    }

    // Offline-Gutschrift
    const elapsed = Math.min(IDLE_OFFLINE_CAP, Math.max(0, (Date.now() - idle.lastSave) / 1000));
    const gain = idlePerSecond() * elapsed;
    if (gain > 0) {
      idle.energy += gain;
      idle.total += gain;
      const dauer = elapsed < 3600 ? Math.round(elapsed / 60) + ' min' : (elapsed / 3600).toFixed(1) + ' h';
      const note = $('idle-offline');
      if (note) {
        note.textContent = `Willkommen zurück: +${idleFmt(gain)} ⚡ in ${dauer} offline`;
        note.classList.remove('hidden');
        setTimeout(() => note.classList.add('hidden'), 8000);
      }
      idleToast('🔌', 'Willkommen zurück!', `+${idleFmt(gain)} ⚡ in ${dauer} offline erzeugt`);
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
    const dt = Math.min(1, (now - idleLast) / 1000);
    idleLast = now;
    const gain = idlePerSecond() * dt;
    if (gain > 0) { idle.energy += gain; idle.total += gain; }
    idleSaveAcc += dt;
    if (idleSaveAcc >= 10) { idleSaveAcc = 0; saveIdle(); }
    idleAchAcc += dt;
    if (idleAchAcc >= 1) { idleAchAcc = 0; checkAchievements(false); }
    renderIdleView();
    requestAnimationFrame(idleTick);
  }

  function init() {
    buildIdle();
    loadIdle();
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
  }

  document.addEventListener('DOMContentLoaded', init);
})();
