/* TT Surf: the rules, with no drawing. A ride is one wave: it peels along the beach at the wave's speed, the white
   water (the curl) chasing behind, and every surfer rides its face for the wave's time. The 3D (js/world.js) and the
   game (js/game.js) only read from here, and the headless checks (js/checks.js) run whole rides with pretend players.

   A surfer has x (along the wave), u (0 = trough, 1 = lip), a heading a (+ = up the face), a speed v, and in the air a
   height y and a climb vy. Physics runs in fixed 1/120 s steps, so any frame rate rides exactly the same:
   - going down the face speeds you up, going up slows you down (gravity along the slope);
   - the wave pushes you toward a speed that is best in the pocket, near the curl, and fades out on the shoulder;
     ride too far ahead and you slow down, fall into the white water and it shoves you out again;
   - hit the lip going up fast enough and you fly; press TRICK in the air to spin (each spin takes trickTime);
   - EASY: a trick always lands (the spin finishes as you touch down) and every air lasts long enough for a spin;
     NORMAL: land in the middle of a spin and you wipe out. */
(function () {
  'use strict';
  const SURF = (window.SURF = window.SURF || {});
  const B = SURF.beaches;

  const PHYS = {
    h: 1 / 120, countIn: 3, G: 9.8, vMin: 3, vMax: 24, push: 0.8, pocketV: 3, faceV: 1.5, boostV: 3, fiveV: 2, foamPush: 2.2,
    popK: 0.55, airDrift: 0.25, landU: 0.72, saveFrac: 0.75, wipeTime: 1.3, hopU: 0.8,
    bumpH: 0.55, bumpW: 9, bumpRate: 1.2, boostTime: 9, liftVy: 6.5, carveGap: 0.6, dolX: 3,
  };
  const LEVELS = {
    // 🐣 for Tommy (5): steering help back to the middle of the face, big floaty airs, every trick lands
    easy: { id: 'easy', turn: 3.0, aMax: 0.7, help: true, popMin: 1.0, popBonus: 2.2, popExtra: 1.2, minAirVy: 3.0, airG: 7, trickTime: 0.42, assist: true, hop: 2.6, weedR: 0.55, dolR: 3.2 },
    // 🔥 for Teddy (8): sharper turns, real gravity, finish your spin before you land
    normal: { id: 'normal', turn: 3.4, aMax: 0.85, help: false, popMin: 2.0, popBonus: 0.6, popExtra: 1.8, minAirVy: 0, airG: 9.8, trickTime: 0.5, assist: false, hop: 2.8, weedR: 0.85, dolR: 2.4 },
  };
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY', foxy: 'FOXY', froggy: 'FROGGY' };
  const CPUS = { foxy: { name: 'FOXY', emoji: '🦊' }, froggy: { name: 'FROGGY', emoji: '🐸' } };
  const POINTS = { carve: 20, air: 20, dolphin: 50 };
  const spinPoints = (n) => (n < 5 ? [0, 100, 250, 450, 700][n] : 700 + 300 * (n - 4));
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------------------------------------------------------------- the wave
  // how tall the face is at x: lower in the white water behind the curl, fading out far along the shoulder, and
  // taller under a brother's better wave
  function height(r, x) {
    const d = x - r.curl;
    let k = 1;
    if (d < 0) k = 1 - 0.5 * smooth(Math.min(1, -d / 6));
    else if (d > 40) k = 1 - 0.6 * smooth(Math.min(1, (d - 40) / 40));
    let bump = 0;
    for (const b of r.bumps) {
      const q = (x - b.x) / PHYS.bumpW;
      bump += b.amp * Math.exp(-q * q);
    }
    return r.beach.H * k * (1 + PHYS.bumpH * Math.min(1, bump));
  }
  const surfaceY = (r, x, u) => height(r, x) * B.f(u);
  // how hard the wave pushes: most in the pocket by the curl, less and less out on the shoulder
  function pocket(d) {
    if (d < 0) return 1.2;
    if (d < 6) return 1;
    return Math.max(-1.5, 1 - (d - 6) / 10);
  }

  // ---------------------------------------------------------------- a ride
  function create(o) {
    const beach = o.beach;
    const seed = o.seed || 1;
    const r = {
      beach, seed, time: -PHYS.countIn, n: 0, acc: 0, alpha: 0, curl: 0, surfers: [], events: [], bumps: [],
      over: false, done: false, bug: o.bug || null,
    };
    const humans = o.players || [];
    const cpuLevel = !humans.length || humans.some((p) => (p.level || 'easy') === 'easy') ? 'easy' : 'normal';
    const slots = [[10, 0.45], [4.5, 0.66], [15.5, 0.3], [0.5, 0.74]];
    humans.forEach((p, i) => {
      r.surfers.push(makeSurfer(r, r.surfers.length, p.who, true, p.level || 'easy', slots[r.surfers.length], p.pilot ? PILOTS[p.pilot](B.rng(seed * 7 + i + 1)) : null));
    });
    if (o.cpu) {
      for (const id of ['foxy', 'froggy']) {
        const i = r.surfers.length;
        // (broken on purpose for the checks: Foxy and Froggy ride all out, like the careful 8-year-old)
        const pilot = r.bug === 'cpuStrong' ? PILOTS.good(B.rng(seed * 13 + i)) : PILOTS.cpu(B.rng(seed * 13 + i), cpuLevel);
        r.surfers.push(makeSurfer(r, i, id, false, cpuLevel, slots[i], pilot));
      }
    }
    r.height = (x) => height(r, x);
    r.surfaceY = (x, u) => surfaceY(r, x, u);
    r.input = (i, inp) => { const sk = r.surfers[i]; if (sk) { sk.in.steer = clamp(inp.steer || 0, -1, 1); sk.in.trick = !!inp.trick; } };
    r.jump = (i) => { const sk = r.surfers[i]; if (sk) sk.press = true; };
    r.lift = (i) => { const sk = r.surfers[i]; if (sk) sk.liftReq = true; };
    r.five = () => { for (const sk of r.surfers) if (sk.human) sk.fiveT = 1.5; };
    r.step = (dt) => step(r, dt);
    r.left = () => Math.max(0, beach.time - Math.max(0, r.time));
    r.results = () => results(r);
    r.airLeft = (sk) => airLeft(r, sk);
    for (const sk of r.surfers) { sk.y = surfaceY(r, sk.x, sk.u); keepPrev(sk); interp(sk, 0); }
    return r;
  }

  function makeSurfer(r, i, id, human, level, slot, pilot) {
    const L = Object.assign({}, LEVELS[level]);
    // the checks' broken rules (each one must be caught)
    if (r.bug === 'noAssist' && level === 'easy') L.assist = false;
    if (r.bug === 'heavy' && level === 'easy') { L.airG = 14; L.popBonus = 0; L.minAirVy = 0; }
    return {
      i, id, human, level, L, name: NAMES[id] || id.toUpperCase(), emoji: CPUS[id] ? CPUS[id].emoji : '',
      x: slot[0], u: slot[1], a: 0, v: r.beach.peel + 1, y: 0, vy: 0,
      air: false, hop: false, airT: 0, spins: 0, trick: null, popT: 0, wipeT: 0, weedT: 0, boostT: 0, fiveT: 0,
      carveSign: 0, carveT: -9, inFoam: false, press: false, liftReq: false,
      in: { steer: 0, trick: false }, pilotFn: pilot,
      met: r.beach.dolphins.map(() => false), hit: r.beach.weeds.map(() => false),
      score: 0, started: 0, landed: 0, airs: 0, wipeouts: 0, dolphins: 0, weeds: 0, carves: 0, maxAir: 0,
      px: 0, pu: 0, py: 0, rx: 0, ru: 0, ry: 0,
    };
  }

  function keepPrev(sk) { sk.px = sk.x; sk.pu = sk.u; sk.py = sk.y; }
  function interp(sk, k) {
    sk.rx = sk.px + (sk.x - sk.px) * k;
    sk.ru = sk.pu + (sk.u - sk.pu) * k;
    sk.ry = sk.py + (sk.y - sk.py) * k;
  }

  function step(r, dt) {
    if (r.bug === 'rawdt') {
      // broken on purpose: one step of whatever the frame was
      for (const sk of r.surfers) keepPrev(sk);
      sub(r, dt);
      r.n++;
      for (const sk of r.surfers) interp(sk, 1);
      return;
    }
    const h = PHYS.h;
    r.acc += dt;
    while (r.acc >= h - 1e-9) {
      r.acc -= h;
      for (const sk of r.surfers) keepPrev(sk);
      sub(r, h);
      r.n++;
      if (r.onSub) r.onSub(r);
    }
    r.alpha = Math.max(0, Math.min(1, r.acc / h));
    for (const sk of r.surfers) interp(sk, r.alpha);
  }

  function sub(r, h) {
    r.time += h;
    if (r.time < 0) {
      for (const sk of r.surfers) sk.y = surfaceY(r, sk.x, sk.u);
      return;
    }
    if (!r.over && r.time >= r.beach.time) { r.over = true; r.events.push({ type: 'end' }); }
    r.curl = r.beach.peel * r.time;
    // the brother's better wave rises under you, follows you, and settles again when it's over
    for (let k = r.bumps.length - 1; k >= 0; k--) {
      const b = r.bumps[k], sk = r.surfers[b.i];
      const on = sk.boostT > 0;
      if (r.bug === 'jumpy') b.amp = on ? 1 : 0;
      else b.amp = clamp(b.amp + (on ? 1 : -1) * PHYS.bumpRate * h, 0, 1);
      b.x = sk.x + 3;
      if (!on && b.amp <= 0) r.bumps.splice(k, 1);
    }
    for (const sk of r.surfers) surf(r, sk, h);
    if (r.over && !r.done && r.surfers.every((s) => !s.air)) r.done = true;
  }

  const NONE = { steer: 0, trick: false, press: false };

  function surf(r, sk, h) {
    const P = PHYS, L = sk.L, beach = r.beach, F = B.F;
    let inp = sk.in, press = sk.press;
    sk.press = false;
    if (sk.pilotFn) {
      const p = sk.pilotFn(sk, r) || NONE;
      inp = p;
      press = press || !!p.press;
    }
    if (r.over) { inp = NONE; press = false; } // the wave is over: ride it in
    const mult = sk.boostT > 0 ? 2 : 1;
    sk.weedT = Math.max(0, sk.weedT - h);
    sk.boostT = Math.max(0, sk.boostT - h);
    sk.fiveT = Math.max(0, sk.fiveT - h);
    sk.popT = Math.max(0, sk.popT - h);

    // the brother lifts you onto a better wave
    if (sk.liftReq) {
      sk.liftReq = false;
      sk.wipeT = 0;
      if (!sk.air) { sk.spins = 0; sk.airT = 0; sk.trick = null; }
      sk.air = true;
      sk.hop = false;
      sk.y = surfaceY(r, sk.x, sk.u) + 0.1;
      sk.vy = Math.max(sk.vy, P.liftVy);
      sk.boostT = P.boostTime;
      if (!r.bumps.some((b) => b.i === sk.i)) r.bumps.push({ i: sk.i, amp: 0, x: sk.x + 3 });
      sk.airs++;
      r.events.push({ type: 'lift', i: sk.i });
    }

    const d = sk.x - r.curl;
    // in the white water: it shoves you along and down the face
    if (d < 0 && !sk.air) {
      if (!sk.inFoam) { sk.inFoam = true; r.events.push({ type: 'foam', i: sk.i }); }
    } else if (d > 1) sk.inFoam = false;

    // wiped out: floating by the board for a moment
    if (sk.wipeT > 0) {
      sk.wipeT -= h;
      sk.v += (beach.peel * 0.85 - sk.v) * Math.min(1, 3 * h);
      if (d < 0) sk.v += P.foamPush * (beach.peel + 3 - sk.v) * h;
      sk.x += sk.v * h;
      sk.u += (0.3 - sk.u) * Math.min(1, 2 * h);
      sk.a = 0;
      sk.y = surfaceY(r, sk.x, sk.u);
      if (sk.wipeT <= 0) { sk.wipeT = 0; sk.carveSign = 0; r.events.push({ type: 'up', i: sk.i }); }
      return;
    }

    if (!sk.air) {
      // steering: up (+1) or down (-1) the face; with no hands on EASY you drift back to the middle
      const s = inp.steer || 0;
      const turn = L.turn * (sk.weedT > 0 ? 0.5 : 1);
      if (s) sk.a += turn * s * h;
      else if (L.help) sk.a += (clamp((0.55 - sk.u) * 1.8, -0.5, 0.5) - sk.a) * Math.min(1, 2.2 * h);
      sk.a = clamp(sk.a, -L.aMax, L.aMax);
      // speed: gravity along the face, and the wave's push
      const H = height(r, sk.x);
      const sl = (H * B.df(sk.u)) / F, sinT = sl / Math.sqrt(1 + sl * sl);
      let acc = -P.G * Math.sin(sk.a) * sinT;
      const vT = beach.peel + P.pocketV * pocket(d) + P.faceV * sk.u + (sk.boostT > 0 ? P.boostV : 0) + (sk.fiveT > 0 ? P.fiveV : 0);
      acc += (r.bug === 'pushy' ? -P.push : P.push) * (vT - sk.v);
      if (d < 0) {
        acc += P.foamPush * (beach.peel + 3 - sk.v);
        sk.a += (-0.2 - sk.a) * Math.min(1, 1.5 * h);
      }
      sk.v = clamp(sk.v + acc * h, P.vMin, P.vMax);
      sk.u += (sk.v * Math.sin(sk.a) * h) / F;
      // the white water carries you along at least a little faster than the wave peels, so it spits you out again
      sk.x += (d < 0 ? Math.max(sk.v * Math.cos(sk.a), beach.peel + 1.5) : sk.v * Math.cos(sk.a)) * h;
      // the lip: fly if you hit it fast enough, otherwise turn back down (a top turn)
      if (sk.u >= 1 && r.bug !== 'noLip') {
        const up = sk.v * Math.sin(sk.a);
        if (up > L.popMin) launch(r, sk, up);
        else { sk.u = 1; sk.a = -Math.abs(sk.a) * 0.5 - 0.15; }
      }
      // the trough: a bottom turn, and the flat water slows you a little
      if (sk.u <= 0) { sk.u = 0; sk.a = Math.abs(sk.a) * 0.5 + 0.15; sk.v = Math.max(P.vMin, sk.v - 0.4); }
      if (!sk.air) {
        carve(r, sk, mult);
        // TRICK on the face: a hop (over seaweed), or near the lip a pop that throws you higher
        if (press) {
          if (sk.u > P.hopU && sk.a > 0.2) sk.popT = 0.35;
          else { sk.air = true; sk.hop = true; sk.vy = L.hop; sk.airT = 0; r.events.push({ type: 'hop', i: sk.i }); }
        }
        sk.y = sk.air ? surfaceY(r, sk.x, sk.u) + 0.01 : surfaceY(r, sk.x, sk.u);
      }
    } else {
      // in the air
      sk.airT += h;
      sk.vy -= L.airG * h;
      sk.y += sk.vy * h;
      sk.x += sk.v * Math.cos(sk.a) * h;
      if (sk.hop) sk.u = clamp(sk.u + (sk.v * Math.sin(sk.a) * h) / F, 0, 1);
      else if (sk.u > P.landU) sk.u = Math.max(P.landU, sk.u - P.airDrift * h); // the wave rolls under you
      if (!sk.hop) {
        sk.maxAir = Math.max(sk.maxAir, sk.y - height(r, sk.x));
        if (sk.trick) {
          sk.trick.t += h;
          if (sk.trick.t >= L.trickTime) { sk.trick = null; sk.spins++; r.events.push({ type: 'spin', i: sk.i, n: sk.spins }); }
        }
        if (!sk.trick && (press || inp.trick)) {
          sk.trick = { t: 0 };
          sk.started++;
          r.events.push({ type: 'trick', i: sk.i });
        }
      }
      const ys = surfaceY(r, sk.x, sk.u);
      if (sk.y <= ys && sk.vy < 0) land(r, sk, ys, mult);
    }

    if (!sk.air && sk.wipeT <= 0) meet(r, sk, mult);
  }

  function launch(r, sk, up) {
    const L = sk.L;
    sk.air = true;
    sk.hop = false;
    sk.airT = 0;
    sk.spins = 0;
    sk.trick = null;
    sk.u = 1;
    sk.y = height(r, sk.x);
    sk.vy = Math.max(L.minAirVy, up * PHYS.popK + L.popBonus + (sk.popT > 0 ? L.popExtra : 0));
    sk.popT = 0;
    sk.airs++;
    r.events.push({ type: 'launch', i: sk.i, pop: sk.vy });
  }

  function land(r, sk, ys, mult) {
    sk.air = false;
    sk.y = ys;
    sk.vy = 0;
    if (sk.hop) { sk.hop = false; r.events.push({ type: 'hopLand', i: sk.i }); return; }
    let n = sk.spins, saved = false;
    if (sk.trick) {
      const p = sk.trick.t / sk.L.trickTime;
      if (sk.L.assist || p >= PHYS.saveFrac) { n++; saved = true; sk.trick = null; }
      else { wipeout(r, sk); return; }
    }
    let pts = n ? spinPoints(n) : sk.airT > 0.35 ? POINTS.air : 0;
    if (r.bug === 'noScore') pts = 0;
    pts *= mult;
    sk.score += pts;
    sk.landed += n;
    sk.spins = 0;
    sk.a = -0.35;
    sk.carveSign = -1;
    if (!sk.L.assist) sk.v *= 0.92;
    r.events.push({ type: 'land', i: sk.i, n, pts, saved });
  }

  function wipeout(r, sk) {
    sk.air = false;
    sk.hop = false;
    sk.trick = null;
    sk.spins = 0;
    sk.wipeT = PHYS.wipeTime;
    sk.wipeouts++;
    sk.v *= 0.55;
    r.events.push({ type: 'wipeout', i: sk.i });
  }

  // a big swing from down the face to up it (or back): a carve
  function carve(r, sk, mult) {
    const sgn = sk.a > 0.25 ? 1 : sk.a < -0.25 ? -1 : 0;
    if (!sgn || sgn === sk.carveSign) return;
    if (sk.carveSign !== 0 && sk.v > 6 && r.time - sk.carveT > PHYS.carveGap) {
      sk.carveT = r.time;
      const pts = POINTS.carve * mult;
      sk.score += pts;
      sk.carves++;
      r.events.push({ type: 'carve', i: sk.i, pts });
    }
    sk.carveSign = sgn;
  }

  // dolphins to say hi to, seaweed to dodge (each one counts once for each surfer)
  function meet(r, sk, mult) {
    const F = B.F, beach = r.beach;
    for (let j = 0; j < beach.dolphins.length; j++) {
      const o = beach.dolphins[j];
      if (sk.met[j] || Math.abs(o.x - sk.x) > PHYS.dolX || Math.abs(o.u - sk.u) * F > sk.L.dolR) continue;
      sk.met[j] = true;
      sk.dolphins++;
      const pts = POINTS.dolphin * mult;
      sk.score += pts;
      r.events.push({ type: 'dolphin', i: sk.i, j, pts });
    }
    for (let j = 0; j < beach.weeds.length; j++) {
      const o = beach.weeds[j];
      if (sk.hit[j] || Math.abs(o.x - sk.x) > 0.6 + sk.L.weedR * 0.5 || Math.abs(o.u - sk.u) * F > sk.L.weedR) continue;
      sk.hit[j] = true;
      sk.weeds++;
      sk.v = Math.max(PHYS.vMin, sk.v * 0.7);
      sk.weedT = 0.7;
      r.events.push({ type: 'weed', i: sk.i, j });
    }
  }

  function results(r) {
    const order = r.surfers.slice().sort((a, b) => b.score - a.score || a.i - b.i);
    order.forEach((sk, k) => { sk.place = k + 1; });
    return order.map((sk) => ({ i: sk.i, id: sk.id, name: sk.name, human: sk.human, place: sk.place, score: sk.score, landed: sk.landed, dolphins: sk.dolphins, wipeouts: sk.wipeouts }));
  }

  // ---------------------------------------------------------------- pretend surfers (Foxy, Froggy, and the checks' players)
  // about how long until he comes down
  function airLeft(r, sk) {
    if (!sk.air) return 0;
    const g = sk.L.airG;
    const ys = surfaceY(r, sk.x, Math.max(PHYS.landU, Math.min(sk.u, sk.u - PHYS.airDrift * 0.4)));
    const dy = sk.y - ys;
    return (sk.vy + Math.sqrt(Math.max(0, sk.vy * sk.vy + 2 * g * Math.max(0, dy)))) / g;
  }

  // down the face, a bottom turn, up to the lip and into the air; spins in the air; a hop over seaweed
  function rider(rnd, o) {
    let phase = 'down', rest = 0, want = o.want(rnd);
    return (sk, r) => {
      const out = { steer: 0, trick: false, press: false };
      if (sk.air) {
        phase = 'down';
        if (!sk.hop && !sk.trick && sk.spins < want) {
          const left = airLeft(r, sk);
          if (o.late ? left < sk.L.trickTime * 0.4 : left > sk.L.trickTime * o.margin) out.trick = true;
        }
        return out;
      }
      if (sk.wipeT > 0) return out;
      if (r.time < rest) {
        if (Math.abs(0.5 - sk.u) > 0.12) out.steer = Math.sign(0.5 - sk.u);
      } else if (phase === 'down') {
        out.steer = -1;
        if (sk.u < o.low) phase = 'up';
      } else {
        out.steer = 1;
        if (o.pop && sk.u > 0.84 && sk.a > 0.3) out.press = rnd() < o.pop * 0.1;
        if (sk.u > 0.97 || (sk.u > 0.85 && sk.a < 0)) { phase = 'down'; }
      }
      if (sk.airs !== o.lastAirs) { o.lastAirs = sk.airs; want = o.want(rnd); rest = r.time + o.rest(rnd); }
      if (o.avoid) {
        for (let j = 0; j < r.beach.weeds.length; j++) {
          const w = r.beach.weeds[j], dx = w.x - sk.x;
          if (!sk.hit[j] && dx > 0.4 && dx < 2 && Math.abs(w.u - sk.u) * B.F < 1.3 && sk.u < PHYS.hopU) out.press = true;
        }
      }
      return out;
    };
  }

  const PILOTS = {
    idle: () => () => NONE,
    // a wobbly 5-year-old: steers about at random, holds TRICK now and then, presses it about once a second
    kid: (rnd) => {
      let steer = 0, hold = false, until = 0;
      return (sk, r) => {
        if (r.time >= until) {
          const p = rnd();
          steer = p < 0.45 ? 1 : p < 0.7 ? -1 : 0;
          hold = rnd() < 0.3;
          until = r.time + 0.3 + rnd() * 1.2;
        }
        return { steer, trick: hold, press: rnd() < PHYS.h * 1.2 };
      };
    },
    // mashing every button
    masher: (rnd) => (sk, r) => ({ steer: [-1, 0, 1][Math.floor(rnd() * 3)], trick: rnd() < 0.5, press: rnd() < 0.05 }),
    // a careful 8-year-old: big bottom turns, airs off the lip, as many spins as fit, hops the seaweed
    good: (rnd) => rider(rnd, { want: () => 9, rest: () => 0, low: 0.12, margin: 1.08, pop: 1, avoid: true }),
    // starts every trick just before landing (EASY must still land it; NORMAL wipes out)
    late: (rnd) => rider(rnd, { want: () => 1, rest: () => 0, low: 0.12, late: true, pop: 0, avoid: false }),
    // Foxy and Froggy: on EASY they take it slow (a few airs, a spin now and then)
    cpu: (rnd, level) => level === 'easy'
      ? rider(rnd, { want: (q) => (q() < 0.5 ? 1 : 0), rest: (q) => 2.5 + q() * 3, low: 0.2, margin: 1.15, pop: 0, avoid: false })
      : rider(rnd, { want: (q) => 1 + (q() < 0.6 ? 1 : 0), rest: (q) => 0.4 + q() * 1.2, low: 0.12, margin: 1.1, pop: 0.6, avoid: true }),
  };

  SURF.rules = { PHYS, LEVELS, CPUS, NAMES, POINTS, PILOTS, spinPoints, create, pocket };
})();
