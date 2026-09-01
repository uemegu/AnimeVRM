import * as THREE from 'three';
import { t } from '../i18n';

export interface HistogramData {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  lum: Uint32Array;
  // Absolute peaks (0-255)
  maxR: number;
  maxG: number;
  maxB: number;
  maxLum: number;
  maxOverall: number;
  // Midtone max (1-254, excluding 0 and 255 for Y-scale auto-ranging)
  scaleMaxR: number;
  scaleMaxG: number;
  scaleMaxB: number;
  scaleMaxLum: number;
  scaleMaxOverall: number;
  avgR: number;
  avgG: number;
  avgB: number;
  avgLum: number;
  shadowClipRatio: number;
  highlightClipRatio: number;
  totalSampled: number;
  width: number;
  height: number;
}

export type ChannelMode = 'all' | 'rgb' | 'r' | 'g' | 'b' | 'lum';
export type ScaleMode = 'linear' | 'log';

/**
 * Computes scaling maximum excluding Level 0 and Level 255 (shadow & highlight bounds),
 * allowing 0 and 255 to clamp at the top ceiling while maximizing the visibility of mid-tones (1-254).
 */
function computeChannelMax(hist: Uint32Array): { peakOverall: number; scaleMax: number } {
  let peakOverall = 0;
  let maxMidtones = 0;

  for (let i = 0; i < 256; i++) {
    const val = hist[i];
    if (val > peakOverall) peakOverall = val;
    // Exclude level 0 and level 255 from midtone scaling
    if (i > 0 && i < 255) {
      if (val > maxMidtones) maxMidtones = val;
    }
  }

  // If midtones (1-254) have data, use their maximum as the Y-axis ceiling.
  // Otherwise fallback to peakOverall.
  const scaleMax = maxMidtones > 0 ? maxMidtones : Math.max(peakOverall, 1);

  return {
    peakOverall: Math.max(peakOverall, 1),
    scaleMax,
  };
}

export class ColorHistogram {
  private container: HTMLElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private tooltipEl: HTMLDivElement | null = null;

  private currentData: HistogramData | null = null;
  private channelMode: ChannelMode = 'all';
  private scaleMode: ScaleMode = 'linear';

  private hoverX: number | null = null;

  constructor() {}

  /**
   * Mounts the histogram UI into a container element.
   */
  public mount(container: HTMLElement, onRefreshRequested: () => void): void {
    this.container = container;
    this.renderDOM(onRefreshRequested);
    if (this.currentData) {
      this.draw();
      this.updateStatsDisplay();
    }
  }

  /**
   * Updates language/labels in the UI.
   */
  public updateLanguage(): void {
    if (!this.container) return;
    const prevMode = this.channelMode;
    const prevScale = this.scaleMode;
    const refreshBtn = this.container.querySelector<HTMLButtonElement>('#hist-refresh-btn');
    const onRefresh = refreshBtn ? () => refreshBtn.click() : () => {};
    this.renderDOM(onRefresh);
    this.channelMode = prevMode;
    this.scaleMode = prevScale;
    this.updateActiveButtons();
    if (this.currentData) {
      this.draw();
      this.updateStatsDisplay();
    }
  }

