//#region \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), s = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, c = /* @__PURE__ */ ((n, r, a) => (a = n == null ? {} : e(i(n)), s(r || !n || !n.__esModule ? t(a, "default", {
	value: n,
	enumerable: !0
}) : a, n)))((/* @__PURE__ */ o(((e, t) => {
	(function(n, r) {
		typeof e == "object" && t !== void 0 ? t.exports = r() : typeof define == "function" && define.amd ? define(r) : (n = typeof globalThis < "u" ? globalThis : n || self).Meyda = r();
	})(e, (function() {
		function e(e, t, n) {
			if (n || arguments.length === 2) for (var r, i = 0, a = t.length; i < a; i++) !r && i in t || (r ||= Array.prototype.slice.call(t, 0, i), r[i] = t[i]);
			return e.concat(r || Array.prototype.slice.call(t));
		}
		var t = Object.freeze({
			__proto__: null,
			blackman: function(e) {
				for (var t = new Float32Array(e), n = 2 * Math.PI / (e - 1), r = 2 * n, i = 0; i < e / 2; i++) t[i] = .42 - .5 * Math.cos(i * n) + .08 * Math.cos(i * r);
				for (i = Math.ceil(e / 2); i > 0; i--) t[e - i] = t[i - 1];
				return t;
			},
			hamming: function(e) {
				for (var t = new Float32Array(e), n = 0; n < e; n++) t[n] = .54 - .46 * Math.cos(2 * Math.PI * (n / e - 1));
				return t;
			},
			hanning: function(e) {
				for (var t = new Float32Array(e), n = 0; n < e; n++) t[n] = .5 - .5 * Math.cos(2 * Math.PI * n / (e - 1));
				return t;
			},
			sine: function(e) {
				for (var t = Math.PI / (e - 1), n = new Float32Array(e), r = 0; r < e; r++) n[r] = Math.sin(t * r);
				return n;
			}
		}), n = {};
		function r(e) {
			for (; e % 2 == 0 && e > 1;) e /= 2;
			return e === 1;
		}
		function i(e, r) {
			if (r !== "rect") {
				if (r !== "" && r || (r = "hanning"), n[r] || (n[r] = {}), !n[r][e.length]) try {
					n[r][e.length] = t[r](e.length);
				} catch {
					throw Error("Invalid windowing function");
				}
				e = function(e, t) {
					for (var n = [], r = 0; r < Math.min(e.length, t.length); r++) n[r] = e[r] * t[r];
					return n;
				}(e, n[r][e.length]);
			}
			return e;
		}
		function a(e, t, n) {
			for (var r = new Float32Array(e), i = 0; i < r.length; i++) r[i] = i * t / n, r[i] = 13 * Math.atan(r[i] / 1315.8) + 3.5 * Math.atan((r[i] / 7518) ** 2);
			return r;
		}
		function o(e) {
			return Float32Array.from(e);
		}
		function s(e) {
			return 1125 * Math.log(1 + e / 700);
		}
		function c(e, t, n) {
			for (var r, i = new Float32Array(e + 2), a = new Float32Array(e + 2), o = t / 2, c = s(0), l = (s(o) - c) / (e + 1), u = Array(e + 2), d = 0; d < i.length; d++) i[d] = d * l, a[d] = (r = i[d], 700 * (Math.exp(r / 1125) - 1)), u[d] = Math.floor((n + 1) * a[d] / t);
			for (var f = Array(e), p = 0; p < f.length; p++) {
				for (f[p] = Array(n / 2 + 1).fill(0), d = u[p]; d < u[p + 1]; d++) f[p][d] = (d - u[p]) / (u[p + 1] - u[p]);
				for (d = u[p + 1]; d < u[p + 2]; d++) f[p][d] = (u[p + 2] - d) / (u[p + 2] - u[p + 1]);
			}
			return f;
		}
		function l(t, n, r, i, a, o, s) {
			i === void 0 && (i = 5), a === void 0 && (a = 2), o === void 0 && (o = !0), s === void 0 && (s = 440);
			var c = Math.floor(r / 2) + 1, l = Array(r).fill(0).map((function(e, i) {
				return t * function(e, t) {
					return Math.log2(16 * e / t);
				}(n * i / r, s);
			}));
			l[0] = l[1] - 1.5 * t;
			var u, d, f, p = l.slice(1).map((function(e, t) {
				return Math.max(e - l[t]);
			}), 1).concat([1]), m = Math.round(t / 2), h = Array(t).fill(0).map((function(e, n) {
				return l.map((function(e) {
					return (10 * t + m + e - n) % t - m;
				}));
			})), g = h.map((function(e, t) {
				return e.map((function(e, n) {
					return Math.exp(-.5 * (2 * h[t][n] / p[n]) ** 2);
				}));
			}));
			if (d = (u = g)[0].map((function() {
				return 0;
			})), f = u.reduce((function(e, t) {
				return t.forEach((function(t, n) {
					e[n] += t ** 2;
				})), e;
			}), d).map(Math.sqrt), g = u.map((function(e, t) {
				return e.map((function(e, t) {
					return e / (f[t] || 1);
				}));
			})), a) {
				var _ = l.map((function(e) {
					return Math.exp(-.5 * ((e / t - i) / a) ** 2);
				}));
				g = g.map((function(e) {
					return e.map((function(e, t) {
						return e * _[t];
					}));
				}));
			}
			return o && (g = e(e([], g.slice(3), !0), g.slice(0, 3), !0)), g.map((function(e) {
				return e.slice(0, c);
			}));
		}
		function u(e, t) {
			for (var n = 0, r = 0, i = 0; i < t.length; i++) n += i ** +e * Math.abs(t[i]), r += t[i];
			return n / r;
		}
		function d(e) {
			var t = e.ampSpectrum, n = e.barkScale, r = e.numberOfBarkBands, i = r === void 0 ? 24 : r;
			if (typeof t != "object" || typeof n != "object") throw TypeError();
			var a = i, o = new Float32Array(a), s = 0, c = t, l = new Int32Array(a + 1);
			l[0] = 0;
			for (var u = n[c.length - 1] / a, d = 1, f = 0; f < c.length; f++) for (; n[f] > u;) l[d++] = f, u = d * n[c.length - 1] / a;
			for (l[a] = c.length - 1, f = 0; f < a; f++) {
				for (var p = 0, m = l[f]; m < l[f + 1]; m++) p += c[m];
				o[f] = p ** .23;
			}
			for (f = 0; f < o.length; f++) s += o[f];
			return {
				specific: o,
				total: s
			};
		}
		function f(e) {
			var t = e.ampSpectrum;
			if (typeof t != "object") throw TypeError();
			for (var n = new Float32Array(t.length), r = 0; r < n.length; r++) n[r] = t[r] ** 2;
			return n;
		}
		function p(e) {
			var t = e.ampSpectrum, n = e.melFilterBank, r = e.bufferSize;
			if (typeof t != "object") throw TypeError("Valid ampSpectrum is required to generate melBands");
			if (typeof n != "object") throw TypeError("Valid melFilterBank is required to generate melBands");
			for (var i = f({ ampSpectrum: t }), a = n.length, o = Array(a), s = new Float32Array(a), c = 0; c < s.length; c++) {
				o[c] = new Float32Array(r / 2), s[c] = 0;
				for (var l = 0; l < r / 2; l++) o[c][l] = n[c][l] * i[l], s[c] += o[c][l];
				s[c] = Math.log(s[c] + 1);
			}
			return Array.prototype.slice.call(s);
		}
		function m(e) {
			return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
		}
		var h = null, g = m((function(e, t) {
			var n = e.length;
			return t ||= 2, h && h[n] || function(e) {
				(h ||= {})[e] = Array(e * e);
				for (var t = Math.PI / e, n = 0; n < e; n++) for (var r = 0; r < e; r++) h[e][r + n * e] = Math.cos(t * (r + .5) * n);
			}(n), e.map((function() {
				return 0;
			})).map((function(r, i) {
				return t * e.reduce((function(e, t, r, a) {
					return e + t * h[n][r + i * n];
				}), 0);
			}));
		})), _ = Object.freeze({
			__proto__: null,
			amplitudeSpectrum: function(e) {
				return e.ampSpectrum;
			},
			buffer: function(e) {
				return e.signal;
			},
			chroma: function(e) {
				var t = e.ampSpectrum, n = e.chromaFilterBank;
				if (typeof t != "object") throw TypeError("Valid ampSpectrum is required to generate chroma");
				if (typeof n != "object") throw TypeError("Valid chromaFilterBank is required to generate chroma");
				var r = n.map((function(e, n) {
					return t.reduce((function(t, n, r) {
						return t + n * e[r];
					}), 0);
				})), i = Math.max.apply(Math, r);
				return i ? r.map((function(e) {
					return e / i;
				})) : r;
			},
			complexSpectrum: function(e) {
				return e.complexSpectrum;
			},
			energy: function(e) {
				var t = e.signal;
				if (typeof t != "object") throw TypeError();
				for (var n = 0, r = 0; r < t.length; r++) n += Math.abs(t[r]) ** 2;
				return n;
			},
			loudness: d,
			melBands: p,
			mfcc: function(e) {
				var t = e.ampSpectrum, n = e.melFilterBank, r = e.numberOfMFCCCoefficients, i = e.bufferSize, a = Math.min(40, Math.max(1, r || 13));
				if (n.length < a) throw Error("Insufficient filter bank for requested number of coefficients");
				return g(p({
					ampSpectrum: t,
					melFilterBank: n,
					bufferSize: i
				})).slice(0, a);
			},
			perceptualSharpness: function(e) {
				for (var t = d({
					ampSpectrum: e.ampSpectrum,
					barkScale: e.barkScale
				}), n = t.specific, r = 0, i = 0; i < n.length; i++) r += i < 15 ? (i + 1) * n[i + 1] : .066 * Math.exp(.171 * (i + 1));
				return r *= .11 / t.total;
			},
			perceptualSpread: function(e) {
				for (var t = d({
					ampSpectrum: e.ampSpectrum,
					barkScale: e.barkScale
				}), n = 0, r = 0; r < t.specific.length; r++) t.specific[r] > n && (n = t.specific[r]);
				return ((t.total - n) / t.total) ** 2;
			},
			powerSpectrum: f,
			rms: function(e) {
				var t = e.signal;
				if (typeof t != "object") throw TypeError();
				for (var n = 0, r = 0; r < t.length; r++) n += t[r] ** 2;
				return n /= t.length, n = Math.sqrt(n);
			},
			spectralCentroid: function(e) {
				var t = e.ampSpectrum;
				if (typeof t != "object") throw TypeError();
				return u(1, t);
			},
			spectralCrest: function(e) {
				var t = e.ampSpectrum;
				if (typeof t != "object") throw TypeError();
				var n = 0, r = -Infinity;
				return t.forEach((function(e) {
					n += e ** 2, r = e > r ? e : r;
				})), n /= t.length, n = Math.sqrt(n), r / n;
			},
			spectralFlatness: function(e) {
				var t = e.ampSpectrum;
				if (typeof t != "object") throw TypeError();
				for (var n = 0, r = 0, i = 0; i < t.length; i++) n += Math.log(t[i]), r += t[i];
				return Math.exp(n / t.length) * t.length / r;
			},
			spectralFlux: function(e) {
				var t = e.signal, n = e.previousSignal, r = e.bufferSize;
				if (typeof t != "object" || typeof n != "object") throw TypeError();
				for (var i = 0, a = -r / 2; a < t.length / 2 - 1; a++) x = Math.abs(t[a]) - Math.abs(n[a]), i += (x + Math.abs(x)) / 2;
				return i;
			},
			spectralKurtosis: function(e) {
				var t = e.ampSpectrum;
				if (typeof t != "object") throw TypeError();
				var n = t, r = u(1, n), i = u(2, n), a = u(3, n), o = u(4, n);
				return (-3 * r ** 4 + 6 * r * i - 4 * r * a + o) / Math.sqrt(i - r ** 2) ** 4;
			},
			spectralRolloff: function(e) {
				var t = e.ampSpectrum, n = e.sampleRate;
				if (typeof t != "object") throw TypeError();
				for (var r = t, i = n / (2 * (r.length - 1)), a = 0, o = 0; o < r.length; o++) a += r[o];
				for (var s = .99 * a, c = r.length - 1; a > s && c >= 0;) a -= r[c], --c;
				return (c + 1) * i;
			},
			spectralSkewness: function(e) {
				var t = e.ampSpectrum;
				if (typeof t != "object") throw TypeError();
				var n = u(1, t), r = u(2, t), i = u(3, t);
				return (2 * n ** 3 - 3 * n * r + i) / Math.sqrt(r - n ** 2) ** 3;
			},
			spectralSlope: function(e) {
				var t = e.ampSpectrum, n = e.sampleRate, r = e.bufferSize;
				if (typeof t != "object") throw TypeError();
				for (var i = 0, a = 0, o = new Float32Array(t.length), s = 0, c = 0, l = 0; l < t.length; l++) {
					i += t[l];
					var u = l * n / r;
					o[l] = u, s += u * u, a += u, c += u * t[l];
				}
				return (t.length * c - a * i) / (i * (s - a ** 2));
			},
			spectralSpread: function(e) {
				var t = e.ampSpectrum;
				if (typeof t != "object") throw TypeError();
				return Math.sqrt(u(2, t) - u(1, t) ** 2);
			},
			zcr: function(e) {
				var t = e.signal;
				if (typeof t != "object") throw TypeError();
				for (var n = 0, r = 1; r < t.length; r++) (t[r - 1] >= 0 && t[r] < 0 || t[r - 1] < 0 && t[r] >= 0) && n++;
				return n;
			}
		});
		function v(e) {
			if (Array.isArray(e)) {
				for (var t = 0, n = Array(e.length); t < e.length; t++) n[t] = e[t];
				return n;
			}
			return Array.from(e);
		}
		var y = {}, b = {}, S = {
			bitReverseArray: function(e) {
				if (y[e] === void 0) {
					for (var t = (e - 1).toString(2).length, n = "0".repeat(t), r = {}, i = 0; i < e; i++) {
						var a = i.toString(2);
						a = n.substr(a.length) + a, a = [].concat(v(a)).reverse().join(""), r[i] = parseInt(a, 2);
					}
					y[e] = r;
				}
				return y[e];
			},
			multiply: function(e, t) {
				return {
					real: e.real * t.real - e.imag * t.imag,
					imag: e.real * t.imag + e.imag * t.real
				};
			},
			add: function(e, t) {
				return {
					real: e.real + t.real,
					imag: e.imag + t.imag
				};
			},
			subtract: function(e, t) {
				return {
					real: e.real - t.real,
					imag: e.imag - t.imag
				};
			},
			euler: function(e, t) {
				var n = -2 * Math.PI * e / t;
				return {
					real: Math.cos(n),
					imag: Math.sin(n)
				};
			},
			conj: function(e) {
				return e.imag *= -1, e;
			},
			constructComplexArray: function(e) {
				var t = {};
				t.real = e.real === void 0 ? e.slice() : e.real.slice();
				var n = t.real.length;
				return b[n] === void 0 && (b[n] = Array.apply(null, Array(n)).map(Number.prototype.valueOf, 0)), t.imag = b[n].slice(), t;
			}
		}, C = function(e) {
			var t = {};
			e.real === void 0 || e.imag === void 0 ? t = S.constructComplexArray(e) : (t.real = e.real.slice(), t.imag = e.imag.slice());
			var n = t.real.length, r = Math.log2(n);
			if (Math.round(r) != r) throw Error("Input size must be a power of 2.");
			if (t.real.length != t.imag.length) throw Error("Real and imaginary components must have the same length.");
			for (var i = S.bitReverseArray(n), a = {
				real: [],
				imag: []
			}, o = 0; o < n; o++) a.real[i[o]] = t.real[o], a.imag[i[o]] = t.imag[o];
			for (var s = 0; s < n; s++) t.real[s] = a.real[s], t.imag[s] = a.imag[s];
			for (var c = 1; c <= r; c++) for (var l = 2 ** c, u = 0; u < l / 2; u++) for (var d = S.euler(u, l), f = 0; f < n / l; f++) {
				var p = l * f + u, m = l * f + u + l / 2, h = {
					real: t.real[p],
					imag: t.imag[p]
				}, g = {
					real: t.real[m],
					imag: t.imag[m]
				}, _ = S.multiply(d, g), v = S.subtract(h, _);
				t.real[m] = v.real, t.imag[m] = v.imag;
				var y = S.add(_, h);
				t.real[p] = y.real, t.imag[p] = y.imag;
			}
			return t;
		}, w = function() {
			function e(e, t) {
				var n = this;
				if (this._m = t, !e.audioContext) throw this._m.errors.noAC;
				if (e.bufferSize && !r(e.bufferSize)) throw this._m._errors.notPow2;
				if (!e.source) throw this._m._errors.noSource;
				this._m.audioContext = e.audioContext, this._m.bufferSize = e.bufferSize || this._m.bufferSize || 256, this._m.hopSize = e.hopSize || this._m.hopSize || this._m.bufferSize, this._m.sampleRate = e.sampleRate || this._m.audioContext.sampleRate || 44100, this._m.callback = e.callback, this._m.windowingFunction = e.windowingFunction || "hanning", this._m.featureExtractors = _, this._m.EXTRACTION_STARTED = e.startImmediately || !1, this._m.channel = typeof e.channel == "number" ? e.channel : 0, this._m.inputs = e.inputs || 1, this._m.outputs = e.outputs || 1, this._m.numberOfMFCCCoefficients = e.numberOfMFCCCoefficients || this._m.numberOfMFCCCoefficients || 13, this._m.numberOfBarkBands = e.numberOfBarkBands || this._m.numberOfBarkBands || 24, this._m.spn = this._m.audioContext.createScriptProcessor(this._m.bufferSize, this._m.inputs, this._m.outputs), this._m.spn.connect(this._m.audioContext.destination), this._m._featuresToExtract = e.featureExtractors || [], this._m.barkScale = a(this._m.bufferSize, this._m.sampleRate, this._m.bufferSize), this._m.melFilterBank = c(Math.max(this._m.melBands, this._m.numberOfMFCCCoefficients), this._m.sampleRate, this._m.bufferSize), this._m.inputData = null, this._m.previousInputData = null, this._m.frame = null, this._m.previousFrame = null, this.setSource(e.source), this._m.spn.onaudioprocess = function(e) {
					var t;
					n._m.inputData !== null && (n._m.previousInputData = n._m.inputData), n._m.inputData = e.inputBuffer.getChannelData(n._m.channel), n._m.previousInputData ? ((t = new Float32Array(n._m.previousInputData.length + n._m.inputData.length - n._m.hopSize)).set(n._m.previousInputData.slice(n._m.hopSize)), t.set(n._m.inputData, n._m.previousInputData.length - n._m.hopSize)) : t = n._m.inputData, (function(e, t, n) {
						if (e.length < t) throw Error("Buffer is too short for frame length");
						if (n < 1) throw Error("Hop length cannot be less that 1");
						if (t < 1) throw Error("Frame length cannot be less that 1");
						var r = 1 + Math.floor((e.length - t) / n);
						return Array(r).fill(0).map((function(r, i) {
							return e.slice(i * n, i * n + t);
						}));
					})(t, n._m.bufferSize, n._m.hopSize).forEach((function(e) {
						n._m.frame = e;
						var t = n._m.extract(n._m._featuresToExtract, n._m.frame, n._m.previousFrame);
						typeof n._m.callback == "function" && n._m.EXTRACTION_STARTED && n._m.callback(t), n._m.previousFrame = n._m.frame;
					}));
				};
			}
			return e.prototype.start = function(e) {
				this._m._featuresToExtract = e || this._m._featuresToExtract, this._m.EXTRACTION_STARTED = !0;
			}, e.prototype.stop = function() {
				this._m.EXTRACTION_STARTED = !1;
			}, e.prototype.setSource = function(e) {
				this._m.source && this._m.source.disconnect(this._m.spn), this._m.source = e, this._m.source.connect(this._m.spn);
			}, e.prototype.setChannel = function(e) {
				e <= this._m.inputs ? this._m.channel = e : console.error(`Channel ${e} does not exist. Make sure you've provided a value for 'inputs' that is greater than ${e} when instantiating the MeydaAnalyzer`);
			}, e.prototype.get = function(e) {
				return this._m.inputData ? this._m.extract(e || this._m._featuresToExtract, this._m.inputData, this._m.previousInputData) : null;
			}, e;
		}(), T = {
			audioContext: null,
			spn: null,
			bufferSize: 512,
			sampleRate: 44100,
			melBands: 26,
			chromaBands: 12,
			callback: null,
			windowingFunction: "hanning",
			featureExtractors: _,
			EXTRACTION_STARTED: !1,
			numberOfMFCCCoefficients: 13,
			numberOfBarkBands: 24,
			_featuresToExtract: [],
			windowing: i,
			_errors: {
				notPow2: /* @__PURE__ */ Error("Meyda: Buffer size must be a power of 2, e.g. 64 or 512"),
				featureUndef: /* @__PURE__ */ Error("Meyda: No features defined."),
				invalidFeatureFmt: /* @__PURE__ */ Error("Meyda: Invalid feature format"),
				invalidInput: /* @__PURE__ */ Error("Meyda: Invalid input."),
				noAC: /* @__PURE__ */ Error("Meyda: No AudioContext specified."),
				noSource: /* @__PURE__ */ Error("Meyda: No source node specified.")
			},
			createMeydaAnalyzer: function(e) {
				return new w(e, Object.assign({}, T));
			},
			listAvailableFeatureExtractors: function() {
				return Object.keys(this.featureExtractors);
			},
			extract: function(e, t, n) {
				var i = this;
				if (!t || typeof t != "object") throw this._errors.invalidInput;
				if (!e) throw this._errors.featureUndef;
				if (!r(t.length)) throw this._errors.notPow2;
				this.barkScale !== void 0 && this.barkScale.length == this.bufferSize || (this.barkScale = a(this.bufferSize, this.sampleRate, this.bufferSize)), this.melFilterBank !== void 0 && this.barkScale.length == this.bufferSize && this.melFilterBank.length == this.melBands || (this.melFilterBank = c(Math.max(this.melBands, this.numberOfMFCCCoefficients), this.sampleRate, this.bufferSize)), this.chromaFilterBank !== void 0 && this.chromaFilterBank.length == this.chromaBands || (this.chromaFilterBank = l(this.chromaBands, this.sampleRate, this.bufferSize)), "buffer" in t && t.buffer === void 0 ? this.signal = o(t) : this.signal = t;
				var s = E(t, this.windowingFunction, this.bufferSize);
				if (this.signal = s.windowedSignal, this.complexSpectrum = s.complexSpectrum, this.ampSpectrum = s.ampSpectrum, n) {
					var u = E(n, this.windowingFunction, this.bufferSize);
					this.previousSignal = u.windowedSignal, this.previousComplexSpectrum = u.complexSpectrum, this.previousAmpSpectrum = u.ampSpectrum;
				}
				var d = function(e) {
					return i.featureExtractors[e]({
						ampSpectrum: i.ampSpectrum,
						chromaFilterBank: i.chromaFilterBank,
						complexSpectrum: i.complexSpectrum,
						signal: i.signal,
						bufferSize: i.bufferSize,
						sampleRate: i.sampleRate,
						barkScale: i.barkScale,
						melFilterBank: i.melFilterBank,
						previousSignal: i.previousSignal,
						previousAmpSpectrum: i.previousAmpSpectrum,
						previousComplexSpectrum: i.previousComplexSpectrum,
						numberOfMFCCCoefficients: i.numberOfMFCCCoefficients,
						numberOfBarkBands: i.numberOfBarkBands
					});
				};
				if (typeof e == "object") return e.reduce((function(e, t) {
					var n;
					return Object.assign({}, e, ((n = {})[t] = d(t), n));
				}), {});
				if (typeof e == "string") return d(e);
				throw this._errors.invalidFeatureFmt;
			}
		}, E = function(e, t, n) {
			var r = {};
			e.buffer === void 0 ? r.signal = o(e) : r.signal = e, r.windowedSignal = i(r.signal, t), r.complexSpectrum = C(r.windowedSignal), r.ampSpectrum = new Float32Array(n / 2);
			for (var a = 0; a < n / 2; a++) r.ampSpectrum[a] = Math.sqrt(r.complexSpectrum.real[a] ** 2 + r.complexSpectrum.imag[a] ** 2);
			return r;
		};
		return typeof window < "u" && (window.Meyda = T), T;
	}));
})))(), 1);
function l(e) {
	if (!e || e.startsWith("blob:") || e.startsWith("data:") || e.startsWith("http://") || e.startsWith("https://")) return e;
	let t = "./".endsWith("/") ? "./" : ".//";
	return e.startsWith(t) ? e : t.startsWith("/") && e.startsWith(t.slice(1)) ? `/${e}` : `${t}${e.startsWith("/") ? e.slice(1) : e}`;
}
//#endregion
//#region src/AudioLipSync.ts
var u = [
	"aa",
	"ee",
	"ih",
	"oh",
	"ou"
], d = {
	female: {
		aa: [
			40.1,
			-17.3,
			-26.1,
			-25.5,
			-25.8,
			-.4,
			31,
			14,
			-19.7,
			-16.3,
			1.9,
			-.8
		],
		ih: [
			29,
			-9.1,
			33.6,
			30,
			-19.4,
			-25.7,
			-13.7,
			-21.1,
			-20.7,
			-22.1,
			-25.5,
			-8.8
		],
		ou: [
			53.9,
			28.5,
			12.6,
			-13.5,
			-10,
			-5.5,
			-16.7,
			-26.4,
			-29.3,
			-22.5,
			-9.9,
			6.4
		],
		ee: [
			31.4,
			-30.1,
			-8.7,
			-1.4,
			-19.5,
			-31.1,
			-6.6,
			-4.2,
			-7.6,
			-1.7,
			1.7,
			-.9
		],
		oh: [
			42.2,
			-2,
			-20.1,
			-29.6,
			-31.4,
			-11.9,
			12.9,
			5.5,
			-13.1,
			-10.1,
			2.9,
			5.5
		]
	},
	male: {
		aa: [
			81.9,
			28.8,
			1.1,
			-5.1,
			-14.3,
			-18.9,
			-.2,
			25.2,
			25.2,
			4.9,
			-5.5,
			.7
		],
		ih: [
			46.6,
			1.3,
			4.5,
			40.4,
			47,
			11.1,
			-18.3,
			-10.1,
			8.5,
			7.1,
			-7.1,
			-13.6
		],
		ou: [
			56.4,
			32.2,
			20.4,
			23.6,
			27.6,
			21.1,
			7.3,
			-5.1,
			-12.4,
			-13.6,
			-8.9,
			-3.4
		],
		ee: [
			55.8,
			11.6,
			14.8,
			32.4,
			39.6,
			16.4,
			-14.8,
			-13.8,
			-8,
			-7.8,
			3.6,
			4.4
		],
		oh: [
			68.5,
			36.1,
			19.7,
			3.8,
			-17.3,
			-30.5,
			-27.2,
			-8.5,
			5.5,
			.5,
			-4.5,
			2.5
		]
	}
}, f = {
	female: {
		aa: {
			f1: [750, 1200],
			f2: [1300, 1750]
		},
		ih: {
			f1: [260, 450],
			f2: [2500, 3600]
		},
		ou: {
			f1: [280, 500],
			f2: [900, 1600]
		},
		ee: {
			f1: [400, 680],
			f2: [2e3, 2900]
		},
		oh: {
			f1: [450, 750],
			f2: [900, 1500]
		}
	},
	male: {
		aa: {
			f1: [600, 950],
			f2: [1050, 1550]
		},
		ih: {
			f1: [200, 380],
			f2: [2e3, 3e3]
		},
		ou: {
			f1: [220, 420],
			f2: [750, 1300]
		},
		ee: {
			f1: [350, 580],
			f2: [1700, 2500]
		},
		oh: {
			f1: [380, 620],
			f2: [750, 1250]
		}
	}
}, p = class {
	audioContext = null;
	audioElement;
	currentPhoneme = void 0;
	currentRms = 0;
	isPlaying = !1;
	isMicrophoneActive = !1;
	rmsThreshold = .008;
	rmsReleaseThreshold = .003;
	holdFrames = 12;
	micGainValue = 2.5;
	audioDelay = .05;
	voiceGender = "female";
	audioTitle = "";
	minTimeMs = Infinity;
	maxTimeMs = 0;
	totalTimeMs = 0;
	sampleCount = 0;
	micStream = null;
	micSourceNode = null;
	micGainNode = null;
	smoothedRms = 0;
	silenceHoldCounter = 0;
	isVoicing = !1;
	lastStats = {
		processingTimeMs: 0,
		minTimeMs: 0,
		maxTimeMs: 0,
		avgTimeMs: 0,
		count: 0,
		rms: 0,
		f1: 0,
		f2: 0,
		distances: {
			aa: 0,
			ee: 0,
			ih: 0,
			oh: 0,
			ou: 0
		},
		phoneme: "nn"
	};
	analyzerNode = null;
	analysisBuffer = null;
	analysisFrameId = null;
	sourceNode = null;
	delayNode = null;
	gainNode = null;
	pannerNode = null;
	currentPan = 0;
	events = {};
	objectUrlToRevoke = null;
	constructor(e = {}) {
		this.events = e, this.audioElement = new Audio(), this.audioElement.crossOrigin = "anonymous", this.audioElement.addEventListener("timeupdate", () => {
			this.events.onTimeUpdate && this.events.onTimeUpdate(this.audioElement.currentTime, this.audioElement.duration || 0);
		}), this.audioElement.addEventListener("ended", () => {
			this.isPlaying = !1, this.currentPhoneme = "nn", this.events.onPhonemeChange && this.events.onPhonemeChange("nn"), this.events.onPlayStateChange && this.events.onPlayStateChange(!1), this.events.onEnded && this.events.onEnded();
		}), this.audioElement.addEventListener("pause", () => {
			this.isPlaying = !1, this.currentPhoneme = "nn", this.events.onPhonemeChange && this.events.onPhonemeChange("nn"), this.events.onPlayStateChange && this.events.onPlayStateChange(!1);
		}), this.audioElement.addEventListener("play", () => {
			this.isPlaying = !0, this.events.onPlayStateChange && this.events.onPlayStateChange(!0);
		}), this.audioElement.addEventListener("error", (e) => {
			console.error("Audio playback error:", e), this.isPlaying = !1, this.events.onError && this.events.onError(/* @__PURE__ */ Error("Audio playback failed"));
		});
	}
	setVoiceGender(e) {
		this.voiceGender = e;
	}
	setMicGain(e) {
		this.micGainValue = Math.max(.2, Math.min(10, e)), this.micGainNode && this.audioContext && this.micGainNode.gain.setValueAtTime(this.micGainValue, this.audioContext.currentTime);
	}
	setHoldTime(e) {
		this.holdFrames = Math.max(1, Math.round(e / 16.6));
	}
	setAudioDelay(e) {
		this.audioDelay = Math.max(0, Math.min(1, e)), this.delayNode && this.audioContext && this.delayNode.delayTime.setValueAtTime(this.audioDelay, this.audioContext.currentTime);
	}
	initAudioContext() {
		this.audioContext || (this.audioContext = new (window.AudioContext || window.webkitAudioContext)(), this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement), this.analyzerNode = this.audioContext.createAnalyser(), this.analyzerNode.fftSize = 1024, this.analyzerNode.smoothingTimeConstant = 0, this.analysisBuffer = new Float32Array(this.analyzerNode.fftSize), this.delayNode = this.audioContext.createDelay(1), this.delayNode.delayTime.setValueAtTime(this.audioDelay, this.audioContext.currentTime), this.gainNode = this.audioContext.createGain(), typeof this.audioContext.createStereoPanner == "function" && (this.pannerNode = this.audioContext.createStereoPanner(), this.pannerNode.pan.setValueAtTime(this.currentPan, this.audioContext.currentTime)), this.sourceNode.connect(this.delayNode), this.delayNode.connect(this.gainNode), this.pannerNode ? (this.gainNode.connect(this.pannerNode), this.pannerNode.connect(this.audioContext.destination)) : this.gainNode.connect(this.audioContext.destination), this.sourceNode.connect(this.analyzerNode), c.default.bufferSize = this.analyzerNode.fftSize, c.default.sampleRate = this.audioContext.sampleRate, this.scheduleAnalysis());
	}
	getStats() {
		return {
			...this.lastStats,
			distances: { ...this.lastStats.distances }
		};
	}
	resetStats() {
		this.minTimeMs = Infinity, this.maxTimeMs = 0, this.totalTimeMs = 0, this.sampleCount = 0, this.lastStats = {
			processingTimeMs: 0,
			minTimeMs: 0,
			maxTimeMs: 0,
			avgTimeMs: 0,
			count: 0,
			rms: 0,
			f1: 0,
			f2: 0,
			distances: {
				aa: 0,
				ee: 0,
				ih: 0,
				oh: 0,
				ou: 0
			},
			phoneme: "nn"
		}, this.events.onStatsUpdate?.(this.getStats());
	}
	updateStats(e, t, n, r, i, a) {
		this.sampleCount++, this.totalTimeMs += e, e < this.minTimeMs && (this.minTimeMs = e), e > this.maxTimeMs && (this.maxTimeMs = e);
		let o = this.totalTimeMs / this.sampleCount;
		this.lastStats = {
			processingTimeMs: e,
			minTimeMs: this.minTimeMs === Infinity ? 0 : this.minTimeMs,
			maxTimeMs: this.maxTimeMs,
			avgTimeMs: o,
			count: this.sampleCount,
			rms: t,
			f1: r,
			f2: i,
			distances: a,
			phoneme: n
		}, this.events.onStatsUpdate && this.events.onStatsUpdate(this.lastStats);
	}
	async startMicrophone() {
		if (this.initAudioContext(), this.audioContext && this.audioContext.state === "suspended" && await this.audioContext.resume(), this.isPlaying && !this.isMicrophoneActive && this.audioElement.pause(), !navigator.mediaDevices?.getUserMedia) throw Error("getUserMedia is not supported in this browser environment");
		this.micStream = await navigator.mediaDevices.getUserMedia({ audio: {
			echoCancellation: !1,
			noiseSuppression: !1,
			autoGainControl: !0
		} }), this.audioContext && this.analyzerNode && (this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream), this.micGainNode = this.audioContext.createGain(), this.micGainNode.gain.setValueAtTime(this.micGainValue, this.audioContext.currentTime), this.micSourceNode.connect(this.micGainNode), this.micGainNode.connect(this.analyzerNode)), this.silenceHoldCounter = 0, this.smoothedRms = 0, this.isVoicing = !1, this.isMicrophoneActive = !0, this.isPlaying = !0, this.events.onPlayStateChange && this.events.onPlayStateChange(!0);
	}
	stopMicrophone() {
		if (this.micSourceNode) {
			try {
				this.micGainNode ? (this.micSourceNode.disconnect(this.micGainNode), this.micGainNode.disconnect()) : this.analyzerNode && this.micSourceNode.disconnect(this.analyzerNode);
			} catch {}
			this.micSourceNode = null, this.micGainNode = null;
		}
		this.micStream &&= (this.micStream.getTracks().forEach((e) => e.stop()), null), this.isMicrophoneActive = !1, this.silenceHoldCounter = 0, this.smoothedRms = 0, this.isVoicing = !1, this.audioElement.paused && (this.isPlaying = !1, this.currentPhoneme = "nn", this.events.onPhonemeChange?.("nn"), this.events.onPlayStateChange && this.events.onPlayStateChange(!1));
	}
	scheduleAnalysis() {
		this.analysisFrameId = requestAnimationFrame(() => {
			this.analysisFrameId = null, this.analyzeCurrentFrame(), this.audioContext?.state !== "closed" && this.scheduleAnalysis();
		});
	}
	analyzeCurrentFrame() {
		if (!this.isPlaying || !this.analyzerNode || !this.analysisBuffer) return;
		let e = performance.now();
		this.analyzerNode.getFloatTimeDomainData(this.analysisBuffer);
		let t = c.default.extract([
			"mfcc",
			"rms",
			"powerSpectrum"
		], this.analysisBuffer), n = t?.rms ?? 0;
		this.smoothedRms = this.smoothedRms * .6 + n * .4;
		let r = Math.max(n, this.smoothedRms);
		if (this.currentRms = r, this.isVoicing ? r < this.rmsReleaseThreshold ? this.silenceHoldCounter > 0 ? this.silenceHoldCounter-- : this.isVoicing = !1 : this.silenceHoldCounter = this.holdFrames : r >= this.rmsThreshold && (this.isVoicing = !0, this.silenceHoldCounter = this.holdFrames), !this.isVoicing) {
			this.currentPhoneme !== "nn" && (this.currentPhoneme = "nn", this.events.onPhonemeChange?.("nn"));
			let t = performance.now();
			this.updateStats(t - e, r, "nn", 0, 0, {
				aa: 99,
				ee: 99,
				ih: 99,
				oh: 99,
				ou: 99
			});
			return;
		}
		let i = t?.powerSpectrum;
		if (i && i.length > 0 && n >= this.rmsReleaseThreshold) {
			let { phoneme: n, f1: a, f2: o, distances: s } = this.guessPhonemeDetailed(t.mfcc, i);
			this.currentPhoneme !== n && (this.currentPhoneme = n, this.events.onPhonemeChange?.(n));
			let c = performance.now();
			this.updateStats(c - e, r, n, a, o, s);
		} else {
			let t = performance.now();
			this.updateStats(t - e, r, this.currentPhoneme || "nn", this.lastStats.f1, this.lastStats.f2, this.lastStats.distances);
		}
	}
	guessPhonemeDetailed(e, t) {
		let n = {
			aa: 99,
			ee: 99,
			ih: 99,
			oh: 99,
			ou: 99
		};
		if (!t || t.length === 0 || !this.audioContext) return {
			phoneme: "nn",
			f1: 0,
			f2: 0,
			distances: n
		};
		let r = d[this.voiceGender] || d.female, i = "nn", a = Infinity, o = { ...n };
		if (e && e.length >= 13) for (let t of u) {
			let n = r[t], s = 0;
			for (let t = 0; t < 12; t++) {
				let r = (e[t + 1] ?? 0) - n[t];
				s += r * r;
			}
			let c = Math.sqrt(s);
			this.currentPhoneme === t && (c *= .82), o[t] = Math.round(c / 50 * 100) / 100, c < a && (a = c, i = t);
		}
		let s = this.analyzerNode ? this.analyzerNode.fftSize : 1024, c = this.audioContext.sampleRate / s, l = t.length, p = Math.max(3, Math.round(360 / (2 * c))), m = new Float32Array(l);
		for (let e = 0; e < l; e++) {
			let n = 0, r = 0;
			for (let i = -p; i <= p; i++) {
				let a = e + i;
				a >= 0 && a < l && (n += t[a], r++);
			}
			m[e] = n / (r || 1);
		}
		let h = f[this.voiceGender] || f.female, g = i === "nn" ? h.aa : h[i], _ = (e, t) => {
			let n = Math.round(e / c), r = Math.round(t / c), i = n, a = -1;
			for (let e = n; e <= r; e++) m[e] > a && (a = m[e], i = e);
			return Math.round(i * c);
		}, v = _(g.f1[0], g.f1[1]), y = _(g.f2[0], g.f2[1]);
		return {
			phoneme: i,
			f1: v,
			f2: y,
			distances: o
		};
	}
	guessPhoneme(e, t) {
		return this.guessPhonemeDetailed(e, t).phoneme;
	}
	guessPhonemeMfcc(e) {
		return this.guessPhoneme(e);
	}
	loadAudioFile(e) {
		this.objectUrlToRevoke &&= (URL.revokeObjectURL(this.objectUrlToRevoke), null);
		let t = URL.createObjectURL(e);
		this.objectUrlToRevoke = t, this.audioTitle = e.name, this.loadAudioUrl(t, e.name);
	}
	setPan(e) {
		this.currentPan = Math.max(-1, Math.min(1, e)), this.pannerNode && this.audioContext && (this.pannerNode.pan.value = this.currentPan, this.pannerNode.pan.setValueAtTime(this.currentPan, this.audioContext.currentTime));
	}
	loadAudioUrl(e, t, n) {
		this.initAudioContext(), this.setPan(typeof n == "number" ? n : 0);
		let r = l(e);
		this.audioTitle = t || e.split("/").pop() || "Audio Track", this.audioElement.src = r, this.audioElement.load(), this.currentPhoneme = "nn", this.events.onPhonemeChange && this.events.onPhonemeChange("nn");
	}
	async play() {
		this.initAudioContext(), this.audioContext && this.audioContext.state === "suspended" && await this.audioContext.resume();
		try {
			await this.audioElement.play(), this.isPlaying = !0;
		} catch (e) {
			console.warn("Audio play request failed or interrupted:", e);
		}
	}
	pause() {
		this.audioElement.pause(), this.isPlaying = !1, this.currentPhoneme = "nn", this.events.onPhonemeChange?.("nn");
	}
	stop() {
		this.isMicrophoneActive && this.stopMicrophone(), this.audioElement.pause(), this.audioElement.currentTime = 0, this.isPlaying = !1, this.currentPhoneme = "nn", this.events.onPhonemeChange?.("nn"), this.events.onPlayStateChange?.(!1);
	}
	seek(e) {
		Number.isFinite(e) && (this.audioElement.currentTime = Math.max(0, Math.min(e, this.audioElement.duration || 0)));
	}
	setVolume(e) {
		this.audioElement.volume = Math.max(0, Math.min(1, e));
	}
	setLoop(e) {
		this.audioElement.loop = e;
	}
	dispose() {
		this.stop(), this.stopMicrophone(), this.analysisFrameId !== null && (cancelAnimationFrame(this.analysisFrameId), this.analysisFrameId = null), this.analysisBuffer = null, this.analyzerNode?.disconnect(), this.analyzerNode = null, this.objectUrlToRevoke &&= (URL.revokeObjectURL(this.objectUrlToRevoke), null), this.audioContext && this.audioContext.state !== "closed" && (this.audioContext.close(), this.audioContext = null);
	}
};
//#endregion
export { p as AudioLipSync, u as PHONEMES };
