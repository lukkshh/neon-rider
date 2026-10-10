export interface InputKeys {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    boost: boolean;
}

type InputKeyName = keyof InputKeys;

/**
 * Input Controller
 * Handles keyboard and touch controls for Neon Rider
 */
export class Input {
    readonly keys: InputKeys;

    private onActionCallback: (() => void) | null = null;
    private onTogglePauseCallback: (() => void) | null = null;
    private onToggleMuteCallback: (() => void) | null = null;
    private onToggleAdminConsoleCallback: (() => void) | null = null;
    private onScreenshotJokeCallback: (() => void) | null = null;
    private screenshotComboActive = false;
    private adminBracketLeftDown = false;
    private adminBracketRightDown = false;
    private adminComboActive = false;

    constructor() {
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            boost: false,
        };

        this.initKeyboard();
        this.initTouchControls();
    }

    onAction(callback: () => void): void {
        this.onActionCallback = callback;
    }

    onTogglePause(callback: () => void): void {
        this.onTogglePauseCallback = callback;
    }

    onToggleMute(callback: () => void): void {
        this.onToggleMuteCallback = callback;
    }

    onToggleAdminConsole(callback: () => void): void {
        this.onToggleAdminConsoleCallback = callback;
    }

    onScreenshotJoke(callback: () => void): void {
        this.onScreenshotJokeCallback = callback;
    }

    private checkScreenshotCombo(): void {
        const active = this.keys.up && this.keys.down;
        if (active && !this.screenshotComboActive) this.onScreenshotJokeCallback?.();
        this.screenshotComboActive = active;
    }

    private initKeyboard(): void {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.repeat) return;
            const code = e.code;

            if (code === 'BracketLeft' || code === 'BracketRight') {
                this.adminBracketLeftDown ||= code === 'BracketLeft';
                this.adminBracketRightDown ||= code === 'BracketRight';
                if (this.adminBracketLeftDown && this.adminBracketRightDown && !this.adminComboActive) {
                    this.adminComboActive = true;
                    this.onToggleAdminConsoleCallback?.();
                    e.preventDefault();
                }
                return;
            }

            if (code === 'KeyA' || code === 'ArrowLeft') {
                this.keys.left = true;
            } else if (code === 'KeyD' || code === 'ArrowRight') {
                this.keys.right = true;
            } else if (code === 'KeyW' || code === 'ArrowUp') {
                this.keys.up = true;
                this.checkScreenshotCombo();
            } else if (code === 'KeyS' || code === 'ArrowDown') {
                this.keys.down = true;
                this.checkScreenshotCombo();
            } else if (code === 'Space') {
                this.keys.boost = true;
                this.onActionCallback?.();
            } else if (code === 'KeyP' || code === 'Escape') {
                this.onTogglePauseCallback?.();
            } else if (code === 'KeyM') {
                this.onToggleMuteCallback?.();
            }
        });

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            const code = e.code;
            if (code === 'BracketLeft' || code === 'BracketRight') {
                if (code === 'BracketLeft') this.adminBracketLeftDown = false;
                if (code === 'BracketRight') this.adminBracketRightDown = false;
                this.adminComboActive = false;
            } else if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
            else if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
            else if (code === 'KeyW' || code === 'ArrowUp') { this.keys.up = false; this.checkScreenshotCombo(); }
            else if (code === 'KeyS' || code === 'ArrowDown') { this.keys.down = false; this.checkScreenshotCombo(); }
            else if (code === 'Space') this.keys.boost = false;
        });
    }

    private initTouchControls(): void {
        const bindTouch = (id: string, keyName: InputKeyName): void => {
            const el = document.getElementById(id);
            if (!el) return;

            el.addEventListener('touchstart', (e: TouchEvent) => {
                e.preventDefault();
                this.keys[keyName] = true;
            }, { passive: false });

            el.addEventListener('touchend', (e: TouchEvent) => {
                e.preventDefault();
                this.keys[keyName] = false;
            }, { passive: false });

            el.addEventListener('mousedown', (e: MouseEvent) => {
                e.preventDefault();
                this.keys[keyName] = true;
            });

            el.addEventListener('mouseup', (e: MouseEvent) => {
                e.preventDefault();
                this.keys[keyName] = false;
            });

            el.addEventListener('mouseleave', () => {
                this.keys[keyName] = false;
            });
        };

        bindTouch('touch-left', 'left');
        bindTouch('touch-right', 'right');
        bindTouch('touch-boost', 'boost');
        bindTouch('touch-brake', 'down');
    }
}
