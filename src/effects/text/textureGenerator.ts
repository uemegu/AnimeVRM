import * as THREE from 'three';
import { DecorationType, EffectTextStyle } from './types';

interface CachedTexture {
  texture: THREE.CanvasTexture;
  aspect: number;
}

const textureCache = new Map<string, CachedTexture>();

/**
 * Generate a cache key from text and style options
 */
export function getTextureCacheKey(text: string, style: EffectTextStyle): string {
  return `${text}_${JSON.stringify(style)}`;
}

/**
 * Draw 4-point comic sparkle star (✦)
 */
function drawSparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, size * 0.15);

  ctx.beginPath();
  const inner = size * 0.22;
  const outer = size;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const nextAngle = angle + Math.PI / 4;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cosNA = Math.cos(nextAngle);
    const sinNA = Math.sin(nextAngle);

    if (i === 0) {
      ctx.moveTo(cx + cosA * outer, cy + sinA * outer);
    } else {
      ctx.lineTo(cx + cosA * outer, cy + sinA * outer);
    }
    ctx.lineTo(cx + cosNA * inner, cy + sinNA * inner);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fill();

  // Little central shine
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, inner * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw comic anger / vein mark (💢)
 */
function drawAngerMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(4, size * 0.22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const r = size * 0.6;
  const curves = [
    // Top-left to top-right curved cross
    [[-r, -r * 0.3], [-r * 0.3, -r], [r * 0.3, -r], [r, -r * 0.3]],
    [[r, -r * 0.3], [r * 0.3, 0], [r * 0.3, 0], [r, r * 0.3]],
    [[r, r * 0.3], [r * 0.3, r], [-r * 0.3, r], [-r, r * 0.3]],
    [[-r, r * 0.3], [-r * 0.3, 0], [-r * 0.3, 0], [-r, -r * 0.3]],
  ];

  ctx.beginPath();
  // Draw classic 4-arc cross
  const s = size * 0.45;
  const d = size * 0.15;
  // Arc 1 (top)
  ctx.moveTo(cx - s, cy - d);
  ctx.bezierCurveTo(cx - d, cy - s, cx + d, cy - s, cx + s, cy - d);
  // Arc 2 (right)
  ctx.moveTo(cx + d, cy - s);
  ctx.bezierCurveTo(cx + s, cy - d, cx + s, cy + d, cx + d, cy + s);
  // Arc 3 (bottom)
  ctx.moveTo(cx + s, cy + d);
  ctx.bezierCurveTo(cx + d, cy + s, cx - d, cy + s, cx - s, cy + d);
  // Arc 4 (left)
  ctx.moveTo(cx - d, cy + s);
  ctx.bezierCurveTo(cx - s, cy + d, cx - s, cy - d, cx - d, cy - s);

  ctx.stroke();

  // White inner highlight
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw sweat drop (💧)
 */
function drawSweatDrop(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, size * 0.14);

  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.bezierCurveTo(cx + size * 0.7, cy - size * 0.2, cx + size * 0.8, cy + size * 0.6, cx, cy + size * 0.8);
  ctx.bezierCurveTo(cx - size * 0.8, cy + size * 0.6, cx - size * 0.7, cy - size * 0.2, cx, cy - size);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();

  // Specular reflection
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.ellipse(cx - size * 0.25, cy + size * 0.2, size * 0.18, size * 0.35, -Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw manga vertical shock lines (for "gaan")
 */
function drawShockLines(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';

  const numLines = Math.floor(w / 14);
  for (let i = 0; i < numLines; i++) {
    const lx = x + (i / (numLines - 1 || 1)) * w;
    const len = h * (0.6 + Math.sin(i * 1.5) * 0.35);
    ctx.lineWidth = 3 + (i % 3 === 0 ? 3 : 1);
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw comic dots (for "shiin")
 */
function drawDots(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  const count = 3;
  const spacing = size * 0.7;
  const startX = cx - ((count - 1) * spacing) / 2;

  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * spacing, cy, size * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw jagged spikes / exclamation burst
 */
function drawSpikes(ctx: CanvasRenderingContext2D, cx: number, cy: number, radiusX: number, radiusY: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const points = 16;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points;
    const isOuter = i % 2 === 0;
    const rX = isOuter ? radiusX * 1.25 : radiusX * 0.85;
    const rY = isOuter ? radiusY * 1.25 : radiusY * 0.85;
    const px = cx + Math.cos(angle) * rX;
    const py = cy + Math.sin(angle) * rY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.25;
  ctx.fill();
  ctx.restore();
}

/**
 * Create CanvasTexture for manga effect text
 */
export function createEffectTextTexture(
  text: string,
  style: EffectTextStyle,
  useCache: boolean = true
): { texture: THREE.CanvasTexture; aspect: number } {
  const cacheKey = getTextureCacheKey(text, style);
  if (useCache && textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const fontSize = 110;
  const fontWeight = style.fontWeight ?? '900';
  const fontFamily =
    style.fontFamily ??
    '"Mochiy Pop One", "M PLUS Rounded 1c", "Hiragino Kaku Gothic ProN", "Meiryo", "Arial Black", sans-serif';
  const font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  // Temporary canvas to measure
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.font = font;

  const chars = Array.from(text);
  const charWidths = chars.map((c) => tempCtx.measureText(c).width);
  const totalTextWidth = charWidths.reduce((a, b) => a + b, 0);

  // Margins for outlines, shadows, and decorations
  const paddingX = 140;
  const paddingY = 130;

  const canvasWidth = Math.ceil(totalTextWidth + paddingX * 2);
  const canvasHeight = Math.ceil(fontSize + paddingY * 2);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // Background decoration if specified
  if (style.decorations?.includes('spikes')) {
    drawSpikes(ctx, centerX, centerY, totalTextWidth * 0.55, fontSize * 0.7, style.decorationColor ?? '#ff1744');
  }

  // Pre-calculate per-character transforms for hand-drawn feel
  const charJitter = style.charJitter ?? { rotationRange: 0.1, offsetYRange: 5, scaleRange: 0.06 };
  const slant = (style.slant ?? 0) * (Math.PI / 180);

  // Deterministic seed based on char code
  const getJitter = (index: number) => {
    const code = (chars[index]?.charCodeAt(0) || 0) + index * 17;
    const sin1 = Math.sin(code * 1.33);
    const cos1 = Math.cos(code * 2.11);
    const sin2 = Math.sin(code * 3.77);

    return {
      rot: sin1 * (charJitter.rotationRange ?? 0),
      offsetY: cos1 * (charJitter.offsetYRange ?? 0),
      scale: 1.0 + sin2 * (charJitter.scaleRange ?? 0),
    };
  };

  // Helper to render all characters with full pipeline
  const renderCharacters = (
    drawFn: (
      char: string,
      x: number,
      y: number,
      jitter: { rot: number; offsetY: number; scale: number },
      charIndex: number
    ) => void
  ) => {
    let currentX = centerX - totalTextWidth / 2;
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const charWidth = charWidths[i];
      const charCenterX = currentX + charWidth / 2;
      const jitter = getJitter(i);

      drawFn(char, charCenterX, centerY, jitter, i);
      currentX += charWidth;
    }
  };

  // Layer 1: Drop Shadow
  if (style.shadowColor && style.shadowOffset) {
    const sx = style.shadowOffset.x;
    const sy = style.shadowOffset.y;
    ctx.save();
    ctx.fillStyle = style.shadowColor;
    ctx.strokeStyle = style.shadowColor;
    const shadowStrokeWidth = (style.outerStrokeWidth || 0) + (style.strokeWidth || 0);

    renderCharacters((char, cx, cy, jitter) => {
      ctx.save();
      ctx.translate(cx + sx, cy + sy + jitter.offsetY);
      if (slant !== 0) ctx.transform(1, 0, Math.tan(slant), 1, 0, 0);
      ctx.rotate(jitter.rot);
      ctx.scale(jitter.scale, jitter.scale);

      if (shadowStrokeWidth > 0) {
        ctx.lineWidth = shadowStrokeWidth;
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 2;
        ctx.strokeText(char, 0, 0);
      }
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  // Layer 2: Outer stroke (Secondary thick outline)
  if (style.outerStrokeColor && style.outerStrokeWidth && style.outerStrokeWidth > 0) {
    ctx.save();
    ctx.strokeStyle = style.outerStrokeColor;
    ctx.lineWidth = (style.strokeWidth || 0) + style.outerStrokeWidth * 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    renderCharacters((char, cx, cy, jitter) => {
      ctx.save();
      ctx.translate(cx, cy + jitter.offsetY);
      if (slant !== 0) ctx.transform(1, 0, Math.tan(slant), 1, 0, 0);
      ctx.rotate(jitter.rot);
      ctx.scale(jitter.scale, jitter.scale);
      ctx.strokeText(char, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  // Layer 3: Primary stroke (White/Light outline)
  if (style.strokeColor && style.strokeWidth && style.strokeWidth > 0) {
    ctx.save();
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    renderCharacters((char, cx, cy, jitter) => {
      ctx.save();
      ctx.translate(cx, cy + jitter.offsetY);
      if (slant !== 0) ctx.transform(1, 0, Math.tan(slant), 1, 0, 0);
      ctx.rotate(jitter.rot);
      ctx.scale(jitter.scale, jitter.scale);
      ctx.strokeText(char, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  // Layer 4: Text Fill (Solid or Gradient)
  ctx.save();
  if (Array.isArray(style.textColor)) {
    const [c1, c2] = style.textColor;
    let gradient: CanvasGradient;
    if (style.gradientDirection === 'horizontal') {
      gradient = ctx.createLinearGradient(centerX - totalTextWidth / 2, 0, centerX + totalTextWidth / 2, 0);
    } else {
      gradient = ctx.createLinearGradient(0, centerY - fontSize / 2, 0, centerY + fontSize / 2);
    }
    gradient.addColorStop(0, c1);
    gradient.addColorStop(1, c2);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = style.textColor;
  }

  renderCharacters((char, cx, cy, jitter) => {
    ctx.save();
    ctx.translate(cx, cy + jitter.offsetY);
    if (slant !== 0) ctx.transform(1, 0, Math.tan(slant), 1, 0, 0);
    ctx.rotate(jitter.rot);
    ctx.scale(jitter.scale, jitter.scale);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  });
  ctx.restore();

  // Layer 5: Highlights / Top-gloss sheen on text
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  renderCharacters((char, cx, cy, jitter) => {
    ctx.save();
    ctx.translate(cx, cy - fontSize * 0.12 + jitter.offsetY);
    if (slant !== 0) ctx.transform(1, 0, Math.tan(slant), 1, 0, 0);
    ctx.rotate(jitter.rot);
    ctx.scale(jitter.scale * 0.95, jitter.scale * 0.35);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  });
  ctx.restore();

  // Layer 6: Decorations (Manga marks around the text)
  if (style.decorations && style.decorations.length > 0) {
    const decColor = style.decorationColor ?? (Array.isArray(style.textColor) ? style.textColor[0] : style.textColor);

    for (const dec of style.decorations) {
      if (dec === 'sparkle') {
        drawSparkle(ctx, centerX - totalTextWidth * 0.52, centerY - fontSize * 0.45, 26, '#fff176');
        drawSparkle(ctx, centerX + totalTextWidth * 0.52, centerY - fontSize * 0.4, 32, '#ffd54f');
        drawSparkle(ctx, centerX + totalTextWidth * 0.4, centerY + fontSize * 0.45, 22, '#ff4081');
      } else if (dec === 'anger') {
        drawAngerMark(ctx, centerX + totalTextWidth * 0.52, centerY - fontSize * 0.48, 38, decColor);
        drawAngerMark(ctx, centerX - totalTextWidth * 0.48, centerY + fontSize * 0.42, 28, decColor);
      } else if (dec === 'sweat') {
        drawSweatDrop(ctx, centerX + totalTextWidth * 0.5, centerY - fontSize * 0.35, 26, '#4fc3f7');
        drawSweatDrop(ctx, centerX - totalTextWidth * 0.48, centerY - fontSize * 0.25, 20, '#29b6f6');
      } else if (dec === 'shockLines') {
        drawShockLines(ctx, centerX - totalTextWidth * 0.55, centerY - fontSize * 0.7, totalTextWidth * 1.1, fontSize * 0.75, decColor);
      } else if (dec === 'dots') {
        drawDots(ctx, centerX + totalTextWidth * 0.55, centerY, 18, decColor);
      } else if (dec === 'exclamation') {
        drawSparkle(ctx, centerX + totalTextWidth * 0.52, centerY - fontSize * 0.4, 28, '#ffeb3b');
      }
    }
  }

  // Create Three.js CanvasTexture
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const aspect = canvasWidth / canvasHeight;
  const result: CachedTexture = { texture, aspect };

  if (useCache) {
    textureCache.set(cacheKey, result);
  }

  return result;
}

/**
 * Clear the texture cache and dispose GPU textures
 */
export function clearEffectTextTextureCache(): void {
  for (const item of textureCache.values()) {
    item.texture.dispose();
  }
  textureCache.clear();
}
