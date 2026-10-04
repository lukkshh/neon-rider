import { Game } from './game/Game.js';

// Boot Neon Rider when DOM content is loaded
function boot() {
    window.game = new Game();
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
