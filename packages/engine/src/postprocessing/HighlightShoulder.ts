/** Hue-preserving HDR shoulder after bloom, before the display conversion.
 * Only enabled by the optional deep-glow profile. Shadows below 0.6 are untouched;
 * scaling by the peak preserves coloured fireworks instead of clipping each channel.
 */
export const HighlightShoulderShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = max(source.rgb, vec3(0.0));
      float peak = max(max(color.r, color.g), color.b);
      float excess = max(peak - 0.6, 0.0);
      float mapped = 0.6 + 0.4 * excess / (0.4 + excess);
      if (peak > 0.6) color *= mapped / peak;
      gl_FragColor = vec4(color, source.a);
    }`,
};
