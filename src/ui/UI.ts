import { Check, ChevronLeft, ChevronRight, Coins, createIcons, LockKeyhole, Settings, ShoppingBag, Trophy, Volume2, VolumeX, Zap } from 'lucide';

const UI_ICONS = { Check, ChevronLeft, ChevronRight, Coins, LockKeyhole, Settings, ShoppingBag, Trophy, Volume2, VolumeX, Zap };
const SVG_NS = 'http://www.w3.org/2000/svg';

function pointOnGauge(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
    const radians = angle * Math.PI / 180;
    return { x: cx + Math.cos(radians) * radius, y: cy + Math.sin(radians) * radius };
}

function gaugeArcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
    const start = pointOnGauge(cx, cy, radius, startAngle);
    const end = pointOnGauge(cx, cy, radius, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function appendGaugeTicks(
    group: SVGGElement | null,
    cx: number,
    cy: number,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number,
    divisions: number,
    majorEvery: number,
    className: string,
    labelEvery = 0,
    labelMax = 0
): void {
    if (!group) return;
    for (let index = 0; index <= divisions; index++) {
        const angle = startAngle + (endAngle - startAngle) * index / divisions;
        const major = index % majorEvery === 0;
        const inner = pointOnGauge(cx, cy, major ? innerRadius - 5 : innerRadius, angle);
        const outer = pointOnGauge(cx, cy, outerRadius, angle);
        const tick = document.createElementNS(SVG_NS, 'line');
        tick.setAttribute('x1', String(inner.x));
        tick.setAttribute('y1', String(inner.y));
        tick.setAttribute('x2', String(outer.x));
        tick.setAttribute('y2', String(outer.y));
        tick.setAttribute('class', `${className}${major ? ' major' : ''}${className === 'rpm-tick' && index >= divisions - 2 ? ' redline' : ''}`);
        group.appendChild(tick);

        if (labelEvery > 0 && major && index >= labelEvery * 2) {
            const labelPoint = pointOnGauge(cx, cy, innerRadius - 17, angle);
            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', String(labelPoint.x));
            label.setAttribute('y', String(labelPoint.y));
            label.setAttribute('class', 'speed-tick-label');
            label.textContent = String(Math.round(labelMax * index / divisions));
            group.appendChild(label);
        }
    }
}

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
    private readonly speedArc: SVGPathElement | null;
    private readonly mainNeedle: SVGGElement | null;
    private readonly rpmNeedle: SVGGElement | null;
    private readonly speedReadout: SVGTextElement | null;
    private readonly gearReadout: SVGTextElement | null;
    private readonly rpmReadout: SVGTextElement | null;
    private displayedSpeed = 0;
    private displayedRpm = 850;
    private currentGear = 0;
    private lastSpeedText = '';
    private lastGearText = '';
    private lastRpmText = '';
    private speedArcLength = 0;
    private onShopAction: ((carId: string) => void) | null = null;
    private onPreviewCar: ((carId: string) => void) | null = null;
    private onCloseShop: (() => void) | null = null;
    private onAudioChange: ((main: number, music: number, effects: number) => void) | null = null;

    constructor() {
        this.hud = document.getElementById('hud');
        this.uiScore = document.getElementById('hud-score');
        this.uiDistance = document.getElementById('hud-distance');
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
        this.speedArc = document.getElementById('speedometer-speed-arc') as SVGPathElement | null;
        this.mainNeedle = document.getElementById('speedometer-needle') as SVGGElement | null;
        this.rpmNeedle = document.getElementById('speedometer-rpm-needle') as SVGGElement | null;
        this.speedReadout = document.getElementById('speedometer-speed') as SVGTextElement | null;
        this.gearReadout = document.getElementById('speedometer-gear') as SVGTextElement | null;
        this.rpmReadout = document.getElementById('speedometer-rpm-value') as SVGTextElement | null;
        const speedArcPath = gaugeArcPath(205, 155, 126, 145, 325);
        document.getElementById('speedometer-track')?.setAttribute('d', speedArcPath);
        this.speedArc?.setAttribute('d', speedArcPath);
        document.getElementById('speedometer-redline')?.setAttribute('d', gaugeArcPath(205, 155, 126, 307, 325));
        this.speedArcLength = this.speedArc?.getTotalLength() ?? 0;
        appendGaugeTicks(document.getElementById('speedometer-ticks') as SVGGElement | null, 205, 155, 110, 126, 145, 325, 32, 4, 'speed-tick', 4, 320);
        const rpmTrack = document.getElementById('speedometer-rpm-track');
        rpmTrack?.setAttribute('d', gaugeArcPath(91, 231, 52, 135, 405));
        document.getElementById('speedometer-rpm-redline')?.setAttribute('d', gaugeArcPath(91, 231, 52, 378, 405));
        appendGaugeTicks(document.getElementById('speedometer-rpm-ticks') as SVGGElement | null, 91, 231, 44, 51, 135, 405, 16, 2, 'rpm-tick');
        const creditsPanel = document.querySelector<HTMLDetailsElement>('.model-credits');
        creditsPanel?.addEventListener('toggle', () => {
            creditsPanel.closest('.screen-overlay')?.classList.toggle('credits-overlay-active', creditsPanel.open);
        });
        document.querySelector<HTMLButtonElement>('.credits-close')?.addEventListener('click', event => {
            event.stopPropagation();
            if (creditsPanel) creditsPanel.open = false;
        });
        createIcons({ icons: UI_ICONS });
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

    updateShop(cars: Array<{ id: string; name: string; price: number; description: string; model: string; level: string }>, owned: string[], selected: string, previewed: string, credits: number, message = ''): void {
        this.updateCredits(credits);
        if (this.shopMessage) this.shopMessage.textContent = message;
        if (!this.shopGrid) return;
        this.shopGrid.innerHTML = cars.map(car => {
            const hasCar = owned.includes(car.id);
            const isSelected = selected === car.id;
            const isPreviewed = previewed === car.id;
            const action = isSelected ? '<i data-lucide="check" aria-hidden="true"></i> IN USE' : hasCar ? 'SELECT' : `<i data-lucide="coins" aria-hidden="true"></i> BUY · ${car.price.toLocaleString()} CR`;
            const status = isSelected ? 'CURRENT RIDE' : hasCar ? 'OWNED' : `<i data-lucide="lock-keyhole" aria-hidden="true"></i> LOCKED · ${car.price.toLocaleString()} CR`;
            return `<article class="car-card ${isPreviewed ? 'previewed' : ''}" data-car-id="${car.id}"><button class="car-option" data-car-id="${car.id}" aria-pressed="${isPreviewed}"><span class="car-option-name">${car.name}</span><span class="car-option-model">${car.level}</span><span class="car-status">${status}</span></button><button class="btn-secondary car-action" data-car-action="true" data-car-id="${car.id}" ${isSelected ? 'disabled' : ''}>${action}</button></article>`;
        }).join('');
        createIcons({ icons: UI_ICONS, root: this.shopGrid });
        const shown = cars.find(car => car.id === previewed) ?? cars[0];
        if (shown && this.previewName) this.previewName.textContent = shown.name;
        if (shown && this.previewDescription) this.previewDescription.textContent = shown.description;
    }

    updateCredits(credits: number): void {
        this.creditsLabels.forEach(label => label.textContent = credits.toLocaleString());
    }

    setMuted(isMuted: boolean): void {
        document.querySelectorAll('.mute-icon').forEach(icon => {
            icon.setAttribute('data-lucide', isMuted ? 'volume-x' : 'volume-2');
        });
        this.muteBtn?.setAttribute('aria-label', isMuted ? 'Unmute audio' : 'Mute audio');
        this.muteBtn?.setAttribute('title', isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)');
        createIcons({ icons: UI_ICONS });
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

    updateHUD(score: number, distance: number, currentSpeed: number, nitro: number, dt = 1 / 60): void {
        const speedKmh = Math.max(0, currentSpeed * 3.2);

        if (this.uiScore) this.uiScore.textContent = Math.floor(score).toLocaleString();
        if (this.uiDistance) this.uiDistance.textContent = `${Math.floor(distance)} m`;
        this.updateSpeedometer(speedKmh, dt);

        if (this.uiNitroBar) {
            this.uiNitroBar.style.width = `${Math.round(nitro)}%`;
            if (nitro > 80) {
                this.uiNitroBar.classList.add('glow');
            } else {
                this.uiNitroBar.classList.remove('glow');
            }
        }
    }

    private updateSpeedometer(speedKmh: number, dt: number): void {
        const speed = Math.min(320, speedKmh);
        const alpha = 1 - Math.exp(-Math.max(0, dt) * 11);
        this.displayedSpeed += (speed - this.displayedSpeed) * alpha;

        const speedText = String(Math.round(speed)).padStart(3, '0');
        if (speedText !== this.lastSpeedText && this.speedReadout) {
            this.speedReadout.textContent = speedText;
            this.lastSpeedText = speedText;
        }

        const speedRatio = this.displayedSpeed / 320;
        const speedAngle = 145 + speedRatio * 180;
        this.mainNeedle?.setAttribute('transform', `rotate(${speedAngle + 90} 205 155)`);
        if (this.speedArc && this.speedArcLength > 0) {
            this.speedArc.setAttribute('stroke-dasharray', `${this.speedArcLength * speedRatio} ${this.speedArcLength}`);
        }

        const upshiftSpeeds = [52, 94, 138, 185, 245];
        if (speed < 4) {
            this.currentGear = 0;
        } else {
            if (this.currentGear === 0) this.currentGear = 1;
            while (this.currentGear < 6 && speed >= upshiftSpeeds[this.currentGear - 1]) this.currentGear++;
            while (this.currentGear > 1 && speed < upshiftSpeeds[this.currentGear - 2] - 8) this.currentGear--;
        }

        const gearText = this.currentGear === 0 ? 'N' : String(this.currentGear);
        if (gearText !== this.lastGearText && this.gearReadout) {
            this.gearReadout.textContent = gearText;
            this.lastGearText = gearText;
        }

        let targetRpm = 850;
        if (this.currentGear > 0) {
            const lowerSpeed = this.currentGear === 1 ? 0 : upshiftSpeeds[this.currentGear - 2] - 8;
            const upperSpeed = upshiftSpeeds[this.currentGear - 1] ?? 320;
            const gearProgress = Math.max(0, Math.min(1, (speed - lowerSpeed) / (upperSpeed - lowerSpeed)));
            targetRpm = 1000 + gearProgress * 6800;
        }
        this.displayedRpm += (targetRpm - this.displayedRpm) * alpha;
        this.rpmNeedle?.setAttribute('transform', `rotate(${135 + this.displayedRpm / 8000 * 270 + 90} 91 231)`);
        const rpmText = (this.displayedRpm / 1000).toFixed(1);
        if (rpmText !== this.lastRpmText && this.rpmReadout) {
            this.rpmReadout.textContent = rpmText;
            this.lastRpmText = rpmText;
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
