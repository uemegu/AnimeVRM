export const VOWELS = ['aa', 'ih', 'ou', 'ee', 'oh'];
const clamp = (x, fallback = 0) => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : fallback;

// The articulation distribution and the opening envelope have independent
// time constants. A vowel change never queues a closed-mouth frame.
export class ExpressionController {
  constructor() {
    this.mix = [1, 0, 0, 0, 0];
    this.target = [...this.mix];
    this.open = 0;
    this.targetOpen = 0;
    this.silence = 1;
    this.blush = 0;
    this.targetBlush = 0;
  }
  setVisemes(weights = {}, openness) {
    const values = VOWELS.map(v => clamp(weights[v]));
    const sum = values.reduce((a,b) => a+b,0);
    this.targetOpen = clamp(openness, Math.min(1, sum));
    if (sum > 0) this.target = values.map(v => v / sum);
    if (this.targetOpen > 0) this.silence = 0;
  }
  setPhoneme(phoneme, openness = 1) {
    this.setVisemes(VOWELS.includes(phoneme) ? {[phoneme]:1} : {}, VOWELS.includes(phoneme) ? openness : 0);
  }
  setBlush(value) { this.targetBlush = clamp(value); }
  stopSpeaking() { this.targetOpen = 0; this.silence = 1; }
  update(dt) {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    if (this.targetOpen === 0) this.silence += dt;
    const target = this.targetOpen === 0 && this.silence < .10 ? this.open : this.targetOpen;
    const articulation = 1-Math.exp(-dt/.065);
    this.mix = this.mix.map((v,i) => v+(this.target[i]-v)*articulation);
    this.open += (target-this.open)*(1-Math.exp(-dt/(target>this.open?.045:.11)));
    this.blush += (this.targetBlush-this.blush)*(1-Math.exp(-dt/.24));
    return this.state;
  }
  get state() {
    const ambiguity = Math.min(1, (1-Math.max(...this.mix))*2);
    // At a full-volume vowel handover the half-open sprites dominate.
    const openness = this.open*(1-.5*ambiguity);
    const half = openness <= .5 ? 2*openness : 2*(1-openness);
    const full = Math.max(0, 2*openness-1);
    const weights = Object.fromEntries(VOWELS.flatMap((v,i)=>[[`mouth_${v}_half`,half*this.mix[i]],[`mouth_${v}`,full*this.mix[i]]]));
    return {weights,rest:Math.max(0,1-2*openness),openness,inputOpenness:this.open,vowels:Object.fromEntries(VOWELS.map((v,i)=>[v,this.mix[i]])),blush:this.blush};
  }
}

// Continuous triangular basis: an actual half-eye drawing, not a direct
// open/closed dissolve. Weights always sum to one.
export function blinkWeights(closure) {
  const x=clamp(closure);
  return {open:Math.max(0,1-2*x),half:1-Math.abs(2*x-1),closed:Math.max(0,2*x-1)};
}
