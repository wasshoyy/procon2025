// js/ui/volume.js

/**
 * プレイヤーごとの音量割合を表示する UI を更新する関数
 * @param {Object} state - 状態オブジェクト
 * @param {HTMLElement} state.volumeRatiosDiv - 音量表示を挿入する親コンテナ
 * @param {Object} state.dm - プレイヤー情報を持つデータマネージャ
 * @param {number} state.redBarIndex - 現在参照する音量配列のインデックス
 */
export function updateVolumeRatios(state) {
  const { volumeRatiosDiv, dm, redBarIndex } = state;

  // 一度中身を空にして、毎回新しく描画する
  volumeRatiosDiv.innerHTML = '';

  // すべてのプレイヤーを順番に処理
  dm.players.forEach(p => {
    // プレイヤーの音量配列から指定インデックスの値を取得
    // データが存在しない場合は 0 にする
    const vol = p.volumeArray?.[redBarIndex] || 0;

    // 0〜1 の値をパーセンテージ (整数) に変換
    const percent = Math.round(vol * 100);

    // ===============================
    // カード全体を包む要素
    // ===============================
    const card = document.createElement('div');
    card.className = "volume-card border rounded p-2";
    card.style.borderColor = p.color; // プレイヤーの色で枠線を設定

    // ===============================
    // プレイヤー名ラベル
    // ===============================
    const label = document.createElement('div');
    label.className = "volume-label";
    label.style.color = p.color;   // プレイヤーの色で文字色を設定
    label.textContent = "■";    // プレイヤー名を表示

    // ===============================
    // プログレスバーの外枠
    // ===============================
    const barWrap = document.createElement('div');
    barWrap.className = "progress bg-gray-200 rounded h-4";

    // ===============================
    // 実際の進捗バー部分
    // ===============================
    const bar = document.createElement('div');
    bar.className = "progress-bar h-4 rounded";
    bar.style.backgroundColor = p.color;  // プレイヤーの色でバーを塗る
    bar.style.width = `${percent}%`;      // 音量に応じて幅を設定

    // アクセシビリティ属性を設定 (スクリーンリーダー用)
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(percent));

    // ===============================
    // 数値ラベル (xx%)
    // ===============================
    const value = document.createElement('div');
    value.className = "progress-value text-sm";
    value.style.color = p.color;
    value.textContent = `${percent}%`;

    // ===============================
    // 要素を組み立てて DOM に追加
    // ===============================
    barWrap.appendChild(bar);      // 枠の中にバーを入れる
    card.appendChild(label);       // カードにラベルを追加
    card.appendChild(barWrap);     // カードにプログレスバーを追加
    card.appendChild(value);       // カードに数値を追加
    volumeRatiosDiv.appendChild(card); // 親コンテナにカードを追加
  });
}
