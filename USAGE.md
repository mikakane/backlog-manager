# USAGE

backlog-manager の使い方ガイド

---

## 前提条件

- Node.js 18 以上
- Backlog API キー（スペース設定から取得）
- セットアップ完了（[SETUP.md](SETUP.md) 参照）

---

## 1. 環境変数の設定

Backlog API キーを環境変数に設定します。

```bash
export BACKLOG_API_KEY="your_api_key_here"
```

恒久的に設定する場合は `~/.zshrc` や `~/.bashrc` に追加してください。

```bash
echo 'export BACKLOG_API_KEY="your_api_key_here"' >> ~/.zshrc
source ~/.zshrc
```

---

## 2. config.yaml の設定

`config.yaml.example` をコピーして `config.yaml` を作成し、環境に合わせて編集します。

```bash
cp config.yaml.example config.yaml
```

最低限設定が必要な項目：

```yaml
api:
  space_id: "your-space"           # Backlog スペース ID
  project_keys:
    - "PROJECT1"                   # 対象プロジェクトキー
    - "PROJECT2"

fetch:
  active_status_ids: [1, 2, 3]    # 取得対象ステータス (1:未対応 2:処理中 3:処理済み)
```

---

## 3. 基本的な使い方

### 全ステップを実行

```bash
npm run all
```

fetch → split → generate の全ステップを順番に実行します。

### 個別ステップを実行

```bash
# 1. Backlog から課題を取得
npm run fetch

# 2. tasks.yaml を手動編集してリリース日をタグ付け
#    (エディタで tasks.yaml を開き、custom.release_date を入力)

# 3. リリース日ごとに分割
npm run split

# 4. PPTX を生成
npm run generate
```

---

## 4. コマンドオプション

各コマンドには共通オプションがあります。

### --config

設定ファイルのパスを指定（デフォルト: `config.yaml`）

```bash
npm run fetch -- --config custom.yaml
npm run all -- --config custom.yaml
```

### --dry-run

実行内容を確認するだけで、実際のファイル書き込みは行いません。

```bash
npm run fetch -- --dry-run
npm run all -- --dry-run
```

---

## 5. ワークフロー例

### 通常のワークフロー

```bash
# 1. 課題を取得
npm run fetch

# 2. tasks.yaml を開いてリリース日をタグ付け
code tasks.yaml  # または vi tasks.yaml

# 例：
# - backlog:
#     issue_key: "PROJECT-123"
#     title: "ログイン機能の実装"
#   custom:
#     release_date: "2026-04-01"  # ← 手動で入力
#     note: ""

# 3. リリース日ごとに分割
npm run split

# 4. PPTX を生成
npm run generate

# 5. 生成された tasks.pptx を確認
open tasks.pptx  # macOS
```

### 定期実行のワークフロー

```bash
# 2回目以降は fetch だけで既存のリリース日タグを保持
npm run fetch

# 新しい課題にリリース日をタグ付け
code tasks.yaml

# 再度 split → generate
npm run split
npm run generate
```

**重要:** `npm run fetch` を実行しても、既存の `release_date` と `note` は上書きされません。

---

## 6. 出力ファイル

| ファイル | 説明 | Git 管理 |
|---|---|---|
| `tasks.yaml` | 取得済み課題一覧 + リリース日タグ | 除外 |
| `release-tasks/*.yaml` | リリース日ごとの課題一覧 | 任意 |
| `tasks.pptx` | 全リリース日まとめ PPTX | 除外 |

---

## 7. トラブルシューティング

### API キーエラー

```
Error: BACKLOG_API_KEY が設定されていません
```

→ 環境変数 `BACKLOG_API_KEY` を設定してください。

### 課題が取得できない

```bash
# dry-run で API レスポンスを確認
npm run fetch -- --dry-run
```

→ `config.yaml` の `space_id`, `project_keys`, `active_status_ids` を確認してください。

### リリース日が保持されない

→ `tasks.yaml` の `custom.release_date` フィールドが正しい形式（`YYYY-MM-DD`）で記述されているか確認してください。

---

## 8. カスタマイズ

### PPTX の列をカスタマイズ

`config.yaml` の `pptx.columns` で表示する列を変更できます。

```yaml
pptx:
  columns:
    - key: issue_key
      label: "課題キー"
      width: 1.5
    - key: title
      label: "タイトル"
      width: 5.0
    - key: assignee
      label: "担当者"
      width: 1.2
    - key: due_date
      label: "期限"
      width: 1.5
```

### 特定のリリース日を PPTX から除外

```yaml
pptx:
  exclude_dates:
    - "2026-04-01"
    - "2026-05-01"
```

### フィルタ条件を追加

```yaml
fetch:
  assignee_ids: [12345, 67890]     # 特定担当者のみ
  milestone_ids: [111, 222]        # 特定マイルストーンのみ
  keyword: "バグ"                   # キーワード検索
```

---

## 9. テスト

```bash
npm test
```

`lib/transform.js` の単体テストを実行します。

---

詳細な仕様は [README.md](README.md) を参照してください。
