/* TT Surf: the headless checks. They ride whole waves with pretend surfers (js/surf.js PILOTS) and look for
   anything wrong. game.check() runs them in the page; node tools/check.js runs them without a browser.
   - stable: the wave physics stays sane on every wave, both levels and all kinds of riding: nothing becomes NaN,
     nobody leaves the face, speed never reaches the safety clamp, nobody runs away from the wave or gets left in the
     white water, a do-nothing surfer settles, and the brother's better wave rises smoothly (no jumps under you).
   - frames: the same ride at 30, 60 and 144 frames a second and at a jumpy frame rate comes out exactly the same.
   - tricks: on EASY every air lasts long enough for a whole spin, a trick started at any moment of an air lands and
     scores, and whole rides of button mashing never wipe out; on NORMAL a late trick does wipe out (the rule is real).
   - easyContest: on EASY a wobbly 5-year-old beats Foxy and Froggy on every wave.
   Each check is then broken on purpose (prove) and has to notice. */
(function () {
  'use strict';
  const SURF = window.SURF;
  const R = SURF.rules, B = SURF.beaches, P = R.PHYS;
  const LEVELS = ['easy', 'normal'];
  const fmt = (n) => (Math.round(n * 100) / 100).toString();

  function ride(o) {
    return R.create({ beach: o.beach, players: o.players, cpu: !!o.cpu, seed: o.seed || 1, bug: o.bug });
  }

  // ---------------------------------------------------------------- stable
  function stable(bug) {
    const problems = [];
    let rides = 0, secs = 0, vLo = 99, vHi = 0, dLo = 99, dHi = -99, jump = 0;
    const note = (s) => { if (problems.length < 40) problems.push(s); };
    for (const beach of B.list) {
      for (const level of LEVELS) {
        for (const pilot of ['idle', 'kid', 'good', 'masher', 'late']) {
          for (const seed of [1, 2]) {
            const two = seed === 2 && pilot !== 'idle';
            const players = [{ who: 'teddy', level, pilot }];
            if (two) players.push({ who: 'tommy', level: level === 'easy' ? 'normal' : 'easy', pilot: 'kid' });
            // a do-nothing surfer rides a wave without seaweed, so that settling is all that's measured
            const r = ride({ beach: pilot === 'idle' ? Object.assign({}, beach, { weeds: [] }) : beach, players, cpu: seed === 2, seed, bug });
            rides++;
            const end = beach.time + 40;
            const vlog = [];
            while (r.time < end) {
              const before = r.surfers.map((sk) => [sk.x, r.height(sk.x)]);
              r.step(P.h);
              r.events.length = 0;
              if (r.time < 0) continue;
              secs += P.h * r.surfers.length;
              r.surfers.forEach((sk, k) => {
                const tag = `${beach.id}/${level}/${pilot}/${seed} ${sk.id} t=${fmt(r.time)}`;
                const d = sk.x - r.curl;
                for (const key of ['x', 'u', 'v', 'a', 'y', 'vy']) if (!Number.isFinite(sk[key])) note(`${tag}: ${key} is ${sk[key]}`);
                if (sk.u < -1e-9 || sk.u > 1 + 1e-9) note(`${tag}: off the face, u = ${fmt(sk.u)}`);
                if (sk.v > 21 || sk.v < P.vMin - 1e-9) note(`${tag}: speed ${fmt(sk.v)} m/s`);
                if (Math.abs(sk.a) > sk.L.aMax + 1e-9) note(`${tag}: heading ${fmt(sk.a)}`);
                if (sk.air && sk.y - r.height(sk.x) > 9) note(`${tag}: ${fmt(sk.y - r.height(sk.x))} m over the lip`);
                if (!sk.air && Math.abs(sk.y - r.surfaceY(sk.x, sk.u)) > 1e-6) note(`${tag}: not on the water`);
                if (d < -14 || d > 45) note(`${tag}: ${fmt(d)} m from the curl`);
                // the wave itself under a fixed spot may only change smoothly
                const dh = Math.abs(r.height(before[k][0]) - before[k][1]);
                jump = Math.max(jump, dh);
                if (dh > 0.08) note(`${tag}: the wave jumped ${fmt(dh)} m under him`);
                vLo = Math.min(vLo, sk.v); vHi = Math.max(vHi, sk.v); dLo = Math.min(dLo, d); dHi = Math.max(dHi, d);
              });
              if (pilot === 'idle') vlog.push([r.time, r.surfers[0].v, r.surfers[0].u]);
            }
            if (pilot === 'idle') {
              const last = vlog.filter((q) => q[0] > beach.time - 10 && q[0] <= beach.time);
              const first = vlog.filter((q) => q[0] < 20), late = vlog.filter((q) => q[0] > beach.time - 20 && q[0] <= beach.time);
              const range = (arr, k) => Math.max(...arr.map((q) => q[k])) - Math.min(...arr.map((q) => q[k]));
              if (level === 'easy' && (range(last, 1) > 1 || range(last, 2) > 0.15)) note(`${beach.id}/easy idle never settles: speed ±${fmt(range(last, 1))}, face ±${fmt(range(last, 2))}`);
              const peak = (arr) => Math.max(...arr.map((q) => q[1]));
              if (peak(late) > peak(first) + 0.5) note(`${beach.id}/${level} idle keeps speeding up: ${fmt(peak(first))} → ${fmt(peak(late))} m/s`);
            }
          }
        }
      }
    }
    // the brother's better wave: lift a surfer and watch it rise and settle again
    for (const beach of B.list) {
      const r = ride({ beach, players: [{ who: 'tommy', level: 'easy', pilot: 'kid' }], seed: 5, bug });
      r.step(P.countIn + 4);
      r.lift(0);
      let peak = 0;
      for (let t = 0; t < P.boostTime + 4; t += P.h) {
        const sk = r.surfers[0], x = sk.x, h0 = r.height(x);
        r.step(P.h);
        const dh = Math.abs(r.height(x) - h0);
        jump = Math.max(jump, dh);
        if (dh > 0.08) note(`${beach.id} better wave: jumped ${fmt(dh)} m`);
        peak = Math.max(peak, r.height(sk.x) / beach.H);
      }
      if (peak < 1.3) note(`${beach.id} better wave never rose (×${fmt(peak)})`);
      if (r.bumps.length) note(`${beach.id} better wave never settled`);
    }
    return { problems, stat: `${rides} rides, ${Math.round(secs / 60)} surfer-minutes; speed ${fmt(vLo)}–${fmt(vHi)} m/s; curl distance ${fmt(dLo)}–${fmt(dHi)} m; biggest wave change ${fmt(jump * 100)} cm per step` };
  }

  // ---------------------------------------------------------------- frames
  function frames(bug) {
    const problems = [];
    let compared = 0;
    const N = 60 * 120; // compare after a minute of riding (and the count-in)
    for (const beach of [B.get('cove'), B.get('big')]) {
      for (const level of LEVELS) {
        const snaps = [];
        for (const fps of [30, 60, 144, 'jumpy']) {
          const r = ride({ beach, players: [{ who: 'teddy', level, pilot: 'kid' }, { who: 'tommy', level, pilot: 'good' }], cpu: true, seed: 3, bug });
          let snap = null;
          r.onSub = (rr) => { if (rr.n === N) snap = rr.surfers.map((sk) => [sk.x, sk.u, sk.v, sk.y, sk.score, sk.landed, sk.wipeouts]); };
          const jr = B.rng(99);
          let guard = 0;
          while (!snap && guard++ < 1e6) {
            const dt = fps === 'jumpy' ? 0.004 + jr() * 0.05 : 1 / fps;
            r.step(dt);
            r.events.length = 0;
            if (bug === 'rawdt' && r.n >= N && !snap) snap = r.surfers.map((sk) => [sk.x, sk.u, sk.v, sk.y, sk.score, sk.landed, sk.wipeouts]);
          }
          snaps.push([fps, snap]);
        }
        const [, base] = snaps[0];
        for (const [fps, s] of snaps.slice(1)) {
          compared++;
          s.forEach((row, k) => row.forEach((val, q) => {
            if (Math.abs(val - base[k][q]) > 1e-9) problems.length < 30 && problems.push(`${beach.id}/${level} at ${fps} fps: surfer ${k} ${['x', 'u', 'v', 'y', 'score', 'spins', 'wipeouts'][q]} ${fmt(val)} vs ${fmt(base[k][q])} at 30 fps`);
          }));
        }
      }
    }
    return { problems, stat: `${compared} frame rates compared against 30 fps, 4 surfers each, after 60 s` };
  }

  // ---------------------------------------------------------------- tricks
  function soloLaunch(beach, bug, v, a) {
    const r = ride({ beach, players: [{ who: 'tommy', level: 'easy' }], seed: 1, bug });
    r.step(P.countIn + 2);
    r.events.length = 0;
    const sk = r.surfers[0];
    sk.v = v; sk.a = a; sk.u = 0.9999;
    return { r, sk };
  }
  function tricks(bug) {
    const problems = [];
    const note = (s) => { if (problems.length < 40) problems.push(s); };
    let airs = 0, shortest = 99, sweep = 0, started = 0, landed = 0, easyWipe = 0, normalWipe = 0;
    for (const beach of B.list) {
      const L = R.LEVELS.easy;
      // every air off the lip lasts long enough for a whole spin
      for (let v = 4; v <= 16; v += 1) {
        for (let a = 0.15; a <= L.aMax + 1e-9; a += 0.05) {
          if (v * Math.sin(a) <= L.popMin + 0.05) continue;
          const { r, sk } = soloLaunch(beach, bug, v, a);
          let t = 0;
          r.step(P.h);
          if (!sk.air) continue; // went over the lip too slowly: a top turn, not an air
          airs++;
          while (sk.air && t < 10) { r.step(P.h); t += P.h; }
          shortest = Math.min(shortest, t);
          if (t < L.trickTime + 0.15) note(`${beach.id}: an air of ${fmt(t)} s (v ${v}, heading ${fmt(a)}) is too short for a ${L.trickTime} s spin`);
        }
      }
      // a trick started at any moment of an air lands, and scores
      for (let t0 = 0; t0 < 3; t0 += 0.02) {
        const { r, sk } = soloLaunch(beach, bug, 10, 0.6);
        r.step(P.h);
        let t = 0, pressed = false;
        while (sk.air && t < 10) {
          if (!pressed && t >= t0) { r.jump(0); pressed = true; }
          r.step(P.h);
          t += P.h;
        }
        if (!pressed) break;
        sweep++;
        const ev = r.events.find((e) => e.type === 'land'), wipe = r.events.some((e) => e.type === 'wipeout');
        if (wipe) note(`${beach.id}: a trick started ${fmt(t0)} s into the air wiped out on EASY`);
        else if (!ev || ev.n < 1 || ev.pts <= 0) note(`${beach.id}: a trick started ${fmt(t0)} s into the air landed without a spin or points (${ev ? ev.n + ' spins, ' + ev.pts + ' points' : 'no landing'})`);
      }
      // whole rides of every kind of EASY riding: no wipeouts, every trick started is landed
      for (const pilot of ['kid', 'masher', 'late', 'good']) {
        for (const seed of [1, 2, 3]) {
          const r = ride({ beach, players: [{ who: 'tommy', level: 'easy', pilot }, { who: 'teddy', level: 'easy', pilot: 'kid' }], cpu: true, seed, bug });
          while (!r.done) { r.step(1 / 60); r.events.length = 0; }
          for (const sk of r.surfers) {
            started += sk.started; landed += sk.landed; easyWipe += sk.wipeouts;
            if (sk.wipeouts) note(`${beach.id}/${pilot}/${seed} ${sk.id}: ${sk.wipeouts} wipeouts on EASY`);
            if (sk.landed !== sk.started) note(`${beach.id}/${pilot}/${seed} ${sk.id}: started ${sk.started} tricks, landed ${sk.landed}`);
          }
          if (pilot !== 'masher' && r.surfers[0].started === 0) note(`${beach.id}/${pilot}/${seed}: no tricks at all (nothing measured)`);
        }
      }
      // on NORMAL, starting a spin just before landing wipes you out
      const r = ride({ beach, players: [{ who: 'teddy', level: 'normal', pilot: 'late' }], seed: 1, bug });
      while (!r.done) { r.step(1 / 60); r.events.length = 0; }
      normalWipe += r.surfers[0].wipeouts;
      if (!r.surfers[0].wipeouts) note(`${beach.id}: late tricks on NORMAL never wiped out, so the landing rule isn't working`);
    }
    if (!airs) note('no airs measured');
    return { problems, stat: `${airs} EASY airs, shortest ${fmt(shortest)} s (a spin takes ${R.LEVELS.easy.trickTime} s); ${sweep} trick timings; ${started} tricks started in EASY rides, ${landed} landed, ${easyWipe} wipeouts; ${normalWipe} late-trick wipeouts on NORMAL` };
  }

  // ---------------------------------------------------------------- easyContest
  function easyContest(bug) {
    const problems = [];
    let n = 0, worst = Infinity;
    for (const beach of B.list) {
      for (const seed of [1, 2, 3, 4]) {
        const r = ride({ beach, players: [{ who: 'tommy', level: 'easy', pilot: 'kid' }], cpu: true, seed, bug });
        while (!r.done) { r.step(1 / 60); r.events.length = 0; }
        n++;
        const kid = r.surfers[0].score, best = Math.max(...r.surfers.slice(1).map((s) => s.score));
        worst = Math.min(worst, kid - best);
        if (kid <= best) problems.push(`${beach.id}/${seed}: the 5-year-old scored ${kid}, Foxy/Froggy ${best}`);
      }
    }
    return { problems, stat: `${n} EASY contests, the wobbly kid wins every one (smallest lead ${worst} points)` };
  }

  const CHECKS = { stable, frames, tricks, easyContest };
  const BROKEN = [
    { name: 'pushy', check: 'stable', why: 'the wave pushes the wrong way' },
    { name: 'noLip', check: 'stable', why: 'nothing stops you at the lip' },
    { name: 'jumpy', check: 'stable', why: 'the better wave appears all at once' },
    { name: 'rawdt', check: 'frames', why: 'one physics step per frame' },
    { name: 'noAssist', check: 'tricks', why: 'no landing help on EASY' },
    { name: 'heavy', check: 'tricks', why: 'EASY airs as heavy as a rock' },
    { name: 'noScore', check: 'tricks', why: 'landed tricks score nothing' },
    { name: 'cpuStrong', check: 'easyContest', why: 'Foxy and Froggy go all out on EASY' },
  ];

  function run(o) {
    o = o || {};
    const t0 = Date.now();
    const results = [];
    for (const name of Object.keys(CHECKS)) {
      if (o.only && o.only !== name) continue;
      const res = CHECKS[name](null);
      results.push({ name, ok: !res.problems.length, stat: res.stat, problems: res.problems });
    }
    const prove = [];
    if (o.prove) {
      for (const b of BROKEN) {
        if (o.only && o.only !== b.check) continue;
        const res = CHECKS[b.check](b.name);
        prove.push({ name: b.name, check: b.check, why: b.why, caught: res.problems.length > 0, first: res.problems[0] || '(not caught)' });
      }
    }
    return { ok: results.every((r) => r.ok) && prove.every((p) => p.caught), results, prove, ms: Date.now() - t0 };
  }

  SURF.checks = { run, CHECKS };
})();
