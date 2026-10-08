import { Game } from './game/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  (window as Window & { game?: Game }).game = new Game();
});
