# API　Gateway

API Gateway は Web アプリケーションをマイクロサービスに分割して実装するための基本的な機能を提供します。
たとえば、WebコンテンツやAPIを提供する Web サイトを構築する際に、以下のように WAFサービス、認証サービス、認可サービス、コンテンツサービス、APIサービス、データベースサービス、アクセスログサービス、監査ログサービス、時系列データベースサービスというようにマイクロサービスに分割して提供できます。API Gateway とマイクロサービスの間およびマイクロサービス間の通信は SPN を経由して行われます。
API Gateway はコアサービスのメインコンテナと動作します。

```plantuml
@startuml
left to right direction
Actor User
Cloud WWW
User -down- WWW
() HTTP2
WWW --> HTTP2
Cloud "Secure Private Network" as SPN
[API Gateway]
HTTP2 - [API Gateway]
rectangle "MicroServices" as MS{
    [WAF Service] as N0
    [Authn Service] as N1
    [Authz Service] as N2
    [Contents Service] as N3
    [API Service] as N4
    [Database Service] as N5
    [Access Log Service] as N6
    [Audit Log Service] as N7
    [Time Series Database Service] as N8
}
[API Gateway] - SPN
SPN -[hidden]-> N3
SPN - N0
SPN - N1
SPN - N2
SPN - N3
SPN - N4
SPN - N7
SPN - N5
SPN - N6
SPN - N8
@enduml
```

## ゾーン

API Gateway にはDNSゾーンを登録します。ゾーンにゾーン同期サービスが登録されている場合、ゾーンの内容を API Gateway と同期します。
また、ACME サービスが登録されている場合、 ACME DNS-01 プロトコルでサーバ証明書を取得します。
master ゾーンはシステムで予約されており、master レルムのサービスを提供するのに用いられます。
また、レルムのユーザがドメインを持たない場合、 master ゾーンの下のサブドメインを使用することができます。

## BFF

BFF(Backend for Frontend)機能はフロントエンドからの API アクセスに対する認証機能を提供します。
Web プロキシのコンフィグレーションでロケーション(FQDN+パスのパターンで特定)を指定してBFFを追加できます。
BFFは以下の機能を提供します。
- Open ID Connect プロトコルで IdP を呼び出し、IDトークンとアクセストークンを取得
- IDトークンとアクセストークンをセッション情報として構成情報データベースに保存
- セッションIDをセキュアなCookie（HttpOnly, Secure, SameSite=Strict）を発行
- 単純なリクエストを拒否（400を返す）
- 必要に応じて HTTPレスポンスに CORS 関係のヘッダを追加
- 必要に応じて HTTPレスポンスに CSPヘッダを追加
- 必要に応じて HTTPレスポンスに X-Frame-Options ヘッダを追加
- 必要に応じてセッション情報の内容を取得するAPIを提供
- 必要に応じて指定されたパスパターンに一致するGETリクエストに対して IdP へのリダイレクトを返す
- 必要に応じてセッション情報の一覧取得（自分の接続中のセッションの確認）・削除（管理者による強制ログアウト）を別のBFFを経由して行える API を提供

:::info
CSRF防御について CSRFトークンを発行するという機能を追加することも可能であるが、セキュアなCookieの発行と単純なリクエストの拒否で十分であると考えています。
:::

### 2フェーズセッション管理

BFFでは、 Cookie を使用してユーザの認証前と認証後の両方で串刺ししてセッションを管理できるようにします。

#### 認証前セッション

CHIPIN_SESSION Cookie でセッションを識別しますが、攻撃などで負荷がかからないようにサーバ側での管理は行わず JWT の発行にとどめます。認証前セッションのセッションIDをログに記録することによって、以下のような場合でもアクセスを串刺しにできます。

- ブラウザを開いたままログアウトして別のユーザでログインしなおした場合
- SP にアクセスして認証サーバにリダイレクトされた場合

また、ドメイン内でセッションを共有できます。

##### COOKIEの属性

CHIPIN_SESSION Cookie は HttpOnly, Secure, SameSite=Strict 属性を持ち、セキュアな Cookie として扱われます。また、Expires 属性を設定して、セッションの有効期限を指定します。

##### JWTの内容
CHIPIN_SESSION Cookie には JWT が含まれ、以下の情報が含まれます。
- 発行者(iss)
- セッションID(sub)
- 発行日時(iat)
- 有効期限(exp)
JWTの署名には、API Gateway の秘密鍵が使用されます。これにより、セッションIDの改ざんを防ぎます。

