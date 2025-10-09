// recording.js — カウントイン後に正確に1拍目から録音を開始する版

(() => {
  const messageArea = document.getElementById('message-area');
  const recordBtn = document.getElementById('start-btn');
  const MicBtn = document.getElementById('micBtn');
  const FldBtn = document.getElementById('fldBtn');
  const SetBtn = document.getElementById('setBtn');
  const tempoInput = document.getElementById('tempo');
  const instrumentSelect = document.getElementById('instrument');
  const timeSigSelect = document.getElementById('time-signature');
  const songNameInput = document.getElementById('song-name');
  const countInSelect = document.getElementById('countin');

  // 状態
  let mediaStream = null;
  let mediaRecorder = null;
  let chunks = [];
  let isRecording = false;
  let isPaused = false;
  let discardRequested = false;

  // audio analysis
  let audioContext = null;
  let analyserL = null;
  let analyserR = null;
  let analysisRaf = null;

  // visual metronome
  let visMetronomeRaf = null;
  let visBeatIndex = 0;
  let visBeatDuration = 0;

  let countInTimeoutId = null;
  let countdownInProgress = false;

  // helpers
  function showMessage(text, visible = true) {
    if (!messageArea) return;
    messageArea.textContent = text;
    if (visible) messageArea.classList.add('show'); else messageArea.classList.remove('show');
  }

  async function initMedia() {
    if (mediaStream) return mediaStream;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 48000, sampleSize: 16 }
      });
    } catch (err) {
      console.error('マイクへのアクセスに失敗しました', err);
      showMessage('マイクにアクセスできません。設定を確認してください。');
      throw err;
    }

    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();


    // analyser セットアップ（ステレオ試行 -> モノラルフォールバック）
    try {
      const source = audioContext.createMediaStreamSource(mediaStream);
      const splitter = audioContext.createChannelSplitter(2);
      source.connect(splitter);

      analyserL = audioContext.createAnalyser();
      analyserR = audioContext.createAnalyser();
      analyserL.fftSize = 2048;
      analyserR.fftSize = 2048;

      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);
    } catch (e) {
      console.warn('ステレオ解析に失敗、モノラルにフォールバック', e);
      analyserL = audioContext.createAnalyser();
      analyserL.fftSize = 2048;
      try {
        const src = audioContext.createMediaStreamSource(mediaStream);
        src.connect(analyserL);
      } catch (err) { analyserL = null; }
      analyserR = null;
    }

    // MediaRecorder 初期化
    try {
      const options = {};
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      }
      mediaRecorder = new MediaRecorder(mediaStream, options);
      mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    } catch (err) {
      console.error('MediaRecorder 初期化エラー', err);
      showMessage('録音を開始できません（ブラウザが対応していない可能性）');
      throw err;
    }

    return mediaStream;
  }

  // === Audio analysis loop ===
  function startAnalysisLoop() {
    if (!analyserL && !analyserR) return;
    const arrL = analyserL ? new Uint8Array(analyserL.fftSize) : null;
    const arrR = analyserR ? new Uint8Array(analyserR.fftSize) : null;

    function rmsFromByte(array) {
      if (!array) return 0;
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
        const v = (array[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / array.length);
      return Math.min(1, rms * 1.6);
    }

    function loop() {
      if (analyserL) analyserL.getByteTimeDomainData(arrL);
      if (analyserR) analyserR.getByteTimeDomainData(arrR);

      const lv = analyserL ? rmsFromByte(arrL) : 0;
      const rv = analyserR ? rmsFromByte(arrR) : lv;
      if (window.recordingUI && typeof window.recordingUI.setLevels === 'function') {
        window.recordingUI.setLevels(lv, rv);
      }
      analysisRaf = requestAnimationFrame(loop);
    }

    if (!analysisRaf) analysisRaf = requestAnimationFrame(loop);
  }
  function stopAnalysisLoop() { if (analysisRaf) cancelAnimationFrame(analysisRaf); analysisRaf = null; }

  // === Visual metronome ===
  function startVisualMetronome(bpm, beatsPerBar) {
    stopVisualMetronome();
    visBeatDuration = 60000 / bpm;
    visBeatIndex = 0;

    function visLoop() {
      if (!isRecording) return;
      if (window.recordingUI && typeof window.recordingUI.showMessage === 'function') {
        window.recordingUI.showMessage(`拍 ${visBeatIndex + 1} / ${beatsPerBar}`, true);
      }
      visBeatIndex = (visBeatIndex + 1) % beatsPerBar;
      visMetronomeRaf = setTimeout(visLoop, visBeatDuration);
    }

    visLoop();
  }
  function stopVisualMetronome() {
    if (visMetronomeRaf) clearTimeout(visMetronomeRaf);
    visMetronomeRaf = null;
    if (window.recordingUI && typeof window.recordingUI.showMessage === 'function') {
      window.recordingUI.showMessage('');
    }
  }

  // === Recording control ===
  async function startRecording() {
    if (!mediaRecorder) return;
    chunks = [];
    discardRequested = false;

    mediaRecorder.onstop = async () => {
      // 録音終了処理
      stopAnalysisLoop();
      stopVisualMetronome();

      isRecording = false;
      isPaused = false;

      if (!discardRequested && chunks.length > 0) {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const locationValue = songNameInput?.value?.trim() || '';
        const instrumentValue = instrumentSelect?.value?.trim() || '';
        const selectedTempo = tempoInput?.value || '-';
        const timeSigValue = timeSigSelect?.value || '-';
        const timeSig = timeSigValue.replace('/', '-');
        const userData = localStorage.getItem("user");
        let orgName = userData ? JSON.parse(userData).organization_name : null;
        const folderName = `${orgName || '団体未設定'}/${instrumentValue || 'untitled'}/${locationValue || 'untitled'}_${selectedTempo}_${timeSig}`;

        if (window.recordingUI && typeof window.recordingUI.showProcessing === 'function') {
          window.recordingUI.showProcessing('録音結果をアップロード中…');
        }

        let soundId, data;
        try {
          const resp = await sendRecording(blob, folderName);
          soundId = resp.soundId;
          data = resp.data;
          if (window.recordingUI && typeof window.recordingUI.showMessage === 'function') {
            window.recordingUI.showMessage('アップロード完了');
          }
        } catch (e) {
          console.error('アップロード失敗', e);
          if (window.recordingUI && typeof window.recordingUI.showMessage === 'function') {
            window.recordingUI.showMessage('アップロードに失敗しました');
          }
        } finally {
          if (window.recordingUI && typeof window.recordingUI.hideProcessing === 'function') {
            setTimeout(() => window.recordingUI.hideProcessing(), 600);
          }
        }

        sessionStorage.setItem("feedbackData", JSON.stringify([data]));
        setTimeout(() => location.href = `../feedback/?ids=${[soundId].join(',')}`, 1200);
      } else {
        chunks = [];
        if (window.recordingUI && typeof window.recordingUI.showMessage === 'function') {
          window.recordingUI.showMessage('録音を破棄しました');
        }
        setTimeout(() => { if (window.recordingUI) window.recordingUI.showMessage(''); }, 900);
      }

      if (recordBtn) { recordBtn.disabled = false; recordBtn.textContent = '録音開始'; }
    };

    isRecording = true;
    isPaused = false;

    startAnalysisLoop();

    document.dispatchEvent(new CustomEvent('recording:start', { bubbles: true }));

    if (recordBtn) recordBtn.disabled = true;
  }

  function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    // MediaRecorder.stop() が onstop をトリガーする
    mediaRecorder.stop();

    // カウントイン周りのクリーンアップ（念のため）
    if (countInTimeoutId) { clearTimeout(countInTimeoutId); countInTimeoutId = null; }
  }
  function pauseRecording() { if (!mediaRecorder || mediaRecorder.state !== 'recording') return; mediaRecorder.pause(); isPaused = true; }
  function resumeRecording() { if (!mediaRecorder || mediaRecorder.state !== 'paused') return; mediaRecorder.resume(); isPaused = false; }
  function discardRecording() { discardRequested = true; if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); else chunks = []; }

  async function sendRecording(blob, folderName) {
    const form = new FormData();
    form.append('file', blob, 'recording.webm');
    form.append('bpm', tempoInput?.value || '120');
    form.append('beats', (timeSigSelect?.value || '4/4').split('/')[0]);
    form.append('countInBars', countInSelect?.value || '1');
    const url = `../api/recording/upload/${encodeURIComponent(folderName)}`;
    const resp = await fetch(url, { method: 'POST', body: form });
    if (!resp.ok) throw new Error(`HTTPエラー: ${resp.status}`);
    return resp.json();
  }

  // === Countdown / count-in flow ===
  async function startCountdownFlow() {
    if (isRecording) { stopRecording(); return; }
    if (countdownInProgress) return;
    countdownInProgress = true;

    const bpm = parseInt(tempoInput?.value, 10) || 120;
    const beatsPerBar = parseInt((timeSigSelect?.value || '4/4').split('/')[0], 10) || 4;
    const countInBars = parseInt(countInSelect?.value, 10) || 1; // 何小節分カウントするか

    await initMedia();

    // UI の showCountdownBPM を順に実行
    
    if (window.recordingUI && typeof window.recordingUI.showCountdownBPM === 'function') {
      for (let bar = 0; bar < countInBars; bar++) {
        await window.recordingUI.showCountdownBPM(beatsPerBar, bpm);
      }
    } else {
      // 無ければ単純待機
      await new Promise(r => setTimeout(r, countInBars * beatsPerBar * (60000 / bpm)));
    }

    // 録音開始（正確性はブラウザタイマー頼り）
    startRecording();
    try { mediaRecorder.start(); } catch (err) { showMessage('録音を開始できません'); }
    startVisualMetronome(bpm, beatsPerBar);

    countdownInProgress = false;
    return;
  }

  // 初期メディア確保（可能であれば早めに許可を促す）
  initMedia().catch(() => { /* ignore */ });

  // bottom nav
  MicBtn?.addEventListener('click', () => { location.href = "../recording"; });
  FldBtn?.addEventListener('click', () => { location.href = "../folder"; });
  SetBtn?.addEventListener('click', () => { location.href = "../setting"; });

  // start button -> countdown -> startRecording
  recordBtn?.addEventListener('click', () => {
    startCountdownFlow();
  });

  // events from UI to logic
  document.addEventListener('recording:pause', () => { if (!isRecording) return; if (!isPaused) pauseRecording(); else resumeRecording(); });
  document.addEventListener('recording:resume', () => { if (!isRecording) return; resumeRecording(); });
  document.addEventListener('recording:stop', () => { if (!isRecording) return; stopRecording(); });
  document.addEventListener('recording:discard', () => { if (!isRecording) return; discardRecording(); });

  // cleanup
  window.addEventListener('beforeunload', () => {
    stopVisualMetronome();
    stopAnalysisLoop();
    if (audioContext?.close) { try { audioContext.close(); } catch (e) {} audioContext = null; }
    if (mediaStream) { try { mediaStream.getTracks().forEach(t => t.stop()); } catch (e) {} mediaStream = null; }

    if (countInTimeoutId) { clearTimeout(countInTimeoutId); countInTimeoutId = null; }
  });

})();
