/** プールの寸法（WaterSurface / Caustics / SplashSystem で共有） */
export const POOL_HALF = 8; // 一辺 16m
export const POOL_SIZE = POOL_HALF * 2;
export const POOL_DEPTH = 2.2;

/**
 * 水面の形を表す GLSL 共通関数。
 *  - macroWave: うねり（頂点の変位・法線に使う。数 cm の振幅）
 *  - microGradient: さざ波の勾配（法線の細部とコースティクスに使う）
 * 水面の見た目とコースティクスが同じ波から作られるよう、両方のシェーダーがこれを取り込む。
 */
export const WAVE_GLSL = /* glsl */ `
void addSine(vec2 p, float t, vec2 dir, float wl, float amp, float spd, inout float h, inout vec2 g) {
  vec2 d = normalize(dir);
  float k = 6.2831853 / wl;
  float ph = k * (dot(d, p) - spd * t);
  h += amp * sin(ph);
  g += amp * k * cos(ph) * d;
}

// うねり: 戻り値は高さ、g は (dh/dx, dh/dz)
float macroWave(vec2 p, float t, out vec2 g) {
  float h = 0.0;
  g = vec2(0.0);
  addSine(p, t, vec2( 1.00,  0.30), 3.10, 0.030, 0.62, h, g);
  addSine(p, t, vec2(-0.70,  0.80), 1.90, 0.019, 0.50, h, g);
  addSine(p, t, vec2( 0.30, -1.00), 1.15, 0.011, 0.42, h, g);
  addSine(p, t, vec2(-0.80, -0.40), 0.70, 0.006, 0.35, h, g);
  return h;
}

// さざ波: 波長 0.2〜1.1m の 8 成分。深水波の分散関係（速い長波・遅い短波）でゆっくり流す。
vec2 microGradient(vec2 p, float t) {
  // 周期パターンが目立たないよう座標を少し歪ませる
  p += 0.12 * vec2(sin(p.y * 1.7 + t * 0.35), cos(p.x * 1.3 - t * 0.28));
  vec2 g = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float ang = fi * 2.399963 + 0.7;
    vec2 d = vec2(cos(ang), sin(ang));
    float wl = mix(0.20, 1.10, fract(fi * 0.6180339 + 0.13));
    float k = 6.2831853 / wl;
    float w = sqrt(9.8 * k) * 0.30;
    float slope = 0.030 + 0.022 * fract(fi * 0.7071 + 0.31);
    float ph = k * dot(d, p) - w * t + fi * 1.713;
    g += slope * cos(ph) * d;
  }
  return g;
}
`;
