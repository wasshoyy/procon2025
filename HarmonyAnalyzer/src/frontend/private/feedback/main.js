// feedback/main.js
import { THEME, clamp } from './utils.js';
import { DataManager } from './dataManager.js';
import { registerChartPlugins, createPitchChart, updatePitchChart } from './charts/pitchChart.js';
import { createRadarChart, updateRadarChart } from './charts/radarChart.js';
import { updateXScrollBar as _updateXScrollBar } from './ui/xscroll.js';
import { updateVolumeRatios as _updateVolumeRatios } from './ui/volume.js';
import { updateYSliderVisibility as _updateYSliderVisibility, layoutVerticalSlider } from './ui/ySlider.js';
import { setupAudioPlayer } from './audio.js';
import { updateGlobalCooperation } from './ui/cooperation.js'; // 協調度表示

// -------------------- DOM refs --------------------
const $ = id => document.getElementById(id);
const state = {
  pitchCard: $('pitchCard'),
  pitchChartCanvas: $('pitchChart'),
  radarChartCanvas: $('radarChart'),
  xScrollBarCanvas: $('xScrollBar'),
  redBarSlider: $('redBarSlider'),
  yAxisSlider: $('yAxisSlider'),
  ySliderOverlay: $('ySliderOverlay'),
  bpmInput: $('bpmInput'),
  beatsInput: $('beatsInput'),
  baseAInput: $('baseAInput'),
  updateBtn: $('updateBtn'),
  volumeRatiosDiv: $('volumeRatios'),
  cooperationRatiosDiv: $('cooperationRatios'), // 協調度表示
  fileNameDisplay: $('fileNameDisplay'),
  audioPlayer: $('audioPlayer'),
  MicBtn: $('MicBtn'),
  FldBtn: $('FldBtn'),
  SetBtn: $('SetBtn'),

  get ctxPitch() { return this.pitchChartCanvas.getContext('2d'); },
  get ctxRadar() { return this.radarChartCanvas.getContext('2d'); },
  get xScrollCtx() { return this.xScrollBarCanvas.getContext('2d'); },

  dm: new DataManager([]),
  pitchChart: null,
  radarChart: null,
  redBarIndex: 0,
  audioLoaded: false,
  globalCoopArray: [],

  updateXScrollBar: null,
  updateYSliderVisibility: null,
  updateVolumeRatios: null,
  updateRadarChart: null
};

// bind helpers
state.updateXScrollBar = () => _updateXScrollBar(state);
state.updateYSliderVisibility = (sync) => _updateYSliderVisibility(state, sync);
state.updateVolumeRatios = () => _updateVolumeRatios(state);
state.updateRadarChart = () => updateRadarChart(state);

// -------------------- Interactions --------------------
let isDraggingRedBar = false;
let isDraggingXScrollBar = false;
let startX = 0;
let initialChartMin = 0, initialChartMax = 0;
let isUpdatingRedBar = false; // 再帰防止フラグ
let anyAudioAdded = false;

function updateRedBarPosition(clientX) {
  if (!state.pitchChart || isUpdatingRedBar) return;
  isUpdatingRedBar = true;

  const rect = state.pitchChartCanvas.getBoundingClientRect();
  const px = clientX - rect.left;
  const newIndex = clamp(Math.round(state.pitchChart.scales.x.getValueForPixel(px)), 0, state.dm.totalPoints - 1);

  if (state.redBarIndex !== newIndex) {
    state.redBarIndex = newIndex;
    state.redBarSlider.value = String(state.redBarIndex);

    const ann = state.pitchChart?.options?.plugins?.annotation?.annotations?.redBar;
    if (ann) { ann.xMin = state.redBarIndex; ann.xMax = state.redBarIndex; }

    state.pitchChart.update('none');
    state.updateRadarChart();

    // 協調度更新
    if (state.cooperationRatiosDiv && state.dm.players.length > 1) {
      updateGlobalCooperation({
        cooperationRatiosDiv: state.cooperationRatiosDiv,
        globalCoopArray: state.globalCoopArray,
        tickIndex: state.redBarIndex
      });
    }

    if (state.audioLoaded && state.audioPlayer.duration > 0) {
      const ratio = state.redBarIndex / Math.max(1, state.dm.totalPoints - 1);
      state.audioPlayer.currentTime = ratio * state.audioPlayer.duration;
    }
  }

  isUpdatingRedBar = false;
}

