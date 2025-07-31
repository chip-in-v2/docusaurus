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

### request_filter()

このフィルターでルーティングチェーンを処理します。

### upstream_request_filter()
ルーティングチェーンで set_request_header アクションがあればその内容に従ってバックエンドに送るヘッダの値を変更します。

### upstream_response_filter()
ルーティングチェーンで set_response_header アクションがあればその内容に従ってレスポンスヘッダの値を変更します。
このフェーズでは、下流に送信する前に、レスポンスのヘッダーを変更します。このフェーズはHTTPキャッシュの前に呼び出されるため、ここで行われた変更はHTTPキャッシュに保存されているレスポンスに影響することに注意してください。

## ルーティングチェーンの処理

ルーティングチェーンはルールのリストであり、順にルールの match 条件を評価し、条件を満たしたルールのアクションを実行します。各アクションについて以下に説明します。

（未執筆）