  private renderDOM(onRefreshRequested: () => void): void {
    if (!this.container) return;
    const tr = t();

    this.container.innerHTML = `
      <div class="histogram-wrapper">
        <div class="section-box" style="padding: 10px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <label class="section-label" style="margin: 0; font-weight: 600; color: #5684c8;">${tr.histogram.title}</label>
            <button id="hist-refresh-btn" class="action-btn primary" style="padding: 4px 10px; font-size: 11.5px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
              ${tr.histogram.refresh}
            </button>
          </div>
          <p style="font-size: 11px; color: #888888; margin: 0 0 10px 0; line-height: 1.4;">
            ${tr.histogram.description}
          </p>

          <!-- Channel & Scale Controls -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
            <div>
              <label style="font-size: 10.5px; color: #aaaaaa; display: block; margin-bottom: 4px;">${tr.histogram.channelMode}</label>
              <div class="hist-btn-group" id="hist-channel-group">
                <button class="hist-control-btn ${this.channelMode === 'all' ? 'active' : ''}" data-mode="all">${tr.histogram.channelAll}</button>
                <button class="hist-control-btn ${this.channelMode === 'rgb' ? 'active' : ''}" data-mode="rgb">${tr.histogram.channelRgb}</button>
                <button class="hist-control-btn ${this.channelMode === 'r' ? 'active' : ''}" data-mode="r" style="color: #ff6b6b;">${tr.histogram.channelR}</button>
                <button class="hist-control-btn ${this.channelMode === 'g' ? 'active' : ''}" data-mode="g" style="color: #51cf66;">${tr.histogram.channelG}</button>
                <button class="hist-control-btn ${this.channelMode === 'b' ? 'active' : ''}" data-mode="b" style="color: #4dabf7;">${tr.histogram.channelB}</button>
                <button class="hist-control-btn ${this.channelMode === 'lum' ? 'active' : ''}" data-mode="lum" style="color: #f1f3f5;">${tr.histogram.channelLuminance}</button>
              </div>
            </div>

            <div>
              <label style="font-size: 10.5px; color: #aaaaaa; display: block; margin-bottom: 4px;">${tr.histogram.scaleMode}</label>
              <div class="hist-btn-group" id="hist-scale-group">
                <button class="hist-control-btn ${this.scaleMode === 'linear' ? 'active' : ''}" data-scale="linear">${tr.histogram.linearScale}</button>
                <button class="hist-control-btn ${this.scaleMode === 'log' ? 'active' : ''}" data-scale="log">${tr.histogram.logScale}</button>
              </div>
            </div>
          </div>

          <!-- Histogram Canvas Container -->
          <div class="hist-canvas-container" id="hist-canvas-container">
            <canvas id="hist-canvas" width="300" height="150"></canvas>
            <div id="hist-tooltip" class="hist-tooltip"></div>
          </div>

          <!-- Gradient Bar (Tone Reference) -->
          <div class="hist-gradient-bar" title="0 (Shadow) -> 255 (Highlight)"></div>
          <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #777777; margin-top: 2px;">
            <span>0 (Shadow)</span>
            <span>64</span>
            <span>128 (Mid)</span>
            <span>192</span>
            <span>255 (High)</span>
          </div>
        </div>

        <!-- Statistics Box -->
        <div class="section-box" style="padding: 10px;">
          <label class="section-label" style="color: #cccccc; font-size: 11px; margin-bottom: 6px;">
            ${tr.histogram.statistics}
          </label>
          <div class="hist-stats-grid">
            <div class="hist-stat-item">
              <span class="hist-stat-label" style="color: #ff6b6b;">${tr.histogram.meanR}</span>
              <strong id="hist-stat-mean-r" class="hist-stat-value">-</strong>
            </div>
            <div class="hist-stat-item">
              <span class="hist-stat-label" style="color: #51cf66;">${tr.histogram.meanG}</span>
              <strong id="hist-stat-mean-g" class="hist-stat-value">-</strong>
            </div>
            <div class="hist-stat-item">
              <span class="hist-stat-label" style="color: #4dabf7;">${tr.histogram.meanB}</span>
              <strong id="hist-stat-mean-b" class="hist-stat-value">-</strong>
            </div>
            <div class="hist-stat-item">
              <span class="hist-stat-label" style="color: #f1f3f5;">${tr.histogram.meanLuminance}</span>
              <strong id="hist-stat-mean-lum" class="hist-stat-value">-</strong>
            </div>
            <div class="hist-stat-item">
              <span class="hist-stat-label">${tr.histogram.shadowClip}</span>
              <strong id="hist-stat-shadow-clip" class="hist-stat-value">-</strong>
            </div>
            <div class="hist-stat-item">
              <span class="hist-stat-label">${tr.histogram.highlightClip}</span>
              <strong id="hist-stat-highlight-clip" class="hist-stat-value">-</strong>
            </div>
            <div class="hist-stat-item">
              <span class="hist-stat-label">${tr.histogram.resolution}</span>
              <strong id="hist-stat-res" class="hist-stat-value">-</strong>
            </div>
            <div class="hist-stat-item">
              <span class="hist-stat-label">${tr.histogram.samplePixels}</span>
              <strong id="hist-stat-samples" class="hist-stat-value">-</strong>
            </div>
            <div class="hist-stat-item" style="grid-column: span 2;">
              <span class="hist-stat-label">${tr.histogram.peakCount}</span>
              <strong id="hist-stat-peak" class="hist-stat-value">-</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    this.canvasEl = this.container.querySelector<HTMLCanvasElement>('#hist-canvas');
    if (this.canvasEl) {
      this.ctx = this.canvasEl.getContext('2d');
    }
    this.tooltipEl = this.container.querySelector<HTMLDivElement>('#hist-tooltip');

    // Bind event listeners
    const refreshBtn = this.container.querySelector<HTMLButtonElement>('#hist-refresh-btn');
    refreshBtn?.addEventListener('click', () => {
      onRefreshRequested();
    });

    const channelButtons = this.container.querySelectorAll<HTMLButtonElement>('#hist-channel-group button');
    channelButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') as ChannelMode;
        if (mode) {
          this.channelMode = mode;
          channelButtons.forEach((b) => b.classList.toggle('active', b === btn));
          this.draw();
        }
      });
    });

    const scaleButtons = this.container.querySelectorAll<HTMLButtonElement>('#hist-scale-group button');
    scaleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const scale = btn.getAttribute('data-scale') as ScaleMode;
        if (scale) {
          this.scaleMode = scale;
          scaleButtons.forEach((b) => b.classList.toggle('active', b === btn));
          this.draw();
        }
      });
    });

    // Canvas Mouse interaction (hover guide & tooltip)
    const canvasContainer = this.container.querySelector<HTMLDivElement>('#hist-canvas-container');
    if (canvasContainer && this.canvasEl) {
      this.canvasEl.addEventListener('mousemove', (e) => {
        const rect = this.canvasEl!.getBoundingClientRect();
        const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        this.hoverX = mouseX / rect.width;
        this.draw();
        this.updateTooltip(e.clientX - rect.left, e.clientY - rect.top, rect.width);
      });

      this.canvasEl.addEventListener('mouseleave', () => {
        this.hoverX = null;
        this.draw();
        if (this.tooltipEl) {
          this.tooltipEl.style.display = 'none';
        }
      });
    }

    this.resizeCanvas();
  }

  private updateActiveButtons(): void {
    if (!this.container) return;
    const channelButtons = this.container.querySelectorAll<HTMLButtonElement>('#hist-channel-group button');
    channelButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === this.channelMode);
    });
    const scaleButtons = this.container.querySelectorAll<HTMLButtonElement>('#hist-scale-group button');
    scaleButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-scale') === this.scaleMode);
    });
  }

  public resizeCanvas(): void {
    if (!this.canvasEl || !this.canvasEl.parentElement) return;
    const rect = this.canvasEl.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width) || 280;
    const height = 150;

    this.canvasEl.width = width * dpr;
    this.canvasEl.height = height * dpr;
    this.canvasEl.style.width = `${width}px`;
    this.canvasEl.style.height = `${height}px`;

    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /**
   * Captures and calculates the histogram from the WebGL context.
   */
  public computeHistogram(renderer: THREE.WebGLRenderer): HistogramData | null {
    const gl = renderer.getContext();
    if (!gl) return null;

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    if (width <= 0 || height <= 0) return null;

    // Step sampling if resolution is large (> 1M pixels) to keep calculation under a few milliseconds
    const totalPixels = width * height;
    const step = totalPixels > 1000000 ? 2 : 1;

    const buffer = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);

    const rHist = new Uint32Array(256);
    const gHist = new Uint32Array(256);
    const bHist = new Uint32Array(256);
    const lumHist = new Uint32Array(256);

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumLum = 0;
    let shadowClipCount = 0;
    let highlightClipCount = 0;
    let sampledCount = 0;

    for (let y = 0; y < height; y += step) {
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x += step) {
        const idx = rowOffset + x * 4;
        const r = buffer[idx];
        const g = buffer[idx + 1];
        const b = buffer[idx + 2];

        // Rec. 709 Luminance
        const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        const clampedLum = Math.min(255, Math.max(0, lum));

        rHist[r]++;
        gHist[g]++;
        bHist[b]++;
        lumHist[clampedLum]++;

        sumR += r;
        sumG += g;
        sumB += b;
        sumLum += clampedLum;

        if (r === 0 && g === 0 && b === 0) {
          shadowClipCount++;
        }
        if (r === 255 || g === 255 || b === 255) {
          highlightClipCount++;
        }

        sampledCount++;
      }
    }

    const { peakOverall: maxR, scaleMax: scaleMaxR } = computeChannelMax(rHist);
    const { peakOverall: maxG, scaleMax: scaleMaxG } = computeChannelMax(gHist);
    const { peakOverall: maxB, scaleMax: scaleMaxB } = computeChannelMax(bHist);
    const { peakOverall: maxLum, scaleMax: scaleMaxLum } = computeChannelMax(lumHist);

    const maxOverall = Math.max(maxR, maxG, maxB, maxLum, 1);
    const scaleMaxOverall = Math.max(scaleMaxR, scaleMaxG, scaleMaxB, scaleMaxLum, 1);

    this.currentData = {
      r: rHist,
      g: gHist,
      b: bHist,
      lum: lumHist,
      maxR,
      maxG,
      maxB,
      maxLum,
      maxOverall,
      scaleMaxR,
      scaleMaxG,
      scaleMaxB,
      scaleMaxLum,
      scaleMaxOverall,
      avgR: sampledCount > 0 ? sumR / sampledCount : 0,
      avgG: sampledCount > 0 ? sumG / sampledCount : 0,
      avgB: sampledCount > 0 ? sumB / sampledCount : 0,
      avgLum: sampledCount > 0 ? sumLum / sampledCount : 0,
      shadowClipRatio: sampledCount > 0 ? (shadowClipCount / sampledCount) * 100 : 0,
      highlightClipRatio: sampledCount > 0 ? (highlightClipCount / sampledCount) * 100 : 0,
      totalSampled: sampledCount,
      width,
      height,
    };

    this.resizeCanvas();
    this.draw();
    this.updateStatsDisplay();

    return this.currentData;
  }

  /**
   * Draws the histogram on the 2D canvas.
   */
  public draw(): void {
    if (!this.ctx || !this.canvasEl) return;
    const ctx = this.ctx;
    const width = parseFloat(this.canvasEl.style.width) || this.canvasEl.width;
    const height = parseFloat(this.canvasEl.style.height) || this.canvasEl.height;

    // Clear background
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines (0%, 25%, 50%, 75%, 100%)
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 1;

    // Vertical grid lines
    const gridPoints = [0.25, 0.5, 0.75];
    gridPoints.forEach((p) => {
      const x = Math.round(p * width) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    // Horizontal grid lines
    gridPoints.forEach((p) => {
      const y = Math.round(p * height) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    if (!this.currentData) {
      // Empty state
      ctx.fillStyle = '#666666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t().common.loadingModel || 'No Data', width / 2, height / 2);
      return;
    }

    const data = this.currentData;
    const isLog = this.scaleMode === 'log';

    // Select active scale ceiling (based on 1-254 range)
    let currentYMax = data.scaleMaxOverall;
    if (this.channelMode === 'r') currentYMax = data.scaleMaxR;
    else if (this.channelMode === 'g') currentYMax = data.scaleMaxG;
    else if (this.channelMode === 'b') currentYMax = data.scaleMaxB;
    else if (this.channelMode === 'lum') currentYMax = data.scaleMaxLum;

    const currentAbsolutePeak =
      this.channelMode === 'r'
        ? data.maxR
        : this.channelMode === 'g'
        ? data.maxG
        : this.channelMode === 'b'
        ? data.maxB
        : this.channelMode === 'lum'
        ? data.maxLum
        : data.maxOverall;

    // Scale calculation function (clamps at top if exceeding maxVal)
    const getY = (val: number, maxVal: number): number => {
      if (val <= 0) return height;
      if (isLog) {
        const logVal = Math.log(1 + val);
        const logMax = Math.log(1 + currentYMax);
        const normalized = Math.min(1, logVal / logMax);
        return height - normalized * (height - 6);
      } else {
        const normalized = Math.min(1, val / maxVal);
        return height - normalized * (height - 6);
      }
    };

    const drawChannel = (
      hist: Uint32Array,
      maxVal: number,
      fillColor: string,
      strokeColor: string,
      composite: GlobalCompositeOperation = 'source-over'
    ) => {
      ctx.save();
      ctx.globalCompositeOperation = composite;

      // Fill area
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * width;
        const y = getY(hist[i], maxVal);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Stroke outline
      ctx.beginPath();
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * width;
        const y = getY(hist[i], maxVal);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    };

    switch (this.channelMode) {
      case 'all': {
        // Red, Green, Blue with screen composite, then Luminance line
        drawChannel(data.r, currentYMax, 'rgba(255, 60, 60, 0.35)', 'rgba(255, 90, 90, 0.8)', 'screen');
        drawChannel(data.g, currentYMax, 'rgba(60, 220, 80, 0.35)', 'rgba(90, 240, 110, 0.8)', 'screen');
        drawChannel(data.b, currentYMax, 'rgba(50, 140, 255, 0.35)', 'rgba(80, 170, 255, 0.8)', 'screen');
        // Luminance line on top
        drawChannel(data.lum, currentYMax, 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.95)', 'source-over');
        break;
      }
      case 'rgb': {
        drawChannel(data.r, currentYMax, 'rgba(255, 60, 60, 0.4)', 'rgba(255, 90, 90, 0.9)', 'screen');
        drawChannel(data.g, currentYMax, 'rgba(60, 220, 80, 0.4)', 'rgba(90, 240, 110, 0.9)', 'screen');
        drawChannel(data.b, currentYMax, 'rgba(50, 140, 255, 0.4)', 'rgba(80, 170, 255, 0.9)', 'screen');
        break;
      }
      case 'r': {
        drawChannel(data.r, currentYMax, 'rgba(255, 75, 75, 0.45)', 'rgba(255, 100, 100, 0.95)');
        break;
      }
      case 'g': {
        drawChannel(data.g, currentYMax, 'rgba(60, 220, 80, 0.45)', 'rgba(90, 240, 110, 0.95)');
        break;
      }
      case 'b': {
        drawChannel(data.b, currentYMax, 'rgba(60, 150, 255, 0.45)', 'rgba(90, 180, 255, 0.95)');
        break;
      }
      case 'lum': {
        drawChannel(data.lum, currentYMax, 'rgba(220, 220, 220, 0.35)', 'rgba(255, 255, 255, 0.95)');
        break;
      }
    }

    // Draw Y-Axis scale info badge on top-left of canvas
    ctx.save();
    ctx.font = '9.5px monospace, sans-serif';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const scaleText = isLog
      ? `Log (Y-Max: ${Math.round(currentYMax).toLocaleString()} px)`
      : `Y-Max (1-254): ${Math.round(currentYMax).toLocaleString()} px`;
    ctx.fillText(scaleText, 6, 6);
    ctx.restore();

    // Draw hover vertical indicator line
    if (this.hoverX !== null) {
      const x = Math.round(this.hoverX * width) + 0.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private updateTooltip(mouseX: number, mouseY: number, containerWidth: number): void {
    if (!this.tooltipEl || !this.currentData || this.hoverX === null) return;
    const level = Math.max(0, Math.min(255, Math.round(this.hoverX * 255)));
    const data = this.currentData;

    const rVal = data.r[level];
    const gVal = data.g[level];
    const bVal = data.b[level];
    const lumVal = data.lum[level];

    this.tooltipEl.innerHTML = `
      <div style="font-weight: 700; color: #ffffff; margin-bottom: 2px;">Level: ${level}</div>
      <div style="color: #ff8787;">R: ${rVal.toLocaleString()}</div>
      <div style="color: #69db7c;">G: ${gVal.toLocaleString()}</div>
      <div style="color: #74c0fc;">B: ${bVal.toLocaleString()}</div>
      <div style="color: #f8f9fa;">Lum: ${lumVal.toLocaleString()}</div>
    `;

    this.tooltipEl.style.display = 'block';

    // Tooltip positioning
    const tooltipWidth = 90;
    let left = mouseX + 10;
    if (left + tooltipWidth > containerWidth) {
      left = mouseX - tooltipWidth - 10;
    }
    const top = Math.max(5, mouseY - 40);

    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
  }

  private updateStatsDisplay(): void {
    if (!this.container || !this.currentData) return;
    const data = this.currentData;

    const setElem = (id: string, text: string) => {
      const el = this.container!.querySelector<HTMLElement>(`#${id}`);
      if (el) el.textContent = text;
    };

    setElem('hist-stat-mean-r', data.avgR.toFixed(1));
    setElem('hist-stat-mean-g', data.avgG.toFixed(1));
    setElem('hist-stat-mean-b', data.avgB.toFixed(1));
    setElem('hist-stat-mean-lum', data.avgLum.toFixed(1));
    setElem('hist-stat-shadow-clip', `${data.shadowClipRatio.toFixed(2)}%`);
    setElem('hist-stat-highlight-clip', `${data.highlightClipRatio.toFixed(2)}%`);
    setElem('hist-stat-res', `${data.width} × ${data.height}`);
    setElem('hist-stat-samples', data.totalSampled.toLocaleString());
    setElem('hist-stat-peak', `${data.maxOverall.toLocaleString()} px`);
  }
}
