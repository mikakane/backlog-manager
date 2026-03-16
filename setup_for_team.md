# チーム向けセットアップ・運用ガイド

## 初回セットアップ

```bash
git clone <このリポジトリのURL>
cd backlog-manager
npm install
cp config.yaml.example config.yaml
```

`config.yaml` を編集して自分の環境に合わせます。

```yaml
api:
  space_id: "your-space"        # Backlog スペース ID
  api_key: "${BACKLOG_API_KEY}"  # 環境変数で渡す（下記参照）
  project_keys:
    - "PROJECT1"
```

API キーを環境変数にセットします（`~/.zshrc` や `~/.bashrc` に追記推奨）。

```bash
export BACKLOG_API_KEY=your_api_key_here
```

---

## ツール更新フロー

チームメンバーがスクリプトや設定テンプレートを更新した場合、以下の手順で取り込みます。

### 1. 最新コードを取得

```bash
git pull origin main
```

### 2. パッケージを更新

`package.json` が変更されている可能性があるため、毎回実行します。

```bash
npm install
```

### 3. `config.yaml.example` の差分を確認・反映

`config.yaml.example` に新しい設定項目が追加されていないか確認します。

```bash
git diff HEAD~1 config.yaml.example
```

追加項目があれば、自分の `config.yaml` に必要に応じてコピーして設定します。
`config.yaml` は git 管理外のため、自動では更新されません。

---

## `.gitignore` の更新フロー

`.gitignore` はリポジトリで共有されます。以下のケースで更新が必要になります。

### 更新が必要なケース

| ケース | 追記する内容 |
|--------|-------------|
| 新しい生成物ディレクトリが増えた | そのディレクトリ名 |
| チームで使うエディタ・ツールが増えた | ツール固有の設定ファイル |
| 個人の設定ファイルを誤コミットしそうな場合 | そのファイルパターン |

### 更新手順

```bash
# .gitignore を編集
vi .gitignore

# コミットして push
git add .gitignore
git commit -m "chore: .gitignore に〇〇を追加"
git push origin main
```

### 現在の管理方針

| 対象 | 管理 | 理由 |
|------|------|------|
| `config.yaml` | **git 管理外** | API キーを含むため |
| `tasks.yaml` | **git 管理外** | 個人の作業ファイル |
| `release-tasks/` | **git 管理外** | 生成物 |
| `config.yaml.example` | **git 管理** | チームで共有するテンプレート |
| `bin/`, `lib/` | **git 管理** | ツール本体 |

---

## 日常の使い方

```bash
# 1. Backlog から課題を取得
npm run fetch

# 2. tasks.yaml を編集して release_date をタグ付け（手動）

# 3. リリース日ごとに YAML を分割
npm run split

# 4. PPTX を生成
npm run generate
```

生成された PPTX は `config.yaml` の `paths.pptx_output` で指定したパスに出力されます（デフォルト: `tasks.pptx`）。
