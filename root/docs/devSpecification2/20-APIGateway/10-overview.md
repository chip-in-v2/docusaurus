# API Gateway

API Gateway は、443/TCP でクライアントからの接続を受け付け、アプリケーションの Web UI や外部連携のための Backend for Frontend(BFF)を提供します。SPN Hubと協調して動作し、API GatewayとSPN Hubの接続はTCP接続です。

## 設計について

このAPI Gatewayは、SPN Hubと協調して動作し、Webアプリケーションのシステム基盤として動作します。この基盤は、システム構成とコードのシンプル化と依存関係の厳密な管理を実現する、Webアプリケーションのセキュリティと管理性の向上のための基盤です。ゼロトラスト・コーディング基盤で、特にサプライチェーン攻撃に対抗します。

## TLS通信

API Gateway では、以下の処置により、全ての通信を TLS で暗号化して行います。
- 対応するサーバ証明書がないリクエストは、TLS接続が失敗するか、400 のエラーで返す 
- http 80 番ポートに受信した場合、 301 で https にリダイレクトする 
- 全ての通信のレスポンスヘッダーに HSTS ヘッダーを付与する  ( [HSTS プリロードリスト](https://hstspreload.org/)にサイトを登録する )

## デバイス管理アクション

デバイスコンテキストCookie発行アクションにより、アクセス元のデバイスを特定できます。
CHIPIN_DEVICE_CONTEXT Cookie でデバイスを識別しますが、攻撃などで負荷がかからないように API Gateway 内のメモリ上での管理は行わず JWT の発行にとどめます。

JWTのクレームは、ランダムのデバイスIDを含み、レルムの鍵（レルムの signingKeyプロパティ）で署名します。(クレームの詳細は、[ルーティングアクション](routing-action)を参照)

Cookie はレルムの設定のデバイスコンテキスト保持期間（レルムの deviceContextTimeout プロパティ）に従って有効期限が設定さ、保持期間の 50% の時間を経過してアクセスすると同じデバイスIDで Cookie が再発行されます。従って、セッション保持期間よりも認証トークンのライフタイムが長い場合はライフタイムが残っているにも関わらずログアウトしてしまう場合がありますので注意が必要です。

## ライブマイグレーション

API Gateway は動作しているサーバとは別のサーバに無停止で移ることができます。
これには前段に ALB のようなロードバランサを配置して行う方式と route53 のような GSLB で切り替える方式があります。
いずれの場合でも移動元の API Gateway はグレースフルシャットダウンにより、処理途中のリクエストを完了させてから停止します。
この実装により無停止ローリングアップデートも可能になります。

SPNとの接続はサービス Consumer となるため、マイグレーションにおいて問題となることはありません。

## エラーコンテンツ

API-Gateway でリクエストを処理中にエラーが発生した場合、エラーのレスポンスの内容はリクエストの Accept ヘッダの内容に合わせて選択します。例えば、 JavaScript から Fetch でアクセスする場合は、
```
Accept: application/json
```
がリクエストヘッダに設定されます。これに対して HTML を返すとクライアントのコーディングでパースに失敗する場合があります。
これを避けるために API-Gateway では Accept ヘッダを見てクライアントが受け入れ可能なタイプのコンテンツを返す仕組みを提供します。

また、以下の要件を満たすよう考慮します。
- エラーコンテンツを返すために再度エラーにならないよう、コンテンツは API Gateway が自力で生成できなければならない
- エラーコンテンツがHTMLである場合、ページ内の参照で再度エラーにならないよう、シングルHTMLで内容を構成するようにする
- Realm や Service ごとにカスタマイズを可能とする
- カスタマイズにおいてはコンテンツ内に JavaScript のパラメータやメッセージに埋め込めるようテンプレート言語をサポートする
（詳細未）

例として、SNIとHTTPのHostヘッダーが異なるエラーで、Accept: application/jsonの場合の、返信は以下です。

```
{
  "status": 400,
  "error": "Bad Request",
  "message": "bad host name",
  "details": "SNI and HTTP host header mismatch"
}
```

## 利用例

シンプルなショップ(店)のSPAアプリケーションの場合の利用例です。

以下は、メインのSPAコードfront.jsを提供するサーバ、ショップのデータAPIを提供するAPIサーバ、静的コンテンツを提供するサーバ、OIDC認証サーバの4つに分かれていたものを、BFFで統一する場合の構成と設定例です。

| request hostname | request path | action | auth scope | upstream server |
|:-----------|:---------|:-------------------|:-------------|:----------------|
| www.sr.example.com | /shop/ |requireAuthentication  | shop_scope | front.js server |
| www.sr.example.com | /api/ | proxy | shop_scope | api server for shop data|
| www.sr.example.com | /images/ | proxy | none | static content server |
| auth.sr.example.com | / | proxy | none | OIDC auth server |
| * | /robot.txt | returnStaticText | none  | none |

この構成変更では、front.jsのコードが大幅にシンプルになり、ブラウザのアクセス先がミニマムで特定され、構成が明確でセキュアなWebアプリケーションになります。