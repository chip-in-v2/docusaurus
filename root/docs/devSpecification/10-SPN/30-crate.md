# SPN エンドポイント crate

この crate は SPN (Service Provider Network) のエンドポイントを提供します。  
SPN セッションの確立と、双方向ストリームによる通信をサポートします。

## Consumer エンドポイント

### `createSpnConsumerEndPoint`関数

```rust
async fn createSpnConsumerEndPoint(
    spnHubUrl: &str,
    serviceUrn: &str,
    certificate: &str,
    certificate_key: &str
) -> Result<impl spnConsumerEndPoint, SpnError>
```

- **引数**
  - `spnHubUrl`: SPN ハブの URL
  - `serviceUrn`: サービスの URN
  - `certificate`: PEM形式のクライアント証明書
  - `certificate_key`: PEM形式のクライアント証明書の秘密鍵
- **戻り値**  
  SPN セッションが確立された `spnConsumerEndPoint` インタフェースのハンドル。エラー時は `SpnError`。
- **主なエラー例**
  - クライアント証明書の読み込み失敗
  - ネットワークエラー
  - SPN Hub からの拒否

### `spnConsumerEndPoint` インタフェース

- **メソッド**
  - `async fn connect(&self, stream: BiDirectionalStream) -> Result<(), SpnError>`
    - 呼び側が事前に準備した双方向ストリームをSPNコネクションに接続する。エラー時は `SpnError`。

### 利用例

```rust
let endpoint = createSpnConsumerEndPoint(
    "https://spn-hub.example.com",
    "urn:chip-in:service:example-realm:foo",
    "/path/to/cert.pem"
).await?;

let my_stream = BiDirectionalStream::new(/* ... */);
endpoint.connect(my_stream).await?;
// my_stream を使って双方向通信を行う
```
## Provider エンドポイント

### `createSpnProviderEndPoint`

```rust
async fn createSpnProviderEndPoint(
    spnHubUrl: &str,
    serviceUrn: &str,
    certificate: &str,
    certificate_key: &str
) -> Result<impl spnProviderEndPoint, SpnError>
```

- **引数**
  - `spnHubUrl`: SPN ハブの URL
  - `serviceUrn`: サービスの URN
  - `certificate`: PEM形式のクライアント証明書
  - `certificate_key`: PEM形式のクライアント証明書の秘密鍵
- **戻り値**  
  SPN セッションが確立された `spnProviderEndPoint` インタフェースのハンドル。エラー時は `SpnError`。
- **主なエラー例**
  - プロバイダ証明書の読み込み失敗
  - ネットワークエラー
  - SPN Hub からの拒否

### `spnProviderEndPoint` インタフェース

- **メソッド**
  - `async fn listen(&self) -> Result<spnProviderRequest, SpnError>`
    - 新たな SPN コネクションの接続を待ち受け、接続されると `spnProviderRequest` インタフェースを返す。エラー時は `SpnError`。

### `spnProviderRequest` インタフェース

- **メソッド**
  - `async fn accept(&self) -> Result<BiDirectionalStream, SpnError>`
    - SPN コネクションを接続し、双方向ストリームを返す。エラー時は `SpnError`。

## 利用例

```rust
let provider = createSpnProviderEndPoint(
    "https://spn-hub.example.com",
    "urn:chip-in:service:example-realm:foo",
    "/path/to/cert.pem"
).await?;

let request = provider.listen().await?;
let stream = request.accept().await?;
// stream を使って双方向通信を行う
```
