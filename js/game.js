/* TT Surf: the game. Home screen, the count-in, surfing (1 or 2 players on the same wave), the brother's lift onto a
   better wave, the end of the wave, the winner's celebration and the results. The rules live in js/surf.js, the 3D
   in js/world.js and js/surfer.js. For tests, window.game:
     game.start({ beach, mode, who, levels }) / game.step(seconds) / game.hold(on) / game.info() / game.check()
     game.buddy() / game.trick(pl) / game.pause(bool) / game.home() / game.autopilot('good' | 'kid' | null) */
(function () {
  'use strict';
  const T = THREE;
  const SURF = window.SURF, R = SURF.rules, W = SURF.world, K = SURF.surfer, B = SURF.beaches;
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const STORE = 'surfTT.v1';
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const HUMANS = ['teddy', 'tommy'];
  const SPIN_WORDS = ['', 'SPIN!', 'DOUBLE SPIN!', 'TRIPLE SPIN!'];

  let save = { beach: 'sunny', mode: 'contest', who: 'teddy', level: { teddy: 'easy', tommy: 'easy' }, best: {}, wins: { teddy: 0, tommy: 0 } };
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s) save = Object.assign(save, s, { level: Object.assign(save.level, s.level), best: s.best || {}, wins: Object.assign(save.wins, s.wins) });
  } catch (e) { /* storage blocked */ }
  if (!B.list.some((b) => b.id === save.beach)) save.beach = 'sunny';
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

  let state = 'loading', paused = false, held = false;
  let beach = B.get(save.beach);
  let ride = null, players = [], models = [], portraits = {};
  let cam = null, views = [];
  let finishWait = 0, celebrate = null, results = null;
  let seq = null, buddy = null, treat = null, ball = null;
  let fiveT = 0, fiveCool = 0, lastCount = null;
  let lastNow = 0;
  const camS = { x: 0, D: 22, y: 2, snap: true };
  const keys = new Set();
  const padHeld = [{}, {}];

  // ---------------------------------------------------------------- start up
  function init() {
    W.init($('game'));
    portraits = Kit.portraits(HUMANS.map((id) => Kit.roster.get(id)), { size: 128 });
    cam = new T.PerspectiveCamera(48, 1, 0.1, 2500);
    const words = window.SURF_TITLE.split(' ');
    $('logo').querySelector('small').textContent = words.slice(0, -1).join(' ');
    $('logo').querySelector('big').textContent = words[words.length - 1];
    homeUI();
    hudUI();
    W.setBeach(beach);
    goHome();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    window.addEventListener('blur', () => keys.clear());
    window.addEventListener('resize', layout);
    window.addEventListener('pointerdown', () => Kit.sound.init(), { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.autoPause && isRiding()) setPause(true);
    });
    Kit.sound.onMute(muteIcon);
    muteIcon(Kit.sound.isMuted());
    setTimeout(() => $('loading').classList.add('hidden'), 150);
    requestAnimationFrame((t) => { lastNow = t; requestAnimationFrame(loop); });
  }
  function isRiding() { return state === 'count' || state === 'ride' || state === 'finish'; }
  function muteIcon(m) { $('muteBtn').textContent = m ? '🔇' : '🔊'; }

  // ---------------------------------------------------------------- home
  function homeUI() {
    const box = $('beaches');
    for (const b of B.list) {
      const el = document.createElement('button');
      el.className = 'card';
      el.dataset.id = b.id;
      el.style.setProperty('--tile', b.tile);
      el.setAttribute('aria-label', b.name);
      el.innerHTML = `<span class="emo">${b.emoji}</span><span class="nm">${b.name}</span><span class="best"></span>`;
      el.addEventListener('click', () => pickBeach(b.id));
      box.appendChild(el);
    }
    $('modes').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => pickMode(b.dataset.mode)));
    $('who').querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => pickWho(b.dataset.who));
      const imgs = b.querySelectorAll('img');
      if (b.dataset.who === 'both') { imgs[0].src = portraits.teddy; imgs[1].src = portraits.tommy; } else imgs[0].src = portraits[b.dataset.who];
    });
    $('playBtn').addEventListener('click', () => startRide());
  }
  function pickBeach(id) {
    save.beach = id;
    persist();
    setBeach(id);
    refreshHome();
    Kit.sound.click();
  }
  function setBeach(id) {
    if (beach.id !== id) { beach = B.get(id); W.setBeach(beach); }
    if (state === 'home') newDemo();
  }
  function pickMode(m) {
    save.mode = m;
    persist();
    refreshHome();
    if (state === 'home') newDemo();
    Kit.sound.click();
  }
  function pickWho(w) {
    save.who = w;
    persist();
    refreshHome();
    if (state === 'home') newDemo();
    Kit.sound.click();
  }
  function setLevel(id, lv) {
    save.level[id] = lv;
    persist();
    refreshHome();
    Kit.sound.click();
  }
  function whoList() { return save.who === 'both' ? HUMANS.slice() : [save.who]; }
  function bestKey(bid, id) { return `${bid}/${save.level[id]}/${id}`; }
  function refreshHome() {
    $('beaches').querySelectorAll('.card').forEach((b) => {
      b.classList.toggle('on', b.dataset.id === save.beach);
      const bests = whoList().map((id) => save.best[bestKey(b.dataset.id, id)]).filter((t) => t);
      b.querySelector('.best').textContent = bests.length ? '⭐ ' + bests.join(' · ') : '';
    });
    $('modes').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === save.mode));
    $('who').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.who === save.who);
      const cups = b.querySelector('.cups');
      if (cups) cups.textContent = save.wins[b.dataset.who] ? `🏆${save.wins[b.dataset.who]}` : '';
    });
    const lv = $('lvls');
    lv.innerHTML = '';
    for (const id of whoList()) {
      const g = document.createElement('div');
      g.className = 'lvl';
      g.innerHTML = `<img alt="" src="${portraits[id]}"><button data-l="easy" aria-label="EASY"><span>🐣</span>EASY</button><button data-l="normal" aria-label="NORMAL"><span>🔥</span>NORMAL</button>`;
      g.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('on', save.level[id] === b.dataset.l);
        b.addEventListener('click', () => setLevel(id, b.dataset.l));
      });
      lv.appendChild(g);
    }
  }
  function goHome() {
    state = 'home';
    paused = false;
    celebrate = null;
    clearBuddy();
    for (const id of ['hud', 'pads', 'pause', 'results', 'buddyBtn', 'fiveBtn']) $(id).classList.add('hidden');
    $('home').classList.remove('hidden');
    $('glow').classList.remove('on');
    refreshHome();
    newDemo();
    Kit.sound.music('title');
  }

  // the title screen's surfer: the chosen boy riding the chosen wave by himself, again and again
  function newDemo() {
    makeRide({ beach, players: whoList().map((id) => ({ who: id, level: 'normal', pilot: 'good' })), cpu: save.mode === 'contest', seed: 1 + Math.floor(Math.random() * 99) }, true);
    ride.step(R.PHYS.countIn + 2.5);
    ride.events.length = 0;
    camS.snap = true;
  }

  // ---------------------------------------------------------------- a ride
  function makeRide(o, demo) {
    for (const m of models) K.remove(m, W.scene());
    ride = R.create(o);
    W.setRide(ride);
    players = ride.surfers.filter((sk) => sk.human).map((sk) => sk.id);
    models = ride.surfers.map((sk) => {
      const m = K.make(sk.id, { tag: ride.surfers.length > 1 && !demo });
      K.add(m, W.scene());
      return m;
    });
    lastCount = null;
  }

  function startRide(o) {
    o = o || {};
    if (o.beach) save.beach = o.beach;
    if (o.mode) save.mode = o.mode;
    if (o.who) save.who = o.who;
    if (o.levels) Object.assign(save.level, o.levels);
    persist();
    setBeach(save.beach);
    clearBuddy();
    const who = whoList();
    makeRide({ beach, players: who.map((id) => ({ who: id, level: save.level[id] })), cpu: save.mode === 'contest', seed: 1 + Math.floor(Math.random() * 9999) });
    state = 'count';
    paused = false;
    celebrate = null;
    results = null;
    finishWait = 0;
    fiveT = fiveCool = 0;
    $('home').classList.add('hidden');
    $('results').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('pads').classList.remove('hidden');
    $('buddyBtn').classList.toggle('hidden', players.length > 1);
    $('fiveBtn').classList.toggle('hidden', players.length < 2);
    if (players.length === 1) $('buddyFace').src = portraits[Kit.roster.buddyFor(players[0])];
    buildBoard();
    buildPads();
    layout();
    camS.snap = true;
    Kit.sound.music('play');
  }
  function nextBeach() {
    const list = B.list, i = list.findIndex((b) => b.id === save.beach);
    save.beach = list[(i + 1) % list.length].id;
    startRide();
  }
  function setPause(p) {
    if (!isRiding()) return;
    paused = !!p;
    $('pause').classList.toggle('hidden', !paused);
    Kit.sound.music(paused ? 'pause' : 'play');
    keys.clear();
  }

  // ---------------------------------------------------------------- input
  function heldKey(codes) { return codes.some((c) => keys.has(c)); }
  const KEYS = {
    one: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], trick: ['Space', 'KeyD', 'ArrowRight', 'Enter', 'NumpadEnter'] },
    two: [
      { up: ['KeyW'], down: ['KeyS'], trick: ['KeyD', 'Space'] },
      { up: ['ArrowUp'], down: ['ArrowDown'], trick: ['ArrowRight', 'Enter', 'NumpadEnter'] },
    ],
  };
  function keySet(pl) { return players.length > 1 ? KEYS.two[pl] : KEYS.one; }
  function controls(pl) {
    const ks = keySet(pl), ph = padHeld[pl];
    const steer = (heldKey(ks.up) || ph.up ? 1 : 0) - (heldKey(ks.down) || ph.down ? 1 : 0);
    return { steer, trick: heldKey(ks.trick) || !!ph.trick };
  }
  function trickKey(code) {
    for (let pl = 0; pl < players.length; pl++) if (keySet(pl).trick.includes(code)) return pl;
    return -1;
  }
  function doTrick(pl) {
    if (!ride || paused || state !== 'ride') return;
    ride.jump(pl);
  }

  function onKey(e) {
    const k = e.code;
    if (k === 'KeyM') { Kit.sound.init(); Kit.sound.toggleMute(); e.preventDefault(); return; }
    if (state !== 'loading') Kit.sound.init();
    if (state === 'home') {
      const list = B.list, i = list.findIndex((b) => b.id === save.beach);
      if (k === 'ArrowLeft' || k === 'KeyA' || k === 'ArrowRight' || k === 'KeyD') {
        pickBeach(list[(i + (k === 'ArrowLeft' || k === 'KeyA' ? list.length - 1 : 1)) % list.length].id);
      } else if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'KeyW' || k === 'KeyS') {
        const id = save.who === 'both' ? (k === 'KeyW' || k === 'KeyS' ? 'teddy' : 'tommy') : save.who;
        setLevel(id, k === 'ArrowUp' || k === 'KeyW' ? 'easy' : 'normal');
      } else if (k === 'Digit1') pickWho('teddy');
      else if (k === 'Digit2') pickWho('tommy');
      else if (k === 'Digit3') pickWho('both');
      else if (k === 'KeyR') pickMode(save.mode === 'contest' ? 'free' : 'contest');
      else if (k === 'Enter' || k === 'Space') startRide();
      else return;
      e.preventDefault();
      return;
    }
    if (state === 'results') {
      if (k === 'Enter' || k === 'Space') startRide();
      else if (k === 'KeyN') nextBeach();
      else if (k === 'Escape' || k === 'KeyH') goHome();
      else return;
      e.preventDefault();
      return;
    }
    if (!isRiding()) return;
    if (k === 'KeyP' || k === 'Escape') { setPause(!paused); e.preventDefault(); return; }
    if (paused) {
      if (k === 'Enter' || k === 'Space') setPause(false);
      e.preventDefault();
      return;
    }
    if (k === 'KeyT') { callBuddy(); e.preventDefault(); return; }
    if (['KeyW', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'Space', 'Enter', 'NumpadEnter'].includes(k)) {
      e.preventDefault();
      keys.add(k);
      const pl = trickKey(k);
      if (pl >= 0 && !e.repeat) doTrick(pl);
    }
  }

  // ---------------------------------------------------------------- the brother lifts you onto a better wave (1 player), high fives (2 players)
  function callBuddy() {
    if (!ride || paused || state !== 'ride') return;
    if (players.length > 1) return highFive();
    const sk = ride.surfers[0];
    const id = Kit.roster.buddyFor(players[0]);
    const entry = Kit.roster.get(id);
    if (!buddy || buddy.id !== id) {
      if (buddy) K.remove(buddy, W.scene());
      buddy = K.make(id, { scale: entry.buddyScale });
      buddy.out = true;
    }
    if (buddy.out) {
      K.add(buddy, W.scene());
      buddy.out = false;
      buddy.pop = 0;
      buddy.x = sk.rx - 3;
      buddy.u = Math.min(0.85, Math.max(0.15, sk.ru));
      W.splash(new T.Vector3(buddy.x, beach.H * B.f(buddy.u), -buddy.u * B.F), 14);
    }
    buddy.leaving = false; // called again while he was waving goodbye: he stays
    buddy.leave = 0;
    const [emoji, name] = TREATS[Math.floor(Math.random() * TREATS.length)];
    seq = { t: 0, entry, emoji, name, tossed: false, helped: false, ball: false };
    $('buddyBtn').classList.add('here');
    Kit.sound.tone({ f: 520, to: 980, type: 'triangle', dur: 0.18, vol: 0.25 });
  }
  function clearBuddy() {
    if (buddy && !buddy.out) { K.remove(buddy, W.scene()); buddy.out = true; }
    seq = null;
    if (treat) { W.scene().remove(treat.sp); treat = null; }
    if (ball) { W.scene().remove(ball.sp); ball = null; }
    $('buddyBtn').classList.remove('here');
    $('glow').classList.remove('on');
  }
  function highFive() {
    if (fiveCool > 0) return;
    fiveCool = 1.2;
    fiveT = 1.1;
    toast('✋ HIGH FIVE!', 'good', 0);
    toast('✋ HIGH FIVE!', 'good', 1);
    Kit.sound.tone({ f: 660, to: 1320, type: 'square', dur: 0.12, vol: 0.2 });
    Kit.sound.coin(3);
    ride.five();
    const a = models[0].outer.position, b = models[1].outer.position;
    W.burst(a.clone().lerp(b, 0.5).add(new T.Vector3(0, 2, 0)), '#ffd400', 18, 3, 4);
  }

  const tv = new T.Vector3();
  function updateBuddy(dt) {
    if (!buddy || buddy.out || !ride) return;
    const sk = ride.surfers[0];
    buddy.pop = Math.min(1, (buddy.pop || 0) + dt * 4);
    const sc = buddy.scale * (buddy.leaving ? Math.max(0.01, 1 - buddy.leave * 3) : 1 - Math.pow(1 - buddy.pop, 3));
    buddy.outer.scale.setScalar(Math.max(0.01, sc));
    // he rides along just behind you on the face
    buddy.x += (sk.rx - 2.8 - buddy.x) * Math.min(1, dt * 5);
    const uT = Math.min(0.85, Math.max(0.12, sk.air ? 0.7 : sk.ru));
    buddy.u += (uT - buddy.u) * Math.min(1, dt * 3);
    const p = K.stand(buddy, buddy.x, buddy.u, dt);
    if (!seq) {
      // waving goodbye, then gone in a splash
      buddy.leave = (buddy.leave || 0) + dt;
      K.act(buddy, 'wave', dt);
      if (buddy.leave > 0.35) { W.splash(p.clone(), 16); K.remove(buddy, W.scene()); buddy.out = true; buddy.leaving = false; buddy.leave = 0; }
      return;
    }
    seq.t += dt;
    const t = seq.t, me = seq.entry.id;
    if (t < 1.9) {
      // his own move, facing you: Teddy boxes then shoots a 🏀, Tommy does his Y
      const mode = me === 'teddy' ? (t < 1.2 ? 'boxing' : 'jumpshot') : 'peace';
      K.act(buddy, mode, dt);
      if (me === 'teddy' && t > 1.2) buddy.outer.position.y += Math.sin(Math.min(1, (t - 1.2) / 0.6) * Math.PI) * 0.5;
      if (me === 'teddy' && !seq.ball && t > 1.45) { seq.ball = true; shootBall(p.clone().add(tv.set(0, 2.1, 0))); }
    } else if (t < 2.6) K.act(buddy, 'jump', dt); // both arms up: up you go!
    else K.act(buddy, 'surf', dt);
    if (!seq.tossed && t > 0.9) {
      seq.tossed = true;
      const s = seq;
      throwTreat(s.emoji, p.clone().add(tv.set(0, 1.6, 0)), () => {
        toast(`${s.emoji} ${s.name} FROM ${s.entry.name}!`, 'treat', 0);
        Kit.sound.coin(2);
      });
    }
    if (!seq.helped && t > 1.9) {
      seq.helped = true;
      toast(`${seq.entry.name} SAYS: BIGGER WAVE!`, 'buddy', 0);
      ride.lift(0);
      Kit.sound.powerup();
      W.sparkle(models[0].outer.position, 24, 3);
    }
    if (seq.helped && t > 1.9 + R.PHYS.boostTime) {
      seq = null;
      buddy.leaving = true;
      buddy.leave = 0;
      $('buddyBtn').classList.remove('here');
    }
  }
  function sprite(emoji, size) {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture(emoji), transparent: true, depthWrite: false }));
    sp.scale.setScalar(size);
    W.scene().add(sp);
    return sp;
  }
  function throwTreat(emoji, from, done) {
    if (treat) W.scene().remove(treat.sp);
    treat = { sp: sprite(emoji, 0.9), from: from.clone(), t: 0, done };
  }
  function shootBall(from) {
    if (ball) W.scene().remove(ball.sp);
    ball = { sp: sprite('🏀', 0.7), from: from.clone(), t: 0 };
  }
  function updateProps(dt) {
    if (treat) {
      treat.t += dt / 0.7;
      const to = models[0].outer.position.clone().add(tv.set(0, 1.4, 0));
      const e = Math.min(1, treat.t);
      treat.sp.position.lerpVectors(treat.from, to, e);
      treat.sp.position.y += Math.sin(e * Math.PI) * 1.8;
      if (treat.t >= 1) {
        W.burst(to, '#ffd400', 10, 2, 3);
        treat.done();
        W.scene().remove(treat.sp);
        treat = null;
      }
    }
    if (ball) {
      ball.t += dt;
      ball.sp.position.copy(ball.from);
      ball.sp.position.y += ball.t * 6 - ball.t * ball.t * 5;
      ball.sp.position.x += ball.t * 2;
      if (ball.t > 1.6) { W.scene().remove(ball.sp); ball = null; }
    }
  }

  // ---------------------------------------------------------------- the loop
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (held) return;
    frame(dt);
  }

  function frame(dt, noDraw) {
    if (state === 'loading') return;
    const d = paused ? 0 : dt;
    if (!paused) {
      if (state === 'home') tickDemo(dt);
      else if (isRiding()) tickRide(dt);
      else if (state === 'results') tickResults(dt);
      fiveT = Math.max(0, fiveT - dt);
      fiveCool = Math.max(0, fiveCool - dt);
    }
    W.update(d, camS.x);
    if (noDraw) return;
    W.render(views);
    drawFx(d);
  }

  function placeAll(dt) {
    for (let i = 0; i < models.length; i++) {
      const sk = ride.surfers[i], m = models[i];
      if (ride.time < 0) { K.stand(m, sk.rx, sk.ru, null); K.act(m, 'surf', dt); continue; }
      K.place(m, sk, dt);
      if (fiveT > 0 && sk.human && !sk.air) Kit.people.pose(m.p, m.ph, 'give', 1 - Math.exp(-16 * dt));
    }
  }

  function tickDemo(dt) {
    ride.step(dt);
    ride.events.length = 0;
    placeAll(dt);
    if (ride.over) { newDemo(); placeAll(0.016); }
    aimCam(dt, homeRegion(), 14, false);
  }

  function tickRide(dt) {
    for (let i = 0; i < players.length; i++) ride.input(i, controls(i));
    ride.step(dt);
    countIn();
    processEvents();
    placeAll(dt);
    updateBuddy(dt);
    updateProps(dt);
    $('glow').classList.toggle('on', players.length === 1 && ride.surfers[0].boostT > 0);
    aimCam(dt, rideRegion(), null, true);
    updateHUD();
    if (state === 'ride' && ride.over) {
      state = 'finish';
      finishWait = 0;
      clearBuddy();
      toast('🏁 WAVE OVER!', 'good', 0);
      if (players.length > 1) toast('🏁 WAVE OVER!', 'good', 1);
      [784, 988, 1175].forEach((f, k) => Kit.sound.tone({ f, type: 'triangle', dur: 0.2, vol: 0.22, at: k * 0.12 }));
    }
    if (state === 'finish') {
      finishWait += dt;
      if (finishWait > 2.3 && ride.done) showResults();
    }
  }

  function countIn() {
    if (state !== 'count') return;
    const n = Math.ceil(-ride.time - 1e-9);
    if (ride.time >= 0) {
      state = 'ride';
      bigCount('GO!', true);
      Kit.sound.tone({ f: 880, to: 1320, type: 'square', dur: 0.35, vol: 0.25 });
      Kit.sound.hiss({ f: 1200, to: 400, filter: 'lowpass', dur: 1.2, vol: 0.12 });
      return;
    }
    if (n !== lastCount && n <= 3 && n >= 1) {
      lastCount = n;
      bigCount(String(n), false);
      Kit.sound.tone({ f: 520, type: 'square', dur: 0.15, vol: 0.2 });
    }
  }
  function bigCount(text, go) {
    const el = $('bigCount');
    el.textContent = text;
    el.className = go ? 'go' : '';
    void el.offsetWidth;
    el.classList.add('anim');
  }

  function spinWord(n) { return n < 4 ? SPIN_WORDS[n] : `SUPER SPIN ×${n}!`; }
  function processEvents() {
    const evs = ride.events.splice(0);
    for (const ev of evs) {
      if (ev.type === 'end') continue;
      const sk = ride.surfers[ev.i], m = models[ev.i];
      const pos = m.outer.position;
      const pl = ev.i;
      if (ev.type === 'dolphin') W.dolphinHi(ev.j);
      if (ev.type === 'wipeout') W.splash(pos.clone(), 26);
      if (ev.type === 'launch' && Math.abs(pos.x - camS.x) < 40) W.splash(pos.clone(), 10);
      if (!sk.human) continue;
      const gold = sk.boostT > 0 ? ' ✨' : '';
      switch (ev.type) {
        case 'launch': Kit.sound.jump(); break;
        case 'hop': Kit.sound.tone({ f: 300, to: 560, type: 'sine', dur: 0.12, vol: 0.15 }); break;
        case 'trick': Kit.sound.swish(); break;
        case 'spin': Kit.sound.tone({ f: 600 + ev.n * 120, type: 'triangle', dur: 0.1, vol: 0.15 }); break;
        case 'land':
          if (ev.n) {
            toast(`${spinWord(ev.n)} +${ev.pts}${gold}`, 'good', pl);
            Kit.sound.powerup();
            W.burst(pos.clone().add(tv.set(0, 1.5, 0)), '#ffd400', 16 + ev.n * 6, 3, 4);
          } else if (ev.pts) {
            toast(`AIR! +${ev.pts}${gold}`, 'small', pl);
            Kit.sound.land();
          } else Kit.sound.land();
          W.splash(pos.clone(), 10);
          break;
        case 'hopLand': Kit.sound.land(); break;
        case 'wipeout':
          toast('WIPEOUT! SPLASH!', 'oops', pl);
          Kit.sound.stumble();
          Kit.sound.hiss({ f: 2000, to: 300, filter: 'lowpass', dur: 0.6, vol: 0.15 });
          break;
        case 'carve':
          toast(`CARVE! +${ev.pts}${gold}`, 'small', pl);
          Kit.sound.swipe();
          break;
        case 'dolphin':
          toast(`🐬 HI DOLPHIN! +${ev.pts}${gold}`, 'dolphin', pl);
          [1400, 1800, 1500].forEach((f, k) => Kit.sound.tone({ f, to: f * 1.3, type: 'sine', dur: 0.08, vol: 0.14, at: k * 0.09 }));
          break;
        case 'weed':
          toast('SEAWEED! WOBBLE!', 'oops', pl);
          Kit.sound.bump();
          W.weedHit(ev.j);
          break;
        case 'foam':
          toast('THE FOAM GOT YOU!', 'small', pl);
          Kit.sound.hiss({ f: 900, to: 300, filter: 'lowpass', dur: 0.5, vol: 0.1 });
          break;
        case 'lift':
          W.sparkle(pos, 20, 3);
          break;
      }
    }
  }

  // ---------------------------------------------------------------- the camera: on the beach, looking out at the face
  // region: the part of the screen the picture should fill (menus and results cover the rest)
  function homeRegion() { return window.innerWidth / window.innerHeight > 1.1 ? [0, 0, 0.4, 1] : [0, 0.03, 1, 0.33]; }
  function rideRegion() { return [0, 0.09, 1, 0.76]; }
  const look = new T.Vector3(), dir = new T.Vector3(-0.2, 0.2, 1).normalize();
  function aimCam(dt, region, wantW, riding) {
    const w = window.innerWidth, h = window.innerHeight;
    const rw = Math.max(1, region[2] * w), rh = Math.max(1, region[3] * h);
    const H = beach.H;
    let xs = ride.surfers.filter((sk) => sk.human).map((sk) => sk.rx);
    if (!xs.length) xs = [ride.surfers[0].rx];
    const lo = Math.min(...xs), hi = Math.max(...xs);
    const tall = rw / rh < 1;
    const needW = Math.max(wantW || (tall ? 13 : 24), hi - lo + (tall ? 8 : 14));
    const needH = H + 5.5;
    const tanH = Math.tan((cam.fov * Math.PI) / 360);
    const D = Math.min(80, Math.max(needH / (2 * tanH), needW / (2 * tanH * (rw / rh))));
    const tx = (lo + hi) / 2 + (riding ? 1.5 : 0.5);
    const k = camS.snap ? 1 : 1 - Math.exp(-3 * dt);
    camS.x += (tx - camS.x) * k;
    camS.D += (D - camS.D) * (camS.snap ? 1 : 1 - Math.exp(-1.5 * dt));
    camS.snap = false;
    look.set(camS.x, (H + 3.2) / 2, -B.F * 0.45);
    cam.position.copy(look).addScaledVector(dir, camS.D);
    cam.lookAt(look);
    cam.setViewOffset(rw, rh, -region[0] * w, -region[1] * h, w, h);
    views = [{ cam, x: 0, y: 0, w: 1, h: 1 }];
  }

  // ---------------------------------------------------------------- the end of the wave, the celebration, results
  function placeWord(n) { return `${n}${['ST', 'ND', 'RD'][n - 1] || 'TH'}`; }
  function showResults() {
    const order = ride.results();
    const win = order[0];
    const humans = order.filter((r) => r.human);
    const news = {};
    for (const r of humans) {
      const key = bestKey(beach.id, r.id);
      if (!save.best[key] || r.score > save.best[key]) { news[r.id] = true; save.best[key] = r.score; }
    }
    const contest = order.length > 1;
    if (contest && win.human) save.wins[win.id] = (save.wins[win.id] || 0) + 1;
    persist();
    results = { order, news };
    let head;
    if (!contest) head = `🎉 GREAT RIDE, ${win.name}!`;
    else if (win.human) head = `🏆 ${win.name} WINS!`;
    else head = `${R.CPUS[win.id].emoji} ${win.name} WINS! ${placeWord(humans[0].place)} PLACE, GOOD TRY!`;
    $('rHead').textContent = head;
    const rows = $('rRows');
    rows.innerHTML = '';
    for (const r of order) {
      const row = document.createElement('div');
      row.className = 'rrow' + (r.human ? ' me' : '');
      const face = r.human ? `<img alt="" src="${portraits[r.id]}">` : R.CPUS[r.id].emoji;
      const medal = ['🥇', '🥈', '🥉'][r.place - 1] || `${r.place}`;
      row.innerHTML = `<span class="medal"></span><span class="face">${face}</span><span class="nm"></span><span class="stats"></span><span class="tm"></span>`;
      row.querySelector('.medal').textContent = contest ? medal : '⭐';
      row.querySelector('.nm').textContent = r.name;
      row.querySelector('.stats').textContent = `🌀${r.landed} 🐬${r.dolphins}`;
      row.querySelector('.tm').textContent = `⭐ ${r.score}`;
      if (r.human && news[r.id]) {
        const b = document.createElement('span');
        b.className = 'rnew';
        b.textContent = 'NEW BEST!';
        row.insertBefore(b, row.querySelector('.tm'));
      }
      rows.appendChild(row);
    }
    $('rBest').innerHTML = '';
    for (const r of humans) {
      const s = document.createElement('span');
      s.textContent = `${r.name}: BEST ${save.best[bestKey(beach.id, r.id)]} · 🏆 ${save.wins[r.id] || 0}`;
      $('rBest').appendChild(s);
    }
    for (const id of ['hud', 'pads', 'buddyBtn', 'fiveBtn']) $(id).classList.add('hidden');
    $('glow').classList.remove('on');
    $('results').classList.remove('hidden');
    state = 'results';
    // the winner's celebration: his own move on his board in the flat water, facing the camera
    const wsk = ride.surfers[win.i];
    celebrate = { i: win.i, t: 0, id: win.id, x: wsk.rx, human: win.human, ball: false };
    models.forEach((m, i) => { m.outer.visible = i === win.i || ride.surfers[i].human; if (m.tag) m.tag.visible = false; });
    camS.snap = true;
    confetti(win.human ? 170 : 70);
    Kit.sound.music('over');
    [523, 659, 784, 1047].forEach((f, k) => Kit.sound.tone({ f, type: 'triangle', dur: 0.22, vol: 0.22, at: k * 0.13 }));
  }
  function tickResults(dt) {
    if (!celebrate) return;
    const c = celebrate;
    c.t += dt;
    ride.step(dt); // the wave rolls on behind him
    ride.events.length = 0;
    const m = models[c.i];
    const p = K.stand(m, c.x, 0.06, dt);
    let mode = 'wave';
    if (c.id === 'teddy') {
      const cyc = c.t % 3.4;
      mode = cyc < 1.8 ? 'boxing' : 'jumpshot';
      if (mode === 'jumpshot') {
        m.outer.position.y += Math.sin(Math.min(1, (cyc - 1.8) / 0.7) * Math.PI) * 0.6;
        if (!c.ball && cyc > 2.1) { c.ball = true; shootBall(p.clone().add(tv.set(0, 2.4, 0))); }
      } else c.ball = false;
    } else if (c.id === 'tommy') mode = 'peace';
    K.act(m, mode, dt);
    // the other brother cheers next to him
    models.forEach((o, i) => {
      if (i === c.i || !ride.surfers[i].human) return;
      K.stand(o, c.x - 2.6, 0.1, dt);
      K.act(o, 'wave', dt);
    });
    updateProps(dt);
    // a close look at him
    const w = window.innerWidth, h = window.innerHeight;
    const region = w / h > 1.1 ? [0, 0, 0.42, 1] : [0, 0.03, 1, 0.33];
    const rw = region[2] * w, rh = region[3] * h;
    const tanH = Math.tan((cam.fov * Math.PI) / 360);
    const D = Math.max(4.2 / (2 * tanH), 5.5 / (2 * tanH * (rw / rh)));
    const k = camS.snap ? 1 : 1 - Math.exp(-2.5 * dt);
    camS.snap = false;
    camS.x += (c.x - 0.8 - camS.x) * k;
    camS.D += (D - camS.D) * k;
    look.set(camS.x, 1.3, -0.4);
    cam.position.copy(look).add(tv.set(-0.25, 0.12, 1).normalize().multiplyScalar(camS.D));
    cam.lookAt(look);
    cam.setViewOffset(rw, rh, -region[0] * w, -region[1] * h, w, h);
    views = [{ cam, x: 0, y: 0, w: 1, h: 1 }];
  }

  // ---------------------------------------------------------------- the HUD: time left, everyone's score
  let rows = [];
  function buildBoard() {
    const box = $('board');
    box.innerHTML = '';
    rows = ride.surfers.map((sk) => {
      const d = document.createElement('div');
      d.className = 'srow' + (sk.human ? ' me' : ' cpu');
      d.innerHTML = `<span class="face">${sk.human ? `<img alt="" src="${portraits[sk.id]}">` : sk.emoji}</span><span class="pts">0</span><span class="chip dol"></span><span class="chip gold"></span>`;
      box.appendChild(d);
      return { d, pts: d.querySelector('.pts'), dol: d.querySelector('.dol'), gold: d.querySelector('.gold'), last: '' };
    });
  }
  function updateHUD() {
    ride.surfers.forEach((sk, i) => {
      const r = rows[i];
      const key = `${sk.score}|${sk.dolphins}|${sk.boostT > 0}`;
      if (key === r.last) return;
      r.last = key;
      r.pts.textContent = sk.score;
      r.dol.textContent = sk.dolphins ? `🐬${sk.dolphins}` : '';
      r.gold.textContent = sk.boostT > 0 ? '✨×2' : '';
    });
    const left = ride.left();
    const s = Math.ceil(left - 1e-9);
    const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if ($('timeLeft').textContent !== txt) $('timeLeft').textContent = txt;
    $('timeBar').style.transform = `scaleX(${(left / beach.time).toFixed(3)})`;
  }

  // ---------------------------------------------------------------- touch buttons
  let pads = [];
  function buildPads() {
    const box = $('pads');
    box.innerHTML = '';
    pads = players.map((id, pl) => {
      const two = players.length > 1;
      const kb = two ? (pl ? ['↑', '↓', '→'] : ['W', 'S', 'D']) : ['↑', '↓', 'Space'];
      const mk = (cls, label, key, what, hint) => {
        const b = document.createElement('button');
        b.className = 'pad ' + cls;
        b.innerHTML = `${label}${hint ? `<small>${hint}</small>` : ''}<kbd>${key}</kbd>`;
        b.setAttribute('aria-label', { up: 'Up the wave', down: 'Down the wave', trick: 'Jump and trick' }[what]);
        const down = (e) => {
          e.preventDefault();
          Kit.sound.init();
          try { b.setPointerCapture(e.pointerId); } catch (err) { /* old browser */ }
          b.classList.add('down');
          padHeld[pl][what] = true;
          if (what === 'trick') doTrick(pl);
        };
        const up = () => { b.classList.remove('down'); padHeld[pl][what] = false; };
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('lostpointercapture', up);
        box.appendChild(b);
        return b;
      };
      padHeld[pl] = {};
      return { up: mk('steer', '⬆', kb[0], 'up'), down: mk('steer', '⬇', kb[1], 'down'), trick: mk('trick', '⭐', kb[2], 'trick', 'TRICK') };
    });
  }
  function hudUI() {
    $('pauseBtn').addEventListener('click', () => setPause(true));
    $('muteBtn').addEventListener('click', () => { Kit.sound.init(); Kit.sound.toggleMute(); });
    $('pResume').addEventListener('click', () => setPause(false));
    $('pRestart').addEventListener('click', () => startRide());
    $('pHome').addEventListener('click', goHome);
    $('rAgain').addEventListener('click', () => startRide());
    $('rNext').addEventListener('click', nextBeach);
    $('rHome').addEventListener('click', goHome);
    $('buddyBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); Kit.sound.init(); callBuddy(); });
    $('fiveBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); Kit.sound.init(); if (ride && state === 'ride' && !paused) highFive(); });
  }

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    const two = players.length > 1;
    // ⬆ over ⬇ at the outside edge, ⭐ next to them; Teddy on the left, Tommy on the right
    const pad = Math.round(Math.max(58, Math.min(92, Math.min(w, h) * 0.13)));
    const gap = 10, edge = 14, safeB = 16;
    const yDown = h - safeB - pad, yUp = yDown - pad - gap;
    const set = (b, x, y, s) => Object.assign(b.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${s || pad}px`, height: `${s || pad}px` });
    const big = Math.round(pad * 1.25);
    pads.forEach((p, pl) => {
      const right = two && pl === 1;
      const xa = right ? w - edge - pad : edge;
      set(p.up, xa, yUp);
      set(p.down, xa, yDown);
      if (!two) set(p.trick, w - edge - big, h - safeB - big - pad * 0.3, big);
      else set(p.trick, right ? xa - gap - big : xa + pad + gap, h - safeB - big, big);
    });
    const bs = Math.round(Math.max(58, Math.min(84, Math.min(w, h) * 0.11)));
    Object.assign($('buddyBtn').style, { left: `${Math.round(w / 2 - bs / 2)}px`, top: `${Math.round(h - safeB - bs)}px` });
    Object.assign($('fiveBtn').style, { left: `${Math.round(w / 2 - bs / 2)}px`, top: `${Math.round(h - safeB - bs)}px` });
    for (const pl of [0, 1]) {
      const el = $(`toasts${pl}`);
      const x = two ? (pl ? w * 0.72 : w * 0.28) : w / 2;
      Object.assign(el.style, { left: `${x}px`, top: `${h * (w > h ? 0.2 : 0.24)}px`, width: `${two ? w * 0.48 : w * 0.94}px` });
    }
  }

  // ---------------------------------------------------------------- toasts and confetti (2D, on top)
  function toast(text, kind, pl) {
    const box = $(`toasts${players.length > 1 ? pl || 0 : 0}`);
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2000);
    while (box.children.length > 3) box.firstChild.remove();
  }
  const fx = $('fx').getContext('2d');
  const bits = [];
  function confetti(n) {
    const Wd = window.innerWidth;
    for (let i = 0; i < n; i++) {
      bits.push({ x: rand(0, Wd), y: rand(-200, -10), vx: rand(-60, 60), vy: rand(80, 220), r: rand(0, 6), vr: rand(-6, 6), w: rand(7, 13), h: rand(4, 8), c: Kit.gfx.pick(['#ffd400', '#e8382f', '#18b8d8', '#7ed957', '#ff3d7f', '#ffffff']), life: rand(3, 5) });
    }
  }
  function drawFx(dt) {
    const c = $('fx');
    const Wd = window.innerWidth, Hd = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(Wd * dpr) || c.height !== Math.round(Hd * dpr)) { c.width = Math.round(Wd * dpr); c.height = Math.round(Hd * dpr); }
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.clearRect(0, 0, Wd, Hd);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.r += b.vr * dt;
      if (b.life <= 0 || b.y > Hd + 20) { bits.splice(i, 1); continue; }
      fx.save();
      fx.translate(b.x, b.y);
      fx.rotate(b.r);
      fx.fillStyle = b.c;
      fx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      fx.restore();
    }
  }

  // ---------------------------------------------------------------- window.game, for tests
  const game = {
    autoPause: true,
    start(o) { startRide(o || {}); return game.info(); },
    // quick: only draw the last frame (for long fast-forwards in tests)
    step(seconds, quick) {
      const n = Math.max(1, Math.round((seconds || 0) * 60));
      for (let i = 0; i < n; i++) frame(1 / 60, quick && i < n - 1);
      return game.info();
    },
    hold(on) { held = !!on; },
    buddy() { callBuddy(); return game.info().buddy; },
    trick(pl) { doTrick(pl || 0); },
    pause(p) { setPause(p); },
    home() { goHome(); },
    next() { nextBeach(); },
    autopilot(kind) {
      if (!ride) return;
      ride.surfers.forEach((sk) => { if (sk.human) sk.pilotFn = kind ? R.PILOTS[kind](B.rng(7 + sk.i)) : null; });
    },
    check(o) { return SURF.checks.run(Object.assign({ prove: true }, o || {})); },
    info() {
      return {
        state, paused, held, beach: beach.id, mode: save.mode, who: save.who, levels: Object.assign({}, save.level),
        time: ride ? +ride.time.toFixed(3) : null, left: ride ? +ride.left().toFixed(2) : null, over: ride ? ride.over : null, done: ride ? ride.done : null,
        surfers: ride ? ride.surfers.map((sk) => ({ id: sk.id, x: +sk.x.toFixed(1), u: +sk.u.toFixed(2), v: +sk.v.toFixed(1), air: sk.air, score: sk.score, landed: sk.landed, started: sk.started, wipeouts: sk.wipeouts, dolphins: sk.dolphins, weeds: sk.weeds, boost: +sk.boostT.toFixed(2) })) : [],
        buddy: seq ? { who: seq.entry.id, t: +seq.t.toFixed(2), tossed: seq.tossed, helped: seq.helped } : null,
        results: results ? results.order.map((r) => ({ id: r.id, place: r.place, score: r.score })) : null,
      };
    },
    get ride() { return ride; },
    get cam() { return cam; },
    get save() { return save; },
  };
  window.game = game;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
