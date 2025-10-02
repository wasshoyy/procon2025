export function updateGlobalCooperation({ cooperationRatiosDiv, globalCoopArray, tickIndex }) {
  if (!cooperationRatiosDiv) return;
  cooperationRatiosDiv.innerHTML = '';

  if (!Array.isArray(globalCoopArray) || globalCoopArray.length === 0) {
    cooperationRatiosDiv.innerHTML = `
      <div class="p-3 bg-white rounded-lg shadow text-sm text-gray-500">
        協調度データがありません
      </div>`;
    return;
  }

  const idx = Math.max(0, Math.min(Math.floor(tickIndex) || 0, globalCoopArray.length - 1));
  let raw = Number(globalCoopArray[idx]);
  if (!isFinite(raw)) raw = 0;
  const value = Math.max(0, Math.min(raw, 1));
  const percent = +(value * 100).toFixed(1);

  const accent = '#6366F1';
  const accent2 = '#06b6d4';

  const card = document.createElement('div');
  card.className = 'bg-white rounded-xl shadow-lg p-3 flex gap-4 items-center';
  card.style.maxWidth = '480px';

  // --- 左: 円形プログレス ---
  const size = 64;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const svgNs = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  const bgCircle = document.createElementNS(svgNs, 'circle');
  bgCircle.setAttribute('cx', String(size / 2));
  bgCircle.setAttribute('cy', String(size / 2));
  bgCircle.setAttribute('r', String(radius));
  bgCircle.setAttribute('stroke', '#e6e7ee');
  bgCircle.setAttribute('stroke-width', String(stroke));
  bgCircle.setAttribute('fill', 'none');
  svg.appendChild(bgCircle);

  const fgCircle = document.createElementNS(svgNs, 'circle');
  fgCircle.setAttribute('cx', String(size / 2));
  fgCircle.setAttribute('cy', String(size / 2));
  fgCircle.setAttribute('r', String(radius));
  fgCircle.setAttribute('stroke', accent);
  fgCircle.setAttribute('stroke-width', String(stroke));
  fgCircle.setAttribute('stroke-linecap', 'round');
  fgCircle.setAttribute('fill', 'none');
  fgCircle.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  fgCircle.setAttribute('stroke-dasharray', String(circumference));
  fgCircle.setAttribute('stroke-dashoffset', String(circumference));
  fgCircle.style.transition = 'stroke-dashoffset 600ms cubic-bezier(.2,.9,.2,1)';
  svg.appendChild(fgCircle);

  const centerText = document.createElement('div');
  centerText.style.position = 'absolute';
  centerText.style.width = `${size}px`;
  centerText.style.textAlign = 'center';
  centerText.style.top = '50%';
  centerText.style.transform = 'translateY(-50%)';
  centerText.style.fontSize = '14px';
  centerText.style.color = accent;
  centerText.style.fontWeight = 'bold';
  centerText.textContent = `${percent}%`;

  const leftWrap = document.createElement('div');
  leftWrap.style.position = 'relative';
  leftWrap.style.width = `${size}px`;
  leftWrap.style.height = `${size}px`;
  leftWrap.appendChild(svg);
  leftWrap.appendChild(centerText);

  // --- 右: スパークライン ---
  const right = document.createElement('div');
  right.style.width = '180px';
  right.style.minWidth = '120px';
  right.style.height = '36px';
  right.style.display = 'flex';
  right.style.alignItems = 'center';

  const sparkW = 180;
  const sparkH = 36;
  const sparkSvg = document.createElementNS(svgNs, 'svg');
  sparkSvg.setAttribute('width', String(sparkW));
  sparkSvg.setAttribute('height', String(sparkH));
  sparkSvg.setAttribute('viewBox', `0 0 ${sparkW} ${sparkH}`);

  // --- 現在位置を中央にするウィンドウ ---
  const windowSize = 32;
  let start = idx - Math.floor(windowSize / 2);
  if (start < 0) start = 0;
  let end = start + windowSize;
  if (end > globalCoopArray.length) {
    end = globalCoopArray.length;
    start = Math.max(0, end - windowSize);
  }
  const slice = globalCoopArray.slice(start, end);
  const len = slice.length || 1;

  const points = slice.map((v, i) => {
    const x = (i / (len - 1 || 1)) * (sparkW - 6) + 3;
    const clamped = Math.max(0, Math.min(1, Number(v) || 0));
    const y = 4 + (1 - clamped) * (sparkH - 8);
    return { x, y };
  });

  let pathD = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    pathD += (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
  }

  const line = document.createElementNS(svgNs, 'path');
  line.setAttribute('d', pathD);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', accent);
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  sparkSvg.appendChild(line);

  // --- 現在位置の点（中央に） ---
  const centerIndex = Math.min(Math.floor(len / 2), points.length - 1);
  const centerPoint = points[centerIndex];
  const dot = document.createElementNS(svgNs, 'circle');
  dot.setAttribute('cx', String(centerPoint.x));
  dot.setAttribute('cy', String(centerPoint.y));
  dot.setAttribute('r', '3.5');
  dot.setAttribute('fill', accent);
  dot.setAttribute('stroke', '#fff');
  dot.setAttribute('stroke-width', '1');
  sparkSvg.appendChild(dot);

  right.appendChild(sparkSvg);

  // --- 組み立て ---
  card.appendChild(leftWrap);
  card.appendChild(right);
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `全体協調度 ${percent}パーセント`);
  cooperationRatiosDiv.appendChild(card);

  // --- アニメーション円 ---
  const offset = circumference * (1 - percent / 100);
  requestAnimationFrame(() => fgCircle.setAttribute('stroke-dashoffset', offset));
}
