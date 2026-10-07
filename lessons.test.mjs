// 全レッスンの sol を流して、合法で、最後に goal を満たすかを見る。 node lessons.test.mjs
import { fromFEN, moves, apply, toUci } from './chess.js';
import { LESSONS, stepsOf, eaten, judgeStep } from './lessons.js';

let bad = 0, n = 0;
const fail = (where, msg) => { bad++; console.log('NG', where, msg); };
const ids = new Set();
const back = (s) => ({ ...s, turn: 'w', ep: -1 }); // 黒は動かない（eat）

for (const L of LESSONS) {
  if (ids.has(L.id)) fail(L.id, 'id が重複');
  ids.add(L.id);
  L.tasks.forEach((t, i) => {
    const where = `${L.id}#${i + 1}`;
    n++;
    let s = fromFEN(t.fen);
    const play = (u, label) => {
      const m = moves(s).find((x) => toUci(x) === u);
      if (!m) { fail(where, `${label} ${u} が合法でない`); return null; }
      if (t.only && s.turn === 'w' && !t.only.includes(s.board[m.from].t)) fail(where, `${u} は only の外`);
      return m;
    };
    if (t.pre) { for (const u of [].concat(t.pre)) { const m = play(u, 'pre'); if (m) s = apply(s, m); } }
    if (t.goal === 'quiz') {
      if (!(t.answer >= 0 && t.answer < t.choices.length)) fail(where, 'answer が範囲外');
      return;
    }
    if (!t.sol) return fail(where, 'sol がない');
    if (t.goal === 'eat') {
      t.sol.forEach((u, k) => {
        const m = play(u, `${k + 1} 手目`);
        if (!m) return;
        s = back(apply(s, m));
        if (k < t.sol.length - 1 && eaten(s)) fail(where, 'sol の途中で全部なくなった');
      });
      if (!eaten(s)) fail(where, 'sol のあとも黒が残っている');
      if (t.sol.length > t.limit) fail(where, 'sol が limit を超えている');
      return;
    }
    const steps = stepsOf(t);
    if (t.sol.length !== steps.length) return fail(where, 'sol の長さと steps が合わない');
    steps.forEach((st, k) => {
      const m = play(t.sol[k], `${k + 1} 段`);
      if (!m) return;
      if (!judgeStep(st, s, m).ok) return fail(where, `${k + 1} 段: ${t.sol[k]} が正解にならない`);
      s = apply(s, m);
      if (st.reply) {
        const r = play(st.reply, `${k + 1} 段の reply`);
        if (r) s = apply(s, r); else return;
      } else s = back(s);
    });
  });
}
// reply つきの steps: ok の手をどれで指しても reply が合法で、最後の段に正解の手が残るか。
// 基本のメイト（ch 5）は、reply が黒の唯一の合法手であることも見る
for (const L of LESSONS) L.tasks.forEach((t, i) => {
  if (t.goal !== 'steps' || !t.steps.some((x) => x.reply)) return;
  const where = `${L.id}#${i + 1} 分岐`;
  const go = (s, k) => {
    const st = t.steps[k];
    if (k === t.steps.length - 1) {
      if (!moves(s).some((m) => judgeStep(st, s, m).ok)) fail(where, '最後の段に正解がない');
      return;
    }
    for (const u of st.ok) {
      const m = moves(s).find((x) => toUci(x) === u);
      if (!m) { fail(where, `${u} が合法でない`); continue; }
      const n = apply(s, m);
      if (!st.reply) { go({ ...n, turn: 'w', ep: -1 }, k + 1); continue; }
      const legal = moves(n).map(toUci);
      if (!legal.includes(st.reply)) { fail(where, `${u} のあと reply ${st.reply} が合法でない`); continue; }
      if ((L.id === 'mate-q' || L.id === 'mate-r') && legal.length !== 1) fail(where, `${u} のあと黒の手が 1 つではない`);
      go(apply(n, moves(n).find((x) => toUci(x) === st.reply)), k + 1);
    }
  };
  go(fromFEN(t.fen), 0);
});
console.log(bad ? `${bad} 件 NG` : `OK（${LESSONS.length} レッスン、${n} 問）`);
process.exit(bad ? 1 : 0);
