/**
 * recording-ui.js 完全版
 * オーバーレイ / カウントダウン / アニメーション / 処理ロック / BPM対応 / 視覚メトロノーム カウントイン音
 *
 * 既存の API を保持しています（window.recordingUI）ので recording.js と差し替え可能。
 */

(function () {
  // ======= Elements =======
  const overlay = document.getElementById('recordOverlay');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const discardBtn = document.getElementById('discardBtn');
  const timerEl = document.getElementById('overlayTimer');
  const waveform = document.getElementById('waveformCanvas');
  const levelL = document.getElementById('levelL')?.querySelector('.level-fill');
  const levelR = document.getElementById('levelR')?.querySelector('.level-fill');
  const messageEl = overlay?.querySelector('.overlay-message');

  const countdownModal = document.getElementById('countdownModal');
  const countNumber = document.getElementById('countNumber');
  const countRing = document.getElementById('countRing');

  const processingModal = document.getElementById('processingModal');
  const processingText = document.getElementById('processingText');

  // ======= State =======
  let raf = null;
  let startTime = 0;
  let elapsedBefore = 0;
  let running = false;
  let paused = false;
  let ctx = waveform ? waveform.getContext('2d') : null;
  let wfWidth = 0, wfHeight = 0;
  let fakeSeed = 0;
  let currentBPM = 120;
  let lastFocused = null;
  let keydownHandler = null;

  // visual metronome timer (fallback)
  let visMetroInterval = null;

  // ======= Utilities =======
  function debugLog(...args) { /* console.debug('[recording-ui]', ...args); */ }
  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const msRem = Math.floor((ms % 1000) / 10);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(msRem).padStart(2,'0')}`;
  }

  // ======= Countdown + Click Sound =======
  // beats: カウントする拍数（例: 4）、bpm: テンポ
  async function showCountdownBPM(beats = 4, bpm = 120) {
    return new Promise(async (resolve) => {
      currentBPM = bpm;

      // DOM が無い場合は単純にタイマー待ち
      if (!countdownModal || !countNumber || !countRing) {
        setTimeout(resolve, beats * (60000 / bpm));
        return;
      }

      countdownModal.setAttribute('aria-hidden', 'false');
      countNumber.textContent = String(beats);

      const beatMs = 60000 / bpm;
      let current = beats;

      function playClick(high = true) {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'square';
          o.frequency.setValueAtTime(high ? 880 : 440, audioCtx.currentTime);
          g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.45, audioCtx.currentTime + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
          o.connect(g); g.connect(audioCtx.destination);
          o.start(); o.stop(audioCtx.currentTime + 0.14);
        } catch (e) { debugLog('Audio click failed', e); }
      }

      function nextBeat() {
        if (current <= 0) {
          countdownModal.setAttribute('aria-hidden', 'true');
          resolve();
          return;
        }

        countNumber.textContent = String(current);
        playClick(current === beats);

        if (countRing && countRing.animate) {
          countRing.animate([
            { transform: 'scale(1)', backgroundColor: '#ffffff33' },
            { transform: 'scale(1.3)', backgroundColor: '#ffffffaa' },
            { transform: 'scale(1)', backgroundColor: '#ffffff33' }
          ], { duration: beatMs * 0.9, easing: 'ease-in-out' });
        }

        current--;
        setTimeout(nextBeat, beatMs);
      }

      nextBeat();
    });
  }

  // ======= Overlay Control (open/close/pause/resume/stop) =======
  function openOverlay(msg = '録音中…') {
    if (!overlay) return;
    lastFocused = document.activeElement;
    overlay.setAttribute('aria-hidden', 'false');
    if (messageEl) messageEl.textContent = msg;
    startTime = performance.now();
    elapsedBefore = 0;
    running = true;
    paused = false;
    if (timerEl) timerEl.textContent = '00:00.00';
    if (pauseBtn) {
      pauseBtn.setAttribute('aria-pressed', 'false');
      const label = pauseBtn.querySelector('.btn-label');
      if (label) label.textContent = '一時停止';
    }

    setTimeout(() => { try { (pauseBtn || stopBtn || discardBtn || overlay).focus(); } catch(e){} }, 120);

    if (!keydownHandler) {
      keydownHandler = (ev) => {
        if (ev.key === 'Escape') {
          document.dispatchEvent(new CustomEvent('recording:stop', { bubbles: true }));
        }
      };
      document.addEventListener('keydown', keydownHandler);
    }

    startAnim(currentBPM);
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.setAttribute('aria-hidden', 'true');
    stopAnim();
    running = false; paused = false;
    try { if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus(); } catch(e){}
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
  }

  function pauseOverlay() {
    if (!running || paused) return;
    paused = true;
    elapsedBefore += performance.now() - startTime;
    stopAnim();
    if (pauseBtn) {
      pauseBtn.setAttribute('aria-pressed', 'true');
      const label = pauseBtn.querySelector('.btn-label'); if (label) label.textContent = '再開';
    }
  }

  function resumeOverlay() {
    if (!running || !paused) return;
    paused = false;
    startTime = performance.now();
    startAnim(currentBPM);
    if (pauseBtn) {
      pauseBtn.setAttribute('aria-pressed', 'false');
      const label = pauseBtn.querySelector('.btn-label'); if (label) label.textContent = '一時停止';
    }
  }

  function stopOverlay(msg = '測定中…') {
    if (!running) return;
    stopAnim();
    const finalElapsed = elapsedBefore + (paused ? 0 : (performance.now() - startTime));
    if (timerEl) timerEl.textContent = formatTime(finalElapsed);
    running = false; paused = false;
    if (messageEl) messageEl.textContent = msg;
    setTimeout(() => closeOverlay(), 700);
  }

  // ======= Waveform + Visual BPM =======
  function startAnim(bpm = 120) {
    if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;

    function resize() {
      wfWidth = waveform.clientWidth || 300;
      wfHeight = waveform.clientHeight || 120;
      waveform.width = Math.max(1, Math.floor(wfWidth * DPR));
      waveform.height = Math.max(1, Math.floor(wfHeight * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();

    let last = performance.now();
    let pulseTime = 0;
    const beatInterval = 60000 / bpm;

    function loop(now) {
      if (!running || paused) return;
      const dt = now - last;
      last = now;
      const elapsed = elapsedBefore + (now - startTime);
      if (timerEl) timerEl.textContent = formatTime(elapsed);

      ctx.clearRect(0, 0, wfWidth, wfHeight);

      // 波形描画（ダミー）
      const cols = 64;
      const colW = wfWidth / cols;
      fakeSeed += dt * 0.0012;
      for (let i = 0; i < cols; i++) {
        const x = i * colW;
        const h = (Math.abs(Math.sin(fakeSeed * (0.6 + i * 0.01) + i * 0.05)) * 0.6 + 0.06) * wfHeight;
        ctx.fillStyle = `rgba(255,255,255,${0.06 + (h/wfHeight) * 0.12})`;
        const barH = h;
        const y = (wfHeight - barH) / 2;
        const r = Math.max(2, Math.floor(colW * 0.65));
        ctx.fillRect(x + (colW - r)/2, y, r, barH);
      }

      // BPM 脈動リング
      pulseTime += dt;
      if (pulseTime > beatInterval) pulseTime -= beatInterval;
      const pulseRatio = Math.abs(Math.sin((pulseTime / beatInterval) * Math.PI));
      ctx.beginPath();
      const safePulse = Math.max(0, pulseRatio);
      const radius = 25 + safePulse * 35;
      ctx.arc(wfWidth/2, wfHeight/2, radius, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + pulseRatio*0.5})`;
      ctx.lineWidth = 4 + pulseRatio*4;
      ctx.shadowBlur = 10 * pulseRatio;
      ctx.shadowColor = 'white';
      ctx.stroke();

      // レベルバー脈動
      if (levelL && !levelL.dataset.manual) {
        const hL = 6 + Math.abs(Math.sin(fakeSeed * 1.5)) * 94 + pulseRatio*10;
        levelL.style.height = `${hL}%`;
      }
      if (levelR && !levelR.dataset.manual) {
        const hR = 6 + Math.abs(Math.cos(fakeSeed * 1.3)) * 94 + pulseRatio*10;
        levelR.style.height = `${hR}%`;
      }

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
    waveform._resizeHandler = resize;

    // fallback simple interval-driven visual metronome
    if (visMetroInterval) clearInterval(visMetroInterval);
    visMetroInterval = setInterval(() => {
      fakeSeed += 0.35;
    }, Math.max(100, 60000 / bpm));
  }

  function stopAnim() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (waveform && waveform._resizeHandler) {
      window.removeEventListener('resize', waveform._resizeHandler);
      delete waveform._resizeHandler;
    }
    
    if (visMetroInterval) { clearInterval(visMetroInterval); visMetroInterval = null; }
  }

  // ======= Levels / Message / Processing =======
  function setLevels(l, r) {
    if (levelL) {
      levelL.dataset.manual = '1';
      const ph = Math.max(0, Math.min(1, Number(l) || 0));
      levelL.style.height = `${6 + ph * 94}%`;
    }
    if (levelR) {
      levelR.dataset.manual = '1';
      const ph = Math.max(0, Math.min(1, Number(r) || 0));
      levelR.style.height = `${6 + ph * 94}%`;
    }
  }

  function showMessage(msg) { if (messageEl) messageEl.textContent = msg; }

  function showProcessing(msg = '測定結果を解析しています…') {
    if (!processingModal || !processingText) return;
    processingText.textContent = msg;
    processingModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('processing-lock');
    try { processingModal.tabIndex = -1; processingModal.focus(); } catch(e){}
  }

  function hideProcessing() {
    if (!processingModal) return;
    processingModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('processing-lock');
    try { if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus(); } catch(e){}
  }

  // ======= Event Wiring =======
  document.addEventListener('recording:start', () => openOverlay('録音中…'));
  document.addEventListener('recording:pause', () => pauseOverlay());
  document.addEventListener('recording:resume', () => resumeOverlay());
  document.addEventListener('recording:stop', () => stopOverlay('測定中…'));
  document.addEventListener('recording:discard', () => { showMessage('破棄中…'); setTimeout(() => closeOverlay(), 600); });

  pauseBtn?.addEventListener('click', () => {
    if (!overlay || overlay.getAttribute('aria-hidden') === 'true') return;
    if (pauseBtn.getAttribute('aria-pressed') !== 'true') {
      document.dispatchEvent(new CustomEvent('recording:pause', { bubbles: true }));
    } else {
      document.dispatchEvent(new CustomEvent('recording:resume', { bubbles: true }));
    }
  });

  stopBtn?.addEventListener('click', () => {
    if (!overlay || overlay.getAttribute('aria-hidden') === 'true') return;
    document.dispatchEvent(new CustomEvent('recording:stop', { bubbles: true }));
  });

  discardBtn?.addEventListener('click', () => {
    if (!overlay || overlay.getAttribute('aria-hidden') === 'true') return;
    document.dispatchEvent(new CustomEvent('recording:discard', { bubbles: true }));
  });

  // ======= Public API =======
  window.recordingUI = {
    showCountdownBPM,
    open: openOverlay,
    close: closeOverlay,
    pause: pauseOverlay,
    resume: resumeOverlay,
    stop: stopOverlay,
    setLevels,
    showMessage,
    showProcessing,
    hideProcessing,
    setElapsedMs: (ms) => {
      elapsedBefore = Number(ms) || 0;
      startTime = performance.now();
      if (!running && timerEl) timerEl.textContent = formatTime(elapsedBefore);
    }
  };

  // ======= Initialize Hidden States =======
  if (overlay) overlay.setAttribute('aria-hidden', 'true');
  if (countdownModal) countdownModal.setAttribute('aria-hidden', 'true');
  if (processingModal) processingModal.setAttribute('aria-hidden', 'true');

  debugLog('recording-ui initialized');
})();