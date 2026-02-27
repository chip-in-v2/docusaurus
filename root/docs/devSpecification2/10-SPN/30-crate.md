# SPN エンドポイント crate

この Rust用のcrate は SPNエンドポイントを提供します。Consumer エンドポイントと Provider エンドポイントの2つのエンドポイントを作成することができます。SPN セッションの確立と、双方向ストリームによるSPN上の通信をサポートします。

## Consumer エンドポイント

### `create_spn_consumer_endpoint`関数

```rust
pub async fn create_spn_consumer_endpoint(
    spn_hub_url: &str,
    cert_path: &str,
    key_path: &str,
    trust_store_path: &str,
) -> Result<SpnConsumerEndpoint, Box<dyn Error>>
```

- **引数**
  - `spn_hub_url`: SPN ハブの URL
  - `cert_path`: PEM形式のクライアント証明書のパス
  - `key_path`: PEM形式のクライアント証明書の秘密鍵のパス
  - `trust_store_path`: 信頼するCA証明書のパス
- **戻り値**  
  SPN セッションが確立された `SpnConsumerEndpoint` 構造体。エラー時は `Box<dyn Error>`。
- **主なエラー例**
  - クライアント証明書の読み込み失敗
  - ネットワークエラー
  - SPN Hub からの拒否

### `SpnConsumerEndpoint` 構造体

- **メソッド**
  - `pub async fn open_stream(&self) -> Result<QuicBidiStream, Box<dyn Error + Send + Sync>>`
    - 新しい双方向ストリーム（`QuicBidiStream`）を開く。

### 利用例

```rust
use ep_lib::core::create_spn_consumer_endpoint;

let endpoint = create_spn_consumer_endpoint(
    "https://spn-hub.example.com:4433",
    "/path/to/cert.pem",
    "/path/to/key.pem",
    "/path/to/ca.pem",
).await?;

let mut my_stream = endpoint.open_stream().await?;
// my_stream を使って双方向通信を行う
```

### QuicBidiStream アダプタ

`QuicBidiStream` は `tokio::io::AsyncRead` と `tokio::io::AsyncWrite` トレイトを実装しており、Tokioエコシステムのライブラリと直接統合可能です。

ストリームのライフサイクルはRAIIパターンで管理されており、`QuicBidiStream` のインスタンスがスコープから外れると、関連するQUICストリームは自動的にクローズされます。利用者が明示的にクローズ処理を呼び出す必要はありません。

### Postgres ドライバの例

`SpnConsumerEndpoint` を使用して PostgreSQL に接続する例を示します。

```Rust
use std::str::FromStr;
use tokio_postgres::Config;

let endpoint = create_spn_consumer_endpoint(
    "https://spn-hub.example.com:4433",
    "/path/to/cert.pem",
    "/path/to/key.pem",
    "/path/to/ca.pem",
).await?;

let stream = endpoint.open_stream().await?;

// tokio-postgresのconnect-rawに渡す
let config = Config::from_str("host=localhost user=postgres")?;
let (client, connection) = config.connect_raw(stream, tokio_postgres::NoTls).await?;

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

`SpnConsumerEndpoint` を使用して HTTP/HTTPS 通信を行う例を示します。

```rust
use hyper::{Body, Client, Request};
use hyper::client::conn;

let endpoint = create_spn_consumer_endpoint(
    "https://spn-hub.example.com:4433",
    "/path/to/cert.pem",
    "/path/to/key.pem",
    "/path/to/ca.pem",
).await?;

let stream = endpoint.open_stream().await?;

// hyperのコネクションをハンドシェイク
let (mut sender, connection) = conn::handshake(stream).await?;

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

### `create_spn_provider_endpoint`

```rust
pub async fn create_spn_provider_endpoint(
    spn_hub_url: &str,
    cert_path: &str,
    key_path: &str,
    trust_store_path: &str,
) -> Result<SpnProviderEndpoint, Box<dyn Error>>
```

- **引数**
  - `spn_hub_url`: SPN ハブの URL
  - `cert_path`: PEM形式のクライアント証明書のパス
  - `key_path`: PEM形式のクライアント証明書の秘密鍵のパス
  - `trust_store_path`: 信頼するCA証明書のパス
- **戻り値**  
  SPN セッションが確立された `SpnProviderEndpoint` 構造体。エラー時は `Box<dyn Error>`。
- **主なエラー例**
  - プロバイダ証明書の読み込み失敗
  - ネットワークエラー
  - SPN Hub からの拒否

### `SpnProviderEndpoint` 構造体

- **メソッド**
  - `pub async fn accept_stream(&self) -> Result<QuicBidiStream, Box<dyn Error>>`
    - SPN コネクションを接続し、QuicBidiStream を返す。エラー時は `Box<dyn Error>`。

## 利用例

```rust
use ep_lib::core::create_spn_provider_endpoint;

let provider = create_spn_provider_endpoint(
    "https://spn-hub.example.com:4433",
    "/path/to/cert.pem",
    "/path/to/key.pem",
    "/path/to/ca.pem",
).await?;

loop {
    let stream = provider.accept_stream().await?;
    // stream を使って双方向通信を行う
    tokio::spawn(async move {
        // handle stream
    });
}
```

### エンドポイントのライフサイクルとスレッドセーフティ

#### ライフサイクル (RAII)

`SpnConsumerEndpoint` および `SpnProviderEndpoint` は、リソースのライフサイクル管理にRAII (Resource Acquisition Is Initialization) パターンを利用しています。

エンドポイントのハンドルがスコープから外れてドロップされると、関連する全てのバックグラウンドタスク（接続維持、監視など）は自動的に停止され、クリーンアップ処理が実行されます。このため、利用者が手動でシャットダウン関数を呼び出す必要はありません。

#### スレッドセーフティ

エンドポイントのハンドル (`SpnConsumerEndpoint`, `SpnProviderEndpoint`) は、複数の非同期タスクから利用されることを想定しています。

ハンドルは `Send` トレイトを実装していますが、`Sync` トレイトは実装していません。このため、複数のタスクでハンドルを安全に共有するには、`Arc<tokio::sync::Mutex<...>>` でラップする必要があります。

`open_stream` や `accept_stream` を呼び出す際は、`Mutex` をロックしてからメソッドを呼び出します。

##### スレッド間での共有例

```rust
use std::sync::Arc;
use tokio::sync::Mutex;
use ep_lib::core::create_spn_consumer_endpoint;

# async fn example() -> Result<(), Box<dyn std::error::Error>> {
let endpoint = create_spn_consumer_endpoint(
    "https://spn-hub.example.com:4433",
    "/path/to/cert.pem",
    "/path/to/key.pem",
    "/path/to/ca.pem",
).await?;

// 複数のタスクで共有するために Arc<Mutex<...>> でラップする
let shared_endpoint = Arc::new(Mutex::new(endpoint));

for i in 0..5 {
    let endpoint_clone = shared_endpoint.clone();
    tokio::spawn(async move {
        // Mutexをロックしてエンドポイントのメソッドを呼び出す
        let lock = endpoint_clone.lock().await;
        match lock.open_stream().await {
            Ok(mut stream) => {
                // ... ストリームを使った処理 ...
                println!("Task {} opened a stream successfully.", i);
            }
            Err(e) => {
                eprintln!("Task {} failed to open stream: {}", i, e);
            }
        }
    });
}
# Ok(())
# }
```