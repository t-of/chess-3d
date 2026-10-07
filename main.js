import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { initial, fromFEN, moves, apply, status, inCheck, toUci } from './chess.js';
import { LESSONS, CHAPTERS, stepsOf, eaten, judgeStep } from './lessons.js';
import { sfx, isOn, setOn } from './sound.js';

WebAppKit.init({ title: 'chess-3d', text: 'チェス入門 #T_OF' });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// ---- シーン ----
const stage = document.getElementById('stage');
const hudText = document.getElementById('hudText');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2118);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 6;
controls.maxDistance = 24;
controls.maxPolarAngle = 1.45;
controls.addEventListener('start', () => { camTween = null; }); // 触ったら自動回転をやめる

scene.add(new THREE.HemisphereLight(0xfff2dd, 0x40342a, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(5, 11, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x1d1610, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.4;
ground.receiveShadow = true;
scene.add(ground);
const frame = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.4, 9.2), new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.6 }));
frame.position.y = -0.4;
frame.receiveShadow = true;
scene.add(frame);

// 升 → 盤上の位置（白が +z 側）
const posOf = (sq) => new THREE.Vector3((sq & 7) - 3.5, 0, 3.5 - (sq >> 3));

const tiles = [];
const markers = [];
const markGeo = new THREE.CircleGeometry(0.2, 24);
const ringGeo = new THREE.RingGeometry(0.34, 0.46, 32);
for (let sq = 0; sq < 64; sq++) {
  const dark = ((sq >> 3) + (sq & 7)) % 2 === 0;
  const t = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshStandardMaterial({ color: dark ? 0x7a4f32 : 0xdcc08f, roughness: 0.5 }));
  t.position.copy(posOf(sq)).setY(-0.1);
  t.receiveShadow = true;
  t.userData.sq = sq;
  scene.add(t);
  tiles.push(t);
  const m = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0x6bff9a, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.copy(posOf(sq)).setY(0.02);
  m.visible = false;
  scene.add(m);
  markers.push(m);
}
const selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd35c, transparent: true, opacity: 0.9, depthWrite: false }));
selRing.rotation.x = -Math.PI / 2;
selRing.visible = false;
scene.add(selRing);
// ヒントで光らせる升（行き先の丸とは別の黄色）
const hintMarks = Array.from({ length: 64 }, (_, sq) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0xffd35c, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.copy(posOf(sq)).setY(0.03);
  m.visible = false;
  scene.add(m);
  return m;
});

// ---- 駒の形（プリミティブの組み合わせ）----
const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24);
const BASE = [[0, 0], [0.36, 0], [0.36, 0.07], [0.27, 0.17]];
const sphere = (r, sx = 1, sy = 1) => new THREE.SphereGeometry(r, 16, 12).scale(sx, sy, sx);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// 各部品: [geometry, x, y, z, rotX]
const SHAPES = {
  p: () => [[lathe([...BASE, [0.13, 0.4], [0.2, 0.45], [0.12, 0.5], [0, 0.5]])], [sphere(0.18), 0, 0.62, 0]],
  r: () => [
    [lathe([...BASE, [0.22, 0.6], [0.3, 0.66], [0.3, 0.82], [0, 0.82]])],
    ...[0, 1, 2, 3].map((i) => [box(0.13, 0.16, 0.13), Math.cos(i * 1.571 + 0.785) * 0.22, 0.9, Math.sin(i * 1.571 + 0.785) * 0.22]),
  ],
  n: () => [
    [lathe([...BASE, [0.2, 0.3], [0, 0.3]])],
    [box(0.34, 0.6, 0.3), 0, 0.58, 0],
    [box(0.26, 0.28, 0.5), 0, 0.9, 0.18, 0.35],
    [box(0.1, 0.5, 0.2), 0, 0.82, -0.2],
    [new THREE.ConeGeometry(0.06, 0.2, 8), -0.09, 1.1, -0.02],
    [new THREE.ConeGeometry(0.06, 0.2, 8), 0.09, 1.1, -0.02],
  ],
  b: () => [[lathe([...BASE, [0.16, 0.5], [0.24, 0.58], [0.12, 0.66], [0, 0.66]])], [sphere(0.2, 1, 1.5), 0, 0.88, 0], [sphere(0.07), 0, 1.22, 0]],
  q: () => [
    [lathe([...BASE, [0.2, 0.6], [0.3, 0.8], [0.34, 1.0], [0.16, 1.05], [0, 1.05]])],
    [sphere(0.1), 0, 1.2, 0],
    ...Array.from({ length: 8 }, (_, i) => [sphere(0.07), Math.cos(i * 0.785) * 0.28, 1.05, Math.sin(i * 0.785) * 0.28]),
  ],
  k: () => [
    [lathe([...BASE, [0.2, 0.7], [0.32, 0.95], [0.3, 1.1], [0.14, 1.15], [0, 1.15]])],
    [box(0.1, 0.4, 0.1), 0, 1.38, 0],
    [box(0.3, 0.1, 0.1), 0, 1.42, 0],
  ],
};
const shapeCache = {};
const partsOf = (t) => shapeCache[t] || (shapeCache[t] = SHAPES[t]());
const COLOR = { w: 0xf2e8d5, b: 0x3b3430 };

