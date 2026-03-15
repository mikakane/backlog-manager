# Backlog 管理システム 設計書

## 概要

タスク管理システムの REST API からアクティブタスクを取得し、YAML で管理・リリース日タグ付けを行い、全リリース日をまとめた 1 つの PPTX を生成するシステム。

---

## システム全体フロー

```
[タスク管理システム REST API]
        ↓ fetch
[tasks.yaml (active タスク一覧)]
        ↓ 手動でリリース日タグ付け
[tasks.yaml (release_date 付き)]
        ↓ split
[releases/YYYY-MM-DD.yaml (リリース日ごと)]
        ↓ generate
[releases/backlog.pptx (全リリース日まとめ、1リリース日 = 1スライド)]
```

---

## コンポーネント構成

```
backlog-manager/
├── bin/
│   └── backlog.js      # CLI エントリポイント
├── commands/
│   ├── fetch.js        # API → tasks.yaml 更新
│   ├── split.js        # tasks.yaml → releases/*.yaml 分割
│   └── generate.js     # releases/*.yaml → releases/*.pptx 生成
├── core/
│   ├── apiClient.js    # REST API クライアント
│   ├── taskModel.js    # データモデル
│   ├── yamlManager.js  # YAML 読み書き
│   └── pptxBuilder.js  # PPTX 生成
├── package.json
├── config.yaml         # 接続先・設定
├── tasks.yaml          # アクティブタスク一覧 (成果物)
└── releases/
    ├── 2026-04-01.yaml
    ├── 2026-05-01.yaml
    └── backlog.pptx        # 全リリース日まとめ (1リリース日 = 1スライド)
```

---

## データモデル

### tasks.yaml スキーマ

```yaml
meta:
  fetched_at: "2026-03-15T10:00:00+09:00"
  source: "https://api.example.com"
  total: 42

tasks:
  - backlog:                           # Backlog API から取得
      id: "TASK-123"
      title: "ログイン機能の実装"
      status: "in_progress"
      priority: "high"
      assignee: "yamada"
      created_at: "2026-02-01"
      updated_at: "2026-03-10"
      labels: ["backend", "auth"]
    custom:                            # 手動で管理するカスタムデータ
      release_date: "2026-04-01"       # 手動タグ付け (初期値: null)
      note: ""                         # 自由記述メモ (初期値: "")
```

### releases/YYYY-MM-DD.yaml スキーマ

```yaml
release:
  date: "2026-04-01"
  generated_at: "2026-03-15T12:00:00+09:00"
  task_count: 15

tasks:
  - id: "TASK-123"
    title: "ログイン機能の実装"
    priority: "high"
    assignee: "yamada"
    status: "in_progress"
    labels: ["backend", "auth"]
    note: ""
```

---

## 各コマンド詳細

### 1. `fetch` — タスク取得・YAML 更新

```bash
backlog fetch [--status active] [--dry-run]
```

**動作:**
1. `config.yaml` の API エンドポイントへ GET リクエスト
2. フィルタ条件 (status=active 等) で絞り込み
3. `tasks.yaml` に upsert (id をキーに既存エントリを保持)
   - **既存の `release_date` / `note` は上書きしない**
   - API から消えたタスク (完了・削除) は `status: closed` としてマーク or 除去 (設定で選択)
4. `meta.fetched_at` を更新

**マージ戦略 (重要):**

| フィールド | 扱い |
|---|---|
| id, title, status, priority 等 | API から上書き |
| release_date | 既存値を保持 (null のみ API 値で初期化) |
| note | 既存値を保持 |

---

### 2. `tag` — リリース日タグ付け

タグ付けは **手動 YAML 編集のみ** で行う。`tasks.yaml` の各タスクの `release_date` フィールドを直接編集する。

```yaml
# tasks.yaml を直接編集
tasks:
  - id: "TASK-123"
    release_date: "2026-04-01"   # ここを手動で入力
```

---

### 3. `split` — リリース日ごとに分割

```bash
backlog split [--output-dir releases/]
```

**動作:**
1. `tasks.yaml` から `release_date` が設定済みのタスクを抽出
2. `release_date` ごとにグループ化
3. `releases/YYYY-MM-DD.yaml` を生成 (既存ファイルは上書き)
4. `release_date: null` のタスクは `releases/untagged.yaml` に出力

**出力ファイル例:**
```
releases/
├── 2026-04-01.yaml   (15件)
├── 2026-05-01.yaml   (8件)
└── untagged.yaml     (3件)
```

---

### 4. `generate` — PPTX 生成

```bash
backlog generate [--template template.pptx] [--output releases/backlog.pptx]
```

**スライド構成 (1ファイル、1リリース日 = 1スライド):**

| スライド | 内容 |
|---|---|
| 1 | 表紙: 生成日時、リリース日一覧 |
| 2 | リリース日 2026-04-01 のタスク一覧 |
| 3 | リリース日 2026-05-01 のタスク一覧 |
| … | 以降、リリース日ごとに 1 スライド |

**タスク一覧スライドのレイアウト例 (1件/行):**
```
2026-04-01 リリース (15件)

ID         タイトル                    優先度  担当者   ステータス
TASK-123   ログイン機能の実装          HIGH    yamada   in_progress
TASK-456   パスワードリセット機能      MED     sato     todo
```

---

## config.yaml

```yaml
api:
  base_url: "https://api.example.com"
  auth:
    type: "bearer"          # bearer / basic / api_key
    token: "${API_TOKEN}"   # 環境変数参照
  endpoints:
    tasks: "/v1/tasks"
  params:
    status: ["active", "in_progress", "todo"]  # フィルタ
    per_page: 100

fetch:
  closed_task_action: "remove"   # remove / mark (status: closed にする)

paths:
  tasks_yaml: "tasks.yaml"
  releases_dir: "releases/"
  pptx_template: "template.pptx"  # null で組み込みテンプレート使用
  pptx_output: "releases/backlog.pptx"

pptx:
  title_prefix: "リリース計画"
```

---

## 検討が必要な点

### 1. 接続する タスク管理システムは何か?
- Jira / Backlog (ヌーラボ) / Linear / GitHub Issues / Notion など
- API 認証方式・レスポンス形式が変わる
- → まずターゲットを決める

### 2. `fetch` の差分更新戦略
- 毎回全件取得 vs `updated_since` で差分取得
- タスクが API から消えた場合の扱い: 削除 or `closed` マーク

### 3. タグ付けワークフロー
- **手動 YAML 編集のみ** (決定済み)

### 4. PPTX テンプレート
- 組み込みデフォルトで始めるか、既存テンプレートに合わせるか
- 必要なスライド構成・レイアウトを確定する

### 5. 実行環境・技術スタック
- Node.js (js-yaml + pptxgenjs) で実装
- CLI フレームワーク: Commander.js / yargs
- 単発実行 vs スケジュール実行 (cron / GitHub Actions)

---

## 未決事項まとめ

| # | 項目 | 選択肢 |
|---|---|---|
| 1 | タスク管理システム | Jira / Backlog / Linear / 他 |
| 2 | API 認証方式 | Bearer token / Basic / API Key |
| 3 | 削除タスクの扱い | remove / mark as closed |
| 4 | タグ付け手段 | ~~手動 YAML 編集 / CLI / Web UI~~ → **手動 YAML 編集のみ** (決定済み) |
| 5 | PPTX テンプレート | デフォルト / 既存テンプレート指定 |
| 6 | 実行環境 | ローカル / CI (GitHub Actions) |
| 7 | スライド構成 | 上記案 or カスタム |
