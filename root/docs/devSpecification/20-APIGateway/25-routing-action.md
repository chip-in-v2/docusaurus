import ApiSchema from '@theme/ApiSchema';

# ルーティングアクション

## デバイスID管理

このアクションは、CHIPIN_DEVICE_CONTEXT Cookie が存在しない場合、新しいデバイスIDをを発行します。
デバイスIDはPRNG（擬似乱数生成器）を使用して生成された48ビットの数値で、base64で 64文字の文字列にエンコードされます。

CHIPIN_DEVICE_CONTEXT Cookie が存在する場合は、JWTを検証し、 iss, exp の妥当性をチェックします。
sub の値をデバイスIDとして使用します。有効期限が再発行閾値を過ぎている場合は、CHIPIN_DEVICE_CONTEXT Cookie を再発行します。
exp 以外の値は引き継がれます。
デバイスIDはメモリ上に保存して管理しているわけではないので、サーバ側で無効化することはできません。セッションの有効期限が切れるまで有効です。

新しくデバイスIDを生成した場合、および再発行した場合はレスポンスヘッダに Cookie を以下のように追加します。
```
Set-Cookie: CHIPIN_DEVICE_CONTEXT=*JWT*;HttpOnly;Secure;SameSite=Strict;
```
サブドメインに shareCookie: true が設定されている場合は、CHIPIN_DEVICE_CONTEXT Cookie の Domain 属性にサブドメインの FQDN を設定します。
これにより、同じサブドメイン配下の仮想ホスト間でセッションを共有できます。

JWTのクレームは API Gateway のリクエストオブジェクトの変数として保存されます。
JWTのクレームおよびリクエストオブジェクト上の変数名は以下の通りです。

| クレーム名 | 型       | 説明                                |変数名|
|:-----------|:---------|:---------------------------------|---|
| iss        | string   | デバイスIDを発行した仮想ホストのFQDN | session_originator |
| sub        | string   | デバイスID.                      | session_id |
| cn         | string   | デバイスのCN（Common Name）     | session_cn |
| iat        | integer  | 発行日時（UNIXタイムスタンプ）     | session_start_at |
| exp        | integer  | 有効期限（UNIXタイムスタンプ）     | session_expire_at |
ただし、cn は利用者が設定した場合のみ設定されます。


<ApiSchema id="inventory" pointer="#/components/schemas/SetDeviceId" showExample={true} />

## サービス確認

このアクションは、SPN Hub 上で指定されたサービスが利用可能かどうかをチェックします。
利用可能である場合は、アクションは成功しますが、利用可能でない場合は 503 Service Unavailable エラーを返します。
そのレスポンスでは JavaScript により /.waitforAvailable の SSE を取得してサービスが利用可能になるのを待ちます。

<ApiSchema id="inventory" pointer="#/components/schemas/CheckoutServices" showExample={true} />

## 認証

このアクションは、CHIPIN_SESSION_ID Cookie の値をキーとして、セッション情報を取得します。
状況に応じて以下の処理を行います。
|状況|処理|
|---|---|
|パスがリダイレクトパス(oidcRecirectPath パラメータで指定)と一致する場合|パラメータに付与されている認可コードを使用して IdP からアクセストークンとリフレッシュトークンを取得します。成功した場合はリクエストのパスを元のパスに書き換えて次のフローに進みます。|
|CHIPIN_SESSION_ID Cookie が存在しない|失敗を返す|
|CHIPIN_SESSION_ID Cookie が存在するが、セッション情報がセッションテーブルに見つからない|失敗を返す|
|CHIPIN_SESSION_ID Cookie が存在し、セッション情報がセッションテーブルに見つかった|セッション情報のアクセストークンを確認して、次のフローに進む|

### セッション情報のアクセストークン確認
セッション情報のアクセストークンの状態により、以下の処理を行います。

|トークンの状態|処理|
|---|---|
|アクセストークンの有効期限が切れていない|セッション情報をリクエストオブジェクトの変数として保存して処理を進めます。|
|アクセストークンの有効期限が切れている|リフレッシュトークンを使用してアクセストークンを取得します|
|前行でトークンの取得に失敗した|失敗を返します。|

### トークン取得処理
[トークンエンドポイントの仕様](https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint)に従って IdP からトークンを取得します。
リクエストのメソッドはPOST、Content-Type ヘッダは application/x-www-form-urlencoded とします。

