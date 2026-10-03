/**
 * Main Game Controller
 * Manages Three.js scene, player physics, collision detection, game loop, and UI
 */

class Game {
    constructor() {
        this.canvasContainer = document.getElementById('game-container');
        
        // Game states: 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
        this.state = 'START';

        // Timing & loop
        this.clock = new THREE.Clock();
        this.timeScale = 1.0;
        this.totalDistance = 0;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('neon_drift_highscore')) || 0;
        this.nearMissCount = 0;
        this.coinCount = 0;
        this.topSpeedRecord = 0;

        // Player movement physics
        this.playerPos = new THREE.Vector3(0, 0, 0);
        this.playerTargetX = 0;
        this.playerVelocityX = 0;
        this.baseSpeed = 32;       // Base units/sec (~100 km/h)
        this.currentSpeed = 32;
        this.maxNormalSpeed = 68;  // Climbs over time (~220 km/h)
        this.nitroSpeed = 95;      // When boosting (~300 km/h)
        this.minSpeed = 20;

        // Nitro energy
        this.nitro = 100; // 0 to 100
        this.isBoosting = false;
        this.isBraking = false;
        this.isAccelerating = false;

        // Input state
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            boost: false
        };

        // Camera control
        this.cameraOffset = new THREE.Vector3(0, 3.6, -7.5);
        this.cameraTarget = new THREE.Vector3(0, 1.2, 10);
        this.cameraShake = 0;

        // Cinematic start camera angle
        this.startCamAngle = 0;

        // Near-miss cooldown map to prevent duplicate triggers
        this.passedEntities = new Set();

        this.initThree();
        this.initEntities();
        this.initInputs();
        this.initUI();
        this.updateHighScoreDisplay();

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
        // 1. Ambient Light
        const ambientLight = new THREE.AmbientLight(0x281944, 1.0);
        this.scene.add(ambientLight);

        // 2. Hemisphere Light (Atmosphere gradient)
        const hemiLight = new THREE.HemisphereLight(0xff6b8b, 0x1b1138, 0.9);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);

        // 3. Directional Sunset Sun Light (with real-time shadows)
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

    // ---------------- INITIALIZE ENTITIES ----------------
    initEntities() {
        // World & Highway Manager
        this.world = new WorldManager(this.scene);

        // Particles System
        this.particles = new ParticleSystem(this.scene);

        // Player 3D Car
        this.playerCar = Models.createPlayerCar();
        this.scene.add(this.playerCar);
        this.resetPlayerState();
    }

    resetPlayerState() {
        this.playerPos.set(0, 0, 0);
        this.playerTargetX = 0;
        this.playerVelocityX = 0;
        this.currentSpeed = this.baseSpeed;
        this.nitro = 100;
        this.totalDistance = 0;
        this.score = 0;
        this.nearMissCount = 0;
        this.coinCount = 0;
        this.passedEntities.clear();

        this.playerCar.position.set(0, 0, 0);
        this.playerCar.rotation.set(0, 0, 0);
        this.playerCar.visible = true;

        this.camera.position.set(0, 3.6, -7.5);
        this.cameraTarget.set(0, 1.2, 14.0);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.cameraTarget);
        this.cameraShake = 0;

        if (this.playerCar.underglowLight) {
            this.playerCar.underglowLight.intensity = 1.5;
        }
    }

    // ---------------- USER INPUTS ----------------
    initInputs() {
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
                if (this.state === 'START') {
                    this.startGame();
                } else if (this.state === 'GAMEOVER') {
                    this.restartGame();
                }
            } else if (code === 'KeyP' || code === 'Escape') {
                this.togglePause();
            } else if (code === 'KeyM') {
                this.toggleMute();
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

        // Touch buttons for mobile & tablet
        this.setupTouchControls();
    }

    setupTouchControls() {
        const bindTouch = (id, keyName) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys[keyName] = true;
            });
            el.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys[keyName] = false;
            });
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.keys[keyName] = true;
            });
            el.addEventListener('mouseup', (e) => {
                e.preventDefault();
                this.keys[keyName] = false;
            });
            el.addEventListener('mouseleave', (e) => {
                this.keys[keyName] = false;
            });
        };

        bindTouch('touch-left', 'left');
        bindTouch('touch-right', 'right');
        bindTouch('touch-boost', 'boost');
        bindTouch('touch-brake', 'down');
    }

    // ---------------- UI & EVENT LISTENERS ----------------
    initUI() {
        this.uiScore = document.getElementById('hud-score');
        this.uiDistance = document.getElementById('hud-distance');
        this.uiSpeed = document.getElementById('hud-speed');
        this.uiSpeedBar = document.getElementById('speed-bar-fill');
        this.uiNitroBar = document.getElementById('nitro-fill');
        this.uiHighScore = document.getElementById('hud-highscore');
        this.uiGameOverModal = document.getElementById('game-over-screen');
        this.uiStartScreen = document.getElementById('start-screen');
        this.uiPauseScreen = document.getElementById('pause-screen');
        this.uiFloatScore = document.getElementById('floating-alerts');

        // Buttons
        document.getElementById('start-btn').addEventListener('click', () => {
            soundCtrl.playClick();
            this.startGame();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            soundCtrl.playClick();
            this.restartGame();
        });

        document.getElementById('resume-btn').addEventListener('click', () => {
            soundCtrl.playClick();
            this.togglePause();
        });

        document.getElementById('mute-btn').addEventListener('click', () => {
            this.toggleMute();
        });

        document.getElementById('start-mute-btn').addEventListener('click', () => {
            this.toggleMute();
        });
    }

    toggleMute() {
        const isMuted = soundCtrl.toggleMute();
        const icons = document.querySelectorAll('.mute-icon');
        icons.forEach(ic => {
            ic.textContent = isMuted ? '🔇' : '🔊';
        });
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.uiPauseScreen.classList.remove('hidden');
            soundCtrl.stopEngine();
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.uiPauseScreen.classList.add('hidden');
        }
    }

    startGame() {
        soundCtrl.init();
        soundCtrl.startMusic();
        this.state = 'PLAYING';
        this.uiStartScreen.classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.camera.position.set(0, 3.6, -7.5);
        this.cameraTarget.set(0, 1.2, 14.0);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.cameraTarget);
        this.clock.start();
    }

    restartGame() {
        this.uiGameOverModal.classList.add('hidden');
        this.world.reset(0);
        this.particles.reset();
        this.resetPlayerState();
        this.state = 'PLAYING';
        this.timeScale = 1.0;
        this.clock.start();
    }

    triggerGameOver() {
        if (this.state === 'GAMEOVER') return;
        this.state = 'GAMEOVER';

        // Crash sound & explosion
        soundCtrl.playCrash();
        soundCtrl.stopEngine();

        this.particles.createCrashExplosion(this.playerCar.position);
        this.cameraShake = 1.8;

        // Slow motion effect
        this.timeScale = 0.25;

        // Hide player car or tilt it
        this.playerCar.rotation.z = 0.8;
        this.playerCar.rotation.x = -0.5;

        // Save high score
        let isNewHigh = false;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('neon_drift_highscore', this.highScore.toString());
            isNewHigh = true;
        }

        setTimeout(() => {
            this.timeScale = 1.0;
            this.showGameOverModal(isNewHigh);
        }, 900);
    }

    showGameOverModal(isNewHigh) {
        document.getElementById('final-score').textContent = Math.floor(this.score).toLocaleString();
        document.getElementById('final-distance').textContent = `${Math.floor(this.totalDistance)} m`;
        document.getElementById('final-top-speed').textContent = `${Math.round(this.topSpeedRecord * 3.2)} km/h`;
        document.getElementById('final-near-misses').textContent = this.nearMissCount;

        const newRecordBadge = document.getElementById('new-record-badge');
        if (isNewHigh && this.score > 0) {
            newRecordBadge.classList.remove('hidden');
        } else {
            newRecordBadge.classList.add('hidden');
        }

        this.uiGameOverModal.classList.remove('hidden');
        this.updateHighScoreDisplay();
    }

    updateHighScoreDisplay() {
        if (this.uiHighScore) {
            this.uiHighScore.textContent = Math.floor(this.highScore).toLocaleString();
        }
    }

    // ---------------- FLOATING UI POPUPS ----------------
    showScoreAlert(text, type = 'bonus') {
        const el = document.createElement('div');
        el.className = `alert-popup ${type}`;
        el.textContent = text;
        this.uiFloatScore.appendChild(el);

        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 1200);
    }

    // ---------------- MAIN GAME LOOP ----------------
    loop(timestamp) {
        requestAnimationFrame((t) => this.loop(t));

        let dt = this.clock.getDelta();
        // Guard against massive delta when tabbing away
        if (dt > 0.1) dt = 0.1;
        dt *= this.timeScale;

        if (this.state === 'START') {
            this.updateStartScreen(dt);
        } else if (this.state === 'PLAYING') {
            this.updateGameplay(dt);
        } else if (this.state === 'GAMEOVER') {
            this.updateGameOver(dt);
        }

        // Particle updates run in all states
        this.particles.update(dt);

        this.renderer.render(this.scene, this.camera);
    }

    // ---------------- START SCREEN IDLE ANIMATION ----------------
    updateStartScreen(dt) {
        this.startCamAngle += dt * 0.5;
        // Cinematic sway behind the car looking forward down the highway
        const camX = Math.sin(this.startCamAngle) * 1.5;
        const camY = 3.6 + Math.cos(this.startCamAngle * 0.8) * 0.25;
        const camZ = -7.5 + Math.sin(this.startCamAngle * 0.6) * 0.4;
        this.camera.position.set(camX, camY, camZ);
        this.cameraTarget.set(0, 1.2, 14.0);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.cameraTarget);

        // Subtle wheel spin
        if (this.playerCar.rollingWheels) {
            this.playerCar.rollingWheels.forEach(w => w.rotation.x += dt * 2);
        }
    }

    // ---------------- ACTIVE GAMEPLAY UPDATE ----------------
    updateGameplay(dt) {
        // 1. Difficulty progression: Base speed scales with distance
        const speedProgression = Math.min(1.0, this.totalDistance / 2500);
        const dynamicBaseSpeed = this.baseSpeed + speedProgression * (this.maxNormalSpeed - this.baseSpeed);

        // 2. Nitro & Speed Controls
        this.isBoosting = false;
        this.isBraking = false;
        this.isAccelerating = false;

        let targetSpeed = dynamicBaseSpeed;

        if ((this.keys.boost || this.keys.up) && this.nitro > 0) {
            // Nitro Boost Active
            targetSpeed = this.nitroSpeed;
            this.nitro = Math.max(0, this.nitro - dt * 28);
            this.isBoosting = true;
            this.isAccelerating = true;
            if (Math.random() < 0.3) soundCtrl.playBoost();
        } else if (this.keys.up) {
            // Standard Throttle
            targetSpeed = dynamicBaseSpeed * 1.25;
            this.isAccelerating = true;
            // Slow nitro regen
            this.nitro = Math.min(100, this.nitro + dt * 4);
        } else if (this.keys.down) {
            // Brakes
            targetSpeed = this.minSpeed;
            this.isBraking = true;
            this.nitro = Math.min(100, this.nitro + dt * 8);
        } else {
            // Passive nitro recharge
            this.nitro = Math.min(100, this.nitro + dt * 6);
        }

        // Smooth acceleration / deceleration
        const accelRate = this.isBoosting ? 3.5 : (this.isBraking ? 4.5 : 2.0);
        this.currentSpeed += (targetSpeed - this.currentSpeed) * dt * accelRate;

        // Track top speed
        if (this.currentSpeed > this.topSpeedRecord) {
            this.topSpeedRecord = this.currentSpeed;
        }

        // 3. Forward Movement
        const deltaZ = this.currentSpeed * dt;
        this.playerPos.z += deltaZ;
        this.totalDistance += deltaZ;

        // Score increases with distance & speed
        const speedMultiplier = this.currentSpeed / this.baseSpeed;
        this.score += deltaZ * speedMultiplier * 0.45;

        // 4. Lateral Steering (Smooth lane control)
        const maxSteerSpeed = 16.0;
        let steerInput = 0;
        if (this.keys.left) steerInput += 1;   // Towards +X (screen LEFT)
        if (this.keys.right) steerInput -= 1;  // Towards -X (screen RIGHT)

        const targetVelX = steerInput * maxSteerSpeed;
        this.playerVelocityX += (targetVelX - this.playerVelocityX) * dt * 10;
        this.playerPos.x += this.playerVelocityX * dt;

        // Road boundaries (-5.6 to +5.6)
        const maxRoadX = 5.6;
        if (this.playerPos.x < -maxRoadX) {
            this.playerPos.x = -maxRoadX;
            this.playerVelocityX = 2.0; // Soft guardrail bounce
            this.cameraShake = Math.max(this.cameraShake, 0.3);
            this.particles.spawnTireSmoke(this.playerCar.position);
        } else if (this.playerPos.x > maxRoadX) {
            this.playerPos.x = maxRoadX;
            this.playerVelocityX = -2.0;
            this.cameraShake = Math.max(this.cameraShake, 0.3);
            this.particles.spawnTireSmoke(this.playerCar.position);
        }

        // 5. Update Car Mesh & Visuals
        this.playerCar.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);

        // Body roll / tilt during steering (leaning slightly into turn)
        const targetRoll = this.playerVelocityX * 0.018;
        this.playerCar.rotation.z += (targetRoll - this.playerCar.rotation.z) * dt * 10;

        // Pitch tilt (rearing up on nitro, diving on brakes)
        let targetPitch = 0;
        if (this.isBoosting) targetPitch = -0.04;
        else if (this.isBraking) targetPitch = 0.04;
        this.playerCar.rotation.x += (targetPitch - this.playerCar.rotation.x) * dt * 8;

        // Car yaw / angle into the turn
        const targetYaw = this.playerVelocityX * 0.012;
        this.playerCar.rotation.y += (targetYaw - this.playerCar.rotation.y) * dt * 10;

        // Wheels rotation
        const wheelRotDelta = deltaZ * 2.8;
        if (this.playerCar.rollingWheels) {
            this.playerCar.rollingWheels.forEach(w => w.rotation.x += wheelRotDelta);
        }
        // Front wheels turn
        if (this.playerCar.frontSteerGroups) {
            const steerAngle = steerInput * 0.35;
            this.playerCar.frontSteerGroups.forEach(w => {
                w.rotation.y = steerAngle;
            });
        }

        // Taillights flare when braking
        if (this.playerCar.taillightMesh) {
            const tColor = this.isBraking ? 0xff0022 : 0xaa0022;
            this.playerCar.taillightMesh.material.color.setHex(tColor);
        }

        // Exhaust Particles
        if (this.playerCar.exhaustPoints) {
            this.playerCar.exhaustPoints.forEach(ex => {
                const worldPos = new THREE.Vector3();
                ex.getWorldPosition(worldPos);
                if (this.isBoosting) {
                    this.particles.spawnExhaust(worldPos, true);
                } else if (this.isAccelerating || Math.random() < 0.25) {
                    this.particles.spawnExhaust(worldPos, false);
                }
            });
        }

        // Tire Smoke when swerving hard
        if (Math.abs(this.playerVelocityX) > 8.0) {
            this.particles.spawnTireSmoke(this.playerCar.position);
        }

        // 6. Directional Light & Shadow Camera follows player
        this.dirLight.position.set(
            this.playerPos.x + 25,
            45,
            this.playerPos.z + 30
        );
        this.dirLight.target.position.set(this.playerPos.x, 0, this.playerPos.z + 15);
        this.dirLight.target.updateMatrixWorld();

        // 7. World Manager update (spawns traffic, recycles road)
        const speedRatio = (this.currentSpeed - this.minSpeed) / (this.nitroSpeed - this.minSpeed);
        this.world.update(this.playerPos.z, speedRatio, dt);

        // 8. Speed Lines effect
        this.particles.updateSpeedLines(this.playerPos.z, speedRatio, this.isBoosting);

        // 9. Audio Engine update
        soundCtrl.updateEngine(speedRatio, this.isAccelerating, this.isBraking);

        // 10. Collisions & Near Misses
        this.checkCollisions();

        // 11. Camera Follow & Dynamic Shake
        this.updateCamera(dt, speedRatio);

        // 12. Update UI HUD
        this.updateHUD(speedRatio);
    }

    // ---------------- COLLISION & NEAR-MISS DETECTION ----------------
    checkCollisions() {
        const pX = this.playerPos.x;
        const pZ = this.playerPos.z;
        const carHalfW = 0.9;
        const carHalfL = 1.8;

        // 1. Traffic Cars
        for (let i = 0; i < this.world.traffic.length; i++) {
            const traffic = this.world.traffic[i];
            const tX = traffic.position.x;
            const tZ = traffic.position.z;
            const tHalfW = (traffic.collisionWidth || 1.7) / 2;
            const tHalfL = (traffic.collisionLength || 3.6) / 2;

            const dx = Math.abs(pX - tX);
            const dz = Math.abs(pZ - tZ);

            // Crash Collision Check (AABB)
            if (dx < (carHalfW + tHalfW) * 0.9 && dz < (carHalfL + tHalfL) * 0.9) {
                this.triggerGameOver();
                return;
            }

            // Near Miss Check (Pass close on the side without colliding)
            const minTrafficSideX = (carHalfW + tHalfW) * 0.9;
            const maxTrafficNearMissX = (carHalfW + tHalfW) + 1.3;
            if (dx >= minTrafficSideX && dx < maxTrafficNearMissX && dz < (carHalfL + tHalfL) * 0.85) {
                if (!this.passedEntities.has(traffic)) {
                    this.passedEntities.add(traffic);
                    this.triggerNearMiss(traffic.position);
                }
            }
        }

        // 2. Obstacles (Barriers, Rocks)
        for (let i = 0; i < this.world.obstacles.length; i++) {
            const obs = this.world.obstacles[i];
            const oX = obs.position.x;
            const oZ = obs.position.z;
            const oHalfW = (obs.collisionWidth || 2.0) / 2;
            const oHalfL = (obs.collisionLength || 1.0) / 2;

            const dx = Math.abs(pX - oX);
            const dz = Math.abs(pZ - oZ);

            if (dx < (carHalfW + oHalfW) * 0.85 && dz < (carHalfL + oHalfL) * 0.85) {
                this.triggerGameOver();
                return;
            }

            // Near Miss Check for obstacles
            const minObsSideX = (carHalfW + oHalfW) * 0.85;
            const maxObsNearMissX = (carHalfW + oHalfW) + 1.2;
            if (dx >= minObsSideX && dx < maxObsNearMissX && dz < (carHalfL + oHalfL) * 0.85) {
                if (!this.passedEntities.has(obs)) {
                    this.passedEntities.add(obs);
                    this.triggerNearMiss(obs.position);
                }
            }
        }

        // 3. Collectibles (Gold Energy Coins)
        for (let i = this.world.collectibles.length - 1; i >= 0; i--) {
            const coin = this.world.collectibles[i];
            const dist = Math.hypot(pX - coin.position.x, pZ - coin.position.z);

            if (dist < 1.8) {
                // Collect coin!
                soundCtrl.playCoin();
                this.particles.createCoinSparkles(coin.position);
                this.scene.remove(coin);
                this.world.collectibles.splice(i, 1);

                this.coinCount++;
                this.score += 250;
                this.nitro = Math.min(100, this.nitro + 30); // Instant nitro boost!
                this.showScoreAlert('+250 NITRO!', 'coin');
            }
        }
    }

    triggerNearMiss(pos) {
        this.nearMissCount++;
        this.score += 150;
        this.nitro = Math.min(100, this.nitro + 12);
        soundCtrl.playNearMiss();
        this.cameraShake = Math.max(this.cameraShake, 0.4);
        this.showScoreAlert('NEAR MISS! +150', 'near-miss');
    }

    // ---------------- CAMERA SMOOTH FOLLOW & SHAKE ----------------
    updateCamera(dt, speedRatio) {
        // Base chase camera position
        const targetCamX = this.playerPos.x * 0.65;
        const targetCamY = 3.6 + (this.isBoosting ? 0.4 : 0);
        const targetCamZ = this.playerPos.z - (7.5 + speedRatio * 2.5);

        // Smooth lerping
        this.camera.position.x += (targetCamX - this.camera.position.x) * dt * 9.0;
        this.camera.position.y += (targetCamY - this.camera.position.y) * dt * 6.0;
        this.camera.position.z += (targetCamZ - this.camera.position.z) * dt * 15.0;

        // Camera LookAt
        this.cameraTarget.set(
            this.playerPos.x * 0.4,
            1.2,
            this.playerPos.z + 14.0
        );

        // Camera Shake effect
        if (this.cameraShake > 0.01) {
            this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
            this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
            this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
        }

        // Camera FOV expansion during nitro
        const targetFOV = this.isBoosting ? 74 : (65 + speedRatio * 5);
        this.camera.fov += (targetFOV - this.camera.fov) * dt * 4;
        this.camera.updateProjectionMatrix();

        // Dynamic subtle camera roll in steering direction using camera.up
        const targetRoll = -this.playerVelocityX * 0.012;
        this.camera.up.set(targetRoll, 1, 0).normalize();
        this.camera.lookAt(this.cameraTarget);
    }

    // ---------------- GAME OVER STATE UPDATE ----------------
    updateGameOver(dt) {
        // Continue camera shake decay
        if (this.cameraShake > 0.01) {
            this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
            this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
            this.cameraShake = Math.max(0, this.cameraShake - dt * 1.5);
        }
    }

    // ---------------- UPDATE HUD ----------------
    updateHUD(speedRatio) {
        const speedKmh = Math.round(this.currentSpeed * 3.2);

        this.uiScore.textContent = Math.floor(this.score).toLocaleString();
        this.uiDistance.textContent = `${Math.floor(this.totalDistance)} m`;
        this.uiSpeed.textContent = speedKmh;

        // Speed Bar Fill %
        const speedPct = Math.min(100, Math.round((speedKmh / 310) * 100));
        this.uiSpeedBar.style.width = `${speedPct}%`;

        // Nitro Bar Fill %
        this.uiNitroBar.style.width = `${Math.round(this.nitro)}%`;
        if (this.nitro > 80) {
            this.uiNitroBar.classList.add('glow');
        } else {
            this.uiNitroBar.classList.remove('glow');
        }
    }
}

// Start Game on Window Load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