function makePiece(p, sq) {
  const mat = new THREE.MeshStandardMaterial({ color: COLOR[p.c], roughness: 0.35, metalness: 0.1, emissive: 0x000000 });
  const g = new THREE.Group();
  for (const [geo, x = 0, y = 0, z = 0, rx = 0] of partsOf(p.t)) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    g.add(m);
  }
  g.rotation.y = p.t === 'n' && p.c === 'w' ? Math.PI : 0; // ナイトは相手の側を向く
  g.userData = { sq, mat, piece: p, yaw: g.rotation.y };
  g.position.copy(posOf(sq));
  scene.add(g);
  return g;
}

// ---- アニメーション ----
let anims = [];
let camTween = null;
const ease = (u) => u * u * (3 - 2 * u);
function tween(dur, fn, delay = 0) {
  return new Promise((resolve) => anims.push({ t0: performance.now() + delay * 1000, dur: dur * 1000, fn, resolve }));
}
// from → to を放物線で動かす。h は跳ねる高さ
function arc(g, to, h, dur, delay = 0, extra) {
  const from = g.position.clone();
  return tween(dur, (u) => {
    g.position.lerpVectors(from, to, ease(u));
    g.position.y += 4 * h * u * (1 - u);
    if (extra) extra(u);
  }, delay);
}

// ---- ゲーム ----
let state, groups, graveyard, selected, targets, busy, gen = 0, checkSide = null;
let mode = 'free';  // 'free'（2 人で自由に指す）か 'lesson'
let lesson = null;  // レッスン中: { L, t, ti, si, mist, moves, live, solved }

// 局面を並べ直す。fen がなければ初期配置
function reset(fen) {
  gen++;
  anims = [];
  if (groups) for (const g of [...groups.values(), ...graveyard]) scene.remove(g);
  state = fen ? fromFEN(fen) : initial();
  groups = new Map();
  graveyard = [];
  state.board.forEach((p, sq) => { if (p) groups.set(sq, makePiece(p, sq)); });
  selected = -1; targets = []; busy = false; checkSide = null;
  showSelection();
  showHint([]);
  hudText.textContent = '白の番';
  camTween = null;
  const d = camera.position.length();
  camera.position.set(0, d * 0.75, d * 0.66);
  controls.update();
  fitCamera(true);
}

function showSelection() {
  selRing.visible = selected >= 0;
  if (selected >= 0) selRing.position.copy(posOf(selected)).setY(0.02);
  markers.forEach((m, sq) => {
    const t = targets.find((x) => x.to === sq);
    m.visible = !!t;
    if (t) {
      const cap = state.board[sq] || t.ep;
      m.material.color.setHex(cap ? 0xff6b5c : 0x6bff9a);
      m.scale.setScalar(cap ? 1.6 : 1);
    }
  });
}

