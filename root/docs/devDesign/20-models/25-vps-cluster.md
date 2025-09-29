# VPS Cluster

24時間365日でサーバを稼働させる場合、WebARENA Indigo, ConoHa VPS, Vultr, さくらのVPSなどのクラウドVPSサービスのほうが AWS などの IaaS サービスと比較して廉価に調達できます。
このため、Chip-in V2 では API Gateway や SPN Hub はクラウドVPSサービスで動作させる前提で設計されています。

## 構成例

以下は、VPS を利用した場合の構成例です。

![VPS Cluster](./imgs/vps.drawio.svg)
