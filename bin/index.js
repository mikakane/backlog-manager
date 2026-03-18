#!/usr/bin/env node
/**
 * index.js — fetch → split → generate をまとめて実行
 *
 * Usage:
 *   npx github:mikakane/backlog-manager
 *   npx github:mikakane/backlog-manager --config my.yaml
 *   npx github:mikakane/backlog-manager --dry-run
 *   npx github:mikakane/backlog-manager --only fetch
 */

import { spawnSync }        from 'child_process';
import { fileURLToPath }    from 'url';
import { dirname, join }    from 'path';
import { program }          from 'commander';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI 引数
// ---------------------------------------------------------------------------

program
  .description('Backlog 課題を取得し PPTX を生成する (fetch → split → generate)')
  .option('--config <path>', '設定ファイルパス', 'config.yaml')
  .option('--only <step>',   '指定ステップのみ実行 (fetch / split / generate)')
  .option('--dry-run',       '出力せずに確認のみ')
  .parse();

const opts = program.opts();

// ---------------------------------------------------------------------------
// ステップ定義
// ---------------------------------------------------------------------------

const ALL_STEPS = [
  { name: 'fetch',    script: join(__dirname, 'fetch.js') },
  { name: 'split',    script: join(__dirname, 'split.js') },
  { name: 'generate', script: join(__dirname, 'generate.js') },
];

// --only が指定された場合は該当ステップのみ
const steps = opts.only
  ? ALL_STEPS.filter(s => s.name === opts.only)
  : ALL_STEPS;

if (steps.length === 0) {
  console.error(`Error: 不明なステップ: ${opts.only}`);
  console.error(`  指定できる値: ${ALL_STEPS.map(s => s.name).join(' / ')}`);
  process.exit(1);
}

// 各ステップに渡す共通オプション
const commonArgs = [
  '--config', opts.config,
  ...(opts.dryRun ? ['--dry-run'] : []),
];

// ---------------------------------------------------------------------------
// 順次実行
// ---------------------------------------------------------------------------

const DIVIDER = '─'.repeat(50);

console.log(`\nbacklog-manager  (${steps.map(s => s.name).join(' → ')})`);

for (const step of steps) {
  console.log(`\n${DIVIDER}`);
  console.log(`▶  ${step.name}`);
  console.log(DIVIDER);

  const result = spawnSync('node', [step.script, ...commonArgs], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error(`\nError: ${step.name} が失敗しました (exit: ${result.status ?? 'unknown'})`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\n${DIVIDER}`);
console.log('✓ すべての処理が完了しました');
