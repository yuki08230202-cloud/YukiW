#!/usr/bin/env node
// 企画書(絵コンテ形式)ビルダー。
// 使い方: node build.js project.json [--out out] [--pdf] [--only 3]
// project.json の書き方は README.md と example.json を見る。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Footer, AlignmentType,
  BorderStyle, WidthType, ShadingType, PageNumber } = require('docx');

// ---------- 引数 ----------
const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) {
  console.error('使い方: node build.js project.json [--out out] [--pdf] [--only 番号]');
  process.exit(1);
}
const optVal = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const specPath = path.resolve(args[0]);
const OUT = path.resolve(optVal('--out') || 'out');
const WANT_PDF = args.includes('--pdf');
const ONLY = optVal('--only');
const D = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const baseDir = path.dirname(specPath);

// ---------- 設定 ----------
const client = D.client || {};
const BRAND = client.brand || client.name;
if (!BRAND) fail('project.json の client.brand(または client.name)がありません。');
const FONT = D.font || 'Noto Sans CJK JP';
const GREY = '7F7F7F';
const TITLE_PREFIX = D.title_prefix || '求人動画 絵コンテ';
const SCRIPT_LABELS = D.script_labels || ['セリフ', '字幕', '小字幕', 'ナレーション'];
const REF_NOTE = D.reference_note ||
  `※参考画像の文字や人物は、すべて参考動画のものです。${BRAND}の内容は「内容&セリフ」を見てください。`;
// 台本以外の文章に出ると AI っぽく見える言葉。見つけたら警告だけ出す。
const WATCH_WORDS = D.watch_words || ['リズム', '距離感', '寄り添', 'という', 'ちゃんと', '世界観', '雰囲気づくり'];

function fail(msg) { console.error('エラー: ' + msg); process.exit(1); }
function warn(msg) { console.warn('警告: ' + msg); }

fs.mkdirSync(OUT, { recursive: true });
const WORK = path.join(OUT, '_work');
fs.mkdirSync(WORK, { recursive: true });

// ---------- 画像(参考動画のフレームだけ) ----------
function videoPath(key) {
  const v = (D.videos || {})[key];
  if (!v) fail(`videos に "${key}" がありません。`);
  return path.isAbsolute(v) ? v : path.resolve(baseDir, v);
}
function extractFrame(frame, outName) {
  const out = path.join(WORK, outName);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(frame.t), '-i', videoPath(frame.video),
    '-frames:v', '1', '-vf', 'scale=420:-2', out]);
  const wh = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height', '-of', 'csv=p=0', out]).toString().trim().split(',').map(Number);
  return { file: out, w: wh[0], h: wh[1] };
}

// ---------- 部品 ----------
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 20, bold: o.bold, color: o.color });
const para = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs],
  spacing: { before: o.before ?? 0, after: o.after ?? 60, line: o.line }, keepNext: o.keepNext, pageBreakBefore: o.pageBreakBefore, alignment: o.align });
const H2 = t => para(run(t, { size: 26, bold: true }), { before: 110, after: 50, keepNext: true });
const body = t => para(run(t, { size: 19 }), { after: 40, line: 260 });
const thin = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const cell = (children, w, o = {}) => new TableCell({ children, width: { size: w, type: WidthType.DXA }, borders,
  margins: { top: 100, bottom: 100, left: 120, right: 120 },
  shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined });
const fmt = s => { const m = Math.floor(s / 60); const r = Math.round((s - m * 60) * 10) / 10;
  const sec = Number.isInteger(r) ? String(r).padStart(2, '0') : r.toFixed(1).padStart(4, '0'); return `${m}:${sec}`; };
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
  children: [run(`${BRAND} 絵コンテ | `, { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GREY })] })] });

// ---------- チェック ----------
const REQUIRED = ['no', 'slug', 'name', 'spec', 'refv', 'method', 'cast', 'cond', 'props', 'editnote', 'confirm'];
function validate(p) {
  const miss = REQUIRED.filter(k => p[k] === undefined || p[k] === null || p[k] === '');
  if (miss.length) fail(`企画${p.no || '?'} に必要な項目がありません: ${miss.join(', ')}`);
  if (p.type === 'interview') {
    if (!Array.isArray(p.script) || !p.script.length) fail(`企画${p.no} (interview) に script がありません。`);
  } else {
    if (!Array.isArray(p.cuts) || !p.cuts.length) fail(`企画${p.no} に cuts がありません。`);
    p.cuts.forEach((c, i) => {
      ['dur', 'place', 'act', 'lines'].forEach(k => { if (c[k] === undefined) fail(`企画${p.no} のカット${i + 1}に ${k} がありません。`); });
    });
  }
  // 台本以外の文章の注意語
  const texts = [p.name, p.method, p.cast, p.cond, p.props, p.editnote, ...(p.confirm || [])];
  (p.cuts || []).forEach(c => texts.push(c.place, c.act, c.edit || ''));
  texts.forEach(t => WATCH_WORDS.forEach(w => { if (t && t.includes(w)) warn(`企画${p.no}: 「${w}」が入っています → ${t.slice(0, 40)}…`); }));
}

