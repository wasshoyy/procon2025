// feedback/ui/ySlider.js
import { clamp } from '../utils.js';

export function layoutVerticalSlider(state) {
  const { ySliderOverlay, yAxisSlider, pitchCard } = state;
  if (!ySliderOverlay || ySliderOverlay.style.display === 'none') return;
  const containerHeight = pitchCard.clientHeight || 0;
  const overlayHeight = Math.max(48, Math.floor(containerHeight * 0.85));
  ySliderOverlay.style.height = `${overlayHeight}px`;
  if (yAxisSlider) yAxisSlider.style.width = `${Math.max(80, overlayHeight - 12)}px`;
}

export function updateYSliderVisibility(state, syncFromChart=false) {
  const { dm, pitchChart, ySliderOverlay, yAxisSlider } = state;
  if (!pitchChart) return;
  const yRange = dm.getYRange();
  const currentMin = pitchChart.scales.y.min;
  const currentMax = pitchChart.scales.y.max;
  const currentRange = currentMax - currentMin;
  const totalRange = yRange.max - yRange.min;
  const scrollable = Math.max(0, totalRange - currentRange);

  if (scrollable > 0) {
    ySliderOverlay.style.display = 'flex';
    ySliderOverlay.setAttribute('aria-hidden','false');
    yAxisSlider.disabled = false;
    layoutVerticalSlider(state);
    if (syncFromChart) {
      const offset = Math.max(0, currentMin - yRange.min);
      const ratio = (scrollable === 0) ? 0 : (offset / scrollable);
      yAxisSlider.value = String(Math.round(ratio * 100));
    }
  } else {
    ySliderOverlay.style.display = 'none';
    ySliderOverlay.setAttribute('aria-hidden','true');
    yAxisSlider.disabled = true;
  }
}
