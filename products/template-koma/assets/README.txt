KOMA — assets/ に置くファイル

このフォルダに画像を置くと、index.html のグレーのプレースホルダー枠が
そのまま写真に置き換わります。ファイルが無い間も画像切れにはなりません。

  hero.jpg        2400 × 1600   HERO の一枚
  work-01.jpg     1600 × 2400   WORKS 1枚目（縦）
  work-02.jpg     2400 × 1600   WORKS 2枚目（横）
  work-03.jpg     2000 × 2000   WORKS 3枚目（正方形）
  … work-12.jpg まで（推奨サイズは各 <figure> の data-size に書いてあります）
  series-1.jpg    2400 × 900    SERIES I の帯
  series-2.jpg    2400 × 900    SERIES II の帯
  series-3.jpg    2400 × 900    SERIES III の帯
  portrait.jpg    1200 × 1500   ABOUT のポートレート

・縦横比を変えたいときは、<figure> の data-size を実際のピクセル数に
  書き換えてください。タイルの形とプレースホルダーの表示が追従します。
・拡大表示だけ大きいファイルを使いたい場合は、<figure> に
  data-full="assets/work-01-large.jpg" を足してください。
・書き出しは長辺 2400px 程度・sRGB・JPEG 品質 80 前後が目安です。
  1枚 500KB を超えないようにすると表示が軽くなります。

【権利について】
ここに置く写真は、ご自身が権利を持つ（または許諾を得た）ものだけにしてください。
人物が写っている場合は肖像権（モデルリリース）の確認をお願いします。
