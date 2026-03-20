// ============================================================
// audio.js - Sound Effects using Web Audio API
// ============================================================

class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.initialized = false;
        this.masterVolume = 1;
        this.setupAutoInit();
    }

    setupAutoInit() {
        const init = () => {
            this.ensureContext();
            document.removeEventListener('click', init);
            document.removeEventListener('touchstart', init);
            document.removeEventListener('keydown', init);
        };
        document.addEventListener('click', init);
        document.addEventListener('touchstart', init);
        document.addEventListener('keydown', init);
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }

    ensureContext() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(frequency, duration, type = 'sine', volume = 0.15) {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration, volume = 0.08) {
        if (!this.enabled || !this.ctx) return;
        this.ensureContext();

        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        source.start();
    }

    // --- Sound Effects ---

    cardSelect() {
        this.playTone(800, 0.08, 'sine', 0.1);
    }

    cardDeselect() {
        this.playTone(600, 0.06, 'sine', 0.08);
    }

    cardPlay() {
        this.playNoise(0.1, 0.12);
        setTimeout(() => this.playTone(440, 0.1, 'triangle', 0.1), 30);
    }

    cardSlam() {
        // For tứ quý or strong plays
        this.playNoise(0.15, 0.2);
        this.playTone(200, 0.2, 'sawtooth', 0.12);
        setTimeout(() => this.playTone(300, 0.15, 'triangle', 0.15), 80);
    }

    pass() {
        this.playTone(300, 0.15, 'sine', 0.06);
        setTimeout(() => this.playTone(200, 0.15, 'sine', 0.04), 100);
    }

    passTurn() {
        this.pass();
    }

    invalidMove() {
        this.playTone(200, 0.2, 'square', 0.1);
        setTimeout(() => this.playTone(150, 0.25, 'square', 0.08), 150);
    }

    win() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.3, 'triangle', 0.15), i * 150);
        });
    }

    lose() {
        const notes = [400, 350, 300, 250];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.4, 'sine', 0.1), i * 200);
        });
    }

    shuffle() {
        for (let i = 0; i < 8; i++) {
            setTimeout(() => this.playNoise(0.04, 0.06), i * 50);
        }
    }

    newRound() {
        this.playTone(600, 0.1, 'triangle', 0.08);
        setTimeout(() => this.playTone(800, 0.12, 'triangle', 0.1), 80);
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    error() {
        this.invalidMove();
    }
}

const audioManager = new AudioManager();
