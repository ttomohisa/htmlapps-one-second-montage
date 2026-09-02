# APP_SPEC — One Second Montage v1.3.0

## Goal

JPEG / PNG / WebP画像と動画をまとめて読み込み、**1素材1秒**でつないだMP4動画をブラウザー内だけで作成・保存する。

動画編集ソフト化はしない。並び順、動画の使う1秒、仕上がりの形と表示方法、BGM1曲、撮影年の区切りだけを必要に応じて変更できる。

## v1.3 scope

- 最新 htmlapps-template v1.2.0 構成に準拠
- JPEG / PNG / WebP画像
- MP4 / WebM動画
- ブラウザーが再生可能なMOV / M4Vも受け付ける
- 画像・動画の混在読み込み
- ファイル選択 / Drag & Drop
- サムネイルグリッド
- 素材の個別削除と短時間のUndo
- 1素材 = 1秒
- 動画は軽量なローカル解析で「見どころ1秒」を自動選択し、判定が弱い場合は中央1秒へフォールバック。必要な動画だけ開始位置を変更可能
- 「動画だけ確認」
- 追加順 / 撮影日時順 / ファイル名順 / 手動並べ替え
- 横16:9 / 縦9:16 / 正方形1:1
- 素材全体を表示 / 画面いっぱい
- Fit時の 黒の余白 / ぼかし背景
- 標準 / 高画質
- BGMなし / 内蔵オリジナルループ2曲 / 自分の音楽1曲
- BGMは完成時間までループ、音量調整可能
- 素材動画の元音声は使用しない
- 撮影年の1秒区切りを任意で自動挿入
- 音声付き / 音声なしMP4生成
- 生成進捗
- 完成動画プレビュー
- 出力ファイル名変更
- MP4保存
- 完全ローカル処理
- 日本語 / 英語
- PC / スマートフォン
- 実行時外部通信なし

### Large-batch behavior

- The grid keeps reduced thumbnails rather than full-resolution image decodes.
- Import work yields between small batches so the UI remains responsive.
- Capture-date parsing uses an embedded Blob Worker when available and falls back safely when unavailable.
- Export keeps only the current item plus at most one prefetched next item, releasing each source as soon as it is no longer needed.
- Import and export can be cancelled without clearing already imported items.
- Unsupported and unreadable files remain outside the successful item list and are shown separately.


### UX states

- 空状態では「選ぶ → 1秒ずつ → 保存」と対応形式を短く表示し、スマートフォンでは不要な固定下部バーを出さない。
- 読み込み / 動画作成中は進捗とキャンセルを明確にし、キャンセルしても追加済み素材が残ることを表示する。
- スマートフォン下部UIは状態に応じて、`追加 / 動画を作る` → `進捗 / キャンセル` → `作り直す / MP4を保存` に切り替える。
- 全件失敗時は失敗詳細を自動で開き、次に確認すべき内容が見える状態にする。
- 完成後はプレビュー / 保存に加え、「素材を確認」で編集へ戻れ、「動画を作り直す」で置き換え確認を行う。
- 完成後に素材・順番・動画位置・仕上がりを変更しても既存MP4は保持し、変更前の動画であることを明示する。


### Empty-state guidance

- 初期画面では、Photo Re-Enactorと同系統の3カード構成で `写真・動画を選ぶ → 1秒ずつ確認する → 動画を作って保存` の流れを先に示す。
- 3カードの下には `見どころ1秒 · BGM · 年の区切り · ぼかし背景 · 横 / 縦 / 正方形` の主要機能だけを簡潔に示す。
- 素材追加後はこの概要を非表示にし、編集・生成UIへ集中させる。

### Language / help / accessibility

- 日本語 / 英語の主要画面・状態・エラー・ヘルプを同じ機能範囲で提供する。
- ヘルプは「使い方 / 対応ファイル / 仕上がり / プライバシー / キーボード操作 / 注意事項」に分け、開発バージョン名や内部技術を通常説明へ出さない。
- プライバシー説明では、選択ファイルを外部サーバーへ送信しないこと、生成動画を自動送信しないこと、保存操作時のみ端末へ書き出すことを明示する。
- `Tab` / `Shift+Tab` で操作箇所を移動でき、動画カードは `Enter` / `Space`、1秒位置は矢印キーで操作できる。
- 処理領域へ `aria-busy`、進捗へ読み上げ用ラベルと値、完成状態へライブ通知を付与する。
- 動画位置スライダーは現在の使用範囲を `aria-valuetext` で読み上げ可能にする。
- ダイアログを閉じた後は、呼び出し元または対応する素材カードへフォーカスを戻す。
- `prefers-reduced-motion` を尊重し、スマートフォンの主要タップ領域は44px程度を確保する。
- 長いヘルプはダイアログ内でスクロールでき、末尾にも閉じる操作を置く。

## Main flow

1. 写真・動画をまとめて追加する。
2. 必要なら並び順を変更する。
3. 自動選択された「おすすめ1秒」を確認し、必要な動画だけ「使う1秒」を変更する。
4. 必要なら仕上がりの**動画の形 / 素材の表示 / Fit時の背景 / 画質**を変更する。
5. 必要ならBGM1曲と音量、撮影年の1秒区切りを設定する。
6. 「動画を作る」を押す。
7. 完成動画をプレビューする。
8. 必要ならファイル名を変更してMP4を保存する。
9. 完成後に編集した場合、既存動画を残したまま調整し、「動画を作り直す」で置き換え確認後に再生成する。

## Output settings

