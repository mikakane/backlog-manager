#!/usr/bin/env node
// generate.js — releases/*.yaml → releases/backlog.pptx 生成
//
// 依存パッケージ:
//   js-yaml   — YAML 読み込み  (npm install js-yaml)
//   pptxgenjs — PPTX 生成     (npm install pptxgenjs)
//   commander — CLI 引数解析  (npm install commander)
//
// Usage:
//   node generate.js
//   node generate.js --config my.yaml
//   node generate.js --output out.pptx
//   node generate.js --releases-dir releases/
//   node generate.js --dry-run

import fs   from "fs";
import path from "path";
import yaml from "js-yaml";
import { program } from "commander";
import PptxGenJS from "pptxgenjs";

// ---------------------------------------------------------------------------
// CLI 引数
// ---------------------------------------------------------------------------
program
  .option("--config <file>",        "設定ファイル",          "config.yaml")
  .option("--output <file>",        "出力 PPTX パス")
  .option("--releases-dir <dir>",   "YAML ディレクトリ")
  .option("--dry-run",              "スライド構成のみ表示")
  .parse();

const opts = program.opts();

// ---------------------------------------------------------------------------
// 設定読み込み
// ---------------------------------------------------------------------------
const config      = fs.existsSync(opts.config)
  ? yaml.load(fs.readFileSync(opts.config, "utf8"))
  : {};
const outputFile  = opts.output      ?? config?.paths?.pptx_output  ?? "tasks.pptx";
const releasesDir = opts.releasesDir ?? config?.paths?.releases_dir ?? "release-tasks";
const titlePrefix = config?.pptx?.title_prefix ?? "リリース計画";

// 列定義: config.yaml の pptx.columns を優先、なければデフォルト
const DEFAULT_COLUMNS = [
  { key: "id",       label: "ID",         width: 1.2 },
  { key: "title",    label: "タイトル",   width: 4.5 },
  { key: "priority", label: "優先度",     width: 1.0 },
  { key: "assignee", label: "担当者",     width: 1.2 },
  { key: "status",   label: "ステータス", width: 1.5 },
  { key: "note",     label: "メモ",       width: 3.5 },
];
const COLUMNS = config?.pptx?.columns ?? DEFAULT_COLUMNS;

/** タスクオブジェクトから列キーに対応する値を返す (backlog → custom の順で探索) */
function resolveCell(task, key) {
  if (key in (task.backlog ?? {})) return task.backlog[key];
  if (key in (task.custom  ?? {})) return task.custom[key];
  return "";
}

// ---------------------------------------------------------------------------
// releases/*.yaml 収集 (日付順ソート、untagged.yaml 除外)
// ---------------------------------------------------------------------------
if (!fs.existsSync(releasesDir)) {
  console.error(`Error: ディレクトリが見つかりません: ${releasesDir}`);
  console.error("  先に split を実行してください");
  process.exit(1);
}

const releaseFiles = fs
  .readdirSync(releasesDir)
  .filter(f => /^\d{4}-\d{2}-\d{2}\.yaml$/.test(f))
  .sort()
  .map(f => path.join(releasesDir, f));

if (releaseFiles.length === 0) {
  console.error(`Error: ${releasesDir}/ に YYYY-MM-DD.yaml が見つかりません`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// スライドデータ構築
// ---------------------------------------------------------------------------
const slides = releaseFiles.map(filePath => {
  const doc   = yaml.load(fs.readFileSync(filePath, "utf8"));
  const date  = doc?.release?.date ?? path.basename(filePath, ".yaml");
  const tasks = (doc?.tasks ?? []).map(t =>
    Object.fromEntries(COLUMNS.map(col => [col.key, String(resolveCell(t, col.key) ?? "")]))
  );
  return { date, tasks };
});

console.log(`対象リリース: ${slides.length} 件`);
slides.forEach(s => console.log(`  ${s.date}: ${s.tasks.length} 件`));

if (opts.dryRun) {
  console.log("\n[dry-run] ファイル出力をスキップします");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// PPTX 生成
// ---------------------------------------------------------------------------
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 インチ

const NAVY  = "1F497D";
const WHITE = "FFFFFF";
const GRAY1 = "F2F2F2";
const GRAY2 = "FFFFFF";

const LM     = 0.3;  // 左マージン
const RH     = 0.32; // 行高さ
const HTOP   = 1.6;  // ヘッダー行 Y

// ── ヘルパー ──────────────────────────────────────────────────────────────
function addText(slide, text, opts) {
  slide.addText(text, opts);
}

function addRect(slide, x, y, w, h, fill) {
  slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: fill }, line: { color: fill } });
}

// ── 表紙 ──────────────────────────────────────────────────────────────────
const cover = pptx.addSlide();

addRect(cover, 0, 0, 13.33, 1.8, NAVY);
addText(cover, titlePrefix, {
  x: 0.5, y: 0.4, w: 12, h: 1.0,
  fontSize: 32, bold: true, color: WHITE,
});

const generatedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
addText(cover, `生成日時: ${generatedAt}`, {
  x: 0.5, y: 2.0, w: 12, h: 0.5,
  fontSize: 14, color: "505050",
});

const releaseLines = slides.map(s => `  ${s.date}  (${s.tasks.length} 件)`).join("\n");
addText(cover, `リリース一覧:\n${releaseLines}`, {
  x: 0.5, y: 2.8, w: 12, h: 4.0,
  fontSize: 14,
});

// ── リリース日スライド ─────────────────────────────────────────────────────
for (const { date, tasks } of slides) {
  const sl = pptx.addSlide();

  // ヘッダーバー
  addRect(sl, 0, 0, 13.33, 1.4, NAVY);
  addText(sl, `${titlePrefix}  —  ${date}`, {
    x: 0.3, y: 0.2, w: 10, h: 0.9,
    fontSize: 24, bold: true, color: WHITE,
  });
  addText(sl, `${tasks.length} 件`, {
    x: 10.5, y: 0.5, w: 2.5, h: 0.6,
    fontSize: 16, color: "C8DCFF", align: "right",
  });

  // カラムヘッダー行
  let x = LM;
  for (const col of COLUMNS) {
    addRect(sl, x, HTOP, col.width, RH, NAVY);
    addText(sl, col.label, {
      x: x + 0.05, y: HTOP + 0.04, w: col.width - 0.1, h: RH,
      fontSize: 11, bold: true, color: WHITE,
    });
    x += col.width;
  }

  // データ行
  for (let rowIdx = 0; rowIdx < tasks.length; rowIdx++) {
    const rowTop = HTOP + RH * (rowIdx + 1);
    if (rowTop + RH > 7.3) break; // スライド下端

    const bg = rowIdx % 2 === 0 ? GRAY1 : GRAY2;
    x = LM;
    for (const col of COLUMNS) {
      addRect(sl, x, rowTop, col.width, RH, bg);
      addText(sl, tasks[rowIdx][col.key] ?? "", {
        x: x + 0.05, y: rowTop + 0.04, w: col.width - 0.1, h: RH,
        fontSize: 10,
      });
      x += col.width;
    }
  }
}

// ---------------------------------------------------------------------------
// ファイル出力
// ---------------------------------------------------------------------------
fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });

await pptx.writeFile({ fileName: outputFile });

const totalTasks = slides.reduce((sum, s) => sum + s.tasks.length, 0);
console.log(`✓ ${outputFile} を生成しました`);
console.log(`  スライド数: ${slides.length + 1} (表紙 + リリース ${slides.length} 件)`);
console.log(`  総タスク数: ${totalTasks} 件`);
