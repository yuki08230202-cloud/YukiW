# 動画企画書の作業フォルダ

クライアントの求人用ショート動画について、企画書(絵コンテ形式)を作り、進捗シートで共有する作業用のフォルダ。
1社あたり合計24本ほどを担当する。一度に作るのは、そのとき頼まれた本数だけ。

## 流れ
1. クライアントの資料をもらう。`clients/<社名>/inbox.md` に、ユーザーが貼る。
2. `client-intake` で、事実の表と、クライアントに聞くことのリストを作る。
3. ユーザーが企画を1本ずつ出す(タイトル、狙い、参考動画、尺くらい)。
4. `kikakusho-builder` で、台本と企画書にする。ユーザーが読んで直す。
5. `tool/build.js` で Word と PDF を作る。
6. PDF をユーザーが Drive のクライアント用フォルダに入れる。`progress-sheet-share` で、シートにリンクする。
7. クライアントへの LINE 文を作る。

## フォルダ
- `clients/<社名>/inbox.md`: ユーザーが資料を貼る場所
- `clients/<社名>/facts.md`: 事実の表と、聞くことのリスト
- `clients/<社名>/project.json`: 企画書の元データ(台本もここ)。直しは、ここに対して行う
- `clients/<社名>/out/`: 作った Word と PDF
- `clients/_template/`: 新しいクライアントを作るときに、フォルダごとコピーする

## 企画書を作るコマンド
```
cd tool && npm install   # 最初の1回だけ
node tool/build.js clients/<社名>/project.json --out clients/<社名>/out --pdf
```
`--only ③` のように、番号を指定すると、その1本だけ作る。
project.json の書き方は `tool/README.md` と `tool/example.json`。

## 守ること
- 数字や条件は、クライアントの資料にある事実だけを使う。資料にないことは書かない。
- 日本語は、やさしく短く。AI っぽい言い回しを避ける。
- 参考動画のスクリーンショットは載せる。Claude が描いた絵は載せない(空欄にする)。
- 直しは project.json に対して行い、Word を作り直す。Word を直接いじらない。
- 作ったら、PDF をページ画像にして、全ページを見て確認する。
- ユーザーはスマホで読むことが多い。報告は短くする。
- Drive へのファイルのアップロードは、ユーザーが手でやる。大きなファイルは、ここからは送れない。

## スキル
アカウントのスキル(client-intake、kikakusho-builder、progress-sheet-share)を使う。
一覧に出ないときは、`.claude/skills/` の同名のものを使う。
