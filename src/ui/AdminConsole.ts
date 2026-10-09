export interface AdminConsoleBindings {
    onClose: () => void;
    onGodModeChange: (enabled: boolean) => void;
    onInfiniteNitroChange: (enabled: boolean) => void;
    onSpeedOverrideChange: (enabled: boolean, speed: number) => void;
    onScoreSet: (score: number) => void;
    onCreditsSet: (credits: number) => void;
    onPoliceSpawn: () => void;
    onTrafficDensityChange: (density: number) => void;
    onPoliceChanceChange: (chance: number) => void;
    onPoliceDurationChange: (seconds: number) => void;
    onPoliceFlashRateChange: (rate: number) => void;
}

export class AdminConsole {
    private readonly panel = document.getElementById('admin-console');
    private readonly status = document.getElementById('admin-console-status');
    private readonly speedToggle = document.getElementById('admin-speed-enabled') as HTMLInputElement | null;
    private readonly speedInput = document.getElementById('admin-speed') as HTMLInputElement | null;

    get isOpen(): boolean {
        return Boolean(this.panel && !this.panel.classList.contains('hidden'));
    }

    setOpen(open: boolean): void {
        this.panel?.classList.toggle('hidden', !open);
        this.panel?.setAttribute('aria-hidden', String(!open));
        if (open) this.status?.focus();
    }

    setStatus(message: string): void {
        if (this.status) this.status.textContent = message;
    }

    bindEvents(bindings: AdminConsoleBindings): void {
        document.getElementById('admin-console-close')?.addEventListener('click', bindings.onClose);
        document.getElementById('admin-god-mode')?.addEventListener('change', event => {
            bindings.onGodModeChange((event.currentTarget as HTMLInputElement).checked);
        });
        document.getElementById('admin-infinite-nitro')?.addEventListener('change', event => {
            bindings.onInfiniteNitroChange((event.currentTarget as HTMLInputElement).checked);
        });
        this.speedToggle?.addEventListener('change', () => {
            if (this.speedInput) this.speedInput.disabled = !this.speedToggle?.checked;
            bindings.onSpeedOverrideChange(Boolean(this.speedToggle?.checked), Number(this.speedInput?.value ?? 32));
        });
        this.speedInput?.addEventListener('input', () => {
            this.updateOutput('admin-speed-output', `${this.speedInput?.value ?? 32} u/s`);
            bindings.onSpeedOverrideChange(Boolean(this.speedToggle?.checked), Number(this.speedInput?.value ?? 32));
        });
        this.bindRange('admin-traffic-density', 'admin-traffic-density-output', value => `${value}%`, value => {
            bindings.onTrafficDensityChange(value / 100);
        });
        this.bindRange('admin-police-chance', 'admin-police-chance-output', value => `${value}%`, value => {
            bindings.onPoliceChanceChange(value / 100);
        });
        this.bindRange('admin-police-duration', 'admin-police-duration-output', value => `${value}s`, value => {
            bindings.onPoliceDurationChange(value);
        });
        this.bindRange('admin-police-flash', 'admin-police-flash-output', value => `${value}×`, value => {
            bindings.onPoliceFlashRateChange(value);
        });
        document.getElementById('admin-score-apply')?.addEventListener('click', () => {
            const value = this.readNumber('admin-score-value');
            if (value !== null) bindings.onScoreSet(value);
        });
        document.getElementById('admin-credits-apply')?.addEventListener('click', () => {
            const value = this.readNumber('admin-credits-value');
            if (value !== null) bindings.onCreditsSet(value);
        });
        document.getElementById('admin-police-spawn')?.addEventListener('click', bindings.onPoliceSpawn);
    }

    private bindRange(id: string, outputId: string, format: (value: number) => string, onChange: (value: number) => void): void {
        const input = document.getElementById(id) as HTMLInputElement | null;
        input?.addEventListener('input', () => {
            const value = Number(input.value);
            this.updateOutput(outputId, format(value));
            onChange(value);
        });
    }

    private updateOutput(id: string, value: string): void {
        const output = document.getElementById(id);
        if (output) output.textContent = value;
    }

    private readNumber(id: string): number | null {
        const input = document.getElementById(id) as HTMLInputElement | null;
        if (!input || !input.value.trim()) return null;
        const value = Number(input.value);
        return Number.isFinite(value) ? Math.max(0, value) : null;
    }
}
