// ==========================================
// 🔊 SOUND MANAGER (Producción web + Fallback)
// ==========================================
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.globalVolume = 0.5;

        // Rutas relativas para producción web
        this.sources = {
            hit:            'sounds/hit.mp3',
            block:          'sounds/block.mp3',
            dash:           'sounds/dash.mp3',
            frame:          'sounds/frame.mp3',
            selfFrame:      'sounds/self_frame.mp3',
            heavyBlackFlash:'sounds/heavy_black_flash.mp3',
            blackFlash:     'sounds/black_flash.mp3',
            tib:            'sounds/tib.mp3',
            domain:         'sounds/domain.mp3'
        };

        this.cache = {};
        this._preloadCache();
    }

    initAudioContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    _preloadCache() {
        for (const [key, url] of Object.entries(this.sources)) {
            if (url) {
                const audio = new Audio(url);
                audio.preload = 'auto';
                this.cache[key] = audio;
            }
        }
    }

    play(soundKey, customVolume = null) {
        if (!this.enabled) return;
        this.initAudioContext(); // Asegura desbloqueo en caliente

        const targetVol = customVolume !== null ? customVolume : this.globalVolume;

        if (this.cache[soundKey]) {
            const clone = this.cache[soundKey].cloneNode();
            clone.volume = Math.max(0, Math.min(1, targetVol));
            clone.play().catch(() => {
                this._fallbackSynth(soundKey);
            });
        } else {
            this._fallbackSynth(soundKey);
        }
    }

    _fallbackSynth(key) {
        this.initAudioContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        
        switch (key) {
            case 'hit':
                osc.type = 'triangle'; osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
                gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
                break;
            case 'block':
                osc.type = 'square'; osc.frequency.setValueAtTime(400, now);
                osc.frequency.setValueAtTime(250, now + 0.05);
                gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.start(now); osc.stop(now + 0.12);
                break;
            case 'dash':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(280, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);
                gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
                osc.start(now); osc.stop(now + 0.09);
                break;
            case 'blackFlash':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, now);
                osc.frequency.exponentialRampToValueAtTime(700, now + 0.18);
                osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
                gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                osc.start(now); osc.stop(now + 0.5);
                break;
            case 'heavyBlackFlash':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(40, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);
                osc.frequency.exponentialRampToValueAtTime(15, now + 0.8);
                gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
                osc.start(now); osc.stop(now + 0.8);
                break;
            case 'domain':
                osc.type = 'triangle'; osc.frequency.setValueAtTime(100, now);
                osc.frequency.linearRampToValueAtTime(200, now + 0.6);
                gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
                osc.start(now); osc.stop(now + 0.9);
                break;
            default:
                osc.type = 'sine'; osc.frequency.setValueAtTime(220, now);
                gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
                break;
        }
    }
}

// Instancia global
const sfx = new SoundManager();

// ==========================================
// 🔓 AUDIO UNLOCKER GLOBAL (Móviles / PC fix)
// ==========================================
['click', 'keydown', 'touchstart'].forEach(eventType => {
    window.addEventListener(eventType, () => {
        sfx.initAudioContext();
    }, { once: false });
});

// Exponemos función global para pruebas rápidas desde HTML buttons
window.testAction = (action) => {
    sfx.play(action);
    console.log(`[SFX Triggered]: ${action}`);
};

// Loop principal de prueba (placeholder para tu game loop real)
function gameLoop() {
    // aquí va tu lógica de 1v1
    requestAnimationFrame(gameLoop);
}
gameLoop();