// ---------- 表紙側 ----------
function cover(p, total, n, scriptLines, hasFrame) {
  const spec = p.spec.replace('{T}', Math.round(total)).replace('{N}', n);
  return [
    para(run(`${BRAND} ${TITLE_PREFIX} 企画${p.no}`, { size: 32, bold: true }), { after: 80 }),
    para(run(p.name, { size: 28, bold: true }), { after: 100 }),
    body(spec),
    H2('参考動画'),
    body('動画名:' + p.refv),
    body('リンク:' + (p.ref_link || '【URLを記入】')),
    H2('画の作り方'), body(p.method), ...(hasFrame ? [body(REF_NOTE)] : []),
    H2('演者'), body(p.cast),
    H2('撮影条件'), body(p.cond),
    H2('撮影前に揃えるもの'), body(p.props),
    H2('編集とリアクション'), body(p.editnote),
    H2('通し台本'),
    ...scriptLines.map(t => para(run(t, { size: 20 }), { after: 30 })),
    H2('要確認事項(仮案)'),
    ...p.confirm.map(t => body('・' + t)),
  ];
}

// ---------- カット表(3列) ----------
function buildStoryboard(p) {
  let acc = 0;
  p.cuts.forEach((c, i) => {
    c.id = `C-${String(i + 1).padStart(2, '0')}`; c.start = acc; acc += c.dur; c.end = acc;
    if (c.frame) c.img = extractFrame(c.frame, `${p.no}_${p.slug}_${String(i + 1).padStart(2, '0')}.jpg`);
  });
  const hasFrame = p.cuts.some(c => c.img);
  const COLS = [2523, 6605, 1191];
  const scriptLines = [];
  p.cuts.forEach(c => c.lines.forEach(l => {
    if (SCRIPT_LABELS.includes(l[0]) || (p.speakers || []).includes(l[0]))
      scriptLines.push(`${c.id}　${l[0] === 'セリフ' ? '' : l[0] + ':'}${l[1]}`);
  }));
  const row = c => {
    const c1kids = [para(run(c.id, { bold: true }), { after: 60 })];
    if (c.img) {
      const h = Math.min(236, Math.round(126 * c.img.h / c.img.w));
      c1kids.push(para(new ImageRun({ type: 'jpg', data: fs.readFileSync(c.img.file),
        transformation: { width: Math.round(h * c.img.w / c.img.h), height: h },
        altText: { title: c.id, description: c.id, name: c.id } }), { after: 0 }));
    }
    const noteTxt = (c.ref && c.ref !== '–' ? `参考動画 ${c.ref}` + (c.edit ? '｜' : '') : '') + (c.edit || '');
    const c2kids = [
      para(run('① 撮影指示', { size: 22, bold: true }), { after: 60 }),
      para(run('場所:' + c.place, { bold: true }), { after: 40 }),
      para(run(c.act), { after: 60, line: 290 }),
      ...(noteTxt ? [para(run(noteTxt, { size: 18, color: GREY }), { after: 100, line: 270 })] : []),
      para(run('② セリフ/テロップ', { size: 22, bold: true }), { after: 60 }),
      ...c.lines.map(l => para(run(`${l[0]}:${l[1]}`, { size: l[2] ? 22 : 20, bold: !!l[2] }), { after: 40, line: 280 })),
    ];
    const c3 = cell([para(run(`${c.dur} 秒`, { size: 24, bold: true }), { after: 60 }),
      para(run(fmt(c.start), { size: 18 }), { after: 0 }), para(run(`〜${fmt(c.end)}`, { size: 18 }), { after: 100 }),
      para(run('累計', { size: 16, color: GREY }), { after: 0 }), para(run(fmt(c.end), { size: 18, color: GREY }), { after: 0 })], COLS[2]);
    return new TableRow({ children: [cell(c1kids, COLS[0]), cell(c2kids, COLS[1]), c3], cantSplit: true, height: { value: 3300, rule: 'atLeast' } });
  };
  const head = () => { const hc = (t, w) => cell([para(run(t, { bold: true }), { after: 0 })], w, { fill: 'F2F2F2' });
    return new TableRow({ children: [hc('画面/絵', COLS[0]), hc('内容&セリフ', COLS[1]), hc('時間', COLS[2])], tableHeader: true }); };
  const pages = [];
  for (let i = 0; i < p.cuts.length; i += 3) {
    const g = p.cuts.slice(i, i + 3);
    pages.push(para(run(`企画${p.no} ${p.name} ${g[0].id}〜${g[g.length - 1].id}`, { size: 22, bold: true }), { after: 100, pageBreakBefore: true, keepNext: true }));
    pages.push(new Table({ width: { size: 10319, type: WidthType.DXA }, columnWidths: COLS, rows: [head(), ...g.map(row)] }));
  }
  return { children: [...cover(p, acc, p.cuts.length, scriptLines, hasFrame), ...pages], total: acc, count: p.cuts.length };
}

