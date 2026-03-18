#!/usr/bin/env node
/**
 * fetch.js — Backlog アクティブ課題を tasks.yaml に出力
 *
 * Usage:
 *   node fetch.js                        # config.yaml → tasks.yaml
 *   node fetch.js --config my.yaml       # 設定ファイルを指定
 *   node fetch.js --output out.yaml      # 出力先を指定
 *   node fetch.js --dry-run              # 出力せずに件数確認
 *
 * 必要バージョン: Node.js >= 18 (fetch API 内蔵)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { program } from 'commander';
import yaml from 'js-yaml';
import { toDate, toName, toNames, convertIssue, buildOutput } from '../lib/transform.js';
import { BacklogClient } from '../lib/client.js';

const DEFAULT_STATUS_IDS = [1, 2, 3]; // 1:未対応 2:処理中 3:処理済み

// ---------------------------------------------------------------------------
// 設定読み込み
// ---------------------------------------------------------------------------

function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    console.error(`Error: 設定ファイルが見つかりません: ${configPath}`);
    console.error('  cp config.yaml.example config.yaml  で作成してください');
    process.exit(1);
  }

  return yaml.load(readFileSync(configPath, 'utf8'));
}

// ---------------------------------------------------------------------------
// YAML 読み書き
// ---------------------------------------------------------------------------

/** 既存 tasks.yaml を読み込み { issue_key: { release_date, note } } を返す */
function loadExistingTasks(outputPath) {
  if (!existsSync(outputPath)) return {};

  const data = yaml.load(readFileSync(outputPath, 'utf8'));
  if (!data?.tasks) return {};

  return Object.fromEntries(
    data.tasks.map(t => [
      t.backlog.issue_key,
      { release_date: t.custom.release_date ?? null, note: t.custom.note ?? '' },
    ])
  );
}

function saveYaml(data, outputPath) {
  const dir = dirname(outputPath);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  writeFileSync(outputPath, yaml.dump(data, { allowUnicode: true, lineWidth: -1 }), 'utf8');
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

program
  .description('Backlog のアクティブ課題を tasks.yaml に出力する')
  .option('--config <path>', '設定ファイルパス', 'config.yaml')
  .option('--output <path>', '出力 YAML パス (config の設定を上書き)')
  .option('--dry-run',       '出力せずに取得件数のみ確認')
  .parse();

const opts = program.opts();
const config = loadConfig(opts.config);

const outputPath = opts.output ?? config.output?.tasks_yaml ?? 'tasks.yaml';
const statusIds  = config.fetch?.active_status_ids ?? DEFAULT_STATUS_IDS;

const apiKey = process.env.BACKLOG_API_KEY;
if (!apiKey) {
  console.error('Error: 環境変数 BACKLOG_API_KEY が設定されていません');
  console.error("  echo 'export BACKLOG_API_KEY=your_api_key_here' >> ~/.zshrc && source ~/.zshrc");
  process.exit(1);
}

const client = new BacklogClient(config.api.space_id, apiKey, config.api.domain ?? 'backlog.jp');

// プロジェクト ID 解決
const projectKeys = config.api.project_keys ?? [];
let projectIds = config.api.project_ids ?? [];

if (projectKeys.length > 0) {
  console.log(`プロジェクト解決中: ${projectKeys.join(', ')}`);
  projectIds = await client.resolveProjectIds(projectKeys);
  console.log(`  → project_ids: ${projectIds.join(', ')}`);
}

if (projectIds.length === 0) {
  console.error('Error: config.yaml に project_keys または project_ids を設定してください');
  process.exit(1);
}

// 既存データ読み込み (release_date / note を保持)
const existing = loadExistingTasks(outputPath);
const existingCount = Object.keys(existing).length;
if (existingCount > 0) {
  console.log(`既存 tasks.yaml: ${existingCount} 件 (release_date/note を保持)`);
}

// 追加フィルターパラメータを config から構築
const extraParams = {};
if (config.fetch?.assignee_ids?.length)   extraParams['assigneeId[]']   = config.fetch.assignee_ids;
if (config.fetch?.milestone_ids?.length)  extraParams['milestoneId[]']  = config.fetch.milestone_ids;
if (config.fetch?.category_ids?.length)   extraParams['categoryId[]']   = config.fetch.category_ids;
if (config.fetch?.issue_type_ids?.length) extraParams['issueTypeId[]']  = config.fetch.issue_type_ids;
if (config.fetch?.keyword)                extraParams['keyword']         = config.fetch.keyword;
if (config.fetch?.exclude_child_issues)   extraParams['parentChild']     = 1; // 1: 子課題以外

// 課題取得
const rawIssues = await client.fetchAllIssues(projectIds, statusIds, extraParams);
console.log(`取得完了: ${rawIssues.length} 件`);

if (opts.dryRun) {
  console.log('[dry-run] ファイル出力をスキップします');
  process.exit(0);
}

// 変換・保存
const output = buildOutput(rawIssues, existing, config);
saveYaml(output, outputPath);

// サマリー表示
const untagged = output.tasks.filter(t => !t.custom.release_date).length;
console.log(`✓ ${outputPath} に ${output.tasks.length} 件を出力しました`);
if (untagged > 0) {
  console.log(`  ⚠ release_date 未設定: ${untagged} 件`);
}
