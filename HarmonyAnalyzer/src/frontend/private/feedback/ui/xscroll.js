// js/ui/xscroll.js
import { THEME, clamp } from '../utils.js';

export function updateXScrollBar(state) {
  const { xScrollBarCanvas, xScrollCtx, pitchChart, dm } = state;
  const dpr = window.devicePixelRatio || 1;
  const width = xScrollBarCanvas.clientWidth * dpr;
  const height = xScrollBarCanvas.clientHeight * dpr;
  if (xScrollBarCanvas.width !== width || xScrollBarCanvas.height !== height) {
    xScrollBarCanvas.width = width; xScrollBarCanvas.height = height;
  }
  xScrollCtx.clearRect(0,0,width,height);
  xScrollCtx.lineWidth = 1;

  if (!pitchChart) return;
  const xScale = pitchChart.scales.x;
  const totalPoints = dm.totalPoints;
  const chartMin = xScale.min, chartMax = xScale.max, chartRange = chartMax - chartMin;

  dm.players.forEach(p => {
    xScrollCtx.beginPath(); xScrollCtx.strokeStyle = p.color; xScrollCtx.globalAlpha = 0.5;
    const h = height * 0.8;
    const yMax = Math.max(...p.pitchArray);
    const yMin = Math.min(...p.pitchArray);
    const r = (yMax - yMin) || 1;
    for (let i=0;i<totalPoints;i++) {
      const x = (i / totalPoints) * width;
      const y = h * (1 - ((p.pitchArray[i] - yMin) / r));
      if (i===0) xScrollCtx.moveTo(x,y); else xScrollCtx.lineTo(x,y);
    }
    xScrollCtx.stroke();
  });

  xScrollCtx.globalAlpha = 1;
  xScrollCtx.fillStyle = THEME.miniVisibleShade;
  const visibleRectX = (chartMin / totalPoints) * width;
  const visibleRectWidth = (chartRange / totalPoints) * width;
  xScrollCtx.fillRect(visibleRectX, 0, visibleRectWidth, height);
}
