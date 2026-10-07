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