const sqIdx = (n) => 'abcdefgh'.indexOf(n[0]) + (n[1] - 1) * 8;
function showHint(names) {
  const set = new Set(names.map(sqIdx));
  hintMarks.forEach((m, sq) => { m.visible = set.has(sq); });
}

function select(sq) {
  // 前に選んでいた駒は元の姿勢に戻す
  const prev = groups.get(selected);
  if (prev) { prev.position.y = 0; prev.rotation.set(0, prev.userData.yaw, 0); }
  selected = sq;
  targets = sq >= 0 ? moves(state).filter((m) => m.from === sq) : [];
  showSelection();
}

function onTap(sq) {
  if (busy || (mode === 'lesson' && !lesson.live)) return;
  const p = state.board[sq];
  const m = targets.find((x) => x.to === sq);
  if (m) return mode === 'lesson' ? tryLesson(m) : play(m);
  const only = mode === 'lesson' && lesson.t.only;
  if (p && p.c === state.turn && sq !== selected && (!only || only.includes(p.t))) { select(sq); sfx('select'); }
  else select(-1);
}

// 駒を動かして state を進める。途中で盤が並べ直されたら false
async function move(m) {
  const g0 = gen;
  busy = true;
  const mover = groups.get(m.from);
  select(-1);
  mover.userData.sq = m.to;
  const knight = mover.userData.piece.t === 'n';
  const dur = knight ? 0.8 : 0.55;
  const jobs = [];
  groups.delete(m.from);

  const capSq = m.ep ? m.to + (state.turn === 'w' ? -8 : 8) : m.to;
  const victim = groups.get(capSq);
  if (victim) {
    groups.delete(capSq);
    const side = victim.userData.piece.c;
    const n = graveyard.filter((x) => x.userData.piece.c === side).length;
    const slot = new THREE.Vector3((side === 'w' ? -5.6 : 5.6) + (side === 'w' ? -1 : 1) * (n % 2) * 0.7, -0.12, -3.2 + (n >> 1) * 0.8);
    graveyard.push(victim);
    // 取られた駒は、動いてきた駒が当たるころに倒れて盤の脇へ飛ぶ
    jobs.push(arc(victim, slot, 2.2, 0.8, dur * 0.7, (u) => {
      victim.rotation.z = (side === 'w' ? 1 : -1) * u * 1.5;
      victim.scale.setScalar(1 - u * 0.3);
    }));
  }
  groups.set(m.to, mover);
  jobs.push(arc(mover, posOf(m.to), knight ? 1.8 : 0.3, dur, 0, (u) => {
    if (knight) mover.rotation.y = mover.userData.yaw + Math.sin(u * Math.PI) * 0.4;
  }));
  if (m.castle) {
    const rank = m.from & ~7;
    const [rf, rt] = m.castle === 'K' ? [rank + 7, rank + 5] : [rank, rank + 3];
    const rook = groups.get(rf);
    groups.delete(rf); groups.set(rt, rook); rook.userData.sq = rt;
    jobs.push(arc(rook, posOf(rt), 0.7, dur, 0.1));
  }
  setTimeout(() => { if (g0 === gen) sfx(victim ? 'capture' : 'place'); }, dur * 800);
  await Promise.all(jobs);
  if (g0 !== gen) return false;

  if (m.promo) {
    // ポーンをクイーンに取り替え、ぽんと膨らませる
    scene.remove(mover);
    const q = makePiece({ t: 'q', c: mover.userData.piece.c }, m.to);
    groups.set(m.to, q);
    await tween(0.35, (u) => q.scale.setScalar(u < 0.6 ? 0.6 + u * 1.0 : 1.2 - (u - 0.6) * 0.5));
    if (g0 !== gen) return false;
    q.scale.setScalar(1);
  }
  state = apply(state, m);
  return true;
}

