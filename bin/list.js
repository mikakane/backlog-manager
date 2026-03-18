#!/usr/bin/env node
/**
 * list.js — config.yaml に設定する ID を一覧表示
 *
 * Usage:
 *   node bin/list.js                        # 全プロジェクトの ID を表示
 *   node bin/list.js --config my.yaml
 *   node bin/list.js --project PROJECT1     # 指定プロジェクトのみ
 */

import { existsSync, readFileSync } from 'fs';
import { program }                  from 'commander';
import yaml                         from 'js-yaml';
import { BacklogClient }            from '../lib/client.js';

// ---------------------------------------------------------------------------
// CLI 引数
// ---------------------------------------------------------------------------

program
  .description('config.yaml に設定する ID を一覧表示する')
  .option('--config <path>',   '設定ファイルパス', 'config.yaml')
  .option('--project <key>',   '表示するプロジェクトキー (省略時: 全件)')
  .parse();

const opts = program.opts();

// ---------------------------------------------------------------------------
// 設定・API キー
// ---------------------------------------------------------------------------

if (!existsSync(opts.config)) {
  console.error(`Error: 設定ファイルが見つかりません: ${opts.config}`);
  process.exit(1);
}

const config = yaml.load(readFileSync(opts.config, 'utf8'));

const apiKey = process.env.BACKLOG_API_KEY;
if (!apiKey) {
  console.error('Error: 環境変数 BACKLOG_API_KEY が設定されていません');
  process.exit(1);
}

const client = new BacklogClient(
  config.api.space_id,
  apiKey,
  config.api.domain ?? 'backlog.jp',
);

// ---------------------------------------------------------------------------
// 対象プロジェクトキーを決定
// ---------------------------------------------------------------------------

const allKeys = config.api.project_keys ?? [];

const projectKeys = opts.project
  ? [opts.project]
  : allKeys;

if (projectKeys.length === 0) {
  console.error('Error: config.yaml に project_keys を設定するか --project を指定してください');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/** 左揃えで ID と名前を整形して出力 */
function printRows(rows) {
  if (rows.length === 0) { console.log('  (なし)'); return; }
  const maxIdLen = Math.max(...rows.map(r => String(r.id).length));
  for (const { id, name, extra } of rows) {
    const idStr   = String(id).padStart(maxIdLen);
    const extraStr = extra ? `  (${extra})` : '';
    console.log(`  ${idStr}  ${name}${extraStr}`);
  }
}

// ---------------------------------------------------------------------------
// 各プロジェクトの ID を取得・表示
// ---------------------------------------------------------------------------

for (const key of projectKeys) {
  console.log(`\nプロジェクト: ${key}`);
  console.log('─'.repeat(40));

  // 4つのエンドポイントを並列取得
  const [categories, milestones, issueTypes, members] = await Promise.all([
    client.get(`/projects/${key}/categories`).catch(() => []),
    client.get(`/projects/${key}/versions`).catch(() => []),
    client.get(`/projects/${key}/issueTypes`).catch(() => []),
    client.get(`/projects/${key}/members`).catch(() => []),
  ]);

  console.log('\nカテゴリー (category_ids):');
  printRows(categories.map(c => ({ id: c.id, name: c.name })));

  console.log('\nマイルストーン (milestone_ids):');
  printRows(milestones.map(m => ({ id: m.id, name: m.name, extra: m.releaseDueDate ?? null })));

  console.log('\n課題種別 (issue_type_ids):');
  printRows(issueTypes.map(t => ({ id: t.id, name: t.name })));

  console.log('\n担当者 (assignee_ids):');
  printRows(members.map(u => ({ id: u.id, name: u.name })));
}

console.log('');
