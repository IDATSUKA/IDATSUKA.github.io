/*
 * Firebase 設定（ランキングをオンライン化する場合のみ使用）
 * ─────────────────────────────────────────────────────────
 * デフォルトでは null のままにしておくと、js/leaderboard.js は
 * 自動的にローカルストレージ（この端末のみのランキング）で動作します。
 *
 * オンラインランキングを有効にする手順:
 *   1. https://console.firebase.google.com/ でプロジェクトを作成する。
 *   2. 左メニュー「構築」→「Realtime Database」を開き、データベースを
 *      作成する（リージョンは任意、開始時のルールは「テストモード」で可。
 *      公開後は必ずこのリポジトリ直下の firebase.rules.json の内容を
 *      Realtime Database の「ルール」タブに貼り付けて公開すること）。
 *   3. 「プロジェクトの概要」→ 歯車アイコン →「プロジェクトの設定」を開く。
 *   4. 「マイアプリ」でウェブアプリ（</> アイコン）を追加する
 *      （すでに追加済みならそれを選択）。
 *   5. 表示される `firebaseConfig` オブジェクト（apiKey, authDomain,
 *      databaseURL, projectId, storageBucket, messagingSenderId, appId
 *      などを含む）を丸ごとコピーし、下の window.FIREBASE_CONFIG に
 *      そのまま代入する。例:
 *
 *      window.FIREBASE_CONFIG = {
 *        apiKey: "AIza...",
 *        authDomain: "your-project.firebaseapp.com",
 *        databaseURL: "https://your-project-default-rtdb.firebaseio.com",
 *        projectId: "your-project",
 *        storageBucket: "your-project.appspot.com",
 *        messagingSenderId: "1234567890",
 *        appId: "1:1234567890:web:abcdef123456"
 *      };
 *
 *   6. 保存してページを再読み込みすれば、ranking.html と各ゲームページは
 *      追加の変更なしに自動でオンラインモード（Firebase Realtime Database）
 *      に切り替わります。設定を戻したい場合は null に戻すだけで、
 *      ローカルストレージモードに戻ります。
 */
window.FIREBASE_CONFIG = null;
