// チェスのルール（描画に依存しない）。
// 升は 0..63（rank*8+file、rank 0 = 白の初段、file 0 = a 筋）。
// 駒は { t: 'p'|'n'|'b'|'r'|'q'|'k', c: 'w'|'b' }。

const BACK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

export function initial() {
  const board = Array(64).fill(null);
  for (let f = 0; f < 8; f++) {
    board[f] = { t: BACK[f], c: 'w' };
    board[8 + f] = { t: 'p', c: 'w' };
    board[48 + f] = { t: 'p', c: 'b' };
    board[56 + f] = { t: BACK[f], c: 'b' };
  }
  // castle: 動いていない王・ルークの権利。ep: アンパッサンで取れる升（なければ -1）
  return { board, turn: 'w', castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1 };
}

const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// 升 sq が色 by の駒に攻撃されているか
export function attacked(board, sq, by) {
  const r = sq >> 3, f = sq & 7;
  const at = (dr, df) => {
    const rr = r + dr, ff = f + df;
    return rr < 0 || rr > 7 || ff < 0 || ff > 7 ? null : board[rr * 8 + ff];
  };
  const pr = by === 'w' ? -1 : 1; // 白ポーンは自分より下の段から攻撃してくる
  for (const df of [-1, 1]) { const p = at(pr, df); if (p && p.c === by && p.t === 'p') return true; }
  for (const [dr, df] of KN) { const p = at(dr, df); if (p && p.c === by && p.t === 'n') return true; }
  for (let dr = -1; dr <= 1; dr++) for (let df = -1; df <= 1; df++) {
    if (!dr && !df) continue;
    const p = at(dr, df); if (p && p.c === by && p.t === 'k') return true;
  }
  for (const [dirs, kinds] of [[DIAG, 'bq'], [ORTH, 'rq']]) {
    for (const [dr, df] of dirs) {
      for (let k = 1; k < 8; k++) {
        const rr = r + dr * k, ff = f + df * k;
        if (rr < 0 || rr > 7 || ff < 0 || ff > 7) break;
        const p = board[rr * 8 + ff];
        if (p) { if (p.c === by && kinds.includes(p.t)) return true; break; }
      }
    }
  }
  return false;
}

export function inCheck(s, c = s.turn) {
  const k = s.board.findIndex((p) => p && p.t === 'k' && p.c === c);
  return attacked(s.board, k, c === 'w' ? 'b' : 'w');
}

function pseudo(s) {
  const { board, turn, castle, ep } = s;
  const opp = turn === 'w' ? 'b' : 'w';
  const out = [];
  const add = (from, to, extra) => out.push({ from, to, ...extra });
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || p.c !== turn) continue;
    const r = from >> 3, f = from & 7;
    if (p.t === 'p') {
      const d = turn === 'w' ? 1 : -1, last = turn === 'w' ? 7 : 0, start = turn === 'w' ? 1 : 6;
      const push = (to) => add(from, to, to >> 3 === last ? { promo: 'q' } : {});
      const one = from + d * 8;
      if (!board[one]) {
        push(one);
        if (r === start && !board[one + d * 8]) add(from, one + d * 8, { double: true });
      }
      for (const df of [-1, 1]) {
        if (f + df < 0 || f + df > 7) continue;
        const to = one + df;
        if (board[to] && board[to].c === opp) push(to);
        else if (to === ep) add(from, to, { ep: true });
      }
    } else if (p.t === 'n' || p.t === 'k') {
      const moves = p.t === 'n' ? KN : [...DIAG, ...ORTH];
      for (const [dr, df] of moves) {
        const rr = r + dr, ff = f + df;
        if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
        const q = board[rr * 8 + ff];
        if (!q || q.c === opp) add(from, rr * 8 + ff);
      }
      if (p.t === 'k') {
        const home = turn === 'w' ? 4 : 60;
        if (from === home && !attacked(board, home, opp)) {
          const free = (...a) => a.every((o) => !board[home + o]);
          const safe = (...a) => a.every((o) => !attacked(board, home + o, opp));
          if (castle[turn + 'K'] && free(1, 2) && safe(1, 2)) add(from, home + 2, { castle: 'K' });
          if (castle[turn + 'Q'] && free(-1, -2, -3) && safe(-1, -2)) add(from, home - 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = p.t === 'b' ? DIAG : p.t === 'r' ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, df] of dirs) {
        for (let k = 1; k < 8; k++) {
          const rr = r + dr * k, ff = f + df * k;
          if (rr < 0 || rr > 7 || ff < 0 || ff > 7) break;
          const q = board[rr * 8 + ff];
          if (!q) add(from, rr * 8 + ff);
          else { if (q.c === opp) add(from, rr * 8 + ff); break; }
        }
      }
    }
  }
  return out;
}

// 手を指した次の局面を返す（合法かどうかは見ない）
export function apply(s, m) {
  const board = s.board.slice();
  const p = board[m.from];
  const castle = { ...s.castle };
  board[m.from] = null;
  if (m.ep) board[m.to + (s.turn === 'w' ? -8 : 8)] = null;
  board[m.to] = m.promo ? { t: m.promo, c: p.c } : p;
  if (m.castle) {
    const rank = m.from & ~7;
    if (m.castle === 'K') { board[rank + 5] = board[rank + 7]; board[rank + 7] = null; }
    else { board[rank + 3] = board[rank]; board[rank] = null; }
  }
  if (p.t === 'k') castle[p.c + 'K'] = castle[p.c + 'Q'] = false;
  for (const [sq, key] of [[0, 'wQ'], [7, 'wK'], [56, 'bQ'], [63, 'bK']]) {
    if (m.from === sq || m.to === sq) castle[key] = false;
  }
  return {
    board, castle, turn: s.turn === 'w' ? 'b' : 'w',
    ep: m.double ? (m.from + m.to) / 2 : -1,
  };
}

export function legalMoves(s) {
  return pseudo(s).filter((m) => !inCheck(apply(s, m), s.turn));
}

// 'play' | 'check' | 'checkmate' | 'stalemate'
export function status(s) {
  const any = legalMoves(s).length > 0, chk = inCheck(s);
  return any ? (chk ? 'check' : 'play') : (chk ? 'checkmate' : 'stalemate');
}

// 手で確かめる: node chess.js
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('chess.js')) {
  const s = initial();
  console.log('初期局面の合法手:', legalMoves(s).length);
  const perft = (st, d) => d === 0 ? 1 : legalMoves(st).reduce((n, m) => n + perft(apply(st, m), d - 1), 0);
  console.log('perft 1..3 (20, 400, 8902):', perft(s, 1), perft(s, 2), perft(s, 3));
}
