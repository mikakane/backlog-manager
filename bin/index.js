#!/usr/bin/env node
/**
 * index.js — Backlog Manager エントリーポイント
 *
 * サブコマンドあり → 個別実行
 *   npx github:mikakane/backlog-manager list
 *   npx github:mikakane/backlog-manager fetch
 *   npx github:mikakane/backlog-manager fetch-sub
 *   npx github:mikakane/backlog-manager split
 *   npx github:mikakane/backlog-manager generate
 *
 * サブコマンドなし → fetch → split → generate を一括実行
 *   npx github:mikakane/backlog-manager
 *   npx github:mikakane/backlog-manager --config my.yaml
 *   npx github:mikakane/backlog-manager --dry-run
 */

import { spawnSync }     from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCRIPTS = {
  fetch:     join(__dirname, 'fetch.js'),
  'fetch-sub': join(__dirname, 'fetch-sub.js'),
  split:     join(__dirname, 'split.js'),
  generate:  join(__dirname, 'generate.js'),
  list:      join(__dirname, 'list.js'),
};

const PIPELINE = ['fetch', 'split', 'generate'];
const DIVIDER  = '─'.repeat(50);

// ---------------------------------------------------------------------------
// サブコマンド判定
//   第1引数が SCRIPTS のキーならサブコマンドとして個別実行
//   '-' 始まりのオプション or 未指定ならパイプライン全実行
// ---------------------------------------------------------------------------

const first = process.argv[2];
const isSubcommand = first && !first.startsWith('-') && first in SCRIPTS;

if (isSubcommand) {
  // 個別実行: 残りの引数をそのままスクリプトへ渡す
  const result = spawnSync('node', [SCRIPTS[first], ...process.argv.slice(3)], {
    stdio: 'inherit',
  });
  process.exit(result.status ?? 0);
}

// ---------------------------------------------------------------------------
// パイプライン全実行
//   process.argv.slice(2) のオプション (--config / --dry-run 等) を各ステップに透過
// ---------------------------------------------------------------------------

const passthroughArgs = process.argv.slice(2); // --config xxx --dry-run など

console.log(`\nbacklog-manager  (${PIPELINE.join(' → ')})`);

for (const name of PIPELINE) {
  console.log(`\n${DIVIDER}`);
  console.log(`▶  ${name}`);
  console.log(DIVIDER);

  const result = spawnSync('node', [SCRIPTS[name], ...passthroughArgs], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error(`\nError: ${name} が失敗しました (exit: ${result.status ?? 'unknown'})`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\n${DIVIDER}`);
console.log('✓ すべての処理が完了しました');
