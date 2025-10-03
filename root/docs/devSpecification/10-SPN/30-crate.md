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

### TokioStream アダプタ

spnConsumerEndPoint をクライアントライブラリでカスタムストリームとして使用する場合、tokio::io::AsyncReadとtokio::io::AsyncWriteトレイトに適合させるラッパーが必要となります。

```Rust
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use std::pin::Pin;
use std::task::{Context, Poll};
use std::io;

pub struct TokioStreamAdapter {
    inner: BiDirectionalStream,
}

impl TokioStreamAdapter {
    pub fn new(stream: BiDirectionalStream) -> Self {
        Self { inner: stream }
    }
}

impl AsyncRead for TokioStreamAdapter {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        // BiDirectionalStreamのread実装に委譲
        Pin::new(&mut self.inner).poll_read(cx, buf)
    }
}

impl AsyncWrite for TokioStreamAdapter {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        // BiDirectionalStreamのwrite実装に委譲
        Pin::new(&mut self.inner).poll_write(cx, buf)
    }

    fn poll_flush(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<io::Result<()>> {
        Pin::new(&mut self.inner).poll_flush(cx)
    }

    fn poll_shutdown(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<io::Result<()>> {
        Pin::new(&mut self.inner).poll_shutdown(cx)
    }
}
```

### Postgres ドライバの例

spnConsumerEndPoint とラッパーを使用して PostgreSQL に接続する例を示します。

```Rust
use tokio_postgres::connect_raw;

let endpoint = createSpnConsumerEndPoint(
    "https://spn-hub.example.com",
    "urn:chip-in:service:example-realm:postgres",
    "/path/to/cert.pem",
    "/path/to/key.pem"
).await?;

let my_stream = BiDirectionalStream::new(/* ... */);
endpoint.connect(my_stream).await?;

// TokioStreamAdapterでラップ
let adapted_stream = TokioStreamAdapter::new(my_stream);

// tokio-postgresのconnect-rawに渡す
let (client, connection) = connect_raw(
    "host=localhost user=postgres",
    tokio_postgres::NoTls,
    adapted_stream,
).await?;

// 別タスクでconnectionを実行
tokio::spawn(async move {
    if let Err(e) = connection.await {
        eprintln!("connection error: {}", e);
    }
});

// clientを使ってクエリ実行
let rows = client.query("SELECT * FROM users", &[]).await?;
```

### Hyper クライアントの例

spnConsumerEndPoint と TokioStreamAdapter を使用して HTTP/HTTPS 通信を行う例を示します。

```rust
use hyper::{Body, Client, Request};
use hyper::client::conn;

let endpoint = createSpnConsumerEndPoint(
    "https://spn-hub.example.com",
    "urn:chip-in:service:example-realm:http-service",
    "/path/to/cert.pem",
    "/path/to/key.pem"
).await?;

let my_stream = BiDirectionalStream::new(/* ... */);
endpoint.connect(my_stream).await?;

// TokioStreamAdapterでラップ
let adapted_stream = TokioStreamAdapter::new(my_stream);

// hyperのコネクションをハンドシェイク
let (mut sender, connection) = conn::handshake(adapted_stream).await?;

// 別タスクでconnectionを実行
tokio::spawn(async move {
    if let Err(e) = connection.await {
        eprintln!("connection error: {}", e);
    }
});

// HTTPリクエストを送信
let request = Request::builder()
    .method("GET")
    .uri("/api/users")
    .header("Host", "example.com")
    .body(Body::empty())?;

let response = sender.send_request(request).await?;
println!("Response status: {}", response.status());

// レスポンスボディを読み取る
let body_bytes = hyper::body::to_bytes(response.into_body()).await?;
println!("Response body: {:?}", body_bytes);
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
