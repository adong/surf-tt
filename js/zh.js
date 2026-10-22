/* 中文 for TT Surf: the words on the page, the toasts and the ? panel (Kit.lang, from kit/lang.js). Simple words:
   Tommy is 5. 冲浪 (surf), 浪 (wave), 技巧 (trick). The kids' names, Foxy and Froggy, and the game's own name stay in
   English on purpose. */
(function () {
  const L = Kit.lang;
  const title = window.SURF_TITLE;
  const words = title.split(' ');
  L.keep(['TEDDY', 'TOMMY', 'FOXY', 'FROGGY', 'Teddy', 'Tommy', title, words.slice(0, -1).join(' '), words[words.length - 1], 'Esc']);

  L.add({
    // home
    'Pick a wave': '选一个浪', 'Free surf or contest': '自由冲浪还是比赛', 'FREE SURF': '自由冲浪', 'CONTEST': '冲浪比赛',
    'Free surf (R)': '自由冲浪 (R)', 'Contest (R)': '冲浪比赛 (R)', "Who's surfing?": '谁来冲浪？', 'BOTH': '一起冲',
    'Teddy surfs': 'Teddy 冲浪', 'Tommy surfs': 'Tommy 冲浪', 'Teddy and Tommy surf': 'Teddy 和 Tommy 一起冲浪',
    'SUNNY BAY': '阳光海湾', 'DOLPHIN COVE': '海豚湾', 'BIG BLUE': '大蓝浪', 'Surf!': '冲浪！', 'Surf! (Enter)': '冲浪！(回车)',
    // surfing
    'Pause': '暂停', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Call your brother': '叫兄弟来帮忙', 'High five': '击掌', 'Up the wave': '往浪上冲', 'Down the wave': '往浪下滑',
    'Jump and trick': '跳起来做技巧', 'TRICK': '技巧',
    'GO!': '出发！', '🏁 WAVE OVER!': '🏁 这个浪结束啦！',
    'WIPEOUT! SPLASH!': '摔进水里啦！扑通！', 'SEAWEED! WOBBLE!': '海草！晃呀晃！', 'THE FOAM GOT YOU!': '被白浪追上啦！',
    '✋ HIGH FIVE!': '✋ 击掌！',
    // pause, results
    'Keep surfing': '继续冲浪', 'Start again': '重新开始', 'Waves': '选浪', 'Play again': '再玩一次', 'Next wave': '下一个浪',
    'NEW BEST!': '新纪录！',
    // the ? panel (js/keys.js)
    'Teddy (left)': 'Teddy（左边）', 'Tommy (right)': 'Tommy（右边）',
    'carve up / down the wave': '在浪上往上 / 往下滑', 'jump · a trick in the air': '跳 · 在空中做技巧',
    'pick a wave': '选浪', 'level 🐣 / 🔥': '难度 🐣 / 🔥', 'who surfs': '谁来冲浪', 'free surf or contest': '自由冲浪或比赛',
    'surf! · again': '冲浪！· 再来',
    'Carve up the wave fast and you fly off the top. Press the trick key in the air to spin. Say hi to the dolphins and dodge the seaweed (a jump hops over it). In 1 player both sets of keys work and T calls your brother to lift you onto a better wave; with 2 players, T is a high five.':
      '快快往浪顶冲，就能飞起来。在空中按技巧键转圈圈。跟海豚打招呼，躲开海草（跳一下就能跳过去）。一个人玩时两套按键都能用，T 叫兄弟把你举到更好的浪上；两个人玩时，T 是击掌。',
    "Hold ⬆ ⬇ to carve, tap ⭐ to jump and spin. Tap your brother's face to call him.":
      '按住 ⬆ ⬇ 在浪上滑，点 ⭐ 跳起来转圈。点兄弟的头像叫他来。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const SPIN = { 'SPIN!': '转一圈技巧！', 'DOUBLE SPIN!': '转两圈技巧！', 'TRIPLE SPIN!': '转三圈技巧！' };
  const PLACE = (n) => `第${n}名`;
  L.rule(/^(SPIN!|DOUBLE SPIN!|TRIPLE SPIN!) \+(\d+)( ✨)?$/, (m, w, n, g) => `${SPIN[w]}+${n}${g || ''}`);
  L.rule(/^SUPER SPIN ×(\d+)! \+(\d+)( ✨)?$/, (m, k, n, g) => `超级技巧，转${k}圈！+${n}${g || ''}`);
  L.rule(/^AIR! \+(\d+)( ✨)?$/, (m, n, g) => `飞起来啦！+${n}${g || ''}`);
  L.rule(/^CARVE! \+(\d+)( ✨)?$/, (m, n, g) => `漂亮转弯！+${n}${g || ''}`);
  L.rule(/^🐬 HI DOLPHIN! \+(\d+)( ✨)?$/, (m, n, g) => `🐬 海豚你好！+${n}${g || ''}`);
  L.rule(/^(\S+) SAYS: BIGGER WAVE!$/, '$1 说：上大浪啦！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 给你${TREAT[item]}！`);
  L.rule(/^🎉 GREAT RIDE, (\S+)!$/, '🎉 $1 冲得真棒！');
  L.rule(/^🏆 (\S+) WINS!$/, '🏆 $1 赢啦！');
  L.rule(/^(\S+) (\S+) WINS! (\d+)(ST|ND|RD|TH) PLACE, GOOD TRY!$/, (m, e, who, n) => `${e} ${who} 赢啦！你是${PLACE(n)}，加油！`);
  L.rule(/^(TEDDY|TOMMY): BEST (\d+) · 🏆 (\d+)$/, '$1：最高分 $2 · 🏆 $3');
})();
