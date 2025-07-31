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

以下に API Gateway における各フェーズのフィルターの仕様を説明します。

### early_request_filter()

リクエストの最初のフェーズです。


request_filter()
このフェーズは通常、リクエスト入力の検証、レート制限、コンテキストの初期化に使用されます。

request_body_filter()
このフェーズは、リクエストボディを上流に送信する準備が整った後に開始されます。リクエストボディの一部を受信するたびに呼び出されます。

proxy_upstream_filter()
このフェーズでは、上流へレスポンスを返すかどうかを判断します。ショートサーキットの場合はデフォルトで502が返されますが、別のレスポンスを実装することもできます。

このフェーズでは、アップストリームに進むかエラーになるかを決定するブール値を返します。

upstream_peer()
このフェーズでは、どのアップストリームに接続するか (DNS ルックアップやハッシュ/ラウンドロビンなど) と、それに接続する方法を決定します。

このフェーズでは、Peer接続先のアップストリームを定義する を返します。このフェーズの実装は必須です。

connected_to_upstream()
このフェーズは、アップストリームが正常に接続されたときに実行されます。

通常、このフェーズはログ記録を目的としています。RTTやアップストリームTLS暗号などの接続情報はこのフェーズで報告されます。

fail_to_connect()
の対応フェーズconnected_to_upstream()。アップストリームへの接続時にエラーが発生した場合、このフェーズが呼び出されます。

このフェーズでは、ユーザーはSentry/Prometheus/エラーログにエラーを報告できます。また、エラーが再試行可能かどうかを判断することもできます。

エラーが再試行可能な場合は、upstream_peer()再度呼び出されます。その場合、ユーザーは同じアップストリームを再試行するか、セカンダリにフェイルオーバーするかを決定できます。

エラーが再試行できない場合は、リクエストは終了します。

upstream_request_filter()
このフェーズでは、アップストリームに送信する前にリクエストを変更します。

upstream_response_filter()/upstream_response_body_filter()/upstream_response_trailer_filter()
このフェーズは、アップストリーム応答ヘッダー/本文/トレーラーが受信された後にトリガーされます。

このフェーズでは、下流に送信する前に、レスポンスのヘッダー、ボディ、またはトレーラーを変更または処理します。このフェーズはHTTPキャッシュの前に呼び出されるため、ここで行われた変更はHTTPキャッシュに保存されているレスポンスに影響することに注意してください。

response_filter()/response_body_filter()/response_trailer_filter()
このフェーズは、応答ヘッダー/本文/トレーラーをダウンストリームに送信する準備ができた後、トリガーされます。

このフェーズでは、下流に送信する前にそれらを変更します。

error_while_proxy()
このフェーズは、アップストリームへのプロキシ エラー中にトリガーされ、接続が確立された後です。

このフェーズでは、接続が再利用され、HTTP メソッドがべき等である場合に、リクエストを再試行することを決定する場合があります。

fail_to_proxy()
このフェーズは、上記のいずれかのフェーズでエラーが発生するたびに呼び出されます。

このフェーズは通常、エラーのログ記録と下流へのエラー報告を目的としています。

logging()
これは、リクエストが完了（またはエラー）した後、リソースが解放される前に実行される最後のフェーズです。すべてのリクエストはこの最終フェーズで終了します。

このフェーズは通常、ログ記録とリクエスト後のクリーンアップに使用されます。

request_summary()
これはフェーズではありませんが、よく使用されるコールバックです。

到達したすべてのエラーはfail_to_proxy()自動的にエラー ログに記録されます。request_summary()エラーをログに記録するときに、要求に関する情報をダンプするためにが呼び出されます。

このコールバックは、エラー ログにダンプする情報をユーザーがカスタマイズして、障害の追跡とデバッグを行えるようにする文字列を返します。

suppress_error_log()
これもフェーズではなく、別のコールバックです。

fail_to_proxy()エラーは自動的にエラーログに記録されますが、ユーザーがすべてのエラーに関心があるとは限りません。例えば、クライアントが早期に切断された場合、下流のエラーもログに記録されますが、ユーザーが主に上流の問題の監視に関心がある場合、これらのエラーはノイズとして認識される可能性があります。このコールバックはエラーを検査し、trueまたはfalseを返します。trueの場合、エラーはログに記録されません。

キャッシュフィルター
文書化される

## ルーティングチェーンの処理

ルーティングチェーンはルールのリストであり、順にルールの match 条件を評価し、条件を満たしたルールのアクションを実行します。各アクションについて以下に説明します。