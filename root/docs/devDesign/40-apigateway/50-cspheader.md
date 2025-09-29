# CSPヘッダの設定

CSPヘッダの指定内容を決めるためには、アプリケーションがどのようなリソースをどこから読み込んでいるかを正確に把握し、それらを「ホワイトリスト形式」で明示的に許可していくアプローチを取ります。

以下に、CSPの内容を決定するための考え方と具体的なステップを解説します。

-----

## CSP設定の基本的な考え方

CSPの基本は\*\*「デフォルト拒否（Default Deny）」\*\*です。つまり、まず全ての外部リソースの読み込みを原則として禁止し、その後、アプリケーションの動作に必要なリソースだけを個別に許可していきます。

このアプローチにより、もし攻撃者によって悪意のあるスクリプトがサイトに注入されても、そのスクリプトの実行や外部への情報送信をブラウザレベルでブロックできます。

-----

## CSPポリシー決定の具体的なステップ

CSPの導入は、ウェブサイトの表示や機能を壊してしまうリスクがあるため、慎重に段階を踏んで進めるのがベストプラクティスです。

### ステップ1: 自サイトのリソースを棚卸しする

まず、あなたのSPAがどこからどのような種類のリソースを読み込んでいるかをすべて洗い出します。

  * **JavaScriptファイル (.js)**: 自社のサーバー、CDN（例: cdnjs, unpkg）など
  * **CSSファイル (.css)**: 自社のサーバー、Google Fontsなどの外部サービス
  * **画像ファイル (jpg, png, svgなど)**: 自社のサーバー、外部の画像配信サービス
  * **フォントファイル**: Google Fonts, Adobe Fontsなど
  * **API通信先**: 自社のAPIサーバー、外部のBaaS（Firebaseなど）
  * **埋め込みコンテンツ (`<iframe>`)**: YouTube, Google Mapsなど
  * **その他**: Webソケットの接続先など

ブラウザの開発者ツールの「ネットワーク」タブを見ながら実際にアプリケーションを操作すると、どのようなリソースが読み込まれているかを確認できます。

### ステップ2: Report-Onlyモードでポリシー案を試す

いきなりCSPを強制（enforce）すると、許可漏れがあった場合にサイトが正しく動作しなくなります。そこで、まずは\*\*`Content-Security-Policy-Report-Only`\*\*ヘッダを使ってシミュレーションを行います。

このヘッダを設定すると、ポリシーに違反するリソースがあってもブロックはせず、違反内容をコンソールに出力したり、指定したURLにレポートを送信したりできます。

**▼ Report-Onlyヘッダの例**

```http
Content-Security-Policy-Report-Only:
  default-src 'self';
  report-uri /csp-violation-report-endpoint;
```

この状態でアプリケーションをテストし、開発者ツールのコンソールにCSP違反のログが出力されるのを確認しながら、必要な許可設定を洗い出していきます。

### ステップ3: ポリシーを段階的に策定する

Report-Onlyモードで収集した情報をもとに、具体的なCSPのディレクティブ（指示）を組み立てていきます。最初は最も厳しいポリシーから始め、必要なものだけを追加していくのが安全です。

#### **① 基本方針を決める (`default-src`)**

まずは基本となる`default-src`を決めます。多くの場合は、自分自身のオリジン（ドメイン）のみを許可する`'self'`を指定するのが良い出発点です。

`default-src 'self';`

これにより、`script-src`や`img-src`など、個別に指定されていないすべてのリソースは、自分自身のドメインからしか読み込めなくなります。

#### **② 各種リソースの読み込み元を許可する**

次に、棚卸ししたリソースに応じて、必要なドメインをディレクティブごとに追加していきます。

  * **スクリプト (`script-src`)**: SPAでは特に重要です。自ドメインに加えて、利用しているCDNなどを指定します。

      * `script-src 'self' https://cdn.example.com;`

  * **スタイルシート (`style-src`)**: Google Fontsなどを利用している場合に追加します。

      * `style-src 'self' https://fonts.googleapis.com;`

  * **API通信 (`connect-src`)**: Fetch APIやXMLHttpRequestで通信するAPIサーバーのドメインを指定します。

      * `connect-src 'self' https://api.example.com;`

  * **画像 (`img-src`)**: 画像を外部サーバーから読み込む場合に指定します。`data:`スキームを使う場合はそれも許可が必要です。

      * `img-src 'self' https://images.example.com data:;`

  * **フォント (`font-src`)**: Google Fontsなどのフォントファイルの読み込み元を指定します。

      * `font-src https://fonts.gstatic.com;`

#### **③ SPA特有の課題（インラインスクリプト/スタイル）への対応**

