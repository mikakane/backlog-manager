#!/usr/bin/env node
/**
 * split.js — tasks.yaml をリリース日ごとの YAML に分割
 *
 * Usage:
 *   node bin/split.js                        # tasks.yaml → release-tasks/
 *   node bin/split.js --config my.yaml       # 設定ファイルを指定
 *   node bin/split.js --input other.yaml     # 入力ファイルを指定
 *   node bin/split.js --output-dir out/      # 出力ディレクトリを指定
 *   node bin/split.js --dry-run              # 出力せずに分割結果を確認
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';
import yaml from 'js-yaml';
import { groupByReleaseDate } from '../lib/transform.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI 引数
// ---------------------------------------------------------------------------

program
  .description('tasks.yaml をリリース日ごとの YAML に分割する')
  .option('--config <path>',     '設定ファイルパス',             'config.yaml')
  .option('--input <path>',      '入力 tasks.yaml パス (config の設定を上書き)')
  .option('--output-dir <dir>',  '出力ディレクトリ (config の設定を上書き)')
  .option('--dry-run',           '出力せずに分割結果のみ表示')
  .parse();

const opts = program.opts();

// ---------------------------------------------------------------------------
// 設定読み込み
// ---------------------------------------------------------------------------

const config = existsSync(opts.config)
  ? yaml.load(readFileSync(opts.config, 'utf8'))
  : {};

const inputPath  = opts.input     ?? config?.output?.tasks_yaml    ?? 'tasks.yaml';
const outputDir  = opts.outputDir ?? config?.paths?.releases_dir   ?? 'release-tasks';

// ---------------------------------------------------------------------------
// tasks.yaml 読み込み
// ---------------------------------------------------------------------------

if (!existsSync(inputPath)) {
  console.error(`Error: 入力ファイルが見つかりません: ${inputPath}`);
  console.error('  先に fetch を実行してください: node bin/fetch.js');
  process.exit(1);
}

const data = yaml.load(readFileSync(inputPath, 'utf8'));
const tasks = data?.tasks ?? [];

if (tasks.length === 0) {
  console.error(`Error: ${inputPath} にタスクが存在しません`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// リリース日ごとにグループ化 (日付順ソート、untagged を末尾に)
// ---------------------------------------------------------------------------

const sorted = groupByReleaseDate(tasks);

// ---------------------------------------------------------------------------
// サマリー表示
// ---------------------------------------------------------------------------

const taggedDates   = sorted.filter(([k]) => k !== '__untagged__');
const untaggedEntry = sorted.find(([k]) => k === '__untagged__');
const untaggedCount = untaggedEntry?.[1]?.length ?? 0;

console.log(`入力: ${inputPath}  (${tasks.length} 件)`);
console.log(`出力先: ${outputDir}/`);
console.log('');
console.log(`リリース日: ${taggedDates.length} 件`);
for (const [date, list] of taggedDates) {
  console.log(`  ${date}: ${list.length} 件`);
}
if (untaggedCount > 0) {
  console.log(`  (untagged): ${untaggedCount} 件 → untagged.yaml`);
}

if (opts.dryRun) {
  console.log('\n[dry-run] ファイル出力をスキップします');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// YAML 出力
// ---------------------------------------------------------------------------

mkdirSync(outputDir, { recursive: true });

const generatedAt = new Date().toISOString();

for (const [key, list] of sorted) {
  const isUntagged = key === '__untagged__';
  const filename   = isUntagged ? 'untagged.yaml' : `${key}.yaml`;
  const filePath   = join(outputDir, filename);

  const doc = {
    release: {
      date:         isUntagged ? null : key,
      generated_at: generatedAt,
      task_count:   list.length,
    },
    tasks: list,
  };

  writeFileSync(filePath, yaml.dump(doc, { allowUnicode: true, lineWidth: -1 }), 'utf8');
  console.log(`  ✓ ${filePath}  (${list.length} 件)`);
}

console.log(`\n完了: ${sorted.length} ファイルを出力しました`);
