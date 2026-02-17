import ApiSchema from '@theme/ApiSchema';

# SPN Hub

SPN Hub では SPN エンドポイントからの QUIC での接続を受け付けて、閉じた仮想ネットワークを提供します。

SPN HubとSPN エンドポイントがトンネル(SPN セッション)を張り、
Consumer エンドポイントとProvider エンドポイント間のストリーム通信(SPNコネクション)を実現します。

SPNエージェントを用いた場合のSPNの利用イメージは以下です。
 - Consumer エージェントへTCPコネクトすることで、Providerのサーバーサービスを利用できます。
 - Provider エージェントへTCPサービスを公開することで、Consumerへサーバーサービスを提供できます。

## SPN エンドポイント

SPN エンドポイントは QUIC で SPN Hub に接続するクライアントです。
SPNエンドポイントの実現方法は二つあり、 SPN create を使用して Rust で開発する方法と、SPN エージェントを利用して普通のTCPのクライアント/サーバと接続する方法です。

Providerエンドポイントと、Consumerエンドポイントがあり、前者がサーバーサービスの提供者側で、後者がサーバーサービスの利用者側です。

## SPN セッション

SPN セッションは、SPN Hub と SPN エンドポイントの間のトンネルです。(QUIC のコネクションと同義ですが、SPNのコネクションとの混同を避けるためにあえて、SPN セッションと呼びます。この他に Chip-in では HTTP のセッションやコネクションも登場しますが、それらとも区別してください。)

QUIC コネクション確立によりSPNセッションも確立され、これをトンネルとして、ユーザはエンドポイント間でストリーム通信(SPNコネクション)を利用することができます。

SPN セッションオブジェクトには以下が保持されます。

|項目名|説明|
|--|--|
|startAt|セッション開始時刻|
|spnSessionId|デバイスID（QUIC のサーバ側コネクションIDを使用する）|
|spnEndPoint|QUICコネクションの確立に使用されたクライアント証明書の Subject の値|
|endPointType|"serviceProvider", "serviceConsumer" のいずれか|
|serviceUrn|セッションのサービスのエンドポイントのURN|
|totalConnectionCount|このセッション上で作成された SPNコネクションの総数|

SPN　セッションはセッションの開設時と終了時にログを出力します。ログの項目は以下の通り。

|項目名|説明|
|--|--|
|timestamp|イベント発生時刻（ログの出力時刻と異なる場合があるのでイベント発生時の時刻を記録する）|
|spnSessionId|デバイスID（QUIC のサーバ側コネクションIDを使用する）|
|spnEndPoint|QUICコネクションの確立に使用されたクライアント証明書の Subject の値|
|eventType|"startSpnSession", "endSpnSession" のいずれか|
|endPointType|"serviceProvider", "serviceConsumer" のいずれか|
|serviceUrn|セッションのサービスのURN|
|totalConnectionCount|このセッション上で作成された SPNコネクションの総数。endSpnSession のときのみ出力される|
|elapsedTime|セッション開設時からの経過時間。endSpnSession のときのみ出力される|
|terminateReason|セッションの終了理由。"shutdown", "terminatedByPeer", "error" のいずれか。endSpnSession のときのみ出力される|

#### SNP Hub のマルチインスタンス

SPN Hub は複数稼働させることができます。ただし、それぞれの SPN Hub は異なるグローバルIPを持ちます。
DNS上では SPN Hub の1個のFQDNに対して起動中のグローバルIPアドレスをすべて返すようにします。
エンドポイント側では、起動時に SPN Hub の FQDN を解決し、得られたグローバルIPアドレスの全てに対してセッションを確立します。
また、定期的に SPN Hub の FQDN を解決し、得られたグローバルIPアドレスの変化を監視します。グローバルIPが削除された場合は、内包するコネクションを中断してセッションを終了し別の SPN Hub に接続し直してコネクションを再開します。

エンドポイント側で複数の SPN セッションがある状態で新しいコネクションが必要となった場合はどれか一つのセッションを選択してコネクションを確立します。

## SPN コネクション

SPN コネクションは、Consumer エンドポイントから SPN Hub を経由して Provider エンドポイントに接続するストリーム通信です。(QUIC のコネクションと異なるので、注意してください。SPN コネクションは、QUIC ストリームで実現されます。)
SPN コネクションは以下の構成要素からなります。
- Consumer エンドポイントと SPN Hub の間の双方向 QUIC ストリーム
- SPN Hub と Provider エンドポイントの間の双方向 QUIC ストリーム
- SPN コネクション管理オブジェクト

