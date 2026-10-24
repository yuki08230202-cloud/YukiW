# 企画書ビルダー

`project.json` を渡すと、企画書(絵コンテ形式)の Word を作り、`--pdf` で PDF にもする。

## 必要なもの
- Node.js
- `npm install`(docx が入る)
- ffmpeg と ffprobe(参考動画から画像を切り出すときだけ)
- LibreOffice(PDF にするときだけ。コマンドは `soffice`)
- フォント: 初期値は `Noto Sans CJK JP`。Mac は `"font": "Hiragino Sans"`、Windows は `"font": "Yu Gothic"` を project.json に書く。PDF にするときは、そのフォントが入っている必要がある。

## 使い方
```
node build.js example.json --out out --pdf
node build.js project.json --only ③
```

## project.json
```
client        { "name": "会社名", "brand": "表紙とフッターに出す名前" }
font          省略可
title_prefix  省略可。初期値「求人動画 絵コンテ」
script_labels 通し台本に拾うラベル。初期値 ["セリフ","字幕","小字幕","ナレーション"]
videos        { "a": "参考動画のファイルのパス" }  ※パスは project.json からの相対でもよい
projects      企画の配列
```

### 企画(絵コンテ型)
```
no        番号(①、②、… または 009 など。ファイル名と表紙に出る)
slug      ファイル名に使う短い名前
name      企画のタイトル
spec      "想定{T}秒 {N}カット 縦型9:16 …"   {T}は合計秒、{N}はカット数に置きかわる
refv      参考動画の名前
ref_link  参考動画のURL(省略可。省略すると【URLを記入】)
method    画の作り方の説明
cast, cond, props, editnote   演者、撮影条件、撮影前に揃えるもの、編集とリアクション
confirm   要確認事項の配列(クライアントに聞く点)
speakers  通し台本に拾う話者の名前の配列(省略可。例 ["聞き手","スタッフ"])
cuts      カットの配列
```
カット:
```
dur     秒
place   場所
act     動き・撮影指示
ref     参考動画の何秒か(例 "0:12")。なければ "–"
edit    編集メモ(省略可)
frame   { "video": "a", "t": 12 }  参考動画の12秒の画像を載せる(省略すると、絵は空欄)
lines   [["セリフ","「…」",0], ["テロップ","…",0]]   3つ目が1なら太字
```

### 企画(インタビュー型。画角が変わらない企画)
`"type": "interview"` にして、`cuts` の代わりに次を書く。
```
script       [["0:00–0:05","聞き手","セリフ","テロップ・編集"], …]
ref_frame    { "video": "a", "t": 10 }(省略可)
shoot_notes  撮影指示の文の配列(省略可)
place        撮影場所(shoot_notes を省略したとき使う)
total_sec    合計秒(省略すると60)
```

## チェック
- 必要な項目が足りないと、どの企画のどの項目かを出して止まる。
- 台本以外の文章に「リズム」「距離感」などが入っていると、警告を出す(`watch_words` で変えられる)。