リクエストボディには以下のパラメータを指定します。
|パラメータ名|値|
|--|--|
|grant_type|authorization_code（認可コードで取得する場合） または refresh_token（リフレッシュトークンで取得する場合）|
|code|認可コード (grant_type が authorization_code の場合)|
|refresh_token|リフレッシュトークン (grant_type が refresh_token の場合)|
|redirect_uri|```https://\{virtual-host-fqdn\}\{oidcRecirectPath パラメータで指定された値\}``` (grant_type が authorization_code の場合)|
|client_id|oidcClientId パラメータで指定された値|
|client_secret|oidcClientSecret パラメータで指定された値|


取得に成功した場合は、以下の動作を行います。
- セッション情報を作成し、セッション情報テーブルに保存します。更新の場合はトークンのみを上書きします。
- レスポンスヘッダに Set-Cookie ヘッダを追加して CHIPIN_SESSION_ID Cookie にセッションIDを設定します。Cookie が設定済みの場合でも有効期限を更新します。

### 失敗を返す場合のレスポンス
失敗を返す場合のレスポンスはリクエストのパスがログイン画面へのリダイレクトを受け入れられるかどうかによって異なります。
- 失敗原因がOIDC IdPへの接続エラーなどのサーバ側のエラーである場合、500 Internal Server Error レスポンスを返します
- ログイン画面へのリダイレクトを受け入れられる場合でメソッドがGETの場合、ログイン画面へのリダイレクト処理を行います。
- 上記以外の場合、401 Unauthorized レスポンスを返します。このとき、Accept ヘッダーで application/json が指定されている場合は JSON 形式で、text/html が指定されている場合は HTML 形式でレスポンスボディを返します。

### ログイン画面へのリダイレクト
以下の処理を実施して、 IdP のログイン画面へのリダイレクトを行います。
- レスポンスの Location ヘッダに IdP の認証要求URLを指定
- URLには認証要求エンドポイント（oidcAuthorizationEndpoint パラメータで指定）を使用
- [トークンエンドポイントの仕様](https://openid.net/specs/openid-connect-core-1_0.html#TokenEndpoint)に従ってクエリパラメータとして以下を指定
    |パラメータ名|値|
    |--|--|
    |response_type|"code"|
    |client_id|oidcClientId パラメータで指定された値|
    |redirect_uri|```https://\{oidcAuthorizationEndpoint パラメータで指定された値\}\{oidcRecirectPath パラメータで指定された値\}?original_path=\{元のリクエストのURLをパーセントエンコーディングしたもの\}```をパーセントエンコーディングしたもの|
    |scope|"openid"|
    |state|\{ランダムな値\} (CSRF 対策のために使用される。実装ではセッション情報に保存し、リダイレクト後のコールバックで検証すること)|
    |nonce|\{ランダムな値\} (ID トークンの再生攻撃対策のために使用される。実装ではセッション情報に保存し、ID トークン受領後に検証すること)|
- ステータスコードを 302 に設定


### 次のフローに進む
セッション情報をリクエストオブジェクトの変数として保存します。
認可コードで新しくトークンを受け取る処理をした場合には、その original_path クエリパラメータで指定されたパスにリクエストのパスを書き換えます。
その後、ルーティングチェインの次のルールに従って処理を続行します。

<ApiSchema id="inventory" pointer="#/components/schemas/Authentication" showExample={true} />


## プロキシ

リクエストをプロキシ先のサービスに転送するためのアクションです。
前フェーズまでで作成されたレスポンスは破棄され、プロキシ先サービスから返却されたものが新しいレスポンスとなります。
このアクションは、リクエストを別のマイクロサービスに転送するために使用されます。

<ApiSchema id="inventory" pointer="#/components/schemas/Proxy" showExample={true} />

## リダイレクト

リダイレクトを行うためのアクション。レスポンスの stauts は 302 に設定される。
リダイレクト先のURLは、レスポンスの Location ヘッダに設定される。
このアクションは、リクエストを別のURLに転送するために使用される。

<ApiSchema id="inventory" pointer="#/components/schemas/Redirect" showExample={true} />

## ジャンプ

別のルーティングチェーンにリクエストを転送するためのアクション。処理中のチェーンは終了し、転送先のチェーンが新たに開始される。

<ApiSchema id="inventory" pointer="#/components/schemas/Jump" showExample={true} />

## 変数設定

evalexpr の式を評価して、変数に値を設定するアクション。
このアクションは、リクエストやレスポンスの情報を参照して、変数に値を設定するために使用される。

<ApiSchema id="inventory" pointer="#/components/schemas/SetVariables" showExample={true} />

## ヘッダー設定

HTTP ヘッダーの設定を行うためのアクション。
このアクションは、リクエストやレスポンスのヘッダを設定するために使用される。

<ApiSchema id="inventory" pointer="#/components/schemas/SetHeaders" showExample={true} />

## BFF 認証

BFFとしての認証を行う。