// -------------------- Init --------------------
function init() {
  registerChartPlugins();

  state.pitchChart = createPitchChart(state);
  state.radarChart = createRadarChart(state);

  state.redBarSlider.max = String(Math.max(0, state.dm.totalPoints - 1));
  updatePitchChart(state);
  state.updateRadarChart();
  state.updateXScrollBar();
  state.updateYSliderVisibility(true);

  // 初期の協調度表示
  if (state.cooperationRatiosDiv && state.dm.players.length > 1) {
    updateGlobalCooperation({
      cooperationRatiosDiv: state.cooperationRatiosDiv,
      globalCoopArray: state.globalCoopArray,
      tickIndex: state.redBarIndex
    });
  }

  window.addEventListener('resize', () => {
    state.updateXScrollBar();
    layoutVerticalSlider(state);
  });

  document.body.classList.add('page-feedback');
}

// -------------------- Boot --------------------
(function boot() {
  const urlParams = new URLSearchParams(window.location.search);
  const idsParam = urlParams.get("ids");
  const ids = idsParam ? idsParam.split(",").map(Number).filter(n => !isNaN(n)) : [];

  // 録音直後に渡されたデータを確認
  const sessionData = sessionStorage.getItem("feedbackData");
  if (sessionData) {
    console.log("録音直後のデータを使用します");
    const initialData = JSON.parse(sessionData);
    sessionStorage.removeItem("feedbackData"); // 1回限り
    console.log(initialData);
    console.log(Array.isArray(initialData));
    handleData(initialData);
    return;
  }

  const metaUrl = `../api/feedback/items?ids=${ids.join(',')}`;

  fetch(metaUrl).then(res => {
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  }).then(handleData)
    .catch(err => {
      console.error('データ読み込みエラー:', err);
      alert('データの読み込みに失敗しました。ダミーデータで表示します。');
      state.dm = new DataManager([]);
      state.globalCoopArray = [];
      init();
    });

  function handleData(data) {
    if (!data || data.length === 0) throw new Error("no data");

    const colors = ['#f59e0b', '#3b82f6', '#f63b3b']; 

    const externalPlayersData = data.filter(d => "analysis" in d).map((playerData, index) => {
      const analysis = playerData.analysis ?? [];

      const brightnessArray = analysis.map(a => a.brightness ?? 0);
      const clarityArray = analysis.map(a => a.clarity ?? 0);
      const sharpnessArray = analysis.map(a => a.sharpness ?? 0);
      const smoothnessArray = analysis.map(a => a.smoothness ?? 0);
      const thicknessArray = analysis.map(a => a.thickness ?? 0);
      const pitchArray = analysis.map(a => a.pitch ?? 440);
      const volumeArray = analysis.map(a => a.volume ?? 0);

      const featuresArray = Array.from({ length: pitchArray.length }, (_, i) => [
        brightnessArray[i],
        clarityArray[i],
        sharpnessArray[i],
        smoothnessArray[i],
        thicknessArray[i]
      ]);
      
      createPlayerInstance(playerData.filepath, playerData.view_name);
      
      state.bpmInput.value = playerData.option.bpm;
      state.beatsInput.value = playerData.option.beats;

      return {
        name: `${playerData.view_name}`,
        color: colors[index] ?? '#000000',
        pitchArray,
        volumeArray,
        featuresArray
      };
    });

    let new_mins = Array(6).fill(Infinity);
    let new_maxs = Array(6).fill(-Infinity);   

    externalPlayersData.map(player => {
      // まず特徴量の次元ごとの min/max を初期化
      let mins = Array(6).fill(Infinity);
      let maxs = Array(6).fill(-Infinity);
    
      // すべてのフレームを走査して min/max を更新
      player.featuresArray.forEach(feature => {
        feature.forEach((value, i) => {
          mins[i] = Math.min(mins[i], value);
          maxs[i] = Math.max(maxs[i], value);
        });
      });
      player.volumeArray.forEach(value => {
        mins[5] = Math.min(mins[5], value);
        maxs[5] = Math.max(maxs[5], value);
      });

      // new_max/min を更新
      for (let i = 0; i < 6; i++) {
        new_mins[i] = Math.min(new_mins[i], mins[i]);
        new_maxs[i] = Math.max(new_maxs[i], maxs[i]);
      }
    });

    const NormalizationPlayersData = externalPlayersData.map(player => {
      // 正規化した featuresArray を作る
      const normalizedFeatures = player.featuresArray.map(feature =>
        feature.map((value, i) => {
          const range = new_maxs[i] - new_mins[i];
          return range === 0 ? 0.5 : (value - new_mins[i]) / range;
        })
      );
      const normalizedVolume = player.volumeArray.map(value => {
        const range = new_maxs[5] - new_mins[5];
        return range === 0 ? 0.5 : (value - new_mins[5]) / range;
      });

      return {
        ...player,
        volumeArray: normalizedVolume,
        featuresArray: normalizedFeatures
      };
    });
    
    NormalizationPlayersData.forEach(player => {
      const featuresObjects = player.featuresArray.map(([brightness, clarity, sharpness, smoothness, thickness]) => ({
        brightness,
        clarity,
        sharpness,
        smoothness,
        thickness
      }));
      console.log(`${player.view_name} の正規化済み特徴量`);
      console.table(featuresObjects);
    });
    
    state.dm = new DataManager(NormalizationPlayersData);

    if (externalPlayersData.length > 1) {
      const harmonyArray = data.find(d => "harmony" in d)?.harmony.map(a => a.degree ?? 0);
      state.globalCoopArray = harmonyArray;
    } else {
      state.globalCoopArray = [];
    }
    console.log(`協調度:`);
    console.table(state.globalCoopArray);

    init();
  }
})();


