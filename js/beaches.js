/* TT Surf: the three waves. Each is made from a seed, so it's the same every time: how tall the wave is, how fast it
   peels along the beach, how long a ride lasts, and where the seaweed and the dolphins are.
   Also the wave's shape, shared by the rules (js/surf.js) and the 3D (js/world.js). The wave runs along x and peels
   toward +x; its face rises from the trough (u = 0) to the lip (u = 1), F metres away from the camera. A surfer at
   (x, u) on the face stands at world (x, height(x) * f(u), -u * F). */
(function () {
  'use strict';
  const SURF = (window.SURF = window.SURF || {});
  const F = 7; // trough to lip, across the face (m)

  // a small seeded random number generator (mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // the face: gentle at the bottom, steep at the top
  const f = (u) => 1 - Math.cos((u * Math.PI) / 2);
  const df = (u) => (Math.PI / 2) * Math.sin((u * Math.PI) / 2);

  const DEFS = [
    {
      id: 'sunny', name: 'SUNNY BAY', emoji: '☀️', tile: '#ffd400', H: 2.6, peel: 7.5, time: 45, weeds: 7, dolphins: 4, seed: 11,
      sky: ['#2f9cff', '#c4ecff'], sun: '#fff3c0', sea: '#1fa9cf', deep: '#0b6e9c', face: '#3fd2e6', island: '#4fbf5a',
    },
    {
      id: 'cove', name: 'DOLPHIN COVE', emoji: '🐬', tile: '#5fe3b5', H: 3.3, peel: 8.5, time: 55, weeds: 10, dolphins: 9, seed: 23,
      sky: ['#4a7dff', '#d2f2ff'], sun: '#ffffff', sea: '#16b5b8', deep: '#0b7a86', face: '#45e0cf', island: '#3ea64c',
    },
    {
      id: 'big', name: 'BIG BLUE', emoji: '🌊', tile: '#ff8a1f', H: 4.2, peel: 9.5, time: 65, weeds: 13, dolphins: 6, seed: 37, sunset: true,
      sky: ['#5a3aa8', '#ffb36b'], sun: '#ffd27a', sea: '#1d78b8', deep: '#123f7a', face: '#3fb4dc', island: '#2e5c4a',
    },
  ];

  // seaweed and dolphins along the wave, never on top of each other
  function build(def) {
    const r = rng(def.seed);
    const L = def.peel * def.time + 70;
    const weeds = [], dolphins = [];
    const clear = (x, u) => weeds.concat(dolphins).every((o) => Math.abs(o.x - x) > 7 || Math.abs(o.u - u) * F > 2.6);
    const place = (list, n, u0, u1, extra) => {
      const gap = (L - 50) / n;
      for (let k = 0; k < n; k++) {
        for (let tries = 0; tries < 40; tries++) {
          const x = 40 + gap * (k + 0.15 + r() * 0.7), u = u0 + r() * (u1 - u0);
          if (clear(x, u) || tries === 39) { list.push(Object.assign({ x: +x.toFixed(2), u: +u.toFixed(3) }, extra ? extra(r) : {})); break; }
        }
      }
    };
    place(dolphins, def.dolphins, 0.3, 0.7, (rr) => ({ ph: rr() * 6 }));
    place(weeds, def.weeds, 0.18, 0.86);
    weeds.sort((a, b) => a.x - b.x);
    dolphins.sort((a, b) => a.x - b.x);
    return Object.assign({}, def, { L, weeds, dolphins });
  }

  const list = DEFS.map(build);
  SURF.beaches = { F, f, df, rng, list, get: (id) => list.find((b) => b.id === id) || list[0] };
})();