##### セッションIDの管理

ユーザが BFF にアクセスすると、CHIPIN_SESSION Cookie が存在しない場合、新しいセッションIDをを発行します。
セッションIDはPRNG（擬似乱数生成器）を使用して生成された48ビットの数値で、base64で 64文字の文字列にエンコードされます。

CHIPIN_SESSION Cookie が存在する場合は、JWTを検証し、 iss, exp の妥当性をチェックします。 sub の値をセッションIDとして使用します。有効期限が再発行閾値を過ぎている場合は、CHIPIN_SESSION Cookie を再発行します。exp 以外の値は引き継がれます。
セッションIDはメモリ上に保存して管理しているわけではないので、サーバ側で無効化することはできません。セッションの有効期限が切れるまで有効です。

新しくセッションIDを生成した場合、および再発行した場合はレスポンスヘッダに Set-Cookie: CHIPIN_SESSION=**JWT**;HttpOnly;Secure;SameSite=Strict; を追加します。
サブドメインに shareCookie: true が設定されている場合は、CHIPIN_SESSION Cookie の Domain 属性にサブドメインの FQDN を設定します。これにより、同じサブドメイン配下の仮想ホスト間でセッションを共有できます。

##### COOKIEの利用

リクエストコンテキストの以下の変数に JWT の内容が設定されます。

|変数名 | JWTクレーム| 内容 |
|---|---|---|
|session_id|sub|セッションID|
|session_start_time|iat|セッション開始時間|

この変数を参照してログに出力したり、バックエンドのロジックに渡したりすることができます。

#### 認証済みセッション

API Gateway から OIDC の認証サービスを呼び出すことによって認証を行うことができます。
以下に OIDC の認証サービスと連携する場合のシーケンスを示します。

```plantuml Test
!theme spacelab
@startuml
利用者 --> ブラウザ: $success("トップページを表示")
ブラウザ --> "API Gateway": $success("GET")
"API Gateway" --> ブラウザ: $success("認証委譲リダイレクト")
ブラウザ --> "keycloak": $success("認証要求")
"keycloak" --> ブラウザ: $success("ログインページ - set cookie")
ブラウザ --> 利用者: $success("ログインページ表示")
利用者 --> ブラウザ: $success("ID,パスワード,OTPを入力")
ブラウザ --> "keycloak": $success("ID,パスワード,OTP")
note over "keycloak"
認証
end note
"keycloak" --> ブラウザ: $success("OIDC 認証コード付きリダイレクト")
"ブラウザ" --> "API Gateway": $success("認証コード")
"API Gateway" --> keycloak: $success("トークン取得")
note over "keycloak"
アクセストークン
リフレッシュトークン
発行
end note
"keycloak" --> "API Gateway": $success("レスポンス")
note over "API Gateway"
トークンをCookieで付与
end note
"API Gateway" --> ブラウザ: $success("トップページへリダイレクト")
ブラウザ --> "API Gateway": $success("GET")
"API Gateway"  --> "コンテンツサービス": $success("GET")
"コンテンツサービス" --> ”API Gateway": $success("トップページ")
"API Gateway" --> ブラウザ: $success("トップページ")
ブラウザ --> 利用者: $success("トップページ表示")
@enduml
```

上記の動作は API Gateway から呼び出された認証サービスによって行われます。認証に成功すると、認証前セッションで発行されたセッションIDをキーにしてセッションオブジェクトをメモリ上に作成し、そこにユーザIDなど認証で得られたユーザの属性情報を保持します。
認証済みセッションの管理は認証サービスにより行われます。認証サービスは前述のセッションIDをキーにしてデータベース上にセッション情報を保存します。セッション情報にはユーザIDや所属など RBAC, ABAC で利用するための属性情報が含まれます。

## M2M通信

外部システムが HTTP の API でアクセスしてくる場合のセッション管理においては Cookie の保存を前提とすることができません。このようなマシン対マシン（M2M）通信では、 OAuth 2.0 クライアントクレデンシャルズグラント (Client Credentials Grant) という認証フローを使用します。これは、ユーザーの介在なしに、アプリケーション自体が認証を行い、APIアクセスのためのトークンを取得するための仕組みです。
これを使用することにより、秘密情報の漏洩を防ぎつつ、アクセスを追跡しやすくできます。

:::note
M2M 通信と BFF とはパスなどによって排他的に適用されます。
:::

以下にクライアントクレデンシャルズグラントの認証フローのステップを示します。

