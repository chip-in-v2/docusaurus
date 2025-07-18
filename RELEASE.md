# リリース手順

@chip-in-v2@docusaurus パッケージのリリース手順は以下の通り。

## 1. ブランチ作成
Codespaces のターミナルでブランチを作成する。

```sh
branch=<ブランチ名>
git checkout -b $branch
```

## 2. 修正

Codespaces で修正

## 3. RC版タグ付け
Codespaces のターミナルで以下を実行して package.json を編集し、タグをつける。

```sh
(cd packages/docusaurus && npm version prerelease --preid rc)
```

## 4. 単体テスト

ドキュメント rootに移り、単体テストを実施する。

```sh
cd root
npm install --ignore-workspace-root-check https://github.com/chip-in-v2/chip-in-v2.git#$branch
npm start
```

テストがうまくいかない場合は 3. に戻る。

## 5. Pull Request の提出

Codespaces のソース管理機能で以下を実行して Pull Request を提出する。
1. 手順 3. RC版タグ付け処理を実施したことを確認
1. コミット
1. Branch を発行
1. Pull Request を作成（ただし、デバッグループにおける2回目以降は不要）

これにより、 Github Packages にRC版パッケージがリリースされる。

## 6. 結合テスト

他のリポジトリで RC版をインストールし、テストする。

## 7. 修正

結合テストの結果、必要に応じて修正し、 3. に戻る。
結合テストに成功した場合は、以下を実行して次に進む

```sh
(cd packages/docusaurus && npm version patch)
git push origin $branch
```

## 8. プルリクエストをマージ

Codespaces からプルリクエストをマージする。
これにより、 Github Packages にリリース版パッケージがリリースされる。