SPAフレームワーク（React, Vue, Angularなど）は、`<script>`タグ内に直接コードを記述したり、`style`属性で動的にスタイルを適用したりすることがあります。これらはCSPでは「インラインスクリプト」「インラインスタイル」と見なされ、デフォルトではブロックされます。

`'unsafe-inline'`を指定すれば許可できますが、XSSのリスクが高まるため、可能な限り避けるべきです。代替策として以下の方法があります。

  * **nonce**: サーバーがリクエストごとにランダムな文字列（nonce）を生成し、CSPヘッダとHTML内の`<script>`タグの両方に付与します。両者が一致する場合のみ、そのスクリプトの実行を許可する方法です。サーバーサイドレンダリング（SSR）と組み合わせる場合に有効です。
  * **hash**: スクリプトやスタイルの内容からハッシュ値を計算し、そのハッシュ値をCSPヘッダに指定する方法です。ビルド時にインライン化されるスクリプトの内容が固定的な場合に有効です。

どちらも対応が難しい場合は、最終手段として`'unsafe-inline'`を検討しますが、セキュリティレベルは低下します。同様に、`eval()`関数などを利用するライブラリがある場合は`'unsafe-eval'`が必要になることがありますが、これも極力避けるべきです。

### ステップ4: ポリシーを強制する

Report-Onlyモードで違反が出なくなり、アプリケーションの全機能が問題なく動作することを確認できたら、いよいよポリシーを強制します。

ヘッダ名を `Content-Security-Policy-Report-Only` から **`Content-Security-Policy`** に変更して本番環境に適用します。

**▼ 本番適用のCSPヘッダ例**

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://www.google-analytics.com;
  style-src 'self' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  img-src 'self' data:;
  connect-src 'self' https://api.example.com https://www.google-analytics.com;
  frame-ancestors 'none';
  object-src 'none';
  report-uri /csp-violation-report-endpoint;
```

  * **`frame-ancestors 'none'`**: クリックジャッキング対策として、自サイトが`<iframe>`内に埋め込まれることを禁止します。
  * **`object-src 'none'`**: Flashなどの古いプラグインを無効化し、セキュリティリスクを低減します。

### ステップ5: 継続的な監視

アプリケーションに新しい機能を追加したり、利用する外部サービスを変更したりすると、CSPポリシーの修正が必要になる場合があります。`report-uri`で違反レポートを収集し続け、定期的にポリシーを見直す運用が理想的です。

## CSP ヘッダのサービスサプライチェーン攻撃に対する効果

**サービスサプライチェーン攻撃**とは、自社のウェブサイトが利用している**サードパーティのサービス（解析ツール、広告配信、チャットボットなど）が改ざん**され、そこから悪意のあるスクリプトが送り込まれる攻撃です。クレジットカード情報を盗み出す「Magecart攻撃」などが代表例です。

### CSPがどのように防御するか

仮に、あなたが利用している解析ツール `https://analytics.example.com/tracker.js` が攻撃者によって改ざんされたとします。

1.  **不正なスクリプトの実行をブロック**:
    もし、改ざんされた `tracker.js` が、さらに別の攻撃用サーバー `https://evil-server.com/attack.js` を読み込もうとしても、あなたのCSPで `script-src` に `https://evil-server.com` を許可していなければ、このスクリプトの読み込みはブラウザによって**ブロック**されます。

2.  **不正な通信をブロック**:
    もし、`tracker.js` 自体に埋め込まれた攻撃コードが、盗み出した情報を攻撃者のサーバー `https://evil-server.com/steal` に送信しようとしても、CSPの `connect-src` でこのドメインを許可していなければ、データ送信は**ブロック**されます。

このように、CSPは\*\*「許可したドメイン以外からのリソース読み込み」**と**「許可したドメイン以外へのデータ送信」\*\*を禁止するため、サードパーティサービスが侵害された場合でも、被害の発生や拡大を直接的に防ぐことができます。

### 限界と補完策: SRI (Subresource Integrity)

ただし、CSPにも限界があります。もし `tracker.js` のファイル自体が改ざんされ、そのファイル内で攻撃が完結する場合、`script-src 'self' https://analytics.example.com` のように信頼して許可しているドメインなので、CSPだけでは防げません。

そこで有効なのが **SRI (Subresource Integrity)** との組み合わせです。SRIは、`<script>`タグに期待されるファイルのハッシュ値を指定しておくことで、もしファイルの内容が1ビットでも改ざんされていれば、ブラウザがそのスクリプトの実行をブロックする仕組みです。

```html
<script src="https://analytics.example.com/tracker.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wJ"
        crossorigin="anonymous"></script>
```

**CSPで「出所」を、SRIで「内容」を検証する**ことで、サービスサプライチェーン攻撃に対する耐性を飛躍的に高めることができます。