// -------------------- Event wiring --------------------
// 赤バードラッグ
['mousemove', 'touchmove'].forEach(ev => {
  state.pitchChartCanvas.addEventListener(ev, e => {
    if (isDraggingRedBar) {
      e.preventDefault();
      updateRedBarPosition(e.touches ? e.touches[0].clientX : e.clientX);
    }
  });

  state.xScrollBarCanvas.addEventListener(ev, e => {
    if (!isDraggingXScrollBar || !state.pitchChart) return;
    e.preventDefault();
    const rect = state.xScrollBarCanvas.getBoundingClientRect();
    const totalPoints = state.dm.totalPoints;
    const chartRange = initialChartMax - initialChartMin;
    const posX = e.touches ? e.touches[0].clientX : e.clientX;
    const dragPoints = ((posX - startX) / rect.width) * totalPoints;
    const newChartMin = Math.max(0, Math.min(initialChartMin + dragPoints, totalPoints - chartRange));
    state.pitchChart.options.scales.x.min = newChartMin;
    state.pitchChart.options.scales.x.max = newChartMin + chartRange;
    state.pitchChart.update('none');
    state.updateXScrollBar();
  });
});

['mouseup', 'touchend'].forEach(ev => {
  document.addEventListener(ev, () => {
    isDraggingRedBar = false;
    isDraggingXScrollBar = false;
    state.xScrollBarCanvas.style.cursor = 'grab';
  });
});

// 赤バークリック
state.pitchChartCanvas.addEventListener('mousedown', e => { isDraggingRedBar = true; updateRedBarPosition(e.clientX); });
state.pitchChartCanvas.addEventListener('touchstart', e => { isDraggingRedBar = true; updateRedBarPosition(e.touches[0].clientX); });

