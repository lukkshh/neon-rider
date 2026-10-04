/**
 * Input Controller
 * Handles keyboard and touch controls for Neon Rider
 */
export class Input {
    constructor() {
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            boost: false
        };

        // Callbacks for discrete actions
        this.onActionCallback = null;
        this.onTogglePauseCallback = null;
        this.onToggleMuteCallback = null;

        this.initKeyboard();
        this.initTouchControls();
    }

    onAction(callback) {
        this.onActionCallback = callback;
    }

    onTogglePause(callback) {
        this.onTogglePauseCallback = callback;
    }

    onToggleMute(callback) {
        this.onToggleMuteCallback = callback;
    }

    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            const code = e.code;

            if (code === 'KeyA' || code === 'ArrowLeft') {
                this.keys.left = true;
            } else if (code === 'KeyD' || code === 'ArrowRight') {
                this.keys.right = true;
            } else if (code === 'KeyW' || code === 'ArrowUp') {
                this.keys.up = true;
            } else if (code === 'KeyS' || code === 'ArrowDown') {
                this.keys.down = true;
            } else if (code === 'Space') {
                this.keys.boost = true;
                if (this.onActionCallback) {
                    this.onActionCallback();
                }
            } else if (code === 'KeyP' || code === 'Escape') {
                if (this.onTogglePauseCallback) {
                    this.onTogglePauseCallback();
                }
            } else if (code === 'KeyM') {
                if (this.onToggleMuteCallback) {
                    this.onToggleMuteCallback();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const code = e.code;
            if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
            else if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
            else if (code === 'KeyW' || code === 'ArrowUp') this.keys.up = false;
            else if (code === 'KeyS' || code === 'ArrowDown') this.keys.down = false;
            else if (code === 'Space') this.keys.boost = false;
        });
    }

    initTouchControls() {
        const bindTouch = (id, keyName) => {
            const el = document.getElementById(id);
            if (!el) return;

            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys[keyName] = true;
            }, { passive: false });

            el.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys[keyName] = false;
            }, { passive: false });

            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.keys[keyName] = true;
            });

            el.addEventListener('mouseup', (e) => {
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
