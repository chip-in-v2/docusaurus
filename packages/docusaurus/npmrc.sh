#!/bin/bash
# GITHUB_TOKEN 環境変数を使用して Github Package Registory にアクセスできるように .npmrc を生成するスクリプト。
# @nec-dis-gen5v1 のパッケージをインストール際には事前にこのスクリプトを実行してください。
# .npmrc ファイルを生成
echo "@nec-dis-gen5v1:registry=https://npm.pkg.github.com/" > ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> ~/.npmrc
echo "Created ~/.npmrc file with GitHub token for package registry access."
