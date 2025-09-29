# CSP ヘッダのサービスサプライチェーン攻撃に対する効果

**サービスサプライチェーン攻撃**とは、自社のウェブサイトが利用している**サードパーティのサービス（解析ツール、広告配信、チャットボットなど）が改ざん**され、そこから悪意のあるスクリプトが送り込まれる攻撃です。クレジットカード情報を盗み出す「Magecart攻撃」などが代表例です。

## CSPがどのように防御するか

仮に、あなたが利用している解析ツール `https://analytics.example.com/tracker.js` が攻撃者によって改ざんされたとします。

1.  **不正なスクリプトの実行をブロック**:
    もし、改ざんされた `tracker.js` が、さらに別の攻撃用サーバー `https://evil-server.com/attack.js` を読み込もうとしても、あなたのCSPで `script-src` に `https://evil-server.com` を許可していなければ、このスクリプトの読み込みはブラウザによって**ブロック**されます。

2.  **不正な通信をブロック**:
    もし、`tracker.js` 自体に埋め込まれた攻撃コードが、盗み出した情報を攻撃者のサーバー `https://evil-server.com/steal` に送信しようとしても、CSPの `connect-src` でこのドメインを許可していなければ、データ送信は**ブロック**されます。

このように、CSPは\*\*「許可したドメイン以外からのリソース読み込み」**と**「許可したドメイン以外へのデータ送信」\*\*を禁止するため、サードパーティサービスが侵害された場合でも、被害の発生や拡大を直接的に防ぐことができます。

## 限界と補完策: SRI (Subresource Integrity)

ただし、CSPにも限界があります。もし `tracker.js` のファイル自体が改ざんされ、そのファイル内で攻撃が完結する場合、`script-src 'self' https://analytics.example.com` のように信頼して許可しているドメインなので、CSPだけでは防げません。

そこで有効なのが **SRI (Subresource Integrity)** との組み合わせです。SRIは、`<script>`タグに期待されるファイルのハッシュ値を指定しておくことで、もしファイルの内容が1ビットでも改ざんされていれば、ブラウザがそのスクリプトの実行をブロックする仕組みです。

```html
<script src="https://analytics.example.com/tracker.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wJ"
        crossorigin="anonymous"></script>
```

**CSPで「出所」を、SRIで「内容」を検証する**ことで、サービスサプライチェーン攻撃に対する耐性を飛躍的に高めることができます。
