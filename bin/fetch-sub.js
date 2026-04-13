#!/usr/bin/env node
/**
 * fetch-sub.js — tasks.yaml の親課題IDをキーに子課題を取得して別ファイルに出力
 *
 * Usage:
 *   node bin/fetch-sub.js
 *   node bin/fetch-sub.js --config my.yaml
 *   node bin/fetch-sub.js --tasks tasks.yaml --output tasks-sub.yaml
 *   node bin/fetch-sub.js --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { program } from 'commander';
import yaml from 'js-yaml';
import { BacklogClient } from '../lib/client.js';
import { convertIssue } from '../lib/transform.js';

program
  .description('tasks.yaml の親課題IDをキーに子課題を取得して出力する')
  .option('--config <path>',  '設定ファイルパス',              'config.yaml')
  .option('--tasks <path>',   '親課題 tasks.yaml パス (config の設定を上書き)')
  .option('--output <path>',  '出力 YAML パス (config の設定を上書き)')
  .option('--dry-run',        '出力せずに取得件数のみ確認')
  .parse();

const opts = program.opts();

// ---------------------------------------------------------------------------
// 設定読み込み
// ---------------------------------------------------------------------------

if (!existsSync(opts.config)) {
  console.error(`Error: 設定ファイルが見つかりません: ${opts.config}`);
  process.exit(1);
}
const config = yaml.load(readFileSync(opts.config, 'utf8'));

const tasksPath  = opts.tasks  ?? config.output?.tasks_yaml    ?? 'tasks.yaml';
const outputPath = opts.output ?? config.output?.tasks_sub_yaml ?? 'tasks-sub.yaml';

// ---------------------------------------------------------------------------
// 親課題の tasks.yaml を読み込んで backlog_id を収集
// ---------------------------------------------------------------------------

if (!existsSync(tasksPath)) {
  console.error(`Error: 親課題ファイルが見つかりません: ${tasksPath}`);
  console.error('  先に fetch を実行してください: node bin/fetch.js');
  process.exit(1);
}

const parentData  = yaml.load(readFileSync(tasksPath, 'utf8'));
const parentTasks = parentData?.tasks ?? [];

const parentIds = parentTasks
  .map(t => t.backlog.backlog_id)
  .filter(Boolean);

if (parentIds.length === 0) {
  console.error(`Error: ${tasksPath} に backlog_id が見つかりません`);
  console.error('  fetch を再実行して backlog_id を付与してください');
  process.exit(1);
}

console.log(`親課題: ${parentIds.length} 件 → 子課題を取得中...`);

// ---------------------------------------------------------------------------
// Backlog API で子課題を取得
// ---------------------------------------------------------------------------

const apiKey = process.env.BACKLOG_API_KEY;
if (!apiKey) {
  console.error('Error: 環境変数 BACKLOG_API_KEY が設定されていません');
  process.exit(1);
}

const domain  = config.api.domain ?? 'backlog.jp';
const urlBase = `https://${config.api.space_id}.${domain}/view`;
const client  = new BacklogClient(config.api.space_id, apiKey, domain);

// parentIssueId[] で子課題を取得（100件ずつバッチ）
const rawChildren = [];
const BATCH = 100;

for (let i = 0; i < parentIds.length; i += BATCH) {
  const chunk = parentIds.slice(i, i + BATCH);
  const extraParams = { 'parentIssueId[]': chunk };

  let offset = 0;
  while (true) {
    const batch = await client.get('/issues', {
      'projectId[]': config.api.project_ids ??
        await client.resolveProjectIds(config.api.project_keys ?? []),
      ...extraParams,
      count:  100,
      offset,
    });
    rawChildren.push(...batch);
    if (batch.length < 100) break;
    offset += 100;
  }
}

console.log(`子課題取得完了: ${rawChildren.length} 件`);

if (opts.dryRun) {
  console.log('[dry-run] ファイル出力をスキップします');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 既存の tasks-sub.yaml から custom フィールドを引き継ぐ
// ---------------------------------------------------------------------------

let existing = {};
if (existsSync(outputPath)) {
  const prev = yaml.load(readFileSync(outputPath, 'utf8'));
  if (prev?.tasks) {
    existing = Object.fromEntries(
      prev.tasks.map(t => [t.backlog.issue_key, t.custom ?? {}])
    );
  }
}

// ---------------------------------------------------------------------------
// 変換・保存
// ---------------------------------------------------------------------------

// 親マップ（子課題の parent_issue_key を解決するため）
const idToKey   = Object.fromEntries([
  ...parentTasks.map(t => [t.backlog.backlog_id, t.backlog.issue_key]),
  ...rawChildren.map(i => [i.id, i.issueKey]),
]);
const parentIdSet = new Set(rawChildren.map(i => i.parentIssueId).filter(Boolean));

const tasks = rawChildren.map(issue =>
  convertIssue(issue, existing, urlBase, idToKey, parentIdSet)
);

const output = {
  meta: {
    fetched_at:   new Date().toISOString(),
    space_id:     config.api.space_id,
    parent_count: parentIds.length,
    total:        tasks.length,
  },
  tasks,
};

const dir = dirname(outputPath);
if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
writeFileSync(outputPath, yaml.dump(output, { allowUnicode: true, lineWidth: -1 }), 'utf8');

console.log(`✓ ${outputPath} に ${tasks.length} 件を出力しました`);
