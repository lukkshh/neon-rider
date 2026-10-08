import * as THREE from 'three';
import { Input } from '../core/Input.js';
import { UI } from '../ui/UI.js';
import { soundCtrl } from '../systems/Audio.js';
import { ParticleSystem } from '../systems/Particles.js';
import { World } from '../world/World.js';
import { Player } from '../player/Player.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { CAR_CATALOG, loadGarage, saveGarage, type GarageSave } from './Cars.js';

/**
 * Main Game Controller
 * Manages Three.js scene, camera, lighting, loops, and subsystem orchestration
 */
export class Game {
    // Runtime subsystem references are initialized in the constructor's setup phases.
    [key: string]: any;
    constructor() {
        this.canvasContainer = document.getElementById('game-container');
        this.garage = loadGarage();
        this.audioSettings = this.loadAudioSettings();
        this.creditedDistance = 0;
        this.shopFeedback = '';

        // Game states: 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
        this.state = 'START';

        // Timing & loop
        this.clock = new THREE.Clock();
        this.timeScale = 1.0;
        this.totalDistance = 0;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('neon_drift_highscore') ?? '0', 10) || 0;
        this.nearMissCount = 0;
        this.coinCount = 0;
        this.topSpeedRecord = 0;

        // Camera control
        this.cameraOffset = new THREE.Vector3(0, 3.6, -7.5);
        this.cameraTarget = new THREE.Vector3(0, 1.2, 10);
        this.cameraShake = 0;
        this.startCamAngle = 0;

        this.initThree();
        this.initSubsystems();
        this.bindEvents();
        this.ui.updateCredits(this.garage.credits);

