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

  // ─── Originale SVG-Icons (24×24, stroke = currentColor) ───
  const S = 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const F = 'fill="currentColor" stroke="none"';
  const wrap = (inner) =>
    `<svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

  const ICONS = {
    // Handkurbel: Dynamo-Kasten mit Kurbel + Griff
    kurbel: wrap(`<rect x="3.5" y="9" width="8.5" height="9" rx="1.6" ${S}/><path d="M6 13.5h3.5" ${S}/><path d="M12 13.5h2.6V9.6h3.4" ${S}/><circle cx="18" cy="7.8" r="1.5" ${S}/><path d="M18 6.3V4.9" ${S}/>`),
    // Solarpanel: geneigtes Panelraster + Sonne
    solar: wrap(`<path d="M4 19l3-8h9l3 8z" ${S}/><path d="M6 15h12M11 11v8M15 11l-1.5 8" ${S}/><circle cx="18" cy="5.5" r="2" ${S}/><path d="M18 2.4v.8M20.8 5.5h.8M18 8.6v-.8M15.2 5.5h.8" ${S}/>`),
    // Windrad: Turm + 3-Flügel-Stern (ein Flügel, 3× rotiert)
    wind: wrap(`<path d="M11.4 10.5L11 20h2l-.4-9.5z" ${F}/><path d="M9.8 20h4.4" ${S}/><g ${F}><path d="M12 9.5C11 7 11.2 4.6 12 2.8 12.8 4.6 13 7 12 9.5z"/><path d="M12 9.5C11 7 11.2 4.6 12 2.8 12.8 4.6 13 7 12 9.5z" transform="rotate(120 12 9.5)"/><path d="M12 9.5C11 7 11.2 4.6 12 2.8 12.8 4.6 13 7 12 9.5z" transform="rotate(240 12 9.5)"/></g><circle cx="12" cy="9.5" r="1.4" ${F}/>`),
    // Wasserkraft: Staumauer + Wellen
    wasser: wrap(`<path d="M5 5v9M9 5v9M13 5v9M17 5v9" ${S}/><path d="M4 14h16" ${S}/><path d="M4 18c1.6-1.4 3.2-1.4 4 0s2.4 1.4 4 0 3.2-1.4 4 0 2.4 1.4 4 0" ${S}/>`),
    // BHKW: Motorblock mit Kolben + Flamme (Wärme)
    bhkw: wrap(`<rect x="3.5" y="10" width="10" height="8" rx="1.6" ${S}/><path d="M6 10V7.4M8.5 10V7.4M11 10V7.4" ${S}/><path d="M6 14.5h5" ${S}/><path d="M18.4 17.5c-1.7 0-2.9-1.3-2.9-2.9 0-1.5 1.2-2.3 1.5-3.6.7 1.2 1.1 1.6 1.9 2.4.7.8 1.1 1.6 1.1 2.6 0 .9-.7 1.5-1.6 1.5z" ${F}/>`),
    // Kernkraft: Kühlturm + Dampf
    kern: wrap(`<path d="M8 6c-1 4.6-1.2 9.3-1.6 13h11.2c-.4-3.7-.6-8.4-1.6-13z" ${S}/><path d="M8 6h8" ${S}/><path d="M7 15.5c2.4-1.1 7.6-1.1 10 0" ${S}/><path d="M9 4.3c.2-1.1 1.6-1.3 2.2-.5.5-1 2.3-.8 2.4.5.9-.1 1.4.8 1 1.6H8.6c-.4-.8 0-1.6.9-1.6z" ${F}/>`),
    // Fusion: Atom mit Orbits
    fusion: wrap(`<circle cx="12" cy="12" r="1.6" ${F}/><ellipse cx="12" cy="12" rx="8.5" ry="3.4" ${S}/><ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(60 12 12)" ${S}/><ellipse cx="12" cy="12" rx="8.5" ry="3.4" transform="rotate(120 12 12)" ${S}/>`)
  };

  function icon(id) { return ICONS[id] || ''; }

  // ─── Web-Audio-Synthese (keine Sounddateien) ───
  const SOUND_KEY = 'kraftwerk-idle-sound';
  const HUM_KEY = 'kraftwerk-idle-hum';
  let ac = null;
  let master = null;
  let muted = false;
  let hum = null;          // { gain, oscs } wenn aktiv

  try { muted = localStorage.getItem(SOUND_KEY) === 'off'; } catch (e) { /* ignore */ }

  function ensureCtx() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    return ac;
  }

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
    osc.connect(g); g.connect(master);
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
    osc.connect(g); g.connect(master);
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
    g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.2);

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
    musicBus.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 1.5);
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
    _restoreHum() { try { return localStorage.getItem(HUM_KEY) === 'on'; } catch (e) { return false; } },
    _restoreMusic() { try { return localStorage.getItem(MUSIC_KEY) === 'on'; } catch (e) { return false; } }
  };
})();
