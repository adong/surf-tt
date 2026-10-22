/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button (top left).
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.SURF_TITLE,
  cols: ['Teddy (left)', 'Tommy (right)'],
  keys: [
    ['carve up / down the wave', 'W S', '↑ ↓'],
    ['jump · a trick in the air', 'D or Space', '→ or Enter'],
    ['call your brother · high five', 'T', 'T'],
    ['pick a wave', 'A D', '← →'],
    ['level 🐣 / 🔥', 'W S', '↑ ↓'],
    ['who surfs', '1 2 3', '1 2 3'],
    ['free surf or contest', 'R', 'R'],
    ['surf! · again', 'Enter or Space', 'Enter or Space'],
    ['pause', 'P or Esc', 'P or Esc'],
    ['sound on / off', 'M', 'M'],
  ],
  note: 'Carve up the wave fast and you fly off the top. Press the trick key in the air to spin. Say hi to the dolphins and dodge the seaweed (a jump hops over it). In 1 player both sets of keys work and T calls your brother to lift you onto a better wave; with 2 players, T is a high five.',
  touch: 'Hold ⬆ ⬇ to carve, tap ⭐ to jump and spin. Tap your brother\'s face to call him.',
  button: { top: 'calc(env(safe-area-inset-top, 0px) + 10px)', left: 'max(10px, env(safe-area-inset-left, 0px))' },
});
// The language button goes right under the ? button, and the kit's speaker under that: a column in the top left corner,
// in the sky above the wave, away from the carve and trick buttons at the bottom.
Kit.lang.setup({ button: { top: 'calc(env(safe-area-inset-top, 0px) + 58px)', left: 'max(10px, env(safe-area-inset-left, 0px))' } });
