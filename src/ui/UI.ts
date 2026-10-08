export interface UIBindings {
    onStart: () => void;
    onRestart: () => void;
    onResume: () => void;
    onToggleMute: () => void;
}

export interface GameOverStats {
    score: number;
    distance: number;
    topSpeed: number;
    nearMisses: number;
    isNewHigh: boolean;
}

/**
 * UI Manager
 * Handles HUD displays, floating score popups, screen overlays, and menu event bindings
 */
export class UI {
    private readonly hud: HTMLElement | null;
    private readonly uiScore: HTMLElement | null;
    private readonly uiDistance: HTMLElement | null;
    private readonly uiSpeed: HTMLElement | null;
    private readonly uiSpeedBar: HTMLElement | null;
    private readonly uiNitroBar: HTMLElement | null;
    private readonly uiHighScore: HTMLElement | null;
    private readonly uiFloatAlerts: HTMLElement | null;

    private readonly startScreen: HTMLElement | null;
    private readonly pauseScreen: HTMLElement | null;
    private readonly gameOverScreen: HTMLElement | null;

    private readonly startBtn: HTMLElement | null;
    private readonly restartBtn: HTMLElement | null;
    private readonly resumeBtn: HTMLElement | null;
    private readonly muteBtn: HTMLElement | null;
    private readonly startMuteBtn: HTMLElement | null;
    private readonly muteIcons: NodeListOf<Element>;

    private readonly finalScore: HTMLElement | null;
    private readonly finalDistance: HTMLElement | null;
    private readonly finalTopSpeed: HTMLElement | null;
    private readonly finalNearMisses: HTMLElement | null;
    private readonly newRecordBadge: HTMLElement | null;

    constructor() {
        this.hud = document.getElementById('hud');
        this.uiScore = document.getElementById('hud-score');
        this.uiDistance = document.getElementById('hud-distance');
        this.uiSpeed = document.getElementById('hud-speed');
        this.uiSpeedBar = document.getElementById('speed-bar-fill');
        this.uiNitroBar = document.getElementById('nitro-fill');
        this.uiHighScore = document.getElementById('hud-highscore');
        this.uiFloatAlerts = document.getElementById('floating-alerts');

        this.startScreen = document.getElementById('start-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');

        this.startBtn = document.getElementById('start-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.resumeBtn = document.getElementById('resume-btn');
        this.muteBtn = document.getElementById('mute-btn');
        this.startMuteBtn = document.getElementById('start-mute-btn');
        this.muteIcons = document.querySelectorAll('.mute-icon');

        this.finalScore = document.getElementById('final-score');
        this.finalDistance = document.getElementById('final-distance');
        this.finalTopSpeed = document.getElementById('final-top-speed');
        this.finalNearMisses = document.getElementById('final-near-misses');
        this.newRecordBadge = document.getElementById('new-record-badge');
    }

    bindEvents({ onStart, onRestart, onResume, onToggleMute }: UIBindings): void {
        this.startBtn?.addEventListener('click', onStart);
        this.restartBtn?.addEventListener('click', onRestart);
        this.resumeBtn?.addEventListener('click', onResume);
        this.muteBtn?.addEventListener('click', onToggleMute);
        this.startMuteBtn?.addEventListener('click', onToggleMute);
    }

    setMuted(isMuted: boolean): void {
        this.muteIcons.forEach(icon => {
            icon.textContent = isMuted ? '??' : '??';
        });
    }

    showStartScreen(): void {
        this.startScreen?.classList.remove('hidden');
        this.hud?.classList.add('hidden');
    }

    hideStartScreen(): void {
        this.startScreen?.classList.add('hidden');
        this.hud?.classList.remove('hidden');
    }

    showPauseScreen(): void {
        this.pauseScreen?.classList.remove('hidden');
    }

    hidePauseScreen(): void {
        this.pauseScreen?.classList.add('hidden');
    }

    showGameOverScreen({ score, distance, topSpeed, nearMisses, isNewHigh }: GameOverStats): void {
        if (this.finalScore) this.finalScore.textContent = Math.floor(score).toLocaleString();
        if (this.finalDistance) this.finalDistance.textContent = `${Math.floor(distance)} m`;
        if (this.finalTopSpeed) this.finalTopSpeed.textContent = `${Math.round(topSpeed * 3.2)} km/h`;
        if (this.finalNearMisses) this.finalNearMisses.textContent = String(nearMisses);

        if (this.newRecordBadge) {
            if (isNewHigh && score > 0) {
                this.newRecordBadge.classList.remove('hidden');
            } else {
                this.newRecordBadge.classList.add('hidden');
            }
        }

        this.gameOverScreen?.classList.remove('hidden');
    }

    hideGameOverScreen(): void {
        this.gameOverScreen?.classList.add('hidden');
    }

    updateHighScore(highScore: number): void {
        if (this.uiHighScore) {
            this.uiHighScore.textContent = Math.floor(highScore).toLocaleString();
        }
    }

    updateHUD(score: number, distance: number, currentSpeed: number, nitro: number): void {
        const speedKmh = Math.round(currentSpeed * 3.2);

        if (this.uiScore) this.uiScore.textContent = Math.floor(score).toLocaleString();
        if (this.uiDistance) this.uiDistance.textContent = `${Math.floor(distance)} m`;
        if (this.uiSpeed) this.uiSpeed.textContent = String(speedKmh);

        if (this.uiSpeedBar) {
            const speedPct = Math.min(100, Math.round((speedKmh / 310) * 100));
            this.uiSpeedBar.style.width = `${speedPct}%`;
        }

        if (this.uiNitroBar) {
            this.uiNitroBar.style.width = `${Math.round(nitro)}%`;
            if (nitro > 80) {
                this.uiNitroBar.classList.add('glow');
            } else {
                this.uiNitroBar.classList.remove('glow');
            }
        }
    }

    showScoreAlert(text: string, type: string = 'bonus'): void {
        if (!this.uiFloatAlerts) return;

        const el = document.createElement('div');
        el.className = `alert-popup ${type}`;
        el.textContent = text;
        this.uiFloatAlerts.appendChild(el);

        setTimeout(() => {
            el.parentNode?.removeChild(el);
        }, 1200);
    }
}
