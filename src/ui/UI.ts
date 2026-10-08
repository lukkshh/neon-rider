export interface UIBindings {
    onStart: () => void;
    onRestart: () => void;
    onResume: () => void;
    onMainMenu: () => void;
    onToggleMute: () => void;
    onOpenShop: () => void;
    onOpenSettings: () => void;
    onShopAction: (carId: string) => void;
    onPreviewCar: (carId: string) => void;
    onCloseShop: () => void;
    onAudioChange: (main: number, music: number, effects: number) => void;
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
    private readonly pauseMenuBtn: HTMLElement | null;
    private readonly gameOverMenuBtn: HTMLElement | null;
    private readonly muteBtn: HTMLElement | null;
    private readonly startMuteBtn: HTMLElement | null;
    private readonly muteIcons: NodeListOf<Element>;

    private readonly finalScore: HTMLElement | null;
    private readonly finalDistance: HTMLElement | null;
    private readonly finalTopSpeed: HTMLElement | null;
    private readonly finalNearMisses: HTMLElement | null;
    private readonly newRecordBadge: HTMLElement | null;
    private readonly shopScreen: HTMLElement | null;
    private readonly settingsScreen: HTMLElement | null;
    private readonly shopGrid: HTMLElement | null;
    private readonly previewStage: HTMLElement | null;
    private readonly previewName: HTMLElement | null;
    private readonly previewDescription: HTMLElement | null;
    private readonly creditsLabels: NodeListOf<HTMLElement>;
    private readonly shopMessage: HTMLElement | null;
    private readonly audioInputs: NodeListOf<HTMLInputElement>;
    private readonly audioValues: NodeListOf<HTMLElement>;
    private onShopAction: ((carId: string) => void) | null = null;
    private onPreviewCar: ((carId: string) => void) | null = null;
    private onCloseShop: (() => void) | null = null;
    private onAudioChange: ((main: number, music: number, effects: number) => void) | null = null;

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
        this.pauseMenuBtn = document.getElementById('pause-menu-btn');
        this.gameOverMenuBtn = document.getElementById('game-over-menu-btn');
        this.muteBtn = document.getElementById('mute-btn');
        this.startMuteBtn = document.getElementById('start-mute-btn');
        this.muteIcons = document.querySelectorAll('.mute-icon');

        this.finalScore = document.getElementById('final-score');
        this.finalDistance = document.getElementById('final-distance');
        this.finalTopSpeed = document.getElementById('final-top-speed');
        this.finalNearMisses = document.getElementById('final-near-misses');
        this.newRecordBadge = document.getElementById('new-record-badge');
        this.shopScreen = document.getElementById('shop-screen');
        this.settingsScreen = document.getElementById('settings-screen');
        this.shopGrid = document.getElementById('shop-grid');
        this.previewStage = document.getElementById('car-preview-stage');
        this.previewName = document.getElementById('car-preview-name');
        this.previewDescription = document.getElementById('car-preview-description');
        this.creditsLabels = document.querySelectorAll<HTMLElement>('#shop-credits, #shop-credits-value, #shop-credits-final');
        this.shopMessage = document.getElementById('shop-message');
        this.audioInputs = document.querySelectorAll<HTMLInputElement>('[data-audio-volume]');
        this.audioValues = document.querySelectorAll<HTMLElement>('[data-audio-value]');
    }

    bindEvents({ onStart, onRestart, onResume, onMainMenu, onToggleMute, onOpenShop, onOpenSettings, onShopAction, onPreviewCar, onCloseShop, onAudioChange }: UIBindings): void {
        this.onShopAction = onShopAction;
        this.onPreviewCar = onPreviewCar;
        this.onCloseShop = onCloseShop;
        this.onAudioChange = onAudioChange;
        this.startBtn?.addEventListener('click', onStart);
        this.restartBtn?.addEventListener('click', onRestart);
        this.resumeBtn?.addEventListener('click', onResume);
        this.pauseMenuBtn?.addEventListener('click', onMainMenu);
        this.gameOverMenuBtn?.addEventListener('click', onMainMenu);
        this.muteBtn?.addEventListener('click', onToggleMute);
        this.startMuteBtn?.addEventListener('click', onToggleMute);
        document.getElementById('shop-btn')?.addEventListener('click', onOpenShop);
        document.getElementById('settings-btn')?.addEventListener('click', onOpenSettings);
        document.querySelectorAll('[data-close-panel]').forEach(button => button.addEventListener('click', () => {
            this.hidePanels();
            this.onCloseShop?.();
        }));
        this.shopGrid?.addEventListener('click', event => {
            const target = (event.target as HTMLElement).closest<HTMLElement>('[data-car-id]');
            const carId = target?.dataset.carId;
            if (!carId) return;
            this.onPreviewCar?.(carId);
            if (target.matches('[data-car-action]')) this.onShopAction?.(carId);
        });
        this.audioInputs.forEach(input => input.addEventListener('input', () => {
            const values = this.readAudioValues();
            this.updateAudioLabels();
            this.onAudioChange?.(values.main, values.music, values.effects);
        }));
    }

    getAudioValues(): { main: number; music: number; effects: number } { return this.readAudioValues(); }

    setAudioValues(values: { main: number; music: number; effects: number }): void {
        this.audioInputs.forEach(input => {
            const key = input.dataset.audioVolume as keyof typeof values;
            input.value = String(Math.round(Math.max(0, Math.min(1, values[key])) * 100));
        });
        this.updateAudioLabels();
    }

    private readAudioValues(): { main: number; music: number; effects: number } {
        const get = (key: string): number => Number(this.documentInput(key)?.value ?? 100) / 100;
        return { main: get('main'), music: get('music'), effects: get('effects') };
    }

    private documentInput(key: string): HTMLInputElement | null {
        return document.querySelector<HTMLInputElement>(`[data-audio-volume="${key}"]`);
    }

    private updateAudioLabels(): void {
        this.audioValues.forEach(label => {
            const key = label.dataset.audioValue;
            const input = key ? this.documentInput(key) : null;
            if (input) label.textContent = `${input.value}%`;
        });
    }

    hidePanels(): void {
        this.shopScreen?.classList.add('hidden');
        this.settingsScreen?.classList.add('hidden');
    }

    showShop(): void { this.settingsScreen?.classList.add('hidden'); this.shopScreen?.classList.remove('hidden'); }
    showSettings(): void { this.shopScreen?.classList.add('hidden'); this.settingsScreen?.classList.remove('hidden'); }

    getPreviewStage(): HTMLElement | null { return this.previewStage; }

    updateShop(cars: Array<{ id: string; name: string; price: number; description: string; model: string }>, owned: string[], selected: string, previewed: string, credits: number, message = ''): void {
        this.updateCredits(credits);
        if (this.shopMessage) this.shopMessage.textContent = message;
        if (!this.shopGrid) return;
        this.shopGrid.innerHTML = cars.map(car => {
            const hasCar = owned.includes(car.id);
            const isSelected = selected === car.id;
            const isPreviewed = previewed === car.id;
            const action = isSelected ? 'IN USE' : hasCar ? 'SELECT' : `BUY · ${car.price.toLocaleString()} CR`;
            const status = isSelected ? 'CURRENT RIDE' : hasCar ? 'OWNED' : `LOCKED · ${car.price.toLocaleString()} CR`;
            return `<article class="car-card ${isPreviewed ? 'previewed' : ''}" data-car-id="${car.id}"><button class="car-option" data-car-id="${car.id}" aria-pressed="${isPreviewed}"><span class="car-option-name">${car.name}</span><span class="car-option-model">${car.model}</span><span class="car-status">${status}</span></button><button class="btn-secondary car-action" data-car-action="true" data-car-id="${car.id}" ${isSelected ? 'disabled' : ''}>${action}</button></article>`;
        }).join('');
        const shown = cars.find(car => car.id === previewed) ?? cars[0];
        if (shown && this.previewName) this.previewName.textContent = shown.name;
        if (shown && this.previewDescription) this.previewDescription.textContent = shown.description;
    }

    updateCredits(credits: number): void {
        this.creditsLabels.forEach(label => label.textContent = credits.toLocaleString());
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
