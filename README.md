# backlog-manager

Backlog の REST API からアクティブ課題を取得し、YAML 管理 → リリース日タグ付け → PPTX 出力までを行うツール。

## システムフロー

```
Backlog API
  └─ npm run fetch ──→ tasks.yaml          # アクティブ課題一覧
                           │
                       手動編集              # release_date をタグ付け
                           │
                       npm run split ──→ release-tasks/YYYY-MM-DD.yaml   # リリース日ごとに分割
                           │
                       npm run generate ─→ tasks.pptx    # 全リリース日まとめ
```

## セットアップ

→ [SETUP.md](SETUP.md) を参照

---

## 使い方

各スクリプトのオプション一覧はファイル冒頭のコメントを参照してください。

### fetch — Backlog から課題を取得

```bash
npm run fetch
```

**2回目以降の実行でも `release_date` / `note` は保持されます。**

### リリース日タグ付け (手動)

`tasks.yaml` を直接編集し、各タスクの `custom.release_date` を入力します。

```yaml
tasks:
  - backlog:
      issue_key: "PROJECT-123"
      title: "ログイン機能の実装"
      ...
    custom:
      release_date: "2026-04-01"  # ← ここを入力
      note: ""
```

`note` は複数行テキストに対応しています。

```yaml
    custom:
      release_date: "2026-04-01"
      note: |
        承認済み
        テスト完了・本番反映待ち
```

### split — リリース日ごとに YAML を分割

```bash
npm run split
```

### generate — PPTX を生成

```bash
npm run generate
```

出力: `tasks.pptx` (全リリース日まとめ、1リリース日 = 1スライド)

---

## ファイル構成

```
.
├── bin/
│   ├── fetch.js              # Backlog API → tasks.yaml
│   ├── split.js              # tasks.yaml → release-tasks/*.yaml
│   └── generate.js           # release-tasks/*.yaml → tasks.pptx
├── lib/
│   └── transform.js          # 純粋変換関数 (テスト対象)
├── test/
│   └── transform.test.js     # 自動テスト (npm test)
├── package.json
├── config.yaml.example       # 設定ファイルのテンプレート
├── config.yaml               # 設定ファイル (git 管理外)
├── tasks.yaml                # 取得済み課題一覧 (git 管理外)
└── release-tasks/
    └── 2026-04-01.yaml       # リリース日ごとの課題一覧
```

## tasks.yaml スキーマ

```yaml
meta:
  fetched_at: "2026-03-15T10:00:00+00:00"
  space_id: "your-space"
  total: 42

tasks:
  - backlog:             # Backlog API から取得 (fetch のたびに更新)
      id: "12345"
      issue_key: "PROJECT-123"
      title: "ログイン機能の実装"
      status: "処理中"
      priority: "高"
      issue_type: "タスク"
      assignee: "yamada"
      milestone: ["v1.0"]
      category: ["backend"]
      due_date: "2026-04-30"
      created_at: "2026-02-01"
      updated_at: "2026-03-10"
    custom:              # 手動管理 (fetch しても上書きされない)
      release_date: null # リリース日 (YYYY-MM-DD)
      note: |            # 自由メモ (複数行可)
        承認済み
        テスト完了・本番反映待ち
```