```plantuml Test
!theme spacelab
@startuml
外部システム --> 認証サーバ: $success("2. Client ID+Secret")
note over "認証サーバ"
アクセストークンを発行
end note
認証サーバ --> 外部システム: $success("3. アクセストークン")
外部システム --> "API Gateway": $success("4.リクエスト with アクセストークン")
note over "API Gateway"
5. アクセストークンを検証
end note
"API Gateway" --> "API サーバ": $success("6. リクエスト")
"API サーバ" --> "API Gateway": $success("7. レスポンス")
"API Gateway" --> 外部システム: $success("8. レスポンス")
@enduml
```

#### 1. 事前登録
APIを利用したい外部システム（クライアント）は、事前にあなたの認証サーバー（IdP）に登録されます。登録後、そのシステム専用の Client ID と Client Secret が発行されます。これらはシステムのIDとパスワードのようなものです。
また、認証サーバがJWTの署名に使用する鍵を API Gateway に登録します。API Gateway はこの鍵を使用してアクセストークンの署名を検証します。

#### 2. トークンの要求
外部システムは、自身の Client ID と Client Secret を使って、認証サーバーのトークンエンドポイントに直接APIリクエストを送信し、アクセストークンを要求します。

#### 3. トークンの取得
認証サーバーは送られてきた Client ID と Client Secret を検証し、正当であれば、そのシステム（クライアント）の権限を表すアクセストークンを発行します。このトークンは特定のユーザーに紐づくものではなく、システム自体に紐づきます。

#### 4. APIの呼び出し
外部システムは、取得したアクセストークンを Authorization: Bearer アクセストークン ヘッダーに含めて、保護されたAPIを直接呼び出します。

#### 5. API Gateway での検証
API Gateway は、リクエストで受け取ったアクセストークンを検証し、有効であればリクエストを処理します。

#### 6. リクエストの転送

API Gateway は、リクエストをバックエンドの API サーバに送ります。

#### 7. レスポンスの受信
API サーバはリクエストに対するレスポンスを API Gateway に返します。

#### 8. レスポンスの返却
API Gateway は、受け取ったレスポンスを外部システムに返します。


## リクエストコンテキスト

API Gateway では、リクエストコンテキストを使用して、リクエストの状態や情報を管理します。リクエストコンテキストは、リクエストごとに生成され、ルーティングチェーンの各ルールで利用されます。各ルールではリクエストのヘッダや変数を参照してアクションを決定することができます。

## ルーティング機能

API Gateway では、リクエストのルーティングを行うためのルールを定義できます。ルールは、リクエストのパスやヘッダ、メソッドなどに基づいて、適切なマイクロサービスにリクエストを転送します。ルールはルーティングチェーンと呼ばれるリストで管理され、チェーン間を渡り歩くことで複雑なルーティングを実現します。

## 冗長負荷分散機能

以下の冗長負荷分散をサポートします。（詳細未設計）

- Stateless Distributable
- Sticky Session Distributable
- Warm Standby(Activeプロセスのダウンを検知後すぐに切り替え)
- Cold Standby(Activeプロセスのダウンを検知後タスク起動)

## エラーレスポンス調整機能

API Gateway がブラウザにエラーを返す場合、そのボディ部の内容については以下のような課題がある。
- トップページのアクセスにおいて API Gateway の内部で発生する 400番台、500番台のエラーについてアプリケーションの Web UI のデザインにあわせた HTML を表示したい
- トップページ以外のアクセスにおいて HTML を返してもエンドユーザに表示されるわけではないので無意味である
- API のアクセスにおいて、 API Gateway の内部で 400番台、500番台のエラが発生した場合、 Accept ヘッダーにない Content-Type などAPIの呼び出し側が想定していないものを返すのはアプリケーションのエラー処理を複雑にする（間のリバースプロキシが入っている場合のエラー処理を追加しなければならない）
これらの問題に対応するために

## ロボット拒否

ビルトインチェーンでは検索エンジンのロボットを拒否する機能を提供する。

## コンテントセキュリティポリシー管理

CSPヘッダーを付与する

### CSP違反記録サービス

### iframe 管理

X-Frame-Options ヘッダーを付与する

## 監査ログ記録サービス

[pino HTTP送信モジュール](https://github.com/procube-open/pino-transmit-http)を推奨。



### WAFサービス

[ModSerurity](https://modsecurity.org/)にSPNエージェントをサイドカーとして付与して提供します。
