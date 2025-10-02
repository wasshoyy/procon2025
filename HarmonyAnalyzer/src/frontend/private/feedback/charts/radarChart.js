// js/charts/radarChart.js
import { THEME, toRGBA } from '../utils.js';

export function createRadarChart(state) {
  const { ctxRadar, dm, redBarIndex } = state;
  return new Chart(ctxRadar, {
    type: 'radar',
    data: {
      labels: ['明るさ','明瞭さ','鋭さ','滑らかさ','厚さ'],
      datasets: dm.players.map(p => ({
        label: p.name,
        data: p.featuresArray?.[redBarIndex] || Array(5).fill(0),
        borderColor: p.color,
        backgroundColor: toRGBA(p.color),
        borderWidth: 1.5,
        pointBackgroundColor: p.color,
        pointBorderColor: '#fff'
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        r: {
          min: 0,
          max: 1,
          ticks: { display: false },
          pointLabels: { color: THEME.ticks },
          grid: { color: THEME.grid },
          angleLines: { color: THEME.grid }
        }
      },
      plugins: { legend: { position: 'top', labels: { color: THEME.ticks } } }
    }
  });
}

export function updateRadarChart(state) {
  const { radarChart, dm, redBarIndex } = state;
  if (!radarChart) return;
  radarChart.data.datasets.forEach((ds, i) => {
    ds.data = dm.players?.[i]?.featuresArray?.[redBarIndex] || Array(5).fill(0);
  });
  radarChart.update('none');
  state.updateVolumeRatios();
}
