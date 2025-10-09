// feedback/charts/pitchChart.js
import { HOP_LENGTH, SAMPLERATE, THEME, toRGBA, clamp, computeNoteTicks, freqToNoteNameWithOctave } from '../utils.js';

export function registerChartPlugins() {
  try {
    if (window['chartjs-plugin-annotation']) Chart.register(window['chartjs-plugin-annotation']);
    if (window['chartjs-plugin-zoom']) Chart.register(window['chartjs-plugin-zoom']);
  } catch (e) {
    console.warn('Chart plugin registration failed:', e);
  }
}

function buildBeatAndBarAnnotations(dm) {
  const annotations = {};
  const ppb = (60 * SAMPLERATE) / (dm.bpm * HOP_LENGTH);
  if (!ppb || ppb <= 0) return annotations;  // 念のためガード

  const totalBeats = Math.floor(dm.totalPoints / ppb);
  for (let beat = 0; beat <= totalBeats; beat++) {
    const x = beat * ppb;
    const isBar = (beat % dm.beatsPerBar === 0);
    annotations[`${isBar ? 'bar' : 'beat'}_${x}`] = {
      type: 'line',
      xMin: x,
      xMax: x,
      borderColor: THEME.grid,
      borderWidth: isBar ? 2 : 1  // 小節線は太く、拍線は細く
    };
  }

  return annotations;
}

export function createPitchChart(state) {
  const { dm, ctxPitch } = state;
  const yRange = dm.getYRange();

  const cfg = {
    type: 'line',
    data: {
      labels: Array.from({ length: dm.totalPoints }, (_, i) => i),
      datasets: dm.players.map(p => ({
        label: p.name,
        data: p.pitchArray,
        borderColor: p.color,
        backgroundColor: toRGBA(p.color),
        pointRadius: 0,
        borderWidth: 1.5
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: Math.min(500, dm.totalPoints - 1),
          title: { display: true, text: '拍', color: THEME.ticks },
          ticks: {
            color: THEME.ticks,
            stepSize: dm.pointsPerBeat || 1,
            callback: (val) => {
              if (dm.pointsPerBeat > 0 && (val % dm.pointsPerBeat === 0)) {
                return ((Math.floor(val / dm.pointsPerBeat) % dm.beatsPerBar) + 1);
              }
              return '';
            }
          },
          grid: { color: THEME.grid }
        },
        y: {
          type: 'logarithmic',
          min: Math.max(1, yRange.min),
          max: yRange.max,
          afterBuildTicks: (scale) => {
            // 半音単位の周波数を生成
            const ticks = computeNoteTicks(scale.min, scale.max, dm.baseA, 24);
            // Chart.js tick 配列にセット
            scale.ticks = ticks.map(v => ({ value: v, major: true }));
          },
          title: { display: true, text: '音程 (Hz)', color: THEME.ticks },
          ticks: {
            color: THEME.ticks,
            callback: (v) => {
              // 主要な周波数だけ表示
              return freqToNoteNameWithOctave(v, dm.baseA);
            }
          },
          grid: { color: THEME.grid }
        }
      },
      plugins: {
        annotation: {
          annotations: {
            ...buildBeatAndBarAnnotations(dm),
            redBar: {
              type: 'line',
              xMin: state.redBarIndex,
              xMax: state.redBarIndex,
              borderColor: THEME.redBar,
              borderWidth: 2
            }
          }
        },
        zoom: {
          limits: {
            x: { min: 0, max: dm.totalPoints - 1, minRange: 20 },
            y: { min: yRange.min, max: yRange.max, minRange: 20 }
          },
          pan: {
            enabled: true,
            mode: 'xy',
            onPan: () => {
              state.updateXScrollBar();
              state.updateYSliderVisibility(true);
            }
          },
          zoom: {
            wheel: { enabled: true, mode: 'xy' },
            pinch: { enabled: true, mode: 'xy' },
            onZoom: () => {
              state.updateXScrollBar();
              state.updateYSliderVisibility(true);
            }
          }
        },
        legend: { position: 'top', labels: { color: THEME.ticks } },
        tooltip: {
          callbacks: {
            title: ctx => {
              const time = ctx[0].dataIndex * HOP_LENGTH / SAMPLERATE;
              return `Time: ${time.toFixed?.(2)}`;
            },
            label: ctx => {
              const freq = ctx.parsed.y?.toFixed?.(2);
              return `${ctx.dataset.label}: ${freq} Hz (${freqToNoteNameWithOctave(ctx.parsed.y, dm.baseA)})`;
            }
          }
        }
      }
    }
  };

  const chart = new Chart(ctxPitch, cfg);
  return chart;
}

export function updatePitchChart(state) {
  const { dm, pitchChart } = state;
  if (!pitchChart) return;

  pitchChart.data.datasets.forEach((ds, i) => {
    ds.data = dm.players?.[i]?.pitchArray || [];
    ds.borderColor = dm.players?.[i]?.color || ds.borderColor;
    ds.backgroundColor = toRGBA(dm.players?.[i]?.color || '#888888');
  });

  const yRange = dm.getYRange();
  pitchChart.options.scales.y.min = Math.max(1, yRange.min);
  pitchChart.options.scales.y.max = yRange.max;

  // 赤バー & 小節線を再生成
  pitchChart.options.plugins.annotation.annotations = {
    ...(() => {
      const ann = {};
      const ppb = dm.pointsPerBeat || 1;
      const totalBeats = Math.floor(dm.totalPoints / ppb);
      for (let beat = 0; beat <= totalBeats; beat++) {
        const x = beat * ppb;
        const isBar = (beat % dm.beatsPerBar === 0);
        ann[`${isBar ? 'bar' : 'beat'}_${x}`] = {
          type: 'line',
          xMin: x,
          xMax: x,
          borderColor: THEME.grid,
          borderWidth: isBar ? 3 : 1
        };
      }

      ann.redBar = {
        type: 'line',
        xMin: state.redBarIndex,
        xMax: state.redBarIndex,
        borderColor: THEME.redBar,
        borderWidth: 2
      };
      return ann;
    })()
  };

  pitchChart.update('none');
  state.updateYSliderVisibility(true);
}
