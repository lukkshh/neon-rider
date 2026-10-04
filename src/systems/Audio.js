/**
 * Audio Engine using Web Audio API
 * Generates all sound effects and procedural synthwave background music
 * No external audio files required!
 */
export class SoundController {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.musicPlaying = false;
        this.engineOsc = null;
        this.engineSubOsc = null;
        this.engineGain = null;
        this.engineFilter = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        
        // Music sequencer state
        this.musicInterval = null;
        this.currentStep = 0;
        this.tempo = 124; // BPM
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            
            // Master gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.isMuted ? 0 : 0.8;
            this.masterGain.connect(this.ctx.destination);

            // SFX gain
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.9;
            this.sfxGain.connect(this.masterGain);

            // Music gain
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.45;
            this.musicGain.connect(this.masterGain);

            this.setupEngineSound();
            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported or blocked", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime, 0.05);
        }
        return this.isMuted;
    }

    /* ---------------- ENGINE SYNTHESIS ---------------- */
    setupEngineSound() {
        if (!this.ctx) return;

        // Dual oscillator for rich mechanical rumble
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

        this.engineSubOsc = this.ctx.createOscillator();
        this.engineSubOsc.type = 'triangle';
        this.engineSubOsc.frequency.setValueAtTime(22.5, this.ctx.currentTime);

        // Lowpass filter to simulate engine chamber
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
        this.engineFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

        // Distortion / WaveShaper for extra grit
        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.makeDistortionCurve(15);

        this.engineOsc.connect(this.engineFilter);
        this.engineSubOsc.connect(this.engineFilter);
        this.engineFilter.connect(shaper);
        shaper.connect(this.engineGain);
        this.engineGain.connect(this.sfxGain);

        this.engineOsc.start();
        this.engineSubOsc.start();
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    updateEngine(speedNormalized, isAccelerating, isBraking) {
        if (!this.ctx || !this.engineGain || this.isMuted) return;

        const now = this.ctx.currentTime;
        // Pitch goes from 40Hz (idle) to 180Hz (top speed)
        let targetFreq = 42 + speedNormalized * 110;
        if (isAccelerating) targetFreq += 25;
        if (isBraking) targetFreq = Math.max(35, targetFreq - 20);

        this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
        this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.08);

        // Filter opens up as car accelerates
        const targetFilter = 220 + speedNormalized * 850 + (isAccelerating ? 300 : 0);
        this.engineFilter.frequency.setTargetAtTime(targetFilter, now, 0.08);

        // Volume scales with speed & throttle
        const targetVol = 0.18 + speedNormalized * 0.22 + (isAccelerating ? 0.08 : 0);
        this.engineGain.gain.setTargetAtTime(targetVol, now, 0.05);
    }

    stopEngine() {
        if (this.engineGain && this.ctx) {
            this.engineGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.1);
        }
    }

    /* ---------------- SOUND EFFECTS ---------------- */
    playClick() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    playNearMiss() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;

        // Whoosh sound: resonant noise sweep
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.35);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(6.0, now);
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 0.15);
        filter.frequency.exponentialRampToValueAtTime(350, now + 0.35);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start(now);
        noise.stop(now + 0.35);
    }

    playCoin() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;

        // Bright energetic two-tone chime
        const notes = [987.77, 1318.51]; // B5, E6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.07);

            gain.gain.setValueAtTime(0.3, now + idx * 0.07);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now + idx * 0.07);
            osc.stop(now + idx * 0.07 + 0.25);
        });
    }

    playBoost() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;

        // Rising futuristic energy surge
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';

        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(2400, now + 0.4);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.45);
    }

    playCrash() {
        if (!this.ctx || this.isMuted) return;
        this.resume();
        const now = this.ctx.currentTime;

        // Sub bass impact drop
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(150, now);
        subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

        subGain.gain.setValueAtTime(0.8, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        subOsc.connect(subGain);
        subGain.connect(this.sfxGain);
        subOsc.start(now);
        subOsc.stop(now + 0.65);

        // Metal crunch / explosive noise burst
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.8);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.18));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.7);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.9, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        noise.start(now);
        noise.stop(now + 0.8);
    }

    /* ---------------- PROCEDURAL SYNTHWAVE MUSIC ---------------- */
    startMusic() {
        if (!this.ctx || this.musicPlaying) return;
        this.resume();
        this.musicPlaying = true;
        this.currentStep = 0;

        const stepTimeMs = (60 / this.tempo / 4) * 1000; // 16th notes
        
        // Synthwave chord progression: Am -> F -> C -> G
        const bassNotes = [
            // Measure 1: A
            55, 55, 110, 55,  55, 55, 110, 55,  55, 55, 110, 55,  55, 55, 110, 82.4,
            // Measure 2: F
            43.65, 43.65, 87.3, 43.65,  43.65, 43.65, 87.3, 43.65,  43.65, 43.65, 87.3, 43.65,  43.65, 43.65, 87.3, 65.4,
            // Measure 3: C
            65.4, 65.4, 130.8, 65.4,  65.4, 65.4, 130.8, 65.4,  65.4, 65.4, 130.8, 65.4,  65.4, 65.4, 130.8, 98,
            // Measure 4: G / Em
            49, 49, 98, 49,  49, 49, 98, 49,  49, 49, 98, 49,  49, 49, 98, 73.4
        ];

        // Lead synth melody notes (Hz)
        const leadNotes = [
            440, 0, 523.25, 0,  659.25, 0, 523.25, 0,  440, 523.25, 659.25, 0,  587.33, 0, 0, 0,
            349.23, 0, 440, 0,   523.25, 0, 440, 0,    349.23, 440, 523.25, 0,  493.88, 0, 0, 0,
            523.25, 0, 659.25, 0, 783.99, 0, 659.25, 0, 523.25, 659.25, 783.99, 0, 659.25, 0, 0, 0,
            392, 0, 493.88, 0,  587.33, 0, 493.88, 0,  392, 493.88, 587.33, 0,  440, 0, 0, 0
        ];

        this.musicInterval = setInterval(() => {
            if (!this.musicPlaying || this.isMuted || !this.ctx) return;
            const now = this.ctx.currentTime;
            const step = this.currentStep % 64;

            // 1. Kick Drum (Steps 0, 4, 8, 12 in each measure)
            if (step % 4 === 0) {
                this.triggerKick(now);
            }

            // 2. Snare / Clap (Steps 4, 12 in each 16-step measure)
            if (step % 8 === 4) {
                this.triggerSnare(now);
            }

            // 3. Hi-Hat (Every 2nd step)
            if (step % 2 === 0) {
                this.triggerHiHat(now, step % 4 === 2);
            }

            // 4. Synthwave rolling bass
            const bFreq = bassNotes[step];
            if (bFreq > 0) {
                this.triggerBass(bFreq, now, stepTimeMs / 1000 * 0.85);
            }

            // 5. Arpeggio / Lead
            const lFreq = leadNotes[step];
            if (lFreq > 0) {
                this.triggerLead(lFreq, now, stepTimeMs / 1000 * 1.5);
            }

            this.currentStep++;
        }, stepTimeMs);
    }

    triggerKick(now) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.09);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    triggerSnare(now) {
        // Body tone
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

        oscGain.gain.setValueAtTime(0.3, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(oscGain);
        oscGain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.08);

        // Noise snap
        const bSize = Math.floor(this.ctx.sampleRate * 0.12);
        const buf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.035));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, now);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.35, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.musicGain);

        noise.start(now);
        noise.stop(now + 0.12);
    }

    triggerHiHat(now, isOpen = false) {
        const dur = isOpen ? 0.08 : 0.03;
        const bSize = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(isOpen ? 0.15 : 0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(now);
        noise.stop(now + dur);
    }

    triggerBass(freq, now, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(180, now + duration);
        filter.Q.setValueAtTime(4.0, now);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + duration);
    }

    triggerLead(freq, now, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, now);
        filter.Q.setValueAtTime(3.0, now);

        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + duration);
    }

    stopMusic() {
        this.musicPlaying = false;
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

export const soundCtrl = new SoundController();
