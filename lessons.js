// チェスのレッスンのデータと判定（描画に依存しない。main.js と lessons.test.mjs が使う）。
// 手は UCI（e2e4）。比べるのは from と to だけ。id は保存に使うので、あとで変えない。
//
// task.goal:
//   eat        黒の駒を全部取る（limit 手以内）。黒は動かない
//   steps      steps の各段で、白の手が ok のどれか、または goal を満たす。段の reply があれば黒がその手を指す
//   mate / check / stalemate   steps: [{ goal }] の短い書き方
//   quiz       choices のうち answer（0 始まり）を押す
// task.sol は見本の正解（テスト用。画面には出さない）。pre は問題の最初に黒が指す手、only は動かせる駒の種類。
import { apply, inCheck, status, toUci } from './chess.js';

export const CHAPTERS = [
  '駒と動き', '取る・チェック・メイト', '特別な手', '引き分けと駒の価値', '基本のメイト', '序盤', '戦術',
];

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const LESSONS = [
  {
    id: 'board', ch: 1, title: '盤と駒',
    text: 'チェスは 8×8 の盤で、白と黒が 1 手ずつ交代で指します。駒は 6 種類。相手のキングをつかまえたら勝ちです。',
    tasks: [
      { q: '先に指すのは？', fen: START, goal: 'quiz', choices: ['白', '黒'], answer: 0 },
      { q: '盤の右下の升の色は？', fen: START, goal: 'quiz', choices: ['明るい色', '暗い色'], answer: 0,
        hint: '盤は右下が明るい升になるように置く。', hintSq: ['h1'] },
      { q: '白のクイーンはどの升に置く？', fen: START, goal: 'quiz', choices: ['自分と同じ色（明るい）の升', '暗い升'], answer: 0,
        hint: 'クイーンは自分の色の升に。', hintSq: ['d1'] },
    ],
  },
  {
    id: 'rook', ch: 1, title: 'ルーク',
    text: 'ルークは、たて・よこにまっすぐ、どこまでも進めます。ほかの駒は飛びこえられません。',
    tasks: [
      { q: 'ルークで黒のポーンを全部取ろう（2 手以内）', fen: '8/8/8/p3p3/8/8/8/R7 w - - 0 1', goal: 'eat', limit: 2,
        hint: 'まず上にまっすぐ進もう', hintSq: ['a5'], sol: ['a1a5', 'a5e5'] },
      { q: 'ルークで黒のポーンを全部取ろう（3 手以内）', fen: '8/p6p/8/8/8/8/7p/R7 w - - 0 1', goal: 'eat', limit: 3,
        hint: '角をぐるっと回ろう', hintSq: ['a7'], sol: ['a1a7', 'a7h7', 'h7h2'] },
    ],
  },
  {
    id: 'bishop', ch: 1, title: 'ビショップ',
    text: 'ビショップは、ななめにどこまでも進めます。だから、ずっと同じ色の升の上にいます。',
    tasks: [
      { q: 'ビショップで黒のポーンを全部取ろう（2 手以内）', fen: '8/8/7p/8/5p2/8/8/2B5 w - - 0 1', goal: 'eat', limit: 2,
        hint: 'まず f4 のポーンをななめに取ろう', hintSq: ['f4'], sol: ['c1f4', 'f4h6'] },
      { q: 'ビショップで黒のポーンを全部取ろう（3 手以内）', fen: '8/3p4/8/1p6/8/7p/8/5B2 w - - 0 1', goal: 'eat', limit: 3,
        hint: 'ポーンは全部、ビショップと同じ色の升にいる', hintSq: ['b5'], sol: ['f1b5', 'b5d7', 'd7h3'] },
    ],
  },
  {
    id: 'queen', ch: 1, title: 'クイーン',
    text: 'クイーンは、ルークとビショップを合わせた動き。たて・よこ・ななめにどこまでも進める、いちばん強い駒です。',
    tasks: [
      { q: 'クイーンで黒のポーンを全部取ろう（4 手以内）', fen: '8/3p3p/8/8/p7/7p/8/3Q4 w - - 0 1', goal: 'eat', limit: 4,
        hint: 'ななめ → ななめ → よこ → たて', hintSq: ['a4'], sol: ['d1a4', 'a4d7', 'd7h7', 'h7h3'] },
    ],
  },
  {
    id: 'king', ch: 1, title: 'キング',
    text: 'キングは、まわりの 1 升ならどの向きにも進めます。いちばん大事な駒で、取られそうになったら負けです。',
    tasks: [
      { q: 'キングで黒のポーンを全部取ろう（3 手以内）', fen: '8/8/8/8/6p1/6p1/5p2/4K3 w - - 0 1', goal: 'eat', limit: 3,
        hint: 'ななめ前の f2 から', hintSq: ['f2'], sol: ['e1f2', 'f2g3', 'g3g4'] },
    ],
  },
  {
    id: 'knight', ch: 1, title: 'ナイト',
    text: 'ナイトは「2 升まっすぐ＋1 升よこ」の L 字に跳びます。ほかの駒を飛びこえられるのはナイトだけです。',
    tasks: [
      { q: 'ナイトで黒のポーンを全部取ろう（3 手以内）', fen: '8/8/5p2/3p4/8/2p5/8/1N6 w - - 0 1', goal: 'eat', limit: 3,
        hint: 'まず c3 のポーンへ', hintSq: ['c3'], sol: ['b1c3', 'c3d5', 'd5f6'] },
      { q: 'ナイトで黒のポーンを全部取ろう（3 手以内）', fen: '8/8/4p3/6p1/8/7p/4PPPP/6N1 w - - 0 1', goal: 'eat', limit: 3, only: ['n'],
        hint: '自分のポーンを飛びこえて行ける', hintSq: ['h3'], sol: ['g1h3', 'h3g5', 'g5e6'] },
    ],
  },
  {
    id: 'pawn', ch: 1, title: 'ポーン',
    text: 'ポーンは前に 1 升ずつ。最初の 1 回だけ 2 升進めます。駒を取るときだけ、ななめ前に進みます。後ろには戻れません。',
    tasks: [
      { q: 'ポーンで黒のポーンを全部取ろう（3 手以内）', fen: '8/8/2p5/3p4/8/8/4P3/8 w - - 0 1', goal: 'eat', limit: 3,
        hint: '最初は 2 升進めよう', hintSq: ['e4'], sol: ['e2e4', 'e4d5', 'd5c6'] },
      { q: 'ポーンで取れる駒を取ろう', fen: '4k3/8/8/3pp3/4P3/8/8/4K3 w - - 0 1', goal: 'steps',
        steps: [{ ok: ['e4d5'] }], hint: 'まっすぐ前の駒は取れない', hintSq: ['d5'], sol: ['e4d5'] },
    ],
  },
  {
    id: 'capture', ch: 2, title: '取る',
    text: '相手の駒がいる升に進むと、その駒を取れます。でも、取ったあとに取り返されることもあります。',
    tasks: [
      { q: '取り返されない駒を取ろう', fen: '8/8/4p3/3n4/8/8/8/3R3b w - - 0 1', goal: 'steps',
        steps: [{ ok: ['d1h1'], bad: { d1d5: 'ナイトはポーンに守られている。取り返されてしまう' } }],
        hint: '守られていない駒はどれ？', hintSq: ['h1'], sol: ['d1h1'] },
    ],
  },
  {
    id: 'check', ch: 2, title: 'チェック',
    text: '次にキングを取れる形を「チェック」と言います。チェックされた側は、必ずそれをよけなければいけません。',
    tasks: [
      { q: '黒のキングにチェックしよう', fen: '4k3/3pp3/8/8/8/8/8/R5K1 w - - 0 1', goal: 'check', sol: ['a1a8'],
        hint: 'ルークでいちばん上の段へ', hintSq: ['a8'] },
      { q: '黒のキングにチェックしよう', fen: '4k3/4pp2/8/8/8/8/8/4KB2 w - - 0 1', goal: 'check', sol: ['f1b5'],
        hint: 'ななめの道があいている', hintSq: ['b5'] },
    ],
  },
  {
    id: 'escape', ch: 2, title: 'チェックをよける',
    text: 'チェックをよける方法は 3 つ。キングが逃げる、チェックしている駒を取る、あいだに駒を置く。',
    tasks: [
      { q: 'チェックをよけよう（キングが逃げる）', fen: 'k3r3/8/8/8/8/8/8/4K3 w - - 0 1', goal: 'steps',
        steps: [{ ok: ['e1d1', 'e1d2', 'e1f1', 'e1f2'] }],
        hint: 'ルークの通り道（たて 1 列）から出よう', hintSq: ['d1', 'f1'], sol: ['e1d1'] },
      { q: 'チェックをよけよう（チェックしている駒を取る）', fen: '6k1/5ppp/8/8/8/8/5PPP/R3r1K1 w - - 0 1', goal: 'steps',
        steps: [{ ok: ['a1e1'] }], hint: 'ルークでルークを取ろう', hintSq: ['e1'], sol: ['a1e1'] },
      { q: 'チェックをよけよう（あいだに駒を置く）', fen: 'k3r3/8/8/8/8/8/3P1P2/3QKB2 w - - 0 1', goal: 'steps',
        steps: [{ ok: ['f1e2', 'd1e2'] }], hint: 'キングのすぐ前の升', hintSq: ['e2'], sol: ['f1e2'] },
    ],
  },
  {
    id: 'mate', ch: 2, title: 'チェックメイト',
    text: 'チェックをどうやってもよけられない形が「チェックメイト」。メイトしたら勝ちです。',
    tasks: [
      { q: 'メイトしよう', fen: '4k3/3ppp2/8/8/8/8/8/R5K1 w - - 0 1', goal: 'mate', sol: ['a1a8'],
        hint: '黒のキングは自分のポーンで前に出られない', hintSq: ['a8'] },
      { q: 'メイトしよう', fen: '7k/8/6K1/8/8/8/8/3Q4 w - - 0 1', goal: 'mate', sol: ['d1d8'],
        hint: '黒のキングが逃げられる升は、いちばん上の段だけ', hintSq: ['d8'] },
    ],
  },
  {
    id: 'castle', ch: 3, title: 'キャスリング',
    text: 'キングとルークが一度も動いていなければ、キングを横に 2 升動かし、ルークをキングの反対側に置けます。キングを守る手です。チェックされているとき、通り道をねらわれているときはできません。',
    tasks: [
      { q: 'キャスリングしよう', fen: '4k3/8/8/8/8/8/5PPP/4K2R w K - 0 1', goal: 'steps',
        steps: [{ ok: ['e1g1'] }], hint: 'キングをタップすると、2 升となりが光る', hintSq: ['g1'], sol: ['e1g1'] },
      { q: 'キャスリングできるのはどっち側？ やってみよう', fen: '4k3/8/8/8/2b5/8/PPP2PPP/R3K2R w KQ - 0 1', goal: 'steps',
        steps: [{ ok: ['e1c1'] }], hint: '黒のビショップのななめの道を見よう', hintSq: ['f1'], sol: ['e1c1'] },
    ],
  },
  {
    id: 'enpassant', ch: 3, title: 'アンパッサン',
    text: '相手のポーンが 2 升進んで自分のポーンの真横に来たら、すぐ次の手だけ、ななめ前に進んでそのポーンを取れます。',
    tasks: [
      { q: 'アンパッサンで取ろう', fen: '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1', pre: 'd7d5', goal: 'steps',
        steps: [{ ok: ['e5d6'] }], hint: '黒のポーンが 1 升だけ進んだつもりで取る', hintSq: ['d6'], sol: ['e5d6'] },
    ],
  },
  {
    id: 'promote', ch: 3, title: 'プロモーション',
    text: 'ポーンがいちばん奥の段まで行くと、ほかの駒に変身できます。このアプリでは、いちばん強いクイーンになります。',
    tasks: [
      { q: 'ポーンを進めて、黒のポーンを取ろう（3 手以内）', fen: '8/8/1P6/8/8/8/7p/8 w - - 0 1', goal: 'eat', limit: 3,
        hint: 'クイーンになったら、ななめに長く進める', hintSq: ['b8'], sol: ['b6b7', 'b7b8', 'b8h2'] },
      { q: 'メイトしよう', fen: 'k7/2P5/1K6/8/8/8/8/8 w - - 0 1', goal: 'mate', sol: ['c7c8'],
        hint: 'ポーンを奥の段まで進めよう', hintSq: ['c8'] },
    ],
  },
  {
    id: 'draw', ch: 4, title: '引き分け',
    text: 'チェックされていないのに、指せる手がひとつもない形は「ステイルメイト」で引き分け。キングだけ同士になったときや、同じ形が 3 回くり返されたときも引き分けです。',
    tasks: [
      { q: 'わざとステイルメイトにしてみよう', fen: '7k/5K2/8/6Q1/8/8/8/8 w - - 0 1', goal: 'stalemate', sol: ['g5g6'],
        hint: '黒のキングの逃げ場を全部ふさぐ。でもチェックはしない', hintSq: ['g6'] },
      { q: '今度は、ステイルメイトにしないでメイトしよう', fen: '7k/5K2/8/6Q1/8/8/8/8 w - - 0 1', goal: 'mate', sol: ['g5g7'],
        hint: '黒のキングのとなりに、自分のキングに守られたクイーンを置く', hintSq: ['g7'] },
      { q: '白も黒もキングだけになった。どうなる？', fen: '8/8/8/4k3/8/8/4K3/8 w - - 0 1', goal: 'quiz',
        choices: ['白の勝ち', '黒の勝ち', '引き分け'], answer: 2 },
    ],
  },
  {
    id: 'value', ch: 4, title: '駒の価値',
    text: '駒の強さの目安は、ポーン 1、ナイト 3、ビショップ 3、ルーク 5、クイーン 9。取り合いでは、この数で得か損かを考えます。',
    tasks: [
      { q: 'ルークとナイト、大きいのは？', fen: START, goal: 'quiz', choices: ['ルーク', 'ナイト', '同じ'], answer: 0 },
      { q: 'いちばん得になる駒を取ろう', fen: '7k/8/5r2/2p5/4N3/8/8/6K1 w - - 0 1', goal: 'steps',
        steps: [{ ok: ['e4f6'] }], hint: '取れる駒の中で、いちばん価値が大きいのは？', hintSq: ['f6'], sol: ['e4f6'] },
      { q: '損をしない取り方は？', fen: '6k1/8/4p3/3p4/n7/8/8/3Q2K1 w - - 0 1', goal: 'steps',
        steps: [{ ok: ['d1a4'], bad: { d1d5: 'ポーンに取り返され、クイーンを失ってしまう' } }],
        hint: '守られていない駒を取ろう', hintSq: ['a4'], sol: ['d1a4'] },
    ],
  },
];

// 段の並び（mate / check / stalemate は 1 段の短い書き方）
export const stepsOf = (task) => task.steps || [{ goal: task.goal }];

// 黒の駒が全部なくなったか（eat の正解）
export const eaten = (s) => !s.board.some((p) => p && p.c === 'b');

// 白の手 m が、この段の正解か。{ ok: true } か { ok: false, msg }
export function judgeStep(step, s, m) {
  const next = apply(s, m), u = toUci(m), st = status(next);
  const good = step.ok ? step.ok.includes(u)
    : step.goal === 'mate' ? st === 'checkmate'
    : step.goal === 'check' ? inCheck(next, 'b')
    : st === 'stalemate';
  if (good) return { ok: true };
  let msg = 'その手じゃないみたい。もう一度';
  if (step.bad && step.bad[u]) msg = step.bad[u];
  else if (st === 'stalemate') msg = 'それだとステイルメイト（引き分け）になってしまう';
  else if (step.goal === 'mate' && st === 'check') msg = 'チェック！ でもキングが逃げられる';
  else if (step.goal === 'mate' || step.goal === 'check') msg = 'まだチェックになっていない';
  return { ok: false, msg };
}