// 自由に指す: 指したあとの表示と、手番の側へカメラを回す
async function play(m) {
  if (!(await move(m))) return;
  const st = status(state);
  const who = state.turn === 'w' ? '白' : '黒';
  checkSide = st === 'check' || st === 'checkmate' ? state.turn : null;
  if (checkSide) sfx('check');
  hudText.textContent = st === 'checkmate' ? `チェックメイト！ ${state.turn === 'w' ? '黒' : '白'}の勝ち`
    : st === 'stalemate' ? 'ステイルメイト ― 引き分け'
    : st === 'check' ? `${who}の番 ― チェック！` : `${who}の番`;
  busy = st === 'checkmate' || st === 'stalemate';
  if (!busy) turnCamera();
}

// 手番の側へカメラをゆっくり回す（高さと距離はそのまま、真上から見て回すだけ）
function turnCamera() {
  const goal = state.turn === 'w' ? 0 : Math.PI;
  const cur = Math.atan2(camera.position.x, camera.position.z);
  let d = goal - cur;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  if (Math.abs(d) < 0.05) return;
  camTween = { start: camera.position.clone(), d, t0: performance.now() + 250, dur: 1800 };
}

// ---- レッスン ----
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GOAL_WORD = { mate: 'メイト！', check: 'チェック！', stalemate: 'ステイルメイト！（引き分け）' };

function loadDone() {
  try {
    const d = JSON.parse(localStorage.getItem('chess-3d.done'));
    return d && d.v === 1 && Array.isArray(d.ids) ? d.ids.filter((id) => LESSONS.some((L) => L.id === id)) : [];
  } catch { return []; }
}
function markDone(id) {
  const ids = loadDone();
  if (!ids.includes(id)) ids.push(id);
  try { localStorage.setItem('chess-3d.done', JSON.stringify({ v: 1, ids })); } catch { /* 保存できない環境 */ }
}

function show(name) {
  for (const id of ['title', 'list', 'play']) $(id).hidden = id !== name;
  if (name !== 'play') { gen++; anims = []; busy = true; }
  if (name === 'title') renderTitle();
  if (name === 'list') renderList();
}

function renderTitle() {
  const done = loadDone();
  const next = LESSONS.find((L) => !done.includes(L.id));
  const grad = !next;
  $('titleDone').textContent = grad ? `卒業おめでとう！ 全 ${LESSONS.length} レッスンクリア` : `レッスン ${done.length}/${LESSONS.length} クリア`;
  $('goContinue').hidden = !next;
  if (next) $('goContinue').textContent = `つづきから ― ${LESSONS.indexOf(next) + 1}. ${next.title}`;
  $('goContinue').onclick = () => openLesson(next);
  document.querySelector('[data-wak="share"]').dataset.wakText = grad ? `チェス入門 卒業！ ${LESSONS.length}/${LESSONS.length} レッスンクリア #T_OF` : `チェス入門 ${done.length}/${LESSONS.length} レッスンクリア #T_OF`;
}

function renderList() {
  const done = loadDone(), box = $('lessons');
  box.textContent = '';
  let ch = 0;
  LESSONS.forEach((L, i) => {
    if (L.ch !== ch) {
      ch = L.ch;
      const h = document.createElement('h3');
      h.textContent = `第 ${ch} 章 ${CHAPTERS[ch - 1]}`;
      box.appendChild(h);
    }
    const b = document.createElement('button');
    b.className = 'lrow';
    for (const [tag, text] of [['b', i + 1], ['span', L.title], ['i', done.includes(L.id) ? '✓' : '']]) {
      const e = document.createElement(tag);
      e.textContent = text;
      b.appendChild(e);
    }
    b.onclick = () => openLesson(L);
    box.appendChild(b);
  });
}

function openFree() {
  mode = 'free'; lesson = null;
  show('play');
  for (const id of ['intro', 'panel', 'choices']) $(id).hidden = true;
  $('hud').hidden = false;
  reset();
}

