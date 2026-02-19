# SPN エージェント

SPN エージェントは SPN Hub に接続し、SPN セッションを確立するためのエージェントです。
Comsumer エージェントと Provider エージェントの2つのタイプがあります。

## Consumer エージェント
Consumer エージェントは SPN Hub に接続し、SPN セッションを確立するためのエージェントで、クライアントからのProviderへのTCP接続を受け付けます。
パラメータは環境変数で指定します。指定できる環境変数は以下の通りです。

|環境変数名|説明|値の例|
|--|--|--|
|SPN_HUB_HOSTNAME|SPN Hub の HOSTNAME|`spn-hub.example.com`|
|SPN_HUB_PORT|SPN Hub の PORT番号|4433|
|SPN_AGENT_CLIENT_CERTIFICATE|クライアント証明書|PEM形式のクライアント証明書のファイルパス|
|SPN_AGENT_CLIENT_CERTIFICATE_KEY|クライアント証明書秘密鍵|PEM形式のクライアント証明書の秘密鍵のファイルパス|
|SPN_AGENT_TRUST_CERTIFICATE_ROOT|SPN HUBのTLSサーバ証明書のルートCA|PEM形式のクライアント証明書のファイルパス|
|BIND_ADDRESS|エージェントが listen するバインドアドレス|`0.0.0.0:8080`|

サービスの URNは(`urn:example:service`)は、クライアント証明書のSubject CNで指定します。

起動すると、SPN Hub に接続し、SPN セッションを確立します。
BIND_ADDRESS にクライアントからのTCP接続があるごとに、SPN Hub 経由でSPNコネクションを確立しサービスのプロバイダに接続します。

## Provider エージェント
Provider エージェントは SPN Hub に接続し、SPN セッションを確立するためのエージェントで、サーバーをConsumerから利用可能にします。
パラメータは環境変数で指定します。指定できる環境変数は以下の通りです。

|環境変数名|説明|値の例|
|--|--|--|
|SPN_HUB_HOSTNAME|SPN Hub の HOSTNAME|`spn-hub.example.com`|
|SPN_HUB_PORT|SPN Hub の PORT番号|4433|
|SPN_AGENT_CLIENT_CERTIFICATE|クライアント証明書|PEM形式のクライアント証明書のファイルパス|
|SPN_AGENT_CLIENT_CERTIFICATE_KEY|クライアント証明書秘密鍵|PEM形式のクライアント証明書の秘密鍵のファイルパス|
|SPN_AGENT_TRUST_CERTIFICATE_ROOT|SPN HUBのTLSサーバ証明書のルートCA|PEM形式のクライアント証明書のファイルパス|
|FORWARD_ADDRESS|SPN Hub からの接続を転送するアドレス|`127.0.0.1:8080`|

サービスの URNは(`urn:example:service`)は、クライアント証明書のSubject CNで指定します。

起動すると、SPN Hub に接続し、SPN セッションを確立します。
SPN Hub 経由のコンシューマからの接続を待ち受け、接続があるごとにSPN Hub 経由のSPNコネクションを確立し、FORWARD_ADDRESS にプロキシ転送しサーバへ接続します。
