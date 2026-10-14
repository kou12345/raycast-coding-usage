# Coding Usage for Raycast

Codex / Claude Code のサブスクリプション使用率、残り割合、リセット時刻を確認する macOS 向けローカル拡張です。

## 使い方

```bash
git clone https://github.com/kou12345/raycast-coding-usage.git
cd raycast-coding-usage
npm ci
npm run dev
```

Raycast で `Show Coding Usage` を実行すると一覧が開きます。`Coding Usage Menu Bar` を実行するとメニューバーに常駐し、5分ごとに更新します。Background Refresh が無効なら Raycast の設定で有効にしてください。開発サーバーを止めても利用を続ける場合は Raycast の `Import Extension` でこのディレクトリを選択してください。

- 一覧: 使用率、残り割合、ローカル時刻でのリセット日時。`⌘R` で更新。
- メニューバー: `Cx w 残83% · Cl 5h 残36% / w 残73%`。`w` は週次、`5h` は5時間枠で、それぞれ残り割合を表示します。リセット日時とCode Review / モデル別の追加枠は、クリック後のメニューに表示します。
- 取得失敗: メニューバーは `取得エラー`。一覧で理由を確認できます。前回値がある場合は「前回」と明記します。
- API が返さない枠や時刻は推測しません。週次枠だけのプランでは週次だけを表示します。
- API料金・トークン数ではなく、ログイン中のアカウント全体のサブスクリプション使用制限を表示します。

初回または認証切れの場合は、ターミナルでログインしてください。

```bash
codex login
claude auth login
```

Codex は既定で `~/.codex/auth.json`、Claude は `~/.claude/.credentials.json` を読みます。Claude のファイルが未作成・期限切れの場合は macOS Keychain の `Claude Code-credentials` も確認します。Keychain のアクセス許可が表示された場合は、使用量表示のための読み取りです。パスは拡張設定で変更できます。別の Codex home を使っている場合は、その `auth.json` を指定してください。

認証情報の更新・再ログインは各 CLI に任せます。この拡張はトークンを更新せず、保存せず、ログにも出しません。使用量と取得日時だけを Raycast のローカルキャッシュに保存します。HTTP 429 の場合は `Retry-After`、未指定なら5分の待機を守ります。

## 検証

```bash
npm test
npx tsc --noEmit
npm run build
npm run lint
npm run check:live
```

`check:live` は実際の使用率だけを標準出力に出します。いずれかのサービスが取得できない場合は終了コード1です。ログイン情報・アカウントID・メールアドレスは出力しません。

## 取得元と制約

- Codex: OpenAI の Codex クライアントと同じ `GET https://chatgpt.com/backend-api/wham/usage` を利用。[OpenAI クライアント実装](https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/client.rs)。
- Claude: `GET https://api.anthropic.com/api/oauth/usage`、`anthropic-beta: oauth-2025-04-20` を利用。[CodexBar の取得実装](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Claude/ClaudeOAuth/ClaudeOAuthUsageFetcher.swift)を形式確認の参考にしました。コードは独自実装です。
- これらの使用量エンドポイントは一般公開の安定したAPI契約ではありません。サービス側の変更で取得できなくなる可能性があります。
- Raycast: [メニューバーAPI](https://developers.raycast.com/api-reference/menu-bar-commands)、[拡張の開発手順](https://developers.raycast.com/basics/getting-started)。

## Git

[GitHubリポジトリ](https://github.com/kou12345/raycast-coding-usage)の `main` ブランチで管理します。`node_modules`、ビルド出力、認証ファイル、`.env`、ログは除外します。Raycast Storeへの公開は行っていません。