// x-scrollクリック
state.xScrollBarCanvas.style.cursor = 'grab';
state.xScrollBarCanvas.addEventListener('mousedown', e => {
  if (!state.pitchChart) return;
  isDraggingXScrollBar = true; startX = e.clientX; state.xScrollBarCanvas.style.cursor = 'grabbing';
  initialChartMin = state.pitchChart.scales.x.min; initialChartMax = state.pitchChart.scales.x.max;
});
state.xScrollBarCanvas.addEventListener('touchstart', e => {
  if (!state.pitchChart) return;
  isDraggingXScrollBar = true; startX = e.touches[0].clientX; state.xScrollBarCanvas.style.cursor = 'grabbing';
  initialChartMin = state.pitchChart.scales.x.min; initialChartMax = state.pitchChart.scales.x.max;
});

// 赤バースライダー
state.redBarSlider.addEventListener('input', e => {
  // 協調度更新
  if (state.cooperationRatiosDiv && state.dm.players.length > 1) {
    updateGlobalCooperation({
      cooperationRatiosDiv: state.cooperationRatiosDiv,
      globalCoopArray: state.globalCoopArray,
      tickIndex: state.redBarIndex
    });
  }
});

// BPM/拍子/基準A 更新
state.updateBtn.addEventListener('click', () => {
  const bpm = parseFloat(state.bpmInput.value) || 120;
  const beats = parseInt(state.beatsInput.value, 10) || 4;
  const baseA = parseFloat(state.baseAInput.value) || 442;
  state.dm.updateSettings(bpm, beats, baseA);

  updatePitchChart(state);
  state.updateRadarChart();
  state.updateXScrollBar();

  if (state.cooperationRatiosDiv && state.dm.players.length > 1) {
    updateGlobalCooperation({
      cooperationRatiosDiv: state.cooperationRatiosDiv,
      globalCoopArray: state.globalCoopArray,
      tickIndex: state.redBarIndex
    });
  }
});

// y-axis slider
state.yAxisSlider.addEventListener('input', e => {
  if (!state.pitchChart) return;
  const yRange = state.dm.getYRange();
  const currentMin = state.pitchChart.scales.y.min;
  const currentMax = state.pitchChart.scales.y.max;
  const currentRange = currentMax - currentMin;
  const totalRange = yRange.max - yRange.min;
  const scrollable = Math.max(0, totalRange - currentRange);
  if (scrollable > 0) {
    const ratio = parseInt(e.target.value, 10) / 100;
    const newMin = yRange.min + ratio * scrollable;
    state.pitchChart.options.scales.y.min = newMin;
    state.pitchChart.options.scales.y.max = newMin + currentRange;
    state.pitchChart.update('none');
  }
});

function createPlayerInstance(filepath, viewName) {
  console.log(`viewName: ${viewName}`);
  const container = document.getElementById("audioPlayersContainer");
  const globalTitle = document.getElementById("fileNameDisplay");

  if (!anyAudioAdded) {
    globalTitle.textContent = "音源";
    anyAudioAdded = true;
  }

  const playerWrap = document.createElement("div");
  playerWrap.className = "p-3 border rounded-md shadow-sm bg-white";
  

  const title = document.createElement("div");
  title.textContent = viewName;
  title.className = "font-bold text-sm mb-2";


  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "metadata";
  audio.className = "w-full";

  playerWrap.appendChild(title);
  playerWrap.appendChild(audio);
  container.appendChild(playerWrap);


  const localState = {
    ...state,
    audioPlayer: audio,
    fileNameDisplay: title,
    redBarIndex: 0,
    audioLoaded: false
  };

  setupAudioPlayer(localState, filepath);
}

// bottom nav
state.MicBtn?.addEventListener('click', () => { location.href = "../recording"; });
state.FldBtn?.addEventListener('click', () => { location.href = "../folder"; });
state.SetBtn?.addEventListener('click', () => { location.href = "../setting"; });
