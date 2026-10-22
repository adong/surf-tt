/* TT Surf: the 3D world. The sky, the sea and the far islands, the wave itself (rebuilt every frame around the
   camera from the same shape the rules use, js/beaches.js and js/surf.js), its curling lip and white water, the
   seaweed and the dolphins, seagulls, and the spray, foam and sparkles.
   The camera stands on the beach side (+z) and looks out to sea (-z) at the face; the wave peels toward +x. */
(function () {
  'use strict';
  const SURF = (window.SURF = window.SURF || {});
  const T = THREE;
  const G = Kit.gfx;
  const B = SURF.beaches;
  const F = B.F;

  const NX = 132, DX = 1.25; // wave columns along x
  const FRONT = [22, 12, 5]; // the flat water in front of the face (z)
  const NU = 16, NCREST = 6, NBACK = 6;
  const NR = FRONT.length + NU + NCREST + NBACK + 1;
  const NLX = 30, DLX = 0.5, NLR = 12; // the curling lip
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

  let renderer, scene, hemi, sun, far, sky, sunSprite, scenery, ocean, oceanTex;
  let wave, wavePos, waveCol, lip, lipPos, lipCol;
  let spray, foamPts, burstPts, sparkPts;
  let beach = null, ride = null, clock = 0;
  const cols = {};
  const weedViews = [], dolViews = [], gulls = [];

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setScissorTest(true);
    scene = new T.Scene();
    scene.fog = new T.Fog('#cdeeff', 140, 600);
    hemi = new T.HemisphereLight('#eef8ff', '#2a8fb0', 0.8);
    scene.add(hemi);
    sun = new T.DirectionalLight('#fff4dd', 0.75);
    sun.position.set(-40, 70, 90);
    scene.add(sun);
    far = new T.Group();
    scene.add(far);
    scenery = new T.Group();
    scene.add(scenery);
    buildSky();
    buildScenery();
    buildOcean();
    buildWave();
    buildLip();
    buildParticles();
    buildGulls();
  }

  // ---------------------------------------------------------------- sky, sun, clouds (they follow the camera)
  function buildSky() {
    const geo = new T.SphereGeometry(900, 24, 16);
    geo.setAttribute('color', new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    sky = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -2;
    far.add(sky);
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: '#fff3c0', fog: false, depthWrite: false, transparent: true }));
    sunSprite.scale.setScalar(240);
    far.add(sunSprite);
    const cloudTex = (() => {
      const [c, g] = G.makeCanvas(256, 128);
      for (let i = 0; i < 9; i++) {
        const x = 50 + i * 20 + Math.random() * 10, y = 70 + Math.sin(i * 1.7) * 14, rr = 26 + Math.random() * 22;
        const gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 256, 128);
      }
      return G.toTexture(c);
    })();
    for (let i = 0; i < 9; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: 0.9 }));
      s.scale.set(140 + Math.random() * 80, 60 + Math.random() * 20, 1);
      s.position.set(-420 + i * 105 + Math.random() * 40, 120 + Math.random() * 120, -700);
      far.add(s);
    }
  }
  function setSky(top, bottom, sunCol, sunset) {
    const pos = sky.geometry.attributes.position, col = sky.geometry.attributes.color;
    const a = new T.Color(top), b = new T.Color(bottom), c = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 900;
      c.copy(b).lerp(a, Math.max(0, Math.min(1, y * 1.8 + 0.08)));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    scene.fog.color.set(bottom);
    sunSprite.material.color.set(sunCol);
    sunSprite.position.set(sunset ? 140 : -260, sunset ? 40 : 300, -700);
    sun.color.set(sunset ? '#ffd2a0' : '#fff4dd');
    hemi.color.set(sunset ? '#ffd9c2' : '#eef8ff');
  }

  // ---------------------------------------------------------------- far islands with palm trees, a sailboat (slow parallax)
  function buildScenery() {
    const sand = G.std('#f2d58a', { roughness: 1 }), trunk = G.std('#8a5a2b'), leaf = G.std('#2f9e44');
    const islandMat = G.std('#4fbf5a', { roughness: 1 });
    scenery.userData.islandMat = islandMat;
    const spots = [[-260, -460, 70], [40, -520, 110], [330, -480, 60], [620, -540, 90], [-560, -520, 80]];
    for (const [x, z, w] of spots) {
      const g = new T.Group();
      const hill = new T.Mesh(new T.SphereGeometry(1, 16, 10), islandMat);
      hill.scale.set(w, w * 0.32, w * 0.5);
      g.add(hill);
      const beachRing = new T.Mesh(new T.SphereGeometry(1, 16, 8), sand);
      beachRing.scale.set(w * 1.12, w * 0.08, w * 0.6);
      g.add(beachRing);
      for (let k = 0; k < 4; k++) {
        const p = new T.Group();
        const tx = (k - 1.5) * w * 0.35, h = 14 + (k % 2) * 5;
        G.mesh(new T.CylinderGeometry(0.8, 1.2, h, 6), trunk, 0, h / 2, 0, p, false).rotation.z = (k - 1.5) * 0.12;
        for (let q = 0; q < 5; q++) {
          const lf = G.mesh(new T.BoxGeometry(11, 0.6, 2.4), leaf, 0, h, 0, p, false);
          lf.rotation.y = (q / 5) * Math.PI * 2;
          lf.rotation.z = -0.35;
          lf.geometry.translate(5, 0, 0);
        }
        p.position.set(tx, w * 0.22, 0);
        g.add(p);
      }
      g.position.set(x, -2, z);
      scenery.add(g);
    }
    // a little sailboat
    const boat = new T.Group();
    G.mesh(new T.BoxGeometry(14, 2.4, 4), G.std('#ffffff'), 0, 1, 0, boat, false);
    const sail = new T.Mesh(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 2, 0), new T.Vector3(0, 18, 0), new T.Vector3(9, 2, 0)]), new T.MeshBasicMaterial({ color: '#ff6b6b', side: T.DoubleSide }));
    boat.add(sail);
    boat.position.set(200, 0, -360);
    scenery.add(boat);
    scenery.userData.boat = boat;
  }

  // ---------------------------------------------------------------- the open sea (one big plane, ripples drawn on a canvas)
  function buildOcean() {
    const [c, g] = G.makeCanvas(256, 256);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, w = 10 + Math.random() * 30;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(0,40,80,0.10)' : 'rgba(255,255,255,0.6)';
      g.lineWidth = 1.5 + Math.random() * 2;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
      g.stroke();
    }
    oceanTex = G.toTexture(c);
    oceanTex.wrapS = oceanTex.wrapT = T.RepeatWrapping;
    oceanTex.repeat.set(160, 160);
    ocean = new T.Mesh(new T.PlaneGeometry(2400, 2400), new T.MeshStandardMaterial({ color: '#1fa9cf', map: oceanTex, roughness: 0.62, metalness: 0 }));
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.08;
    scene.add(ocean);
  }

  // ---------------------------------------------------------------- the wave
  function streakTexture() {
    const [c, g] = G.makeCanvas(256, 256);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, w = 20 + Math.random() * 70;
      g.strokeStyle = Math.random() < 0.6 ? 'rgba(0,50,90,0.08)' : 'rgba(255,255,255,0.9)';
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y + (Math.random() - 0.5) * 6);
      g.stroke();
    }
    const t = G.toTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  function gridIndex(nx, nr) {
    const idx = [];
    for (let i = 0; i < nx - 1; i++) {
      for (let j = 0; j < nr - 1; j++) {
        const a = i * nr + j, b = (i + 1) * nr + j, c = (i + 1) * nr + j + 1, d = i * nr + j + 1;
        idx.push(a, d, b, b, d, c);
      }
    }
    return idx;
  }
  function buildWave() {
    const geo = new T.BufferGeometry();
    wavePos = new Float32Array(NX * NR * 3);
    waveCol = new Float32Array(NX * NR * 3);
    const uv = new Float32Array(NX * NR * 2);
    geo.setAttribute('position', new T.BufferAttribute(wavePos, 3));
    geo.setAttribute('color', new T.BufferAttribute(waveCol, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setIndex(gridIndex(NX, NR));
    const tex = streakTexture();
    wave = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.62, metalness: 0, side: T.DoubleSide }));
    wave.frustumCulled = false;
    scene.add(wave);
  }
  function buildLip() {
    const geo = new T.BufferGeometry();
    lipPos = new Float32Array(NLX * NLR * 3);
    lipCol = new Float32Array(NLX * NLR * 3);
    geo.setAttribute('position', new T.BufferAttribute(lipPos, 3));
    geo.setAttribute('color', new T.BufferAttribute(lipCol, 3));
    geo.setIndex(gridIndex(NLX, NLR));
    lip = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.05, side: T.DoubleSide, transparent: true, opacity: 0.9 }));
    lip.frustumCulled = false;
    scene.add(lip);
  }

  // how much the lip throws over at distance d from the curl (0 = an open face, 1 = a full curl)
  function curlAmt(d) {
    if (d < -6) return 0;
    if (d < -1) return smooth((d + 6) / 5);
    if (d < 1.5) return 1;
    return 1 - smooth((d - 1.5) / 4.5);
  }

  const cTmp = new T.Color(), cTmp2 = new T.Color();
  function setCol(arr, k, c) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b; }

  function updateWave(camX) {
    if (!ride) return;
    const x0 = Math.floor((camX - 62) / DX) * DX;
    const uv = wave.geometry.attributes.uv.array;
    const gold = cols.gold;
    for (let i = 0; i < NX; i++) {
      const x = x0 + i * DX;
      const H = ride.height(x), d = x - ride.curl;
      const broken = smooth((0.5 - d) / 5); // white water behind the curl
      let goldAmt = 0;
      for (const b of ride.bumps) { const q = (x - b.x) / 9; goldAmt += b.amp * Math.exp(-q * q); }
      goldAmt = Math.min(1, goldAmt);
      let k = i * NR;
      // the white water bubbles up (never down, or the sea underneath would show through near the trough)
      const churn = (j) => broken * 0.24 * Math.min(1, j / 3) * (1 + 0.5 * (Math.sin(x * 1.7 + clock * 6 + j * 1.3) + Math.sin(x * 0.63 - clock * 4.1 + j * 0.7))) * 0.5;
      // front water
      for (let j = 0; j < FRONT.length; j++, k++) {
        const z = FRONT[j];
        wavePos[k * 3] = x; wavePos[k * 3 + 1] = -0.05; wavePos[k * 3 + 2] = z;
        cTmp.copy(cols.sea);
        if (j === FRONT.length - 1) cTmp.lerp(cols.white, broken * 0.35);
        setCol(waveCol, k, cTmp);
        uv[k * 2] = x / 14; uv[k * 2 + 1] = z / 14;
      }
      // the face: exactly where the rules put the surfers
      for (let j = 0; j < NU; j++, k++) {
        const u = j / (NU - 1);
        const y = H * B.f(u) + (j > 0 ? churn(j) : 0);
        wavePos[k * 3] = x; wavePos[k * 3 + 1] = y; wavePos[k * 3 + 2] = -u * F;
        if (u < 0.55) cTmp.copy(cols.trough).lerp(cols.face, u / 0.55);
        else cTmp.copy(cols.face).lerp(cols.light, (u - 0.55) / 0.45);
        if (u < 0.08) cTmp.lerp(cols.white, 0.3 * (1 - u / 0.08));
        cTmp.lerp(cols.white, broken * (0.3 + 0.35 * u + 0.2 * Math.sin(x * 0.9 + j + clock * 3)));
        if (goldAmt > 0) cTmp.lerp(gold, goldAmt * 0.22 * (0.5 + u));
        setCol(waveCol, k, cTmp);
        uv[k * 2] = x / 10; uv[k * 2 + 1] = u * 1.5 - clock * 0.15;
      }
      // the crest, rolling over toward the back
      let z = -F, y = H;
      const sl = (H * B.df(1)) / F;
      const p0 = Math.atan2(-1, sl), p1 = -2.3, seg = 0.11 * H + 0.12;
      for (let j = 0; j < NCREST; j++, k++) {
        const ps = p0 + ((p1 - p0) * (j + 0.5)) / NCREST;
        z += Math.sin(ps) * seg;
        y += Math.cos(ps) * seg;
        wavePos[k * 3] = x; wavePos[k * 3 + 1] = y + churn(j + NU); wavePos[k * 3 + 2] = z;
        cTmp.copy(cols.light).lerp(cols.white, 0.35 + (j < 2 ? 0.25 : 0)).lerp(cols.deep, j / NCREST * 0.5);
        cTmp.lerp(cols.white, broken * 0.6);
        if (goldAmt > 0) cTmp.lerp(gold, goldAmt * 0.3);
        setCol(waveCol, k, cTmp);
        uv[k * 2] = x / 10; uv[k * 2 + 1] = 1.6 + j * 0.1;
      }
      // the back of the wave, down to the sea
      const zc = z, yc = y;
      for (let j = 1; j <= NBACK; j++, k++) {
        const t = j / NBACK;
        wavePos[k * 3] = x; wavePos[k * 3 + 1] = (yc + 0.05) * (1 - smooth(t)) - 0.05; wavePos[k * 3 + 2] = zc - t * 16;
        cTmp.copy(cols.deep).lerp(cols.sea, t);
        setCol(waveCol, k, cTmp);
        uv[k * 2] = x / 10; uv[k * 2 + 1] = 2.4 + t;
      }
      wavePos[k * 3] = x; wavePos[k * 3 + 1] = -0.05; wavePos[k * 3 + 2] = zc - 70;
      setCol(waveCol, k, cols.sea);
      uv[k * 2] = x / 10; uv[k * 2 + 1] = 4;
    }
    const geo = wave.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
    geo.computeVertexNormals();
    updateLip();
  }

  function updateLip() {
    const xs = ride.curl - 7;
    let any = false;
    for (let i = 0; i < NLX; i++) {
      const x = xs + i * DLX, d = x - ride.curl, H = ride.height(x);
      const c = curlAmt(d);
      if (c > 0.01) any = true;
      const sl = (H * B.df(1)) / F;
      const p0 = Math.atan2(-1, sl), turn = c * (Math.PI + 0.9), len = c * 1.15 * H;
      let z = -F, y = H, k = i * NLR;
      for (let j = 0; j < NLR; j++, k++) {
        if (j > 0) {
          const ps = p0 + (turn * (j - 0.5)) / (NLR - 1);
          z += (Math.sin(ps) * len) / (NLR - 1);
          y += (Math.cos(ps) * len) / (NLR - 1);
        }
        lipPos[k * 3] = x; lipPos[k * 3 + 1] = y; lipPos[k * 3 + 2] = z;
        cTmp.copy(cols.light).lerp(cols.white, 0.25 + 0.75 * (j / (NLR - 1)) * (0.4 + 0.6 * smooth((1 - d) / 4)));
        setCol(lipCol, k, cTmp);
      }
    }
    lip.visible = any;
    const geo = lip.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // ---------------------------------------------------------------- seaweed and dolphins
  function makeWeed() {
    const g = new T.Group();
    const greens = ['#2e9e3e', '#55c95c', '#7aa82a', '#3d8a2a', '#8fd14f'];
    const strands = [];
    for (let k = 0; k < 6; k++) {
      const h = 0.7 + Math.random() * 0.6;
      const geo = new T.BoxGeometry(0.16, h, 0.05);
      geo.translate(0, h / 2, 0);
      const m = new T.Mesh(geo, G.std(greens[k % greens.length], { roughness: 0.8 }));
      const a = (k / 6) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
      m.rotation.y = a;
      m.userData.ph = Math.random() * 6;
      g.add(m);
      strands.push(m);
    }
    G.mesh(new T.SphereGeometry(0.2, 8, 6), G.std('#8a6d2a'), 0, 0.08, 0, g, false).scale.y = 0.6;
    g.scale.setScalar(1.5);
    g.userData.strands = strands;
    return g;
  }
  function makeDolphin() {
    const g = new T.Group(), body = new T.Group();
    g.add(body);
    const skin = G.std('#7fa6c9', { roughness: 0.35, metalness: 0.1 }), belly = G.std('#e6f2ff'), dark = G.std('#1b1a22');
    const box = (w, h, d, m, x, y, z, parent) => G.mesh(new T.BoxGeometry(w, h, d), m, x, y, z, parent || body, false);
    box(1.5, 0.52, 0.56, skin, 0, 0, 0);
    box(0.5, 0.4, 0.44, skin, 0.95, -0.02, 0);
    box(1.3, 0.18, 0.46, belly, 0.1, -0.2, 0);
    box(0.36, 0.14, 0.2, skin, 1.36, -0.1, 0); // beak
    box(0.4, 0.38, 0.4, skin, -0.9, 0.04, 0);
    box(0.4, 0.26, 0.3, skin, -1.25, 0.08, 0);
    const fin = box(0.42, 0.42, 0.08, skin, -0.1, 0.38, 0);
    fin.rotation.z = -0.55;
    for (const s of [-1, 1]) {
      box(0.07, 0.08, 0.02, dark, 1.0, 0.07, s * 0.225);
      const fl = box(0.36, 0.06, 0.26, skin, 0.4, -0.25, s * 0.36);
      fl.rotation.x = s * 0.4;
      const tail = box(0.24, 0.06, 0.42, skin, -1.5, 0.1, s * 0.2);
      tail.rotation.y = s * 0.5;
    }
    // a smile
    box(0.24, 0.03, 0.42, dark, 1.25, -0.16, 0);
    const heart = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture('💙'), transparent: true, depthWrite: false }));
    heart.scale.setScalar(0.9);
    heart.position.y = 1.4;
    heart.visible = false;
    g.add(heart);
    g.userData = { body, heart };
    return g;
  }

  function setBeach(b) {
    beach = b;
    cols.sea = new T.Color(b.sea);
    cols.deep = new T.Color(b.deep);
    cols.face = new T.Color(b.face);
    cols.light = new T.Color(G.shade(b.face, 0.28));
    cols.trough = new T.Color(b.sea).lerp(cols.deep, 0.3);
    cols.white = new T.Color('#f4fbff');
    cols.gold = new T.Color('#ffe066');
    setSky(b.sky[0], b.sky[1], b.sun, !!b.sunset);
    ocean.material.color.set(b.sea);
    scenery.userData.islandMat.color.set(b.island);
    for (const v of weedViews) scene.remove(v.g);
    for (const v of dolViews) scene.remove(v.g);
    weedViews.length = dolViews.length = 0;
    for (const w of b.weeds) {
      const g = makeWeed();
      scene.add(g);
      weedViews.push({ g, o: w, hitT: 0 });
    }
    for (const o of b.dolphins) {
      const g = makeDolphin();
      scene.add(g);
      dolViews.push({ g, o, hiT: 0, lastH: -1 });
    }
  }
  function setRide(r) { ride = r; for (const v of weedViews) v.hitT = 0; for (const v of dolViews) v.hiT = 0; }

  // where (x, u) is on the face, its normal and the way up the face
  const UP = new T.Vector3(0, 1, 0);
  function frame(x, u, out) {
    out = out || { p: new T.Vector3(), n: new T.Vector3(), t: new T.Vector3() };
    const H = ride ? ride.height(x) : beach.H;
    const sl = (H * B.df(u)) / F, k = Math.sqrt(1 + sl * sl);
    out.p.set(x, H * B.f(u), -u * F);
    out.n.set(0, 1 / k, sl / k);
    out.t.set(0, sl / k, -1 / k);
    return out;
  }
  const fr = { p: new T.Vector3(), n: new T.Vector3(), t: new T.Vector3() };
  const qTmp = new T.Quaternion();

  function updateThings(dt, camX) {
    for (const v of weedViews) {
      const near = Math.abs(v.o.x - camX) < 90;
      v.g.visible = near;
      if (!near) continue;
      frame(v.o.x, v.o.u, fr);
      v.g.position.copy(fr.p).addScaledVector(fr.n, 0.02);
      v.g.quaternion.setFromUnitVectors(UP, fr.n);
      v.hitT = Math.max(0, v.hitT - dt);
      const amp = 0.25 + v.hitT * 0.9;
      for (const s of v.g.userData.strands) {
        s.rotation.z = Math.sin(clock * 2.6 + s.userData.ph) * amp;
        s.rotation.x = Math.cos(clock * 2.1 + s.userData.ph) * amp * 0.6;
      }
    }
    for (const v of dolViews) {
      const near = Math.abs(v.o.x - camX) < 90;
      v.g.visible = near;
      if (!near) continue;
      const x = v.o.x + Math.sin(clock * 0.55 + v.o.ph) * 1.2;
      frame(x, v.o.u, fr);
      // porpoising: an arc out of the face every few seconds; a big happy leap when someone says hi
      v.hiT = Math.max(0, v.hiT - dt);
      let h, pitch, roll = 0;
      if (v.hiT > 0) {
        const s = 1 - v.hiT / 1.4;
        h = Math.sin(s * Math.PI) * 3 - 0.3;
        pitch = Math.cos(s * Math.PI) * 0.9;
        roll = s * Math.PI * 2;
      } else {
        const per = 2.8, q = (((clock + v.o.ph * 0.7) % per) + per) % per / per;
        if (q < 0.5) { const s = q / 0.5; h = Math.sin(s * Math.PI) * 1.25 - 0.45; pitch = Math.cos(s * Math.PI) * 0.8; }
        else { h = -1.2; pitch = 0; }
      }
      v.g.position.copy(fr.p).addScaledVector(fr.n, h);
      v.g.quaternion.setFromUnitVectors(UP, fr.n);
      v.g.userData.body.rotation.set(roll, 0, pitch);
      v.g.userData.heart.visible = v.hiT > 0;
      if (v.hiT > 0) v.g.userData.heart.position.y = 1.4 + (1.4 - v.hiT) * 0.8;
      if ((v.lastH < 0) !== (h < 0) && Math.abs(v.o.x - camX) < 40) splash(fr.p.clone().addScaledVector(fr.n, 0.1), 8, '#ffffff');
      v.lastH = h;
    }
  }
  function dolphinHi(j) { const v = dolViews[j]; if (v) v.hiT = 1.4; }
  function weedHit(j) {
    const v = weedViews[j];
    if (!v) return;
    v.hitT = 1;
    burst(v.g.position.clone().add(new T.Vector3(0, 0.5, 0.2)), '#4caf50', 14, 2.5, 3);
  }

  // ---------------------------------------------------------------- seagulls
  function buildGulls() {
    const white = G.std('#ffffff'), grey = G.std('#9aa7b5');
    for (let i = 0; i < 5; i++) {
      const g = new T.Group();
      G.mesh(new T.BoxGeometry(0.9, 0.22, 0.22), white, 0, 0, 0, g, false);
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new T.Group();
        G.mesh(new T.BoxGeometry(0.3, 0.05, 1.1), grey, 0, 0, s * 0.55, w, false);
        g.add(w);
        wings.push(w);
      }
      g.userData = { wings, ph: Math.random() * 6, r: 6 + Math.random() * 10, y: 12 + Math.random() * 8, dz: -6 - Math.random() * 20, sp: 0.2 + Math.random() * 0.25 };
      scene.add(g);
      gulls.push(g);
    }
  }
  function updateGulls(camX) {
    gulls.forEach((g, i) => {
      const u = g.userData, a = clock * u.sp + u.ph;
      g.position.set(camX + (i - 2) * 14 + Math.cos(a) * u.r, u.y + Math.sin(clock * 0.7 + i) * 1.2, u.dz + Math.sin(a) * u.r * 0.4);
      g.rotation.y = -a - Math.PI / 2;
      const flap = Math.sin(clock * 7 + u.ph) * 0.5;
      u.wings[0].rotation.x = flap;
      u.wings[1].rotation.x = -flap;
    });
  }

  // ---------------------------------------------------------------- particles: spray, foam, bursts, sparkles
  function buildParticles() {
    const make = (n, size) => {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ map: G.dotTexture(), size, transparent: true, depthWrite: false, vertexColors: true }));
      pts.frustumCulled = false;
      pts.userData = { parts: [], n };
      scene.add(pts);
      return pts;
    };
    spray = make(700, 0.3);
    foamPts = make(700, 0.75);
    burstPts = make(400, 0.42);
    sparkPts = make(300, 0.35);
  }
  function emit(pts, p, vx, vy, vz, life, color) {
    const parts = pts.userData.parts;
    if (parts.length >= pts.userData.n) parts.shift();
    parts.push({ x: p.x, y: p.y, z: p.z, vx, vy, vz, life, max: life, c: color });
  }
  const WHITE = new T.Color('#ffffff');
  const colorCache = {};
  const colorOf = (c) => colorCache[c] || (colorCache[c] = new T.Color(c));
  // spray off the board's tail (dir: which way it flies)
  function sprayAt(p, dir, n) {
    for (let i = 0; i < n; i++) emit(spray, p, dir.x * (1 + Math.random()) + (Math.random() - 0.5), 1.2 + Math.random() * 2.4 + dir.y, dir.z * (1 + Math.random()) + (Math.random() - 0.5), 0.45 + Math.random() * 0.4, WHITE);
  }
  function splash(p, n, color) {
    const c = colorOf(color || '#ffffff');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.5;
      emit(spray, p, Math.cos(a) * s, 2 + Math.random() * 3.5, Math.sin(a) * s, 0.6 + Math.random() * 0.5, c);
    }
  }
  function burst(p, color, n, speed, up) {
    const c = colorOf(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      emit(burstPts, p, Math.cos(a) * speed * Math.random(), up * (0.5 + Math.random()), Math.sin(a) * speed * Math.random(), 0.6 + Math.random() * 0.5, c);
    }
  }
  function sparkle(p, n, spread) {
    const c = colorOf('#ffe680');
    for (let i = 0; i < n; i++) {
      emit(sparkPts, { x: p.x + (Math.random() - 0.5) * spread, y: p.y + Math.random() * 1.5, z: p.z + (Math.random() - 0.5) * 2 }, (Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.6, c);
    }
  }
  function updateParts(pts, dt, grav) {
    const parts = pts.userData.parts, pos = pts.geometry.attributes.position, col = pts.geometry.attributes.color;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy -= grav * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    }
    for (let i = 0; i < pts.userData.n; i++) {
      const q = parts[i];
      if (q) {
        pos.setXYZ(i, q.x, q.y, q.z);
        const f = Math.min(1, (q.life / q.max) * 2);
        col.setXYZ(i, q.c.r * f + (1 - f), q.c.g * f + (1 - f), q.c.b * f + (1 - f));
      } else pos.setXYZ(i, 0, -1e5, 0);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  // the curl throws foam and mist; the white water behind it churns
  let foamAcc = 0;
  const fp = new T.Vector3();
  function curlFoam(dt, camX) {
    if (!ride || ride.time < 0) return;
    foamAcc += dt * 70;
    const H = beach.H;
    while (foamAcc > 1) {
      foamAcc -= 1;
      const near = Math.random() < 0.45;
      const x = near ? ride.curl - 1.5 + Math.random() * 2.5 : ride.curl - 2 - Math.random() * 40;
      if (Math.abs(x - camX) > 70) continue;
      const u = near ? Math.random() * 0.4 : Math.random();
      fp.set(x, ride.height(x) * B.f(u) + 0.2, -u * F + 0.4);
      emit(foamPts, fp, (Math.random() - 0.3) * 2, (near ? 2 + Math.random() * H : 0.6 + Math.random() * 1.2), 1 + Math.random() * 2, 0.7 + Math.random() * 0.6, WHITE);
    }
  }

  // ---------------------------------------------------------------- each frame
  function update(dt, camX) {
    clock += dt;
    oceanTex.offset.y = (oceanTex.offset.y + dt * 0.006) % 1;
    ocean.position.x = Math.round(camX / 15) * 15;
    scenery.position.x = camX * 0.92;
    const boat = scenery.userData.boat;
    boat.position.x = 200 + Math.sin(clock * 0.05) * 60;
    boat.rotation.z = Math.sin(clock * 1.1) * 0.04;
    updateWave(camX);
    updateThings(dt, camX);
    updateGulls(camX);
    if (dt > 0) curlFoam(dt, camX);
    // the better wave sparkles
    if (ride && dt > 0) {
      for (const b of ride.bumps) {
        if (b.amp > 0.2 && Math.random() < b.amp * 0.9) {
          const x = b.x + (Math.random() - 0.5) * 14, u = 0.4 + Math.random() * 0.6;
          sparkle(fp.set(x, ride.height(x) * B.f(u), -u * F + 0.2), 1, 0.5);
        }
      }
    }
    updateParts(spray, dt, 9);
    updateParts(foamPts, dt, 4);
    updateParts(burstPts, dt, 6);
    updateParts(sparkPts, dt, -0.6);
  }

  function render(views) {
    const W = renderer.domElement.clientWidth, Hh = renderer.domElement.clientHeight;
    renderer.setSize(W, Hh, false);
    for (const v of views) {
      const x = Math.round(v.x * W), y = Math.round(v.y * Hh), w = Math.round(v.w * W), h = Math.round(v.h * Hh);
      renderer.setViewport(x, Hh - y - h, w, h);
      renderer.setScissor(x, Hh - y - h, w, h);
      // a camera with a view offset (js/game.js frames the part of the screen the menus leave free) keeps its own aspect
      if (!(v.cam.view && v.cam.view.enabled)) { v.cam.aspect = w / Math.max(1, h); v.cam.updateProjectionMatrix(); }
      far.position.copy(v.cam.position);
      renderer.render(scene, v.cam);
    }
  }

  SURF.world = {
    init, setBeach, setRide, update, render, frame, sprayAt, splash, burst, sparkle, dolphinHi, weedHit,
    scene: () => scene, renderer: () => renderer, beach: () => beach,
  };
})();
