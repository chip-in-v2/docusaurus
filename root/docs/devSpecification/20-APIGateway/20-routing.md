import Redoc from '@theme/Redoc';

# ルーティング処理

API Gateway は、リクエストを適切なサービスにルーティングするための機能を提供します。以下のセクションでは、ルーティングの基本的な概念と実装方法について説明します。

## SNIによる仮想ホストの特定

API Gateway は最初に SNI で宛先のFQDNを判定します。FQDNをキーとして仮想ホストを特定します。
仮想ホストが登録されていない場合は接続を拒否します。
仮想ホストが登録されている場合は、仮想ホストに設定されているルーティングチェーンを使用してリクエストを処理します。

## リクエストライフサイクル

以下に HTTP リクエストのライフサイクルを示します。

1. HTTP　リクエストのライフサイクルは、API Gatewayがクライアント(downstream)からリクエストヘッダを読み取ったときに始まります。
2. API Gateway はバックエンド（upstream）に接続します。再利用できる接続が既に確立されている場合、このステップはスキップされます。
3. API Gateway はリクエストヘッダをバックエンドに送信します。
4. リクエストヘッダが送信されると、API Gateway は二重モードに入り、同時に次の処理を実行します。
    - リクエストのボディ(存在する場合) をバックエンドに転送します
    - バックエンドからのレスポンス (ヘッダとボディの両方) をクライアントに転送します
5. リクエスト/レスポンス全体が終了すると、リクエストのライフサイクルは終了し、すべてのリソースが解放されます。クライアントとの接続とバックエンドとの接続は、条件を満たせば再利用のために維持されます。

## リクエストオブジェクト

ルーティングにおいてはリクエストごとにオブジェクトが作成されます。オブジェクトにはデバイスID、HTTPリクエストの属性、レスポンスヘッダなどが格納されます。
これは以下の機能で利用されます。

- デバイスID管理アクションでデバイスIDと関連付け
- ルーティングチェーンの match 式で参照
- setHeader, addCookie アクションで参照
- setHeader, addCookie アクションでオブジェクトの値を変更
- ログ出力アクションの値式で参照
- 認証アクションでセッションと関連付け


## BFF における認証処理

BFFにおいては、 Keycloak と Open ID Connect プロトコルで連携して認証を実装します。API Gateway と Cloak の認証の関係を以下に示します。

```plantuml Test
!theme spacelab
@startuml
actor user as "ユーザ"
component APIGateway as "API Gateway"
component keycloak
database keycloakDb as "Keycloak Database"
database sessionDb as "Session Database"
() Web
user --> Web
Web - APIGateway
APIGateway -- keycloak
() keycloakDbIf
keycloakDbIf - keycloakDb
keycloak --> keycloakDbIf
() sessionDbIf
sessionDbIf - sessionDb
APIGateway --> sessionDbIf
@enduml
```

### セッションレコード

セッションデータベースのセッションテーブルにはセッションレコードが記録される。

```plantuml Test
!theme spacelab
@startuml PERT
left to right direction

Package BrowserCookie1 {
  map DeviceContext1 {
    iss => iam.master.chip-in.net
    sub => DEVICE1
    iat => 1759383149
    exp => 1759323456
  }
}

Package BrowserCookie2 {
  map DeviceContext2 {
    iss => iam.master.chip-in.net
    sub => DEVICE2
    iat => 1759383149
    exp => 1759323456
  }
}

Package RequestObjects {
  map RequestObject0 {
    deviceId => DEVICE1
    method => GET
    path => /
    headers => {..hash map ..}
    responseHeaders => {..hash map ..}
    timestamp => 1759323456
    elapsedTime => 12
  }
  map RequestObject1 {
    deviceId => DEVICE1
    sessionId => si9e4X54543KH
    method => GET
    path => /um
    headers => {..hash map ..}
    responseHeaders => {..hash map ..}
    timestamp => 1759323421
    elapsedTime => 14
  }
  map RequestObject2 {
    deviceId => DEVICE1
    sessionId => si9e4X54543KH
    method => POST
    path => /api/pets/cat1
    headers => {..hash map ..}
    responseHeaders => {..hash map ..}
    timestamp => 1759324424
    elapsedTime => 3
  }
  map RequestObject3 {
    deviceId => DEVICE2
    sessionId => Uxd9kenfuwndl
    method => GET
    path => /
    headers => {..hash map ..}
    responseHeaders => {..hash map ..}
    timestamp => 1759329681
    elapsedTime => 24
  }
  map RequestObject4 {
    deviceId => DEVICE2
    sessionId => Uxd9kenfuwndl
    method => POST
    path => /api/pets/cat1
    headers => {..hash map ..}
    responseHeaders => {..hash map ..}
    timestamp => 1759321275
    elapsedTime => 5
  }
}

Package SessionTable {
  map SessionRecord1 {
    sessionId => si9e4X54543KH
    deviceId => DEVICE1
    host => iam.master.chip-in.net
    accessToken => xxx.yyy.zzz
    refreshToken => xxx.yy11.z22
    userId => mitsuru@test.chip-in.net
    selectedRole => worker
    previousLogin => 2025-08-12T15:10:12+0900
    location => 10.23.34.0/24
    firstSessionForDevice => false
    firstSessionForLocation => true
    loginAt => 2025-09-12T15:10:12+0900
    logoutAt => 2025-09-19T15:10:12+0900
    logoutReason => idle timeout
  }
  map SessionRecord2 {
    sessionId => Uxd9kenfuwndl
    deviceId => DEVICE2
    host => iam.master.chip-in.net
    accessToken => xxx.yyy.zzz
    refreshToken => xxx.yy11.z22
    userId => mitsuru@test.chip-in.net
    selectedRole => administrator
    previousLogin => 2025-08-12T15:10:12+0900
    location => 10.23.35.0/24
    firstSessionForDevice => true
    firstSessionForLocation => false
    loginAt => 2025-09-12T15:10:12+0900
    logoutAt => 2025-09-19T15:10:12+0900
    logoutReason => user operation
  }
}

Package LocaionTable {
  map Location1 {
    cidr => 10.23.34.0/24
    country => Japan
    areaName => Kobe
    postalCode => 6500001
    latitude => 34.6913
    longitude => 135.183
    ASN => amazon
  }
  map Location2 {
    cidr => 10.23.35.0/24
    country => Japan
    areaName => Osaka
    postalCode => 5308201
    latitude => 34.6913
    longitude => 135.183
    ASN => google
  }
}

DeviceContext1 <-- RequestObject0
DeviceContext1 <-- RequestObject1
DeviceContext1 <-- RequestObject2
DeviceContext2 <-- RequestObject3
DeviceContext2 <-- RequestObject4
RequestObject1 --> SessionRecord1
RequestObject2 --> SessionRecord1
RequestObject3 --> SessionRecord2
RequestObject4 --> SessionRecord2
SessionRecord1 --> Location1
SessionRecord2 --> Location2

@enduml

```


