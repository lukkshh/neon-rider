import * as THREE from 'three';
import { Input } from '../core/Input.js';
import { UI } from '../ui/UI.js';
import { soundCtrl } from '../systems/Audio.js';
import { ParticleSystem } from '../systems/Particles.js';
import { World } from '../world/World.js';
import { Player } from '../player/Player.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { CAR_CATALOG, loadGarage, saveGarage, type CarModel, type GarageSave } from './Cars.js';
import { Models } from '../world/Models.js';
import { TrafficModels } from '../world/TrafficModels.js';

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
        this.previewMode = false;
        this.previewDirty = false;
        this.previewCar = null;
        this.previewRequestId = 0;
        this.previewCarId = this.garage.selectedCar;

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
        this.gameOverTimeout = null;

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

        // The shop preview shares the game's renderer and WebGL context.
        this.previewScene = new THREE.Scene();
        this.previewScene.background = new THREE.Color(0x090d1b);
        this.previewScene.add(new THREE.HemisphereLight(0xddeaff, 0x171025, 2.2));
        const previewKey = new THREE.DirectionalLight(0xffffff, 3.2);
        previewKey.position.set(-4, 7, 5);
        previewKey.castShadow = true;
        previewKey.shadow.mapSize.set(512, 512);
        previewKey.shadow.camera.left = -5;
        previewKey.shadow.camera.right = 5;
        previewKey.shadow.camera.top = 5;
        previewKey.shadow.camera.bottom = -5;
        this.previewScene.add(previewKey);
        const previewRim = new THREE.PointLight(0x00eaff, 3.0, 12);
        previewRim.position.set(4, 3, -3);
        this.previewScene.add(previewRim);
        const previewFloor = new THREE.Mesh(
            new THREE.CircleGeometry(4.2, 40),
            new THREE.MeshStandardMaterial({ color: 0x101426, roughness: 0.72, metalness: 0.3 })
        );
        previewFloor.rotation.x = -Math.PI / 2;
        previewFloor.position.y = -0.035;
        previewFloor.receiveShadow = true;
        this.previewScene.add(previewFloor);
        this.previewCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
        this.previewCamera.position.set(5.4, 3.6, 6.3);
        this.previewCamera.lookAt(0, 0.65, 0);

        // Resize handler
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        if (this.previewMode) this.resizePreview();
        else this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ---------------- INITIALIZE SUBSYSTEMS ----------------
    initSubsystems() {
        this.input = new Input();
        this.ui = new UI();
        this.audio = soundCtrl;
        this.world = new World(this.scene);
        this.particles = new ParticleSystem(this.scene);
        this.player = new Player(this.modelForCarId(this.garage.selectedCar));
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
            onMainMenu: () => {
                this.audio.playClick();
                this.returnToMenu();
            },
            onToggleMute: () => this.toggleMute(),
            onOpenShop: () => { this.audio.init(); this.audio.resume(); this.openCarShop(); },
            onOpenSettings: () => { this.audio.init(); this.audio.resume(); this.ui.showSettings(); },
            onShopAction: (carId) => this.handleShopAction(carId),
            onPreviewCar: (carId) => this.previewCarModel(carId),
            onCloseShop: () => this.closeCarPreview(),
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
        this.ui.updateShop(CAR_CATALOG, this.garage.ownedCars, this.garage.selectedCar, this.previewCarId, this.garage.credits, this.shopFeedback);
    }

    modelForCarId(carId: string): CarModel {
        return CAR_CATALOG.find(car => car.id === carId)?.model ?? 'sports';
    }

    openCarShop(): void {
        this.ui.showShop();
        this.previewCarId = this.garage.selectedCar;
        this.attachPreviewCanvas();
        this.setPreviewModel(this.previewCarId);
        this.updateShop();
    }

    attachPreviewCanvas(): void {
        const stage = this.ui.getPreviewStage();
        if (!stage) return;
        stage.appendChild(this.renderer.domElement);
        this.previewMode = true;
        this.resizePreview();
    }

    resizePreview(): void {
        const stage = this.ui.getPreviewStage();
        if (!stage) return;
        const width = Math.max(1, stage.clientWidth);
        const height = Math.max(1, stage.clientHeight);
        this.renderer.setSize(width, height, false);
        this.previewCamera.aspect = width / height;
        this.previewCamera.updateProjectionMatrix();
        this.previewDirty = true;
    }

    async setPreviewModel(carId: string): Promise<void> {
        const requestId = ++this.previewRequestId;
        if (this.previewCar) {
            this.previewScene.remove(this.previewCar);
            this.previewCar = null;
        }
        try {
            const model = await TrafficModels.createGaragePreview(this.modelForCarId(carId));
            if (!this.previewMode || requestId !== this.previewRequestId) return;
            this.previewCar = model;
            this.previewCar.rotation.y = 0.28;
            this.previewScene.add(this.previewCar);
            this.previewDirty = true;
        } catch (error) {
            console.error('Unable to load garage vehicle preview.', error);
        }
    }

    previewCarModel(carId: string): void {
        if (!CAR_CATALOG.some(car => car.id === carId)) return;
        this.previewCarId = carId;
        if (this.previewMode) this.setPreviewModel(carId);
        this.updateShop();
    }

    closeCarPreview(): void {
        if (!this.previewMode) return;
        this.previewMode = false;
        this.previewRequestId++;
        if (this.previewCar) {
            this.previewScene.remove(this.previewCar);
            this.previewCar = null;
        }
        this.canvasContainer.appendChild(this.renderer.domElement);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    handleShopAction(carId: string): void {
        const car = CAR_CATALOG.find(entry => entry.id === carId);
        if (!car) return;
        if (this.garage.ownedCars.includes(carId)) {
            this.garage.selectedCar = carId;
            const oldMesh = this.player.mesh;
            this.player.setCar(this.modelForCarId(carId));
            this.scene.remove(oldMesh);
            this.scene.add(this.player.mesh);
            this.shopFeedback = `${car.name} selected.`;
        } else if (this.garage.credits >= car.price) {
            this.garage.credits = Math.max(0, this.garage.credits - car.price);
            this.garage.ownedCars.push(carId);
            this.garage.selectedCar = carId;
            const oldMesh = this.player.mesh;
            this.player.setCar(this.modelForCarId(carId));
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
        this.closeCarPreview();
        this.ui.hideStartScreen();
        this.camera.position.set(0, 3.6, -7.5);
        this.cameraTarget.set(0, 1.2, 14.0);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.cameraTarget);
        this.clock.start();
    }

    restartGame() {
        if (this.gameOverTimeout !== null) {
            clearTimeout(this.gameOverTimeout);
            this.gameOverTimeout = null;
        }
        this.ui.hideGameOverScreen();
        this.ui.hidePauseScreen();
        this.world.reset(0);
        this.particles.reset();
        this.resetGameVariables();
        this.state = 'PLAYING';
        this.timeScale = 1.0;
        this.clock.start();
    }

    returnToMenu(): void {
        if (this.gameOverTimeout !== null) {
            clearTimeout(this.gameOverTimeout);
            this.gameOverTimeout = null;
        }
        this.state = 'START';
        this.timeScale = 1.0;
        this.audio.stopEngine();
        this.audio.stopMusic();
        this.world.reset(0);
        this.particles.reset();
        this.resetGameVariables();
        this.ui.hidePauseScreen();
        this.ui.hideGameOverScreen();
        this.ui.hidePanels();
        this.closeCarPreview();
        this.ui.showStartScreen();
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

        this.gameOverTimeout = setTimeout(() => {
            this.gameOverTimeout = null;
            if (this.state !== 'GAMEOVER') return;
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
        if (this.previewMode) {
            if (this.previewDirty) {
                this.renderer.render(this.previewScene, this.previewCamera);
                this.previewDirty = false;
            }
        } else {
            this.renderer.render(this.scene, this.camera);
        }
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
        this.world.update(this.player.pos.z, speedRatio, dt, this.player.pos.x, this.player.currentSpeed);

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
