/*
 * fx.js — Grafik & Sound für Kraftwerk-Idle
 *
 * Alles hier ist eigens für dieses Projekt erstellt (originale SVG-Icons und
 * per Web-Audio-API synthetisierte Klänge — keine externen Asset-Dateien).
 * Damit lizenzrein und unter GPL-3.0 wie der Rest des Projekts.
 *
 * Stellt window.KraftFX bereit:
 *   KraftFX.icon(id)   -> SVG-Markup für ein Kraftwerk
 *   KraftFX.zap(g)     -> Klick-Sound (+ Blitz), g = Klick-Gewinn (nur für Tonhöhe)
 *   KraftFX.buy()      -> Kauf-Sound
 *   KraftFX.upgrade()  -> Upgrade-Sound
 *   KraftFX.prestige() -> Prestige-Sweep
 *   KraftFX.burst(x,y) -> Blitz-Partikel an Bildschirmposition
 *   KraftFX.toggleMute() / KraftFX.isMuted()
 *   KraftFX.toggleHum() / KraftFX.humOn()
 */
(() => {
  'use strict';

  // ─── Originale SVG-Icons (24×24, zweifarbig: weiche Füllung + Kontur, currentColor) ───
  const S = 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const A = 'fill="currentColor" opacity="0.2" stroke="none"';           // weiche Fläche
  const F = 'fill="currentColor" stroke="none"';                          // volle Fläche
  const wrap = (inner) =>
    `<svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

  const ICONS = {
    // Handkurbel: Dynamo mit Spule + Kurbel
    kurbel: wrap(
      `<rect x="3" y="9" width="9" height="9.5" rx="2" ${A}/><rect x="3" y="9" width="9" height="9.5" rx="2" ${S}/>` +
      `<path d="M5.5 12h4M5.5 15h4" ${S}/>` +
      `<path d="M12 13.5h3V9.4h3" ${S}/>` +
      `<circle cx="18" cy="7.5" r="1.7" ${A}/><circle cx="18" cy="7.5" r="1.7" ${S}/><path d="M18 5.8V4.5" ${S}/>`),
    // Solarpanel: Sonne + geneigtes Panelraster
    solar: wrap(
      `<circle cx="18" cy="5.4" r="2.3" ${A}/><circle cx="18" cy="5.4" r="2.3" ${S}/>` +
      `<path d="M18 1.8v1M18 8v1M14.5 5.4h1M20.5 5.4h1M15.5 2.9l.7.7M20.5 7.3l-.7-.7" ${S}/>` +
      `<path d="M4 19l2.7-8h8.6l2.7 8z" ${A}/><path d="M4 19l2.7-8h8.6l2.7 8z" ${S}/>` +
      `<path d="M5.6 15h12.8M10.8 11v8M14.2 11l-1 8" ${S}/>`),
    // Windrad: Turm + 3 Rotorblätter
    wind: wrap(
      `<path d="M11.3 10.5 11 20.5h2l-.3-10z" ${A}/><path d="M11.3 10.5 11 20.5h2l-.3-10z" ${S}/><path d="M9.6 20.5h4.8" ${S}/>` +
      `<g ${A}><path d="M12 9.6C11 7.2 11.2 4.8 12 3.1 12.8 4.8 13 7.2 12 9.6z"/><path d="M12 9.6C11 7.2 11.2 4.8 12 3.1 12.8 4.8 13 7.2 12 9.6z" transform="rotate(120 12 9.6)"/><path d="M12 9.6C11 7.2 11.2 4.8 12 3.1 12.8 4.8 13 7.2 12 9.6z" transform="rotate(240 12 9.6)"/></g>` +
      `<g ${S}><path d="M12 9.6C11 7.2 11.2 4.8 12 3.1 12.8 4.8 13 7.2 12 9.6z"/><path d="M12 9.6C11 7.2 11.2 4.8 12 3.1 12.8 4.8 13 7.2 12 9.6z" transform="rotate(120 12 9.6)"/><path d="M12 9.6C11 7.2 11.2 4.8 12 3.1 12.8 4.8 13 7.2 12 9.6z" transform="rotate(240 12 9.6)"/></g>` +
      `<circle cx="12" cy="9.6" r="1.3" ${F}/>`),
    // Wasserkraft: Staumauer + Wellen
    wasser: wrap(
      `<path d="M5 6h14v8H5z" ${A}/><path d="M5 6h14v8H5z" ${S}/><path d="M9 6v8M13 6v8" ${S}/>` +
      `<path d="M4 17c1.4-1.3 2.8-1.3 4 0s2.6 1.3 4 0 2.8-1.3 4 0 2.6 1.3 4 0" ${S}/>` +
      `<path d="M4 20c1.4-1.3 2.8-1.3 4 0s2.6 1.3 4 0 2.8-1.3 4 0 2.6 1.3 4 0" ${S}/>`),
    // BHKW: Motorblock + Flamme (Kraft-Wärme-Kopplung)
    bhkw: wrap(
      `<rect x="3" y="10" width="10.5" height="8.5" rx="2" ${A}/><rect x="3" y="10" width="10.5" height="8.5" rx="2" ${S}/>` +
      `<path d="M5.6 10V7.3M8.2 10V7.3M10.8 10V7.3" ${S}/><path d="M5.6 14.6h5.3" ${S}/>` +
      `<path d="M18.4 18c-1.8 0-3.1-1.4-3.1-3.1 0-1.6 1.3-2.5 1.6-3.9.8 1.3 1.2 1.7 2 2.6.8.8 1.2 1.7 1.2 2.8 0 1-.8 1.6-1.7 1.6z" ${F}/>`),
    // Kernkraft: Kühlturm + Dampf
    kern: wrap(
      `<path d="M8 6c-1 4.6-1.2 9.4-1.6 13h11.2c-.4-3.6-.6-8.4-1.6-13z" ${A}/>` +
      `<path d="M8 6c-1 4.6-1.2 9.4-1.6 13h11.2c-.4-3.6-.6-8.4-1.6-13z" ${S}/><path d="M8 6h8" ${S}/><path d="M7 15c2.4-1.1 7.6-1.1 10 0" ${S}/>` +
      `<path d="M9 4.2c.2-1.1 1.6-1.3 2.2-.5.5-1 2.3-.8 2.4.5.9-.1 1.4.8 1 1.6H8.6c-.4-.8 0-1.6.9-1.6z" ${A}/>`),
    // Fusion: Atom mit Orbits + leuchtendem Kern
    fusion: wrap(
      `<circle cx="12" cy="12" r="3.2" ${A}/>` +
      `<ellipse cx="12" cy="12" rx="8.6" ry="3.4" ${S}/><ellipse cx="12" cy="12" rx="8.6" ry="3.4" transform="rotate(60 12 12)" ${S}/><ellipse cx="12" cy="12" rx="8.6" ry="3.4" transform="rotate(120 12 12)" ${S}/>` +
      `<circle cx="12" cy="12" r="1.8" ${F}/><circle cx="20.4" cy="12" r="1" ${F}/><circle cx="7.8" cy="4.7" r="1" ${F}/>`)
  };

  function icon(id) { return ICONS[id] || ''; }

  // ─── Web-Audio-Synthese (keine Sounddateien) ───
  const SOUND_KEY = 'kraftwerk-idle-sound';
  const HUM_KEY = 'kraftwerk-idle-hum';
  const VOL_KEY = 'kraftwerk-idle-vol';
  let ac = null;
  let master = null;       // Gesamtlautstärke
  let sfxBus = null;       // Effekt-Bus (Klicks, Käufe …)
  let muted = false;
  let hum = null;          // { gain, oscs } wenn aktiv

  // Lautstärke-Regler (0..1); persistent
  const vol = { master: 0.5, sfx: 1.0, music: 0.9, hum: 0.06 };
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (raw) { const s = JSON.parse(raw); ['master', 'sfx', 'music', 'hum'].forEach(k => { if (typeof s[k] === 'number') vol[k] = Math.max(0, Math.min(1, s[k])); }); }
  } catch (e) { /* ignore */ }
  function persistVol() { try { localStorage.setItem(VOL_KEY, JSON.stringify(vol)); } catch (e) {} }

  try { muted = localStorage.getItem(SOUND_KEY) === 'off'; } catch (e) { /* ignore */ }

  function ensureCtx() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = vol.master;
    master.connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.gain.value = vol.sfx;
    sfxBus.connect(master);
    return ac;
  }

  // Live-Lautstärke setzen (name: master|sfx|music|hum)
  function setVolume(name, v) {
    v = Math.max(0, Math.min(1, +v || 0));
    if (!(name in vol)) return v;
    vol[name] = v;
    persistVol();
    if (ac) {
      const t = ac.currentTime;
      if (name === 'master' && master) master.gain.setTargetAtTime(v, t, 0.03);
      if (name === 'sfx' && sfxBus) sfxBus.gain.setTargetAtTime(v, t, 0.03);
      if (name === 'music' && musicBus) musicBus.gain.setTargetAtTime(v, t, 0.03);
      if (name === 'hum' && hum) hum.g.gain.setTargetAtTime(v, t, 0.03);
    }
    return v;
  }
  function getVolumes() { return Object.assign({}, vol); }

  // Kurzer Ton mit Hüllkurve
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function zap(gain) {
    // leichte Tonhöhen-Variation je nach Klick-Stärke, sonst konstant
    const base = 320 + Math.min(180, Math.log10(1 + (gain || 1)) * 60);
    tone(base, 0.09, 'square', 0.18, base * 0.6);
  }
  function buy() {
    tone(523.25, 0.08, 'triangle', 0.22);            // C5
    setTimeout(() => tone(783.99, 0.14, 'triangle', 0.22), 70); // G5
  }
  function upgrade() {
    tone(659.25, 0.08, 'triangle', 0.2);             // E5
    setTimeout(() => tone(987.77, 0.16, 'triangle', 0.2), 70);  // B5
  }
  function prestige() {
    if (muted) return;
    const ctx = ensureCtx(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(900, t0 + 0.5);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t0); osc.stop(t0 + 0.65);
  }
  // Freischalt-Jingle (neues Kraftwerk in Reichweite)
  function unlock() {
    if (muted) return;
    [659.25, 830.61, 987.77, 1318.51].forEach((f, i) => // E5 G#5 B5 E6
      setTimeout(() => tone(f, 0.16, 'triangle', 0.16), i * 55));
  }
  // Kurzer „geht nicht"-Blip (nicht genug Energie)
  function denied() {
    tone(160, 0.12, 'sawtooth', 0.14, 110);
  }

  // ─── Ambient-Strom-Brumm (zwei leicht verstimmte Oszillatoren + langsames LFO) ───
  function startHum() {
    const ctx = ensureCtx(); if (!ctx || hum) return;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.connect(master);
    g.gain.linearRampToValueAtTime(vol.hum, ctx.currentTime + 1.2);

    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;    // tiefes A
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55.4;  // Schwebung
    const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 110;
    const o3g = ctx.createGain(); o3g.gain.value = 0.35; o3.connect(o3g); o3g.connect(g);

    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.12;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.025;
    lfo.connect(lfoG); lfoG.connect(g.gain);

    o1.connect(g); o2.connect(g);
    o1.start(); o2.start(); o3.start(); lfo.start();
    hum = { g, oscs: [o1, o2, o3, lfo] };
  }
  function stopHum() {
    if (!hum || !ac) return;
    const t = ac.currentTime;
    hum.g.gain.cancelScheduledValues(t);
    hum.g.gain.setValueAtTime(hum.g.gain.value, t);
    hum.g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
    const h = hum; hum = null;
    setTimeout(() => h.oscs.forEach(o => { try { o.stop(); } catch (e) {} }), 700);
  }
  function humOn() { return !!hum; }
  function toggleHum() {
    if (hum) { stopHum(); try { localStorage.setItem(HUM_KEY, 'off'); } catch (e) {} }
    else { startHum(); try { localStorage.setItem(HUM_KEY, 'on'); } catch (e) {} }
    return humOn();
  }

  function isMuted() { return muted; }
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem(SOUND_KEY, muted ? 'off' : 'on'); } catch (e) {}
    if (muted) { stopHum(); stopMusic(); }
    return muted;
  }

  // ─── Blitz-Effekt beim Klicken ───
  function burst(x, y) {
    const el = document.createElement('div');
    el.className = 'kraft-burst';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML =
      '<svg viewBox="0 0 24 24" width="34" height="34" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    // Sicherheitsnetz, falls animationend nicht feuert
    setTimeout(() => el.remove(), 700);
  }

  // ─── Originale Hintergrundmusik (geloopter Sequencer, kein Audio-File) ───
  // Ruhiger Synthwave-Loop in a-Moll: Am – F – C – G, je 1 Takt.
  const MUSIC_KEY = 'kraftwerk-idle-music';
  let musicBus = null;
  let musicTimer = null;
  let nextStep = 0;
  let nextStepTime = 0;

  const BPM = 96;
  const STEP = (60 / BPM) / 4;        // 16tel
  const STEPS = 64;                    // 4 Takte × 16
  const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);  // MIDI → Hz
  // Akkorde je Takt (MIDI): Grundton-Bass + Akkordtöne für Arpeggio/Pad
  const PROG = [
    { bass: 45, chord: [57, 60, 64] }, // Am
    { bass: 41, chord: [53, 57, 60] }, // F
    { bass: 48, chord: [60, 64, 67] }, // C
    { bass: 43, chord: [55, 59, 62] }  // G
  ];

  let noiseBuf = null;
  function getNoise(ctx) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function mNote(t, freq, dur, type, vol) {
    const ctx = ac;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function mHat(t) {
    const ctx = ac;
    const s = ctx.createBufferSource(); s.buffer = getNoise(ctx);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(hp); hp.connect(g); g.connect(musicBus);
    s.start(t); s.stop(t + 0.06);
  }
  function mKick(t) {
    const ctx = ac;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.2);
  }

  function scheduleStep(step, t) {
    const bar = Math.floor(step / 16) % 4;
    const inBar = step % 16;           // 0..15
    const ch = PROG[bar];
    // Pad: weicher Akkord zu Taktbeginn
    if (inBar === 0) ch.chord.forEach(n => mNote(t, mf(n), STEP * 15, 'triangle', 0.05));
    // Bass: Grundton auf Zählzeit 1 und 3
    if (inBar === 0 || inBar === 8) mNote(t, mf(ch.bass), STEP * 3.5, 'sawtooth', 0.14);
    // Kick auf 1 und 3, Hats auf jedem Achtel-Offbeat
    if (inBar === 0 || inBar === 8) mKick(t);
    if (inBar % 4 === 2) mHat(t);
    // Lead-Arpeggio: Achtel, Akkordtöne aufwärts + Oktave
    if (inBar % 2 === 0) {
      const seq = [ch.chord[0], ch.chord[1], ch.chord[2], ch.chord[1] + 12];
      const n = seq[(inBar / 2) % 4];
      mNote(t, mf(n + 12), STEP * 1.6, 'square', 0.05);
    }
  }
  function musicLoop() {
    if (!musicBus) return;
    while (nextStepTime < ac.currentTime + 0.12) {
      scheduleStep(nextStep, nextStepTime);
      nextStepTime += STEP;
      nextStep = (nextStep + 1) % STEPS;
    }
  }
  function startMusic() {
    const ctx = ensureCtx(); if (!ctx || musicBus) return;
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.0;
    musicBus.connect(master);
    musicBus.gain.linearRampToValueAtTime(vol.music, ctx.currentTime + 1.5);
    nextStep = 0; nextStepTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(musicLoop, 25);
  }
  function stopMusic() {
    if (!musicBus) return;
    clearInterval(musicTimer); musicTimer = null;
    const t = ac.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0.0001, t + 0.5);
    const b = musicBus; musicBus = null;
    setTimeout(() => { try { b.disconnect(); } catch (e) {} }, 700);
  }
  function musicOn() { return !!musicBus; }
  function toggleMusic() {
    if (musicBus) { stopMusic(); try { localStorage.setItem(MUSIC_KEY, 'off'); } catch (e) {} }
    else { startMusic(); try { localStorage.setItem(MUSIC_KEY, 'on'); } catch (e) {} }
    return musicOn();
  }



  window.KraftFX = {
    icon, zap, buy, upgrade, prestige, unlock, denied, burst,
    isMuted, toggleMute,
    humOn, toggleHum,
    musicOn, toggleMusic,
    setVolume, getVolumes,
    _restoreHum() { try { return localStorage.getItem(HUM_KEY) === 'on'; } catch (e) { return false; } },
    _restoreMusic() { try { return localStorage.getItem(MUSIC_KEY) === 'on'; } catch (e) { return false; } }
  };
})();