function openLesson(L) {
  mode = 'lesson';
  lesson = { L, ti: 0 };
  show('play');
  $('intro').hidden = false; $('intro').open = true;
  $('panel').hidden = false; $('hud').hidden = true;
  $('introTitle').textContent = `第 ${L.ch} 章 ${CHAPTERS[L.ch - 1]}　${LESSONS.indexOf(L) + 1}. ${L.title}`;
  $('introText').textContent = L.text;
  startTask();
}

const say = (text, cls = '') => { $('taskMsg').textContent = text; $('taskMsg').className = 'msg ' + cls; };
const curStep = () => stepsOf(lesson.t)[lesson.si];

function renderPanel() {
  const { L, t, ti } = lesson;
  $('taskProg').textContent = `${ti + 1}/${L.tasks.length}`;
  $('taskQ').textContent = curStep().q || t.q;
}

async function startTask() {
  const L = lesson, t = L.L.tasks[L.ti];
  Object.assign(L, { t, si: 0, mist: 0, moves: 0, live: false, solved: false });
  reset(t.fen);
  const g0 = gen;
  say('');
  renderPanel();
  $('hintBtn').hidden = false; $('nextBtn').hidden = true;
  const box = $('choices');
  box.textContent = '';
  box.hidden = t.goal !== 'quiz';
  if (t.goal === 'quiz') {
    t.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.textContent = c;
      b.onclick = () => answer(i);
      box.appendChild(b);
    });
    return;
  }
  busy = true;
  for (const u of [].concat(t.pre || [])) {
    await sleep(400);
    if (g0 !== gen) return;
    if (!(await move(moves(state).find((m) => toUci(m) === u)))) return;
  }
  busy = false;
  L.live = true;
}

function showLessonHint() {
  const step = curStep(), t = lesson.t;
  const text = step.hint || t.hint;
  say(text ? 'ヒント：' + text : 'よく見て、もう一度');
  showHint(step.hintSq || t.hintSq || []);
}

// 白の手 m を判定する。ちがう手は動かさず、ひとこと出す
async function tryLesson(m) {
  const L = lesson, t = L.t, g0 = gen, steps = stepsOf(t);
  if (t.goal !== 'eat') {
    const r = judgeStep(steps[L.si], state, m);
    if (!r.ok) {
      select(-1); sfx('bad'); say(r.msg);
      if (++L.mist >= 2) showLessonHint();
      return;
    }
  }
  L.live = false;
  showHint([]); say('');
  if (!(await move(m))) return;
  if (t.goal === 'eat') {
    state = { ...state, turn: 'w', ep: -1 }; // 黒は動かない
    L.moves++;
    if (eaten(state)) return solved('できた！');
    if (L.moves >= t.limit) {
      sfx('bad'); say('手数オーバー。もう一度');
      await sleep(1300);
      if (g0 === gen) startTask();
      return;
    }
    say(`あと ${t.limit - L.moves} 手まで`);
    busy = false; L.live = true;
    return;
  }
  checkSide = inCheck(state, 'b') ? 'b' : null;
  if (checkSide) sfx('check');
  const step = steps[L.si];
  if (L.si === steps.length - 1) return solved(GOAL_WORD[step.goal]);
  sfx('ok'); say('いいね！ つぎは？', 'ok');
  if (step.reply) {
    await sleep(400);
    if (g0 !== gen) return;
    if (!(await move(moves(state).find((x) => toUci(x) === step.reply)))) return;
    checkSide = inCheck(state, 'w') ? 'w' : null;
  } else {
    state = { ...state, turn: 'w', ep: -1 };
  }
  L.si++;
  renderPanel();
  busy = false; L.live = true;
}

function answer(i) {
  const L = lesson;
  if (L.solved) return;
  if (i !== L.t.answer) {
    sfx('bad'); say('ちがうみたい。もう一度');
    if (++L.mist >= 2) showLessonHint();
    return;
  }
  [...$('choices').children].forEach((b, k) => { b.disabled = true; b.classList.toggle('right', k === i); });
  solved('できた！');
}

