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
| iat        | integer  | 発行日時（UNIXタイムスタンプ）     | session_start_at |
| exp        | integer  | 有効期限（UNIXタイムスタンプ）     | session_expire_at |


<ApiSchema id="inventory" pointer="#/components/schemas/SetSessionId" showExample={true} />

## サービス確認

このアクションは、SPN Hub 上で指定されたサービスが利用可能かどうかをチェックします。
利用可能である場合は、アクションは成功しますが、利用可能でない場合は 503 Service Unavailable エラーを返します。
そのレスポンスでは JavaScript により /.waitforAvailable の SSE を取得してサービスが利用可能になるのを待ちます。

<ApiSchema id="inventory" pointer="#/components/schemas/CheckoutServices" showExample={true} />

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
