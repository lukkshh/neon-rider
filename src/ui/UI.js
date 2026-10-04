/**
 * UI Manager
 * Handles HUD displays, floating score popups, screen overlays, and menu event bindings
 */
export class UI {
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

    bindEvents({ onStart, onRestart, onResume, onToggleMute }) {
        if (this.startBtn) {
            this.startBtn.addEventListener('click', onStart);
        }
        if (this.restartBtn) {
            this.restartBtn.addEventListener('click', onRestart);
        }
        if (this.resumeBtn) {
            this.resumeBtn.addEventListener('click', onResume);
        }
        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', onToggleMute);
        }
        if (this.startMuteBtn) {
            this.startMuteBtn.addEventListener('click', onToggleMute);
        }
    }

    setMuted(isMuted) {
        this.muteIcons.forEach(icon => {
            icon.textContent = isMuted ? '🔇' : '🔊';
        });
    }

    showStartScreen() {
        if (this.startScreen) this.startScreen.classList.remove('hidden');
        if (this.hud) this.hud.classList.add('hidden');
    }

    hideStartScreen() {
        if (this.startScreen) this.startScreen.classList.add('hidden');
        if (this.hud) this.hud.classList.remove('hidden');
    }

    showPauseScreen() {
        if (this.pauseScreen) this.pauseScreen.classList.remove('hidden');
    }

    hidePauseScreen() {
        if (this.pauseScreen) this.pauseScreen.classList.add('hidden');
    }

    showGameOverScreen({ score, distance, topSpeed, nearMisses, isNewHigh }) {
        if (this.finalScore) this.finalScore.textContent = Math.floor(score).toLocaleString();
        if (this.finalDistance) this.finalDistance.textContent = `${Math.floor(distance)} m`;
        if (this.finalTopSpeed) this.finalTopSpeed.textContent = `${Math.round(topSpeed * 3.2)} km/h`;
        if (this.finalNearMisses) this.finalNearMisses.textContent = nearMisses;

        if (this.newRecordBadge) {
            if (isNewHigh && score > 0) {
                this.newRecordBadge.classList.remove('hidden');
            } else {
                this.newRecordBadge.classList.add('hidden');
            }
        }

        if (this.gameOverScreen) this.gameOverScreen.classList.remove('hidden');
    }

    hideGameOverScreen() {
        if (this.gameOverScreen) this.gameOverScreen.classList.add('hidden');
    }

    updateHighScore(highScore) {
        if (this.uiHighScore) {
            this.uiHighScore.textContent = Math.floor(highScore).toLocaleString();
        }
    }

    updateHUD(score, distance, currentSpeed, nitro) {
        const speedKmh = Math.round(currentSpeed * 3.2);

        if (this.uiScore) this.uiScore.textContent = Math.floor(score).toLocaleString();
        if (this.uiDistance) this.uiDistance.textContent = `${Math.floor(distance)} m`;
        if (this.uiSpeed) this.uiSpeed.textContent = speedKmh;

        // Speed Bar Fill %
        if (this.uiSpeedBar) {
            const speedPct = Math.min(100, Math.round((speedKmh / 310) * 100));
            this.uiSpeedBar.style.width = `${speedPct}%`;
        }

        // Nitro Bar Fill %
        if (this.uiNitroBar) {
            this.uiNitroBar.style.width = `${Math.round(nitro)}%`;
            if (nitro > 80) {
                this.uiNitroBar.classList.add('glow');
            } else {
                this.uiNitroBar.classList.remove('glow');
            }
        }
    }

    showScoreAlert(text, type = 'bonus') {
        if (!this.uiFloatAlerts) return;

        const el = document.createElement('div');
        el.className = `alert-popup ${type}`;
        el.textContent = text;
        this.uiFloatAlerts.appendChild(el);

        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 1200);
    }
}
