# Backlog 管理システム 要件定義

## 概要

Backlog (ヌーラボ) の REST API からアクティブ課題を取得し、YAML で管理・リリース日タグ付けを行い、全リリース日をまとめた PPTX を生成する CLI ツール。

---

## 機能要件

### 1. fetch — 課題取得

- [ ] Backlog API (`/api/v2/issues`) からアクティブ課題を全件取得できる
- [ ] ページネーション対応 (100件/ページ) で全件取得できる
- [ ] `config.yaml` の `project_keys` を project_id に自動解決できる
- [ ] ステータス ID によるフィルタリングができる (デフォルト: 未対応/処理中/処理済み)
- [ ] 担当者・マイルストーン・カテゴリ・課題種別・キーワードで追加フィルタリングができる
- [ ] 既存 `tasks.yaml` の `release_date` / `note` を保持したまま upsert できる
- [ ] `--dry-run` オプションで取得件数のみ確認できる (ファイル出力なし)
- [ ] `--config` で設定ファイルパスを指定できる
- [ ] `--output` で出力先 YAML パスを指定できる
- [ ] `release_date` 未設定タスク数を出力時に警告表示できる

### 2. タグ付け — リリース日管理

- [ ] `tasks.yaml` を直接編集することでリリース日 (`release_date`) を手動設定できる
- [ ] `release_date: null` はタグ未設定として扱われる
- [ ] `note` フィールドで自由記述メモを管理できる

### 3. split — YAML 分割

- [ ] `tasks.yaml` から `release_date` 設定済みのタスクを抽出できる
- [ ] `release_date` ごとに `releases/YYYY-MM-DD.yaml` を生成できる
- [ ] `release_date: null` のタスクを `untagged.yaml` に出力できる
- [ ] 出力ファイルを日付順にソートできる
- [ ] `--dry-run` オプションで分割結果のみ表示できる (ファイル出力なし)
- [ ] `--config` で設定ファイルパスを指定できる
- [ ] `--input` で入力 YAML パスを指定できる
- [ ] `--output-dir` で出力ディレクトリを指定できる

### 4. generate — PPTX 生成

- [ ] `releases/YYYY-MM-DD.yaml` を読み込み 1 ファイルの PPTX を生成できる
- [ ] 表紙スライド (生成日時・リリース日一覧) を含む
- [ ] リリース日ごとに 1 スライドを生成できる (日付順)
- [ ] スライドにタスク一覧テーブル (ID・タイトル・優先度・担当者・ステータス・メモ) を表示できる
- [ ] スライド下端を超えるタスク行を自動的に切り捨てる
- [ ] `config.yaml` でカラム定義 (キー・ラベル・幅) をカスタマイズできる
- [ ] `config.yaml` で除外リリース日 (`exclude_dates`) を指定できる
- [ ] `--dry-run` オプションでスライド構成のみ表示できる (ファイル出力なし)
- [ ] `--config` で設定ファイルパスを指定できる
- [ ] `--output` で出力 PPTX パスを指定できる
- [ ] `--releases-dir` で YAML ディレクトリを指定できる

---

## データモデル要件

### tasks.yaml

- [ ] `meta` セクション: `fetched_at` (ISO 8601)・`source` (API URL)・`total` (取得件数) を持つ
- [ ] `tasks` セクション: 各タスクは `backlog` (API データ) と `custom` (手動データ) の 2 層構造を持つ
- [ ] `backlog` フィールド: `id`, `title`, `status`, `priority`, `assignee`, `created_at`, `updated_at`, `labels` を含む
- [ ] `custom` フィールド: `release_date` (初期値: null)・`note` (初期値: "") を持つ
- [ ] fetch 時に API から消えたタスクを設定に応じて削除または `closed` マークできる

### releases/YYYY-MM-DD.yaml

- [ ] `release` セクション: `date`・`generated_at`・`task_count` を持つ
- [ ] `tasks` セクション: split 元の tasks.yaml 構造をそのまま保持する

---

## 設定要件 (config.yaml)

- [ ] Backlog スペース ID (`api.space_id`) を設定できる
- [ ] 対象プロジェクトキー (`api.project_keys`) または project_id を設定できる
- [ ] API キーを環境変数 `BACKLOG_API_KEY` から参照できる
- [ ] アクティブステータス ID (`fetch.active_status_ids`) をカスタマイズできる
- [ ] 追加フィルタ (担当者/マイルストーン/カテゴリ/課題種別/キーワード) を設定できる
- [ ] 削除タスクの扱い (`fetch.closed_task_action`: `remove` または `mark`) を選択できる
- [ ] 出力パス (`output.tasks_yaml`・`paths.releases_dir`・`paths.pptx_output`) を設定できる
- [ ] PPTX タイトルプレフィックス (`pptx.title_prefix`) を設定できる
- [ ] PPTX カラム定義 (`pptx.columns`) をカスタマイズできる
- [ ] PPTX 除外リリース日 (`pptx.exclude_dates`) を設定できる

---

## 非機能要件

### 実行環境

- [ ] Node.js >= 18 で動作する (fetch API 内蔵バージョン)
- [ ] ESM (`"type": "module"`) で実装されている
- [ ] `npm install` で依存パッケージをインストールできる

### 依存パッケージ

- [ ] `js-yaml` — YAML 読み書き
- [ ] `commander` — CLI 引数解析
- [ ] `pptxgenjs` — PPTX 生成

### CLI インターフェース

- [ ] `node bin/fetch.js` で fetch コマンドを実行できる
- [ ] `node bin/split.js` で split コマンドを実行できる
- [ ] `node bin/generate.js` で generate コマンドを実行できる
- [ ] 各コマンドに `--help` オプションが機能する
- [ ] エラー時に原因と対処法を標準エラー出力に表示する

### セキュリティ

- [ ] API キーをファイルに直接記載せず環境変数 (`BACKLOG_API_KEY`) で管理する
- [ ] `config.yaml` を `.gitignore` に含め、リポジトリに含めない
- [ ] `config.yaml.example` をテンプレートとしてリポジトリで管理する

---

## ワークフロー要件

以下の順序でコマンドを実行することで PPTX を生成できる:

- [ ] `node bin/fetch.js` → `tasks.yaml` 生成
- [ ] `tasks.yaml` を手動編集して `release_date` を設定
- [ ] `node bin/split.js` → `releases/YYYY-MM-DD.yaml` 生成
- [ ] `node bin/generate.js` → `releases/backlog.pptx` 生成
