# backlog-manager

Backlog の REST API からアクティブ課題を取得し、YAML 管理 → リリース日タグ付け → PPTX 出力までを行うツール。

## システムフロー

```
Backlog API
  └─ fetch.sh ──→ tasks.yaml          # アクティブ課題一覧
                      │
                  手動編集              # release_date をタグ付け
                      │
                  split.sh ──→ releases/YYYY-MM-DD.yaml   # リリース日ごとに分割
                      │
                  generate.sh ─→ releases/backlog.pptx    # 全リリース日まとめ
```

## セットアップ

→ [SETUP.md](SETUP.md) を参照

---

## 使い方

### fetch — Backlog から課題を取得

```bash
node fetch.js                        # config.yaml → tasks.yaml に出力
node fetch.js --config my.yaml       # 設定ファイルを指定
node fetch.js --output out.yaml      # 出力先を指定
node fetch.js --dry-run              # 出力せずに取得件数を確認

# npm script 経由でも実行可能
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

### split — リリース日ごとに YAML を分割 (未実装)

```bash
node split.js
```

### generate — PPTX を生成 (未実装)

```bash
node generate.js
```

出力: `releases/backlog.pptx` (全リリース日まとめ、1リリース日 = 1スライド)

---

## ファイル構成

```
backlog-manager/
├── fetch.js              # Backlog API → tasks.yaml
├── split.js              # tasks.yaml → releases/*.yaml (未実装)
├── generate.js           # releases/*.yaml → releases/backlog.pptx (未実装)
├── package.json
├── config.yaml.example   # 設定ファイルのテンプレート
├── config.yaml           # 設定ファイル (git 管理外)
├── tasks.yaml            # 取得済み課題一覧 (成果物)
└── releases/
    ├── 2026-04-01.yaml   # リリース日ごとの課題一覧
    └── backlog.pptx      # 全リリース日まとめ PPTX
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
      note: ""           # 自由メモ
```