        // Start render loop
        requestAnimationFrame((t) => this.loop(t));
    }

    // ---------------- INITIALIZE THREE.JS ----------------
    initThree() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0e0720);
        this.scene.fog = new THREE.FogExp2(0x130924, 0.0075);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            65,
            window.innerWidth / window.innerHeight,
            0.1,
            700
        );
        this.camera.position.set(0, 5, -8);

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        if (THREE.ACESFilmicToneMapping) {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.2;
        }
        this.canvasContainer.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x281944, 1.0);
        this.scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xff6b8b, 0x1b1138, 0.9);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xffb88c, 2.0);
        this.dirLight.position.set(25, 45, 30);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 120;
        this.dirLight.shadow.camera.left = -22;
        this.dirLight.shadow.camera.right = 22;
        this.dirLight.shadow.camera.top = 22;
        this.dirLight.shadow.camera.bottom = -22;
        this.dirLight.shadow.bias = -0.0008;
        this.scene.add(this.dirLight);

        // Resize handler
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ---------------- INITIALIZE SUBSYSTEMS ----------------
    initSubsystems() {
        this.input = new Input();
        this.ui = new UI();
        this.audio = soundCtrl;
        this.world = new World(this.scene);
        this.particles = new ParticleSystem(this.scene);
        this.player = new Player(this.garage.selectedCar);
        this.scene.add(this.player.mesh);
        this.collision = new CollisionSystem();

        this.resetGameVariables();
        this.ui.updateHighScore(this.highScore);
        this.ui.setAudioValues(this.audioSettings);
        this.audio.setVolumes(this.audioSettings.main, this.audioSettings.music, this.audioSettings.effects);
        this.updateShop();
    }

    bindEvents() {
        // Input callbacks
        this.input.onAction(() => {
            if (this.state === 'START') {
                this.startGame();
            } else if (this.state === 'GAMEOVER') {
                this.restartGame();
            }
        });

        this.input.onTogglePause(() => this.togglePause());
        this.input.onToggleMute(() => this.toggleMute());

        // UI button bindings
        this.ui.bindEvents({
            onStart: () => {
                this.audio.playClick();
                this.startGame();
            },
            onRestart: () => {
                this.audio.playClick();
                this.restartGame();
            },
            onResume: () => {
                this.audio.playClick();
                this.togglePause();
            },
            onToggleMute: () => this.toggleMute(),
            onOpenShop: () => { this.audio.init(); this.audio.resume(); this.ui.showShop(); this.updateShop(); },
            onOpenSettings: () => { this.audio.init(); this.audio.resume(); this.ui.showSettings(); },
            onShopAction: (carId) => this.handleShopAction(carId),
            onAudioChange: (main, music, effects) => this.saveAudioSettings({ main, music, effects })
        });
    }

    loadAudioSettings(): { main: number; music: number; effects: number } {
        const fallback = { main: 1, music: 1, effects: 1 };
        try {
            const parsed = JSON.parse(localStorage.getItem('neon_rider_audio_v1') ?? 'null');
            const valid = (value: unknown): number => typeof value === 'number' && Number.isFinite(value)
                ? Math.max(0, Math.min(1, value)) : 1;
            return parsed && typeof parsed === 'object'
                ? { main: valid(parsed.main), music: valid(parsed.music), effects: valid(parsed.effects) }
                : fallback;
        } catch { return fallback; }
    }

    saveAudioSettings(settings: { main: number; music: number; effects: number }): void {
        this.audioSettings = settings;
        this.audio.setVolumes(settings.main, settings.music, settings.effects);
        try { localStorage.setItem('neon_rider_audio_v1', JSON.stringify(settings)); } catch { /* Storage may be unavailable. */ }
    }

    persistGarage(): void { saveGarage(this.garage as GarageSave); }

    updateShop(): void {
        this.ui.updateShop(CAR_CATALOG, this.garage.ownedCars, this.garage.selectedCar, this.garage.credits, this.shopFeedback);
    }

    handleShopAction(carId: string): void {
        const car = CAR_CATALOG.find(entry => entry.id === carId);
        if (!car) return;
        if (this.garage.ownedCars.includes(carId)) {
            this.garage.selectedCar = carId;
            const oldMesh = this.player.mesh;
            this.player.setCar(carId);
            this.scene.remove(oldMesh);
            this.scene.add(this.player.mesh);
            this.shopFeedback = `${car.name} selected.`;
        } else if (this.garage.credits >= car.price) {
            this.garage.credits = Math.max(0, this.garage.credits - car.price);
            this.garage.ownedCars.push(carId);
            this.garage.selectedCar = carId;
            const oldMesh = this.player.mesh;
            this.player.setCar(carId);
            this.scene.remove(oldMesh);
            this.scene.add(this.player.mesh);
            this.shopFeedback = `${car.name} purchased and selected.`;
        } else {
            this.shopFeedback = `Not enough credits for ${car.name}.`;
        }
        this.persistGarage();
        this.updateShop();
        this.audio.playClick();
    }

    resetGameVariables() {
        this.player.reset();
        this.collision.reset();
        this.totalDistance = 0;
        this.score = 0;
        this.nearMissCount = 0;
        this.coinCount = 0;
        this.creditedDistance = 0;

        this.camera.position.set(0, 3.6, -7.5);
        this.cameraTarget.set(0, 1.2, 14.0);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.cameraTarget);
        this.cameraShake = 0;
    }

    toggleMute() {
        const isMuted = this.audio.toggleMute();
        this.ui.setMuted(isMuted);
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.ui.showPauseScreen();
            this.audio.stopEngine();
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.ui.hidePauseScreen();
        }
    }

    startGame() {
        this.audio.init();
        this.audio.resume();
        this.audio.startMusic();
        this.state = 'PLAYING';
        this.ui.hidePanels();
        this.ui.hideStartScreen();
        this.camera.position.set(0, 3.6, -7.5);
        this.cameraTarget.set(0, 1.2, 14.0);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.cameraTarget);
        this.clock.start();
    }

    restartGame() {
        this.ui.hideGameOverScreen();
        this.world.reset(0);
        this.particles.reset();
        this.resetGameVariables();
        this.state = 'PLAYING';
        this.timeScale = 1.0;
        this.clock.start();
    }

    triggerGameOver() {
        if (this.state === 'GAMEOVER') return;
        this.state = 'GAMEOVER';

        // Crash sound & explosion
        this.audio.playCrash();
        this.audio.stopEngine();

        this.particles.createCrashExplosion(this.player.pos);
        this.cameraShake = 1.8;

        // Slow motion effect
        this.timeScale = 0.25;

        // Tilt player car
        this.player.mesh.rotation.z = 0.8;
        this.player.mesh.rotation.x = -0.5;

        // High score calculation
        let isNewHigh = false;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('neon_drift_highscore', this.highScore.toString());
            isNewHigh = true;
        }

        setTimeout(() => {
            this.timeScale = 1.0;
            this.ui.showGameOverScreen({
                score: this.score,
                distance: this.totalDistance,
                topSpeed: this.topSpeedRecord,
                nearMisses: this.nearMissCount,
                isNewHigh
            });
            this.ui.updateHighScore(this.highScore);
        }, 900);
    }

    triggerNearMiss(pos) {
        this.nearMissCount++;
        this.score += 150;
        this.player.nitro = Math.min(100, this.player.nitro + 12);
        this.audio.playNearMiss();
        this.cameraShake = Math.max(this.cameraShake, 0.4);
        this.ui.showScoreAlert('NEAR MISS! +150', 'near-miss');
    }

    collectCoin(coin, index) {
        this.audio.playCoin();
        this.particles.createCoinSparkles(coin.position);
        this.scene.remove(coin);
        this.world.collectibles.splice(index, 1);

        this.coinCount++;
        this.garage.credits += 10;
        this.persistGarage();
        this.ui.updateCredits(this.garage.credits);
        this.shopFeedback = '+10 credits collected';
        this.updateShop();
        this.score += 250;
        this.player.nitro = Math.min(100, this.player.nitro + 30);
        this.ui.showScoreAlert('+250 NITRO!', 'coin');
    }

    // ---------------- MAIN GAME LOOP ----------------
    loop(timestamp) {
        requestAnimationFrame((t) => this.loop(t));

        let dt = this.clock.getDelta();
        if (dt > 0.1) dt = 0.1;
        dt *= this.timeScale;

        if (this.state === 'START') {
            this.updateStartScreen(dt);
        } else if (this.state === 'PLAYING') {
            this.updateGameplay(dt);
        } else if (this.state === 'GAMEOVER') {
            this.updateGameOver(dt);
        }

        this.particles.update(dt);
        this.renderer.render(this.scene, this.camera);
    }

    // ---------------- START SCREEN IDLE ANIMATION ----------------
    updateStartScreen(dt) {
        this.startCamAngle += dt * 0.5;
        const camX = Math.sin(this.startCamAngle) * 1.5;
        const camY = 3.6 + Math.cos(this.startCamAngle * 0.8) * 0.25;
        const camZ = -7.5 + Math.sin(this.startCamAngle * 0.6) * 0.4;
        this.camera.position.set(camX, camY, camZ);
        this.cameraTarget.set(0, 1.2, 14.0);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.cameraTarget);

        if (this.player.mesh.rollingWheels) {
            this.player.mesh.rollingWheels.forEach(w => w.rotation.x += dt * 2);
        }
    }

    // ---------------- ACTIVE GAMEPLAY UPDATE ----------------
    updateGameplay(dt) {
        // 1. Update Player Movement Physics
        const { deltaZ, speedRatio, hitWall } = this.player.update(
            dt,
            this.input.keys,
            this.totalDistance,
            this.particles,
            this.audio
        );

        if (hitWall) {
            this.cameraShake = Math.max(this.cameraShake, 0.3);
        }

        this.totalDistance += deltaZ;
        const earnedForDistance = Math.floor(this.totalDistance / 100) - Math.floor(this.creditedDistance / 100);
        if (earnedForDistance > 0) {
            this.garage.credits += earnedForDistance;
            this.creditedDistance = this.totalDistance;
            this.persistGarage();
            this.ui.updateCredits(this.garage.credits);
        }

        // Score increases with distance & speed
        const speedMultiplier = this.player.currentSpeed / this.player.baseSpeed;
        this.score += deltaZ * speedMultiplier * 0.45;

        // Track top speed
        if (this.player.currentSpeed > this.topSpeedRecord) {
            this.topSpeedRecord = this.player.currentSpeed;
        }

        // 2. Directional Light & Shadow Camera follows player
        this.dirLight.position.set(
            this.player.pos.x + 25,
            45,
            this.player.pos.z + 30
        );
        this.dirLight.target.position.set(this.player.pos.x, 0, this.player.pos.z + 15);
        this.dirLight.target.updateMatrixWorld();

        // 3. World Manager update (spawns traffic, recycles road)
        this.world.update(this.player.pos.z, speedRatio, dt);

        // 4. Speed Lines effect
        this.particles.updateSpeedLines(this.player.pos.z, speedRatio, this.player.isBoosting);

        // 5. Audio Engine update
        this.audio.updateEngine(speedRatio, this.player.isAccelerating, this.player.isBraking);

        // 6. Collisions & Near Misses
        this.collision.check(this.player, this.world, {
            onCrash: () => this.triggerGameOver(),
            onNearMiss: (pos) => this.triggerNearMiss(pos),
            onCollectCoin: (coin, index) => this.collectCoin(coin, index)
        });

        // 7. Camera Follow & Dynamic Shake
        this.updateCamera(dt, speedRatio);

        // 8. Update UI HUD
        this.ui.updateHUD(this.score, this.totalDistance, this.player.currentSpeed, this.player.nitro);
    }

    // ---------------- CAMERA SMOOTH FOLLOW & SHAKE ----------------
    updateCamera(dt, speedRatio) {
        const targetCamX = this.player.pos.x * 0.65;
        const targetCamY = 3.6 + (this.player.isBoosting ? 0.4 : 0);
        const targetCamZ = this.player.pos.z - (7.5 + speedRatio * 2.5);

        // Smooth lerping
        this.camera.position.x += (targetCamX - this.camera.position.x) * dt * 9.0;
        this.camera.position.y += (targetCamY - this.camera.position.y) * dt * 6.0;
        this.camera.position.z += (targetCamZ - this.camera.position.z) * dt * 15.0;

        // Camera LookAt
        this.cameraTarget.set(
            this.player.pos.x * 0.4,
            1.2,
            this.player.pos.z + 14.0
        );

        // Camera Shake effect
        if (this.cameraShake > 0.01) {
            this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
            this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
            this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
        }

        // Camera FOV expansion during nitro
        const targetFOV = this.player.isBoosting ? 74 : (65 + speedRatio * 5);
        const previousFOV = this.camera.fov;
        this.camera.fov += (targetFOV - previousFOV) * Math.min(1, dt * 4);
        if (Math.abs(this.camera.fov - previousFOV) > 0.001) {
            this.camera.updateProjectionMatrix();
        }

        // Dynamic subtle camera roll in steering direction using camera.up
        const targetRoll = -this.player.velocityX * 0.012;
        this.camera.up.set(targetRoll, 1, 0).normalize();
        this.camera.lookAt(this.cameraTarget);
    }

    // ---------------- GAME OVER STATE UPDATE ----------------
    updateGameOver(dt) {
        if (this.cameraShake > 0.01) {
            this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
            this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
            this.cameraShake = Math.max(0, this.cameraShake - dt * 1.5);
        }
    }
}