SPNコネクションの確立は
1. Consumer エンドポイントは、SPN Hub との間の双方向 QUIC ストリームを接続する
2. SPN Hub は、対応するProvider エンドポイントとの間に双方向 QUIC ストリームを接続する

ただし、エージェントの場合は、以下のように、4つのストリームを接続することになることに注意してください。
1. Consumerの利用者は、Consumer エージェントと、TCPストリーム接続する
2. Consumer エージェントは、SPN Hub との間の双方向 QUIC ストリームを接続する
3. SPN Hub は、対応するProvider エージェントとの間に双方向 QUIC ストリームを接続する
4. Provider エージェントは、ProviderのサーバへTCPストリーム接続する

SPN コネクションオブジェクトには以下が保持されます。

|項目名|説明|
|--|--|
|startAt|コネクション開始時刻|
|spnConnectionId|SPNコネクションID（QUIC のストリームIDを serviceConsumer側、serviceProvider側の順に連結したものを使用する）|
|consumerSideSpnSessionId|serviceConsumer側 SPN セッションのID|
|providerSideSpnSessionId|serviceProvider側 SPN セッションのID|
|totalSentBytes|このストリーム上で serviceConsumerからserviceProviderに送信したデータの累計バイト数|
|totalReceiveBytes|このストリーム上で serviceConsumer がserviceProviderから受信したデータの累計バイト数|

SPN　セッションはセッションの開設時と終了時にログを出力します。ログの項目は以下の通り。

|項目名|説明|
|--|--|
|timestamp|イベント発生時刻（ログの出力時刻と異なる場合があるのでイベント発生時の時刻を記録する）|
|spnConnectionId|SPNコネクションID（QUIC のストリームIDを serviceConsumer側、serviceProvider側の順に連結したものを使用する）|
|eventType|"startSpnConnection", "endSpnConnection" のいずれか|
|consumerSideSpnSessionId|serviceConsumer側 SPN セッションのID|
|providerSideSpnSessionId|serviceProvider側 SPN セッションのID|
|totalSentBytes|このストリーム上で serviceConsumerからserviceProviderに送信したデータの累計バイト数。 endSpnConnection のときのみ出力される|
|totalReceiveBytes|このストリーム上で serviceConsumer がserviceProviderから受信したデータの累計バイト数。 endSpnConnection のときのみ出力される|
|elapsedTime|コネクション開設時からの経過時間。 endSpnConnection のときのみ出力される|
|disconnectReason|コネクションの切断理由。"closedByPeer", "closed", "error" のいずれか。 endSpnConnection のときのみ出力される|

## spnhub コマンド

spnhub コマンドは SPN Hub を実装します。spnhub コマンドのパラメータはコマンドラインオプションと環境変数のいずれかで指定できます。
パラメータには以下のものがあります。

|オプション|環境変数名|説明|デフォルト|
|--|--|--|--|
|-c |SPNHUB_INVENTORY_URL|SPN Hub の構成情報を提供するインベントリのURL。|http://localhost:8080|

spnhubコマンドは起動時とリロードシグナル受信時に構成情報を[インベントリ](/docs/devSpecification/inventory-openapi) から読み込みます。具体的には以下の順に読み込みます。リロードシグナルは SIGUSR1 です。

### 1. レルムの読み込み

全てのレルムを読み込みます。
SPN Hub はレルムごとに内部が分離されており、マルチテナントのシステムを容易に実装できます。

Realmの定義を参照

- disabled が True のものは無視します。(未実装)
- リロードにおいては、一覧の前後を比較し、追加削除を行います。(未実装)

### 2. SPN Hub の構築

レルムごとに SPN Hub を構築します。

Hubの定義を参照

### 3. サービスの構築

SPN Hub ごとにサービスの定義を読み込みます。

Serviceの定義を参照

availabilityManagement が設定されている場合は、クラスタマネージャによるProviderの自動起動が利用できます。
- ondemandStartOnPayload が true のサービスについては、対応するConsumerエンドポイントへ、最初のエンドユーザの通信が発生した時に、サービスを自動起動する。
- ondemandStartOnConsumer が true のサービスについては、対応するConsumerエンドポイントがSPNセッションを確立した時に、サービスを自動起動する。