// ---------- インタビュー型(画角が変わらない企画) ----------
function buildInterview(p) {
  const COLS = [1300, 1700, 5100, 2219];
  const hc = (t, w) => cell([para(run(t, { bold: true }), { after: 0 })], w, { fill: 'F2F2F2' });
  const rows = [new TableRow({ children: [hc('秒', COLS[0]), hc('話者', COLS[1]), hc('セリフ', COLS[2]), hc('テロップ・編集', COLS[3])], tableHeader: true }),
    ...p.script.map(s => new TableRow({ cantSplit: true, children: [
      cell([para(run(s[0], { size: 18 }), { after: 0 })], COLS[0]), cell([para(run(s[1], { size: 18 }), { after: 0 })], COLS[1]),
      cell([para(run(s[2], { size: 20, bold: true }), { after: 0, line: 290 })], COLS[2]),
      cell([para(run(s[3] || '', { size: 18, color: GREY }), { after: 0, line: 270 })], COLS[3])] }))];
  const NOB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const nob = { top: NOB, bottom: NOB, left: NOB, right: NOB };
  const ref = p.ref_frame ? extractFrame(p.ref_frame, `${p.no}_${p.slug}_ref.jpg`) : null;
  const refPara = ref
    ? para(new ImageRun({ type: 'jpg', data: fs.readFileSync(ref.file), transformation: { width: Math.round(320 * ref.w / ref.h), height: 320 } }), { after: 0 })
    : para(run('(空欄)', { size: 18, color: GREY }), { after: 0 });
  const notes = p.shoot_notes || [
    '画角:出演者の胸上〜腰上。全編固定(三脚)。',
    '場所:' + (p.place || '【撮影場所を記入】') + '。',
    '聞き手:画面外、または横から。出演者に目線を向けて質問する。',
    '収録:ピンマイク2本。回答の前後を約1秒余分に収録。',
    'インサート(任意):回答の合間に、手元・現場の引きを挟む。',
  ];
  const lay = new Table({ width: { size: 10319, type: WidthType.DXA }, columnWidths: [3300, 3300, 3719], rows: [new TableRow({ children: [
    new TableCell({ borders: nob, width: { size: 3300, type: WidthType.DXA }, children: [para(run('撮影画角(画角図)', { bold: true }), { after: 60 }), para(run('(空欄)', { size: 18, color: GREY }), { after: 0 })] }),
    new TableCell({ borders: nob, width: { size: 3300, type: WidthType.DXA }, children: [para(run('参考(参考動画の画角)', { bold: true }), { after: 60 }), refPara] }),
    new TableCell({ borders: nob, width: { size: 3719, type: WidthType.DXA }, children: [para(run('撮影指示', { size: 22, bold: true }), { after: 80 }), ...notes.map(body)] }),
  ] })] });
  const scriptLines = p.script.map(s => `${s[0]}　${s[2]}`);
  const children = [...cover(p, p.total_sec || 60, 0, scriptLines, !!ref),
    para(run(`企画${p.no} ${p.name} 画角図`, { size: 22, bold: true }), { after: 100, pageBreakBefore: true }), lay,
    para(run(`企画${p.no} ${p.name} 進行表`, { size: 22, bold: true }), { after: 100, before: 300 }),
    new Table({ width: { size: 10319, type: WidthType.DXA }, columnWidths: COLS, rows })];
  return { children, total: p.total_sec || 60, count: p.script.length };
}

// ---------- PDF ----------
function toPdf(file) {
  for (const bin of ['soffice', 'libreoffice']) {
    try { execFileSync(bin, ['--headless', '--convert-to', 'pdf', '--outdir', OUT, file], { stdio: 'ignore' }); return true; } catch (e) { /* 次へ */ }
  }
  warn('PDFにできませんでした。LibreOffice(soffice)を入れるか、Wordから手でPDFにしてください。');
  return false;
}

// ---------- 本体 ----------
(async () => {
  const list = (D.projects || []).filter(p => !ONLY || String(p.no) === String(ONLY));
  if (!list.length) fail('作る企画がありません(projects が空、または --only の番号が違います)。');
  list.forEach(validate);
  for (const p of list) {
    const r = p.type === 'interview' ? buildInterview(p) : buildStoryboard(p);
    const doc = new Document({ creator: 'Claude', title: `${BRAND} 絵コンテ 企画${p.no} ${p.name}`,
      styles: { default: { document: { run: { font: FONT, size: 20 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 737, right: 794, bottom: 737, left: 794, header: 255, footer: 283 } } },
        footers: { default: footer }, children: r.children }] });
    const buf = await Packer.toBuffer(doc);
    const fn = path.join(OUT, `絵コンテ_企画${p.no}_${p.slug}_${BRAND}.docx`);
    fs.writeFileSync(fn, buf);
    console.log(`作成: ${fn}  (${r.count}${p.type === 'interview' ? '行' : 'カット'}, ${r.total}秒)`);
    if (WANT_PDF) toPdf(fn);
  }
})();
