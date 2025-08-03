import ApiSchema from '@theme/ApiSchema';

# api-gateway コマンド

api-gateway コマンドは API Gateway を実装します。spnhub コマンドのパラメータはコマンドラインオプションと環境変数のいずれかで指定できます。
パラメータには以下のものがあります。

|オプション|環境変数名|説明|デフォルト|
|--|--|--|--|
|-c |APIGW_INVENTORY_URL| API Gateway の構成情報を提供するインベントリのURL。|http://localhost:8080|

api-gateway コマンドは起動時とリロードシグナル受信時に構成情報を[インベントリ](/docs/devSpecification/inventory-openapi) から読み込みます。具体的には以下の順に読み込みます。リロードシグナルは SIGUSR1 です。

## 1. レルムの読み込み

全てのレルムを読み込みます。
API Gateway はレルムごとに内部が分離されており、マルチテナントのシステムを容易に実装できます。

<ApiSchema id="inventory" pointer="#/components/schemas/Realm" />

- disabled が True のものは無視します。
- リロードにおいては、一覧の前後を比較し、追加削除を行います。

## 2. ゾーンの読み込み

レルムごとにゾーンを読み込みます。ゾーンは DNS 権威サーバの管理単位です。

<ApiSchema id="inventory" pointer="#/components/schemas/Zone" />

### DNS 連携
ゾーンに dnsProvider が設定されている場合、ゾーンに所属する仮想ホストに対してDNSレコードが自動的に作成さます。
また、lets encrypt などの自動証明書発行サービスを使用して、仮想ホストに必要なSSL/TLS証明書を自動的に取得します。

## 3. サブドメインの読み込み

ゾーンごとにサブドメインを読み込みます。
サブドメインは、ゾーン内でドメインを作成するために使用されます。

<ApiSchema id="inventory" pointer="#/components/schemas/Subdomain" />

disabled が True のものは無視されます。

## 4. 仮想ホストの読み込み

仮想ホストを読み込みます。
仮想ホストは、サブドメインの下にFQDNを持ち、特定のサービスやアプリケーションを識別するために使用されます。

<ApiSchema id="inventory" pointer="#/components/schemas/VirtualHost" />

disabled が True のものは無視されます。

## 5. ルーティングチェーンの読み込み

レルムごとにルーティングチェーンを読み込みます。
ルーティングチェーンは、API Gateway 内で HTTP リクエストの処理を行うためのルールの集合であり、リクエストを適切なマイクロサービスに転送するためのロジックを定義できます。

<ApiSchema id="inventory" pointer="#/components/schemas/RoutingChain" />
