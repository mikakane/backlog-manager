# セットアップ

## 依存

| 依存 | 用途 | インストール |
|---|---|---|
| Node.js >= 18 | 実行環境 (fetch API 内蔵) | `brew install node` |
| npm パッケージ | YAML / CLI | `npm install` |

### バージョン確認

```bash
node --version   # v18.x 以上
npm --version    # 同梱
```

### Node.js インストール (未導入の場合)

```bash
brew install node
# または https://nodejs.org からインストーラーを使用
```

---

## 1. npm パッケージのインストール

```bash
cd backlog-manager
npm install
```

インストールされるパッケージ:

| パッケージ | 用途 |
|---|---|
| `js-yaml` | YAML 読み書き |
| `commander` | CLI 引数解析 |

## 2. 設定ファイルの作成

```bash
cp config.yaml.example config.yaml
```

`config.yaml` を編集します。

```yaml
api:
  space_id: "your-space"        # Backlog スペース ID
  api_key: "${BACKLOG_API_KEY}"  # 環境変数で渡す (推奨)
  project_keys:
    - "PROJECT1"                # 対象プロジェクトキー
```

## 3. API キーの設定

Backlog の個人設定 → API からキーを発行し、環境変数にセットします。

```bash
export BACKLOG_API_KEY=your_api_key_here

# 毎回設定する手間を省く場合は ~/.zshrc に追記
echo 'export BACKLOG_API_KEY=your_api_key_here' >> ~/.zshrc
```