function solved(word) {
  const L = lesson, t = L.t, last = L.ti === L.L.tasks.length - 1;
  L.solved = true; L.live = false; busy = true;
  showHint([]);
  $('hintBtn').hidden = true;
  const next = LESSONS[LESSONS.indexOf(L.L) + 1];
  if (last) {
    markDone(L.L.id);
    sfx('clear');
    const grad = loadDone().length === LESSONS.length;
    say(`${word || 'できた！'} ${grad ? '卒業おめでとう！ 全レッスンクリア！' : 'レッスンクリア！'}${t.clear ? ' ' + t.clear : ''}`, 'ok');
  } else {
    sfx('ok');
    say(word || 'できた！', 'ok');
  }
  $('nextBtn').textContent = !last ? '次へ' : next ? '次のレッスンへ' : '一覧へ';
  $('nextBtn').hidden = false;
  $('nextBtn').onclick = () => {
    if (!last) { L.ti++; startTask(); } else if (next) openLesson(next); else show('list');
  };
}

$('hintBtn').onclick = showLessonHint;
$('retryBtn').onclick = () => startTask();
$('listBtn').onclick = () => show('list');
$('listBack').onclick = () => show('title');
$('freeBack').onclick = () => show('title');
$('goList').onclick = () => show('list');
$('goFree').onclick = openFree;
const soundBtn = $('soundBtn');
const showSound = () => { soundBtn.textContent = isOn() ? '音 ON' : '音 OFF'; };
soundBtn.onclick = () => { setOn(!isOn()); showSound(); sfx('select'); };
showSound();

// 縦画面でも盤が入る距離にする。ユーザーが寄せた分は resize で保つ
let fit = 0;
function fitCamera(force) {
  if (!stage.clientWidth) return; // 盤を隠しているあいだは測らない
  const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const need = 6.6 / Math.min(Math.tan(vf) * camera.aspect, Math.tan(vf)) * 1.0;
  const dist = camera.position.length();
  const next = force || !fit ? need : dist * need / fit;
  camera.position.multiplyScalar(next / dist);
  fit = need;
  controls.update();
}

// ---- 入力（動かしていないタップだけを選択とみなす）----
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 500) return;
  down = null;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([...groups.values(), ...tiles], true)[0];
  if (!hit) return;
  let o = hit.object;
  while (o && o.userData.sq === undefined) o = o.parent;
  if (o) onTap(o.userData.sq);
});

$('restart').addEventListener('click', () => reset());
new ResizeObserver(() => fitCamera(false)).observe(stage);

// ---- 毎フレーム ----
function frame_(now) {
  const t = now / 1000;
  anims = anims.filter((a) => {
    const u = (now - a.t0) / a.dur;
    if (u < 0) return true;
    a.fn(Math.min(u, 1));
    if (u >= 1) { a.resolve(); return false; }
    return true;
  });
  if (camTween) {
    const u = (now - camTween.t0) / camTween.dur;
    if (u >= 0) {
      const a = camTween.d * ease(Math.min(u, 1));
      const s = camTween.start;
      camera.position.set(s.x * Math.cos(a) + s.z * Math.sin(a), s.y, -s.x * Math.sin(a) + s.z * Math.cos(a));
      if (u >= 1) camTween = null;
    }
  }
  const sel = groups.get(selected);
  if (sel && !busy) { // 選んだ駒は少し浮いてゆらぐ
    sel.position.y = 0.25 + Math.sin(t * 3) * 0.05;
    sel.rotation.z = Math.sin(t * 2.3) * 0.06;
    sel.rotation.x = Math.cos(t * 1.9) * 0.04;
  }
  const pulse = 0.55 + 0.35 * Math.sin(t * 5);
  markers.forEach((m) => { if (m.visible) m.material.opacity = pulse; });
  for (const [, g] of groups) {
    const hot = checkSide && g.userData.piece.t === 'k' && g.userData.piece.c === checkSide;
    g.userData.mat.emissive.setHex(hot ? 0xff1a1a : 0);
    g.userData.mat.emissiveIntensity = hot ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame_);
}

reset();
show('title');
requestAnimationFrame(frame_);
