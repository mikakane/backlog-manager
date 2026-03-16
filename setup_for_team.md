# チーム向けセットアップ・運用ガイド

## INDEX

1. [初回セットアップ](#初回セットアップ)
2. [環境変数の設定](#環境変数の設定)
3. [git 管理方針](#git-管理方針)
4. [日常の使い方](#日常の使い方)
5. [ツール更新フロー](#ツール更新フロー)

---

## 初回セットアップ

**チームリポジトリ** (`origin`) と **ツールリポジトリ** (`tool`) の 2 remote で運用します。

### 1. チームリポジトリをクローン

```bash
git clone <チームリポジトリの URL>
cd <リポジトリ名>
```

### 2. ツールリポジトリを remote に追加してマージ

```bash
git remote add tool <ツールリポジトリの URL>
git fetch tool
git merge tool/main --allow-unrelated-histories
```

### 3. パッケージをインストール

```bash
npm install
```

### 4. 設定ファイルを作成

```bash
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

---

## 環境変数の設定

Backlog API キーを `~/.zshrc` に追記し、現在のシェルに反映します。

```bash
echo 'export BACKLOG_API_KEY=your_api_key_here' >> ~/.zshrc
source ~/.zshrc
```

---

## git 管理方針

チーム運用では `tasks.yaml` と `release-tasks/` を git 管理に含め、チームで共有します。
PPTX は生成物のため管理外とします。

| 対象 | 管理 | 理由 |
|------|------|------|
| `config.yaml` | **管理外** | API キーを含むため |
| `tasks.yaml` | **git 管理** | チームで共有 |
| `release-tasks/` | **git 管理** | チームで共有 |
| `tasks.pptx` | **管理外** | 生成物 |
| `config.yaml.example` | **git 管理** | 設定テンプレート |
| `bin/`, `lib/` | **git 管理** | ツール本体 |

初回セットアップ後、`.gitignore` から `tasks.yaml` と `release-tasks/` の行を削除してコミットします。

```bash
# tasks.yaml と release-tasks/ の行を削除
vi .gitignore

git add .gitignore
git commit -m "chore: チーム運用用に .gitignore を更新"
git push origin main
```

---

## 日常の使い方

```bash
# 1. 最新の tasks.yaml を取得
git pull origin main

# 2. Backlog から課題を取得
npm run fetch

# 3. tasks.yaml を編集して release_date をタグ付け（手動）

# 4. リリース日ごとに YAML を分割
npm run split

# 5. PPTX を生成
npm run generate

# 6. 変更をコミット・プッシュ
git add tasks.yaml release-tasks/
git commit -m "chore: tasks 更新 $(date +%Y-%m-%d)"
git push origin main
```

生成された PPTX は `config.yaml` の `paths.pptx_output` で指定したパスに出力されます（デフォルト: `tasks.pptx`）。

---

## ツール更新フロー

スクリプトや設定テンプレートに更新があった場合、以下の手順で取り込みます。

### 1. ツールの最新コードを取得

```bash
git fetch tool
git merge tool/main
```

### 2. パッケージを更新

`package.json` が変更されている可能性があるため実行します。

```bash
npm install
```

### 3. `config.yaml.example` の差分を確認・反映

新しい設定項目が追加されていないか確認します。

```bash
git diff HEAD~1 config.yaml.example
```

追加項目があれば、自分の `config.yaml` に必要に応じてコピーして設定します。
`config.yaml` は git 管理外のため、自動では更新されません。
