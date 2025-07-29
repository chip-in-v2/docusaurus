# SPN エージェント

SPN エージェントは SPN Hub に接続し、SPN セッションを確立するためのエージェントです。
SPN Comsumer エージェントと SPN Provider エージェントの2つのタイプがあります。

## SPN Consumer エージェント
SPN Consumer エージェントは SPN Hub に接続し、SPN セッションを確立するためのエージェントです。
パラメータは環境変数で指定します。指定できる環境変数は以下の通りです。

|環境変数名|説明|値の例|
|--|--|--|
|SPN_HUB_URL|SPN Hub の URL|`https://spn-hub.example.com`|
|SPN_SERVICE_URN|サービスの URN|`urn:example:service`|
|SPN_CERTIFICATE|クライアント証明書|PEM形式のクライアント証明書|
|SPN_CERTIFICATE_KEY|クライアント証明書秘密鍵|PEM形式のクライアント証明書の秘密鍵|
|BIND_ADDRESS|エージェントが listen するバインドアドレス|`127.0.0.11:8080`|

起動すると、SPN Hub に接続し、SPN セッションを確立します。
BIND_ADDRESS にクライアントからの接続があるごとに、SPN Hub 経由でSPNコネクションを確立しサービスのプロバイダに接続します。

## SPN Provider エージェント
SPN Provider エージェントは SPN Hub に接続し、SPN セッションを確立するためのエージェントです。
パラメータは環境変数で指定します。指定できる環境変数は以下の通りです。

|環境変数名|説明|値の例|
|--|--|--|
|SPN_HUB_URL|SPN Hub の URL|`https://spn-hub.example.com`|
|SPN_SERVICE_URN|サービスの URN|`urn:example:service`|
|SPN_CERTIFICATE|クライアント証明書|PEM形式のクライアント証明書|
|SPN_CERTIFICATE_KEY|クライアント証明書秘密鍵|PEM形式のクライアント証明書の秘密鍵|
|FORWARD_ADDRESS|SPN Hub からの接続を転送するアドレス|`127.0.0.1:8080`|

起動すると、SPN Hub に接続し、SPN セッションを確立します。
SPN Hub からの接続を待ち受け、接続があるごとに、SPN Hub 経由でSPNコネクションを確立し FORWARD_ADDRESS にプロキシ転送します。