## API Gateway のフェーズとフィルタ

API Gateway ではルーティングチェーンを記述することでリクエストのライフサイクルに任意のロジックを挿入できます。
以下に、API Gateway の実装ベースである Pingora のフェーズとフィルターのフローを示します。

```mermaid
 graph TD;
    start("new request")-->early_request_filter;
    early_request_filter-->request_filter;
    request_filter-->upstream_peer;

    upstream_peer-->Connect{{IO: connect to upstream}};

    Connect--connection success-->connected_to_upstream;
    Connect--connection failure-->fail_to_connect;

    connected_to_upstream-->upstream_request_filter;
    upstream_request_filter --> request_body_filter;
    request_body_filter --> SendReq{{IO: send request to upstream}};
    SendReq-->RecvResp{{IO: read response from upstream}};
    RecvResp-->upstream_response_filter-->response_filter-->upstream_response_body_filter-->response_body_filter-->logging-->endreq("request done");

    fail_to_connect --can retry-->upstream_peer;
    fail_to_connect --can't retry-->fail_to_proxy--send error response-->logging;

    RecvResp--failure-->IOFailure;
    SendReq--failure-->IOFailure;
    error_while_proxy--can retry-->upstream_peer;
    error_while_proxy--can't retry-->fail_to_proxy;

    request_filter --send response-->logging


    Error>any response filter error]-->error_while_proxy
    IOFailure>IO error]-->error_while_proxy
```

以下に API Gateway における各フィルタの処理内容を説明します。記載のないフィルタについては Pingora のデフォルトの処理が呼び出されます。

### early_request_filter


### request_filter()

このフィルターでルーティングチェーンを処理します。デフォルトでの処理内容は以下の通り。

- SNI で識別したホスト名と Host ヘッダの値が異なる（小文字で正規化後称号）場合は 400 Bad Request を返す

### upstream_request_filter()
ルーティングチェーンで set_request_header アクションがあればその内容に従ってバックエンドに送るヘッダの値を変更します。

### upstream_response_filter()
ルーティングチェーンで set_response_header アクションがあればその内容に従ってレスポンスヘッダの値を変更します。
このフェーズでは、下流に送信する前に、レスポンスのヘッダーを変更します。このフェーズはHTTPキャッシュの前に呼び出されるため、ここで行われた変更はHTTPキャッシュに保存されているレスポンスに影響することに注意してください。

## ルーティングチェーンの処理

ルーティングチェーンはルールのリストであり、順にルールの match 条件を評価し、条件を満たしたルールのアクションを実行します。各アクションについて[次の章](routing-action)で説明します。

## サービス待ちSSE

API Gateway ではサービスが利用可能になるのを待つための SSE (Server-Sent Events) を提供します。

<Redoc id="waitfor-services" />

##

### デバイスコンテキスト

デバイスコンテキストは "device_" で始まる変数に保持されます。 

| 変数名                  | 型       | 説明                                |
|:-----------------------|:---------|:---------------------------------|
| device_context_originator | string   | デバイスIDを発行した仮想ホストのFQDN |
| device_id              | string   | デバイスID.                      | 
| device_start_at        | integer  | 発行日時（UNIXタイムスタンプ）     | 
| device_expire_at       | integer  | 有効期限（UNIXタイムスタンプ）     |

### HTTPリクエスト

HTTP リクエストは "request_" で始まる変数に保持されます。

| 変数名                  | 型       | 説明                                |　例 |
|:-----------------------|:---------|:---------------------------------|:------------|
| request_path           | string   | HTTPリクエストのパス | /my/path |
| request_method         | string   | HTTPリクエストのメソッド | GET |
| request_param_XXXX     | string   | HTTPリクエストのクエリパラメータ | 下の例を参照 |
| request_header_XXXX     | string   | HTTPリクエストのヘッダ | 下の例を参照 |

例については、以下のリクエストを受信した場合の値を示しています。

```
curl 'https://api.master.chip-in.net/my/path?parameter1=value1&parameter2=value1&parameter2=value2&parameter3=value1,value2' -H 'header1: value1' -H 'header2: value1' -H 'header2: value2' -H 'Accept: text/html, application/xhtml+xml'
```

### クエリパラメータ


:::note
ヘッダとクエリパラメータの複数値の値について検討中
:::

