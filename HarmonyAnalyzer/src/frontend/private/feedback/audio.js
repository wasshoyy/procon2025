// js/audio.js
export function buildServerAudioUrl(folder, candidateFile) {
  const folderSegments = (folder || '').split('/').filter(Boolean);
  const encodedFolderPath = folderSegments.map(seg => encodeURIComponent(seg)).join('/');
  const encodedFile = encodeURIComponent(candidateFile);
  return encodedFolderPath ? `/api/feedback/server/${encodedFolderPath}/${encodedFile}` : `/api/feedback/server/${encodedFile}`;
}

export function clearAudioListeners(audioPlayer) {
  if (!audioPlayer) return;
  audioPlayer.onloadedmetadata = null;
  audioPlayer.ontimeupdate = null;
  audioPlayer.onended = null;
  audioPlayer.onerror = null;
}

// 区切り文字（/ と \）に対応した basename 取得
function getBasename(fp) {
  try {
    const u = new URL(fp, window.location.origin);
    // /a/b/%E9%AB%98%E6%A0%A1/file.wav → ["", "a", "b", "%E9%AB%98%E6%A0%A1", "file.wav"]
    const parts = u.pathname.split('/').map(seg => seg ? decodeURIComponent(seg) : seg);
    return parts[parts.length - 1] || '';
  } catch {
    fp = fp.split('#')[0].split('?')[0];
    const parts = fp.split(/[/\\]/);
    return parts[parts.length - 1] || '';
  }
}

// dirname 相当: 末尾の1要素を除いた残り（空なら ""）
function getDirname(fp) {
  try {
    const u = new URL(fp, window.location.origin);
    const parts = u.pathname.split('/').map(seg => seg ? decodeURIComponent(seg) : seg);
    parts.pop(); // drop basename
    // 先頭の空要素は root（"/"）なので保持しつつ join
    const dir = parts.join('/');
    // "/a/b" or ""（/file だけだった場合）
    return dir && dir !== '/' ? dir : (dir === '/' ? '/' : '');
  } catch {
    fp = fp.split('#')[0].split('?')[0];
    const parts = fp.split(/[/\\]/);
    parts.pop();
    return parts.join('/'); // 区切りは / に正規化
  }
}

export function setupAudioPlayer(state, filepath) {
  const { audioPlayer, redBarSlider, dm } = state;
  if (!audioPlayer) return;

  const fileName = getBasename(filepath); // 例: "test_20250930_093044.wav"
  const folder   = getDirname(filepath);  // 例: "/app/src/uploads/aa高校/フルート/untitled_120_4-4"

  clearAudioListeners(audioPlayer);

  // derive baseName (replace pkl/webm -> wav)
  let baseName = fileName || '';
  if (/\.(pkl|webm)$/i.test(baseName)) {
    baseName = baseName.replace(/\.(pkl|webm)$/i, '.wav');
  }

  const nameNoExt = baseName.replace(/\.[^.]*$/, '');
  const candidates = [`${nameNoExt}.wav`, `${nameNoExt}.webm`];

  let attempt = 0;
  state.audioLoaded = false;

  function tryNext() {
    if (attempt >= candidates.length) {
      console.error('All audio candidates failed:', candidates);
      alert('音声ファイルの読み込みに失敗しました（全候補）。');
      return;
    }
    const cand = candidates[attempt++];
    const url = buildServerAudioUrl(folder, cand);
    console.info('Trying audio URL:', url);
    audioPlayer.src = url;
    audioPlayer.load();
  }

  audioPlayer.onloadedmetadata = () => {
    state.audioLoaded = !!audioPlayer.duration && !isNaN(audioPlayer.duration);
    redBarSlider.max = String(Math.max(0, dm.totalPoints - 1));
  };

  audioPlayer.ontimeupdate = () => {
    if (!state.audioLoaded || !state.pitchChart) return;
    const ratio = (audioPlayer.duration > 0) ? (audioPlayer.currentTime / audioPlayer.duration) : 0;
    const newIndex = Math.round(ratio * Math.max(0, dm.totalPoints - 1));
    if (newIndex !== state.redBarIndex) {
      state.redBarIndex = newIndex;
      redBarSlider.value = String(state.redBarIndex);
      const ann = state.pitchChart?.options?.plugins?.annotation?.annotations?.redBar;
      if (ann) { ann.xMin = state.redBarIndex; ann.xMax = state.redBarIndex; }
      state.pitchChart.update('none');
      state.updateRadarChart();
    }
  };

  audioPlayer.onended = () => {
    state.redBarIndex = 0;
    redBarSlider.value = String(state.redBarIndex);
    if (state.pitchChart) {
      const ann = state.pitchChart.options?.plugins?.annotation?.annotations?.redBar;
      if (ann) { ann.xMin = state.redBarIndex; ann.xMax = state.redBarIndex; }
      state.pitchChart.update('none');
    }
    state.updateRadarChart?.();
  };

  audioPlayer.onerror = () => tryNext();

  tryNext();
}