### Aspect ratio

- `16:9`: 初期値。標準 1280×720 / 高画質 1920×1080
- `9:16`: 標準 720×1280 / 高画質 1080×1920
- `1:1`: 標準 720×720 / 高画質 1080×1080

### Item display

- `fit`（初期値）: 素材全体が見えるように中央配置する。余白は `solid`（黒の余白）または `blur`（ぼかし背景）を選べる。
- `fill`: 出力画面を埋めるまで拡大し、はみ出す部分を中央基準でトリミングする。

現時点では素材ごとの焦点位置変更は行わない。

### Quality

- `standard`: 標準解像度。MediaRecorderへ約5 Mbpsを要求する。
- `high`: 高解像度。MediaRecorderへ約9 Mbpsを要求する。

ビットレートは一般UIには表示しない。高画質は端末負荷と出力サイズが増えることだけ案内する。

設定を変更しても既に生成済みのMP4は保持する。完成動画の表示情報も生成時点の設定を維持し、変更内容は「動画を作り直す」でのみ反映する。再生成時は、現在の完成動画が置き換わることを確認ダイアログで明示する。


### Music

- 初期値は `none`。
- 内蔵曲 `Daylight` / `Warm Pulse` は外部音源ファイルを使わず、アプリ内の軽量シンセコードから生成するオリジナルループ。
- `custom` ではユーザーが端末から音楽ファイルを1つ選ぶ。50 MBを上限とし、ブラウザーがデコード可能な形式に依存する。
- 選択曲は完成動画の末尾まで自動ループする。
- 音量は10〜100%で調整し、初期値35%。
- 複数トラック、開始位置編集、フェード編集は行わない。

### Year dividers

- 初期値はOFF。
- ON時は現在の素材順に沿い、最初の撮影年と年が変化する位置へブランドカラー背景の `YYYY` カードを1秒挿入する。
- 撮影日時は既存の日時取得ルールを利用し、取得できない場合は `File.lastModified` を使う。
- 区切りをONにしても素材自体は自動で並べ替えない。
- 完成時間は `素材数 + 年区切り数` 秒になる。

## Ordering

- 初期値は追加順。
- 撮影日時順はJPEG EXIF、MP4 / MOV / M4V creation metadata、`File.lastModified`の順で利用する。
- ファイル名順は数字を考慮した自然順。
- PCでは一覧上のハンドルで手動並べ替え。
- スマートフォンではカード右下のタッチ用ハンドルで直接並べ替えでき、専用の並べ替え画面の上下移動も利用できる。
- 動画だけフィルター中は全体順序を誤って変えないよう、一覧上のドラッグを無効化する。

## Video rule

- `duration < 1`: 動画全体を使い、最後のフレームを保持して1秒にする。
- `1 <= duration < 2.2`: 中央1秒を初期値とする。
- `duration >= 2.2`: 複数の1秒候補を少数サンプリングし、明るさ・フレーム間変化・コントラスト / エッジ量をもとに見どころ候補を選ぶ。
- 候補が中央1秒より十分に良いと判定できない場合は中央1秒へフォールバックする。
- 自動選択は内容理解AIではなく、完全ローカルの軽量ヒューリスティックとする。
- 使用区間は常に `clipStart` から1秒。
- 開始位置だけ変更でき、終了位置は独立編集しない。
- 素材動画の音声は使用しない。

## Rendering

- Canvas + `captureStream(30)` で出力フレームを生成する。
- 1素材につき1秒。
- Fit / Fillは画像・動画の両方に同じ規則を適用する。Fitでは黒の余白またはぼかし背景を選べる。
- 出力設定はサムネイル自体には適用せず、完成動画生成時に適用する。
- BGMなしでは映像トラックのみ。BGMありではWeb Audio APIのMediaStreamDestinationを使って1本の音声トラックを追加する。

## States

- `empty`: 素材なし
- `importing`: 素材準備中
- `ready`: 素材あり、設定変更可能
- `clip-editing`: 動画の1秒位置を編集
- `reordering`: 素材順を編集
- `processing`: MP4生成中。出力設定も変更不可
- `result`: プレビュー / 保存可能
- `result-stale`: 完成後に素材または設定が変わった状態。既存動画を保持し、再生成を案内
- `error`: 素材を保持したまま再試行可能

## Browser requirement

MP4生成には `MediaRecorder` + `canvas.captureStream()` とブラウザーのMP4エンコーダを使用する。動画入力はHTMLVideoElementで再生可能な形式・codecに依存する。主対象は現行Chrome / Edge。

## Privacy

- 選択した写真・動画・自分で選んだ音楽は外部サーバーへ送信しない。
- analytics / telemetryなし。
- CDNなし。
- CSP `connect-src 'none'` を維持する。
- 生成動画はユーザーが保存操作を行った場合のみ端末へ書き出す。

## Release preparation

- `assets/favicon.svg` とヘッダー左上のブランドアイコンを同一モチーフで維持する。
- `assets/screenshot.png` / `assets/screenshot-en.png` は実際の最新UIから取得する。
- READMEは日本語 / 英語とも最新機能とプライバシー説明に合わせる。
- CIでstandalone / self-extract / CSP / favicon / release screenshotsを確認する。
- `dist/index.html` と `dist/index.self-extract.html` をリリース候補として生成・検証する。

## Release status

v1.3.0 implementation complete. Built-in/custom looping music, year dividers, duration accounting, audio/video MP4 output, local-only processing, and the existing v1.2 feature set are covered by regression checks.
