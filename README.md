# RED天王台 欠席・振替申請

GASを直接スマートフォンで開かず、Cloudflare Pagesをフロントエンドとして利用する構成です。

## 構成

LINEリッチメニュー → Cloudflare Pages → Pages Function /api/submit → GAS Web App → Googleスプレッドシート / メール

## Cloudflare Pages設定

Environment variables に以下を登録します。

- GAS_WEB_APP_URL: GAS Web App の /exec URL
- GAS_API_SECRET: GAS側の Script Properties に設定する秘密文字列

Production / Preview の必要な環境に設定してください。

## GAS設定

gas/Code.gs をApps Scriptプロジェクトへ貼り付けます。

Apps Script の「プロジェクトの設定」→「スクリプト プロパティ」に、

- プロパティ: API_SECRET
- 値: Cloudflare側の GAS_API_SECRET と同じ秘密文字列

を設定します。

デプロイは「ウェブアプリ」とし、

- 次のユーザーとして実行: 自分
- アクセスできるユーザー: 全員

にします。

## Cloudflare Pages

このリポジトリをPagesへ接続します。

- Framework preset: None
- Build command: 空欄
- Build output directory: /

Pages Function は functions/api/submit.js が自動認識され、POST /api/submit として動作します。

## 注意

GASのURLをindex.htmlへ直接記載しません。秘密文字列もindex.htmlには記載しません。
