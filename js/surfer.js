/* TT Surf: the surfers. Teddy and Tommy are the kit's blocky boys (Kit.people) on surfboards; Foxy and Froggy are
   the same bodies with a fox's and a frog's head. SURF.surfer.make(id) builds one, place(m, sk, dt) puts it where
   the rules say (on the face, in the air, wiped out), stand(m, x, u) puts it standing on the water facing the
   camera, and act(m, mode, dt) does the celebrations. Everyone faces the beach (the camera) and rides toward +x. */
(function () {
  'use strict';
  const SURF = (window.SURF = window.SURF || {});
  const T = THREE;
  const G = Kit.gfx;
  const B = SURF.beaches;

  const LOOKS = {
    foxy: { head: 'human', skin: '#ff8a3c', top: '#2f6bff', bottom: '#1d2a55', shoes: '#ff8a3c', shirt: 'tee', print: 'star', hair: null },
    froggy: { head: 'human', skin: '#69c94e', top: '#ffd400', bottom: '#2f7d4f', shoes: '#69c94e', shirt: 'tee', print: 'bolt', hair: null },
  };
  const BOARDS = { teddy: ['#e8382f', '#ffffff'], tommy: ['#ff8a1f', '#2f6bff'], foxy: ['#ffffff', '#ff8a3c'], froggy: ['#2fd0ff', '#ffd400'] };
  const TAGS = { teddy: '#8cc2ff', tommy: '#ffb02e', foxy: '#ffb27a', froggy: '#a6f08a' };
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY', foxy: 'FOXY', froggy: 'FROGGY' };

  // a fox's or a frog's head in place of the boy's (same size, facing -z like the body)
  function animalHead(kind, head) {
    head.children.forEach((c) => { c.visible = false; });
    const fur = G.std(kind === 'foxy' ? '#ff8a3c' : '#69c94e'), dark = G.std('#1b1a22'), white = G.std('#ffffff');
    const box = (w, h, d, m, x, y, z) => G.mesh(new T.BoxGeometry(w, h, d), m, x, y, z, head, false);
    box(0.54, 0.48, 0.48, fur, 0, 0, 0);
    for (const s of [-1, 1]) {
      box(0.08, 0.1, 0.03, dark, s * 0.12, 0.06, -0.25);
      box(0.03, 0.03, 0.02, white, s * 0.1, 0.09, -0.27);
      if (kind === 'foxy') {
        const ear = box(0.17, 0.17, 0.07, fur, s * 0.19, 0.27, 0);
        ear.rotation.z = Math.PI / 4;
        box(0.09, 0.09, 0.02, dark, s * 0.19, 0.27, -0.04).rotation.z = Math.PI / 4;
      } else {
        box(0.17, 0.13, 0.17, fur, s * 0.15, 0.27, -0.06);
        box(0.08, 0.08, 0.03, dark, s * 0.15, 0.29, -0.15);
        box(0.035, 0.035, 0.02, white, s * 0.14, 0.31, -0.17);
      }
    }
    if (kind === 'foxy') {
      box(0.24, 0.16, 0.14, G.std('#fff1e0'), 0, -0.1, -0.29);
      box(0.08, 0.06, 0.04, dark, 0, -0.05, -0.37);
      box(0.56, 0.12, 0.5, G.std('#fff1e0'), 0, -0.2, 0);
    } else {
      box(0.36, 0.04, 0.02, G.std('#2a6a1f'), 0, -0.12, -0.245);
      box(0.56, 0.14, 0.5, G.std('#d8f5b0'), 0, -0.19, 0);
    }
  }

  // a surfboard along +x: a long rounded deck with a stripe, a pointy nose and a fin underneath
  function makeBoard(id) {
    const [deck, stripe] = BOARDS[id] || ['#ffffff', '#2f6bff'];
    const g = new T.Group();
    const dm = G.std(deck, { roughness: 0.35 }), sm = G.std(stripe, { roughness: 0.4 });
    G.mesh(new T.BoxGeometry(1.5, 0.09, 0.56), dm, -0.05, 0, 0, g, false);
    const nose = G.mesh(new T.CylinderGeometry(0.28, 0.28, 0.09, 16, 1, false, 0, Math.PI), dm, 0.7, 0, 0, g, false);
    nose.scale.set(1.9, 1, 1);
    nose.rotation.y = Math.PI / 2;
    const tail = G.mesh(new T.CylinderGeometry(0.28, 0.28, 0.09, 12, 1, false, 0, Math.PI), dm, -0.8, 0, 0, g, false);
    tail.scale.set(0.8, 1, 1);
    tail.rotation.y = -Math.PI / 2;
    G.mesh(new T.BoxGeometry(2.1, 0.095, 0.1), sm, 0.05, 0.002, 0, g, false);
    const fin = G.mesh(new T.BoxGeometry(0.24, 0.22, 0.03), sm, -0.78, -0.13, 0, g, false);
    fin.rotation.z = 0.4;
    return g;
  }

  function make(id, o) {
    o = o || {};
    const entry = Kit.roster.get(id);
    const look = LOOKS[id] || entry.look;
    const p = Kit.people.build(Object.assign({}, look, { peace: true }));
    if (LOOKS[id]) animalHead(id, p.head);
    const outer = new T.Group(), spinG = new T.Group(), board = makeBoard(id);
    outer.add(spinG);
    spinG.add(board);
    spinG.add(p.root);
    p.root.position.y = 0.05;
    p.root.rotation.y = Math.PI; // facing the camera, the nose of the board to his left
    let tag = null;
    if (o.tag) {
      tag = G.nameTag(NAMES[id] || id.toUpperCase(), TAGS[id] || '#ffffff');
      tag.position.y = 2.75;
      tag.material.depthTest = false;
      tag.renderOrder = 5;
      outer.add(tag);
    }
    const scale = o.scale || 1;
    outer.scale.setScalar(scale);
    return { id, outer, spinG, board, p, tag, scale, ph: Math.random() * 6, spin: 0, lastA: 0, sprayAcc: 0, wobble: 0, q: new T.Quaternion() };
  }
  function add(m, scene) { scene.add(m.outer); }
  function remove(m, scene) { scene.remove(m.outer); }

  // the surfing stance: knees bent, feet wide on the board, arms out for balance, looking where he's going
  function stance(m, k, carve, crouch) {
    const p = m.p;
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    to(p.hips.rotation, 'x', -0.22 - crouch * 0.25);
    to(p.hips.rotation, 'y', carve * 0.25);
    to(p.legL.rotation, 'x', 0.22 + crouch * 0.25);
    to(p.legR.rotation, 'x', 0.22 + crouch * 0.25);
    to(p.legL.rotation, 'z', -0.34);
    to(p.legR.rotation, 'z', 0.34);
    const sway = Math.sin(m.ph * 1.3) * 0.08;
    to(p.armL.rotation, 'x', 0.25 + sway);
    to(p.armR.rotation, 'x', 0.25 - sway);
    to(p.armL.rotation, 'z', -1.05 - carve * 0.35);
    to(p.armR.rotation, 'z', 1.05 - carve * 0.35);
    to(p.head.rotation, 'y', 0.55); // eyes on the wave ahead
    to(p.head.rotation, 'x', 0.05);
    p.hips.position.y += (p.hipY - 0.12 - crouch * 0.12 + Math.sin(m.ph * 2) * 0.015 - p.hips.position.y) * k;
    for (const f of p.fingers) f.visible = false;
    p.rig.scale.setScalar(1);
  }
  function legsOnBoard(m, k) {
    const p = m.p;
    p.legL.rotation.x += (0.1 - p.legL.rotation.x) * k;
    p.legR.rotation.x += (0.1 - p.legR.rotation.x) * k;
    p.legL.rotation.z += (-0.3 - p.legL.rotation.z) * k;
    p.legR.rotation.z += (0.3 - p.legR.rotation.z) * k;
    p.head.rotation.y *= 1 - k;
  }

  const fr = { p: new T.Vector3(), n: new T.Vector3(), t: new T.Vector3() };
  const fwd = new T.Vector3(), side = new T.Vector3(), up = new T.Vector3(), mat = new T.Matrix4(), qa = new T.Quaternion();
  const WUP = new T.Vector3(0, 1, 0);
  // the board's frame on the face: nose along the heading, flat on the water
  function orient(m, x, u, a, dt, inAir) {
    SURF.world.frame(x, u, fr);
    up.copy(fr.n);
    if (inAir) up.lerp(WUP, 0.6).normalize();
    fwd.set(Math.cos(a), 0, 0).addScaledVector(fr.t, Math.sin(a));
    fwd.addScaledVector(up, -fwd.dot(up)).normalize();
    side.crossVectors(fwd, up);
    mat.makeBasis(fwd, up, side);
    qa.setFromRotationMatrix(mat);
    if (dt === null) m.q.copy(qa); else m.q.slerp(qa, Math.min(1, dt * 14));
    m.outer.quaternion.copy(m.q);
    return fr;
  }

  const tmp = new T.Vector3(), dir = new T.Vector3();
  // put a surfer where the ride says; returns his world position
  function place(m, sk, dt) {
    m.ph += dt * 3;
    const k = 1 - Math.exp(-14 * dt);
    const turn = (sk.a - m.lastA) / Math.max(dt, 1e-3);
    m.lastA = sk.a;
    if (sk.wipeT > 0) {
      // in the water: sitting low, arms up, the board bobbing beside him
      orient(m, sk.rx, sk.ru, 0, dt, false);
      m.outer.position.set(sk.rx, sk.ry - 0.75 + Math.sin(m.ph * 2) * 0.08, -sk.ru * B.F + 0.3);
      Kit.people.pose(m.p, m.ph, 'fall', k);
      m.spinG.rotation.y *= 0.9;
      m.board.rotation.z = Math.sin(m.ph) * 0.3;
      m.board.position.y = 0.6;
      return m.outer.position;
    }
    m.board.rotation.z *= 1 - k;
    m.board.position.y *= 1 - k;
    const air = sk.air && !sk.hop;
    orient(m, sk.rx, sk.ru, sk.a, dt, air);
    m.outer.position.set(sk.rx, sk.ry, -sk.ru * B.F);
    if (air) {
      // a trick: a spin with his own move up in the air
      if (sk.trick) {
        m.spin = (sk.spins + Math.min(1, sk.trick.t / sk.L.trickTime)) * Math.PI * 2;
        const mode = m.id === 'tommy' ? 'peace' : m.id === 'teddy' ? 'jumpshot' : 'jump';
        Kit.people.pose(m.p, m.ph, mode, k);
        legsOnBoard(m, k);
      } else {
        m.spin = sk.spins * Math.PI * 2;
        stance(m, k, 0, 0.6);
        m.p.armL.rotation.z += (-1.6 - m.p.armL.rotation.z) * k;
        m.p.armR.rotation.z += (1.6 - m.p.armR.rotation.z) * k;
      }
      m.spinG.rotation.y = m.spin;
      m.wobble = 0;
    } else {
      m.spinG.rotation.y = 0;
      m.spin = 0;
      const carve = Math.max(-1, Math.min(1, -turn * 0.35));
      stance(m, k, carve, sk.hop ? 0.5 : 0);
      if (sk.weedT > 0) { m.wobble += dt * 18; m.spinG.rotation.z = Math.sin(m.wobble) * 0.18 * (sk.weedT / 0.7); } else m.spinG.rotation.z *= 0.85;
      // spray off the tail when carving hard
      m.sprayAcc += dt * (Math.abs(turn) * 22 + sk.v * 0.4);
      if (m.sprayAcc > 1 && sk.v > 4) {
        const n = Math.min(4, Math.floor(m.sprayAcc));
        m.sprayAcc -= n;
        tmp.set(-0.9, 0.05, 0).applyQuaternion(m.q).multiplyScalar(m.scale).add(m.outer.position);
        dir.set(-1.5, 0.5 + Math.abs(turn) * 0.6, 1.2);
        SURF.world.sprayAt(tmp, dir, n);
      }
    }
    return m.outer.position;
  }

  // standing on his board on the water at (x, u), facing the camera: the brother's visit, the celebrations
  function stand(m, x, u, dt) {
    orient(m, x, u, 0, dt, false);
    m.outer.position.copy(fr.p);
    m.spinG.rotation.y = 0;
    m.spinG.rotation.z *= 0.8;
    return m.outer.position;
  }
  function act(m, mode, dt) {
    m.ph += dt * 3;
    const k = 1 - Math.exp(-12 * dt);
    if (mode === 'surf') { stance(m, k, 0, 0); return; }
    Kit.people.pose(m.p, m.ph * (mode === 'boxing' ? 1.6 : 1.4), mode, k);
    legsOnBoard(m, k); // feet stay on the board
  }

  SURF.surfer = { make, add, remove, place, stand, act, NAMES, TAGS };
})();
