import * as THREE from 'three';
import { Models } from './Models.js';
import { TrafficModels } from './TrafficModels.js';

/**
 * World & Environment Manager
 * Controls the endless highway, roadside decorations, traffic spawning, and obstacle pooling
 */
export class World {
    // World collections and cached materials are initialized by the setup methods.
    [key: string]: any;
    constructor(scene) {
        this.scene = scene;

        // Highway lane definitions (X coordinates)
        this.lanes = [-4.2, 0, 4.2];
        this.roadWidth = 14;
        this.segmentLength = 60;
        this.segmentCount = 6; // Spans 360 units ahead

        this.roadSegments = [];
        this.sceneryObjects = [];
        this.traffic = [];
        this.trafficModelsReady = false;
        this.adminTrafficDensity = 1;
        this.adminPoliceChaseDuration = 12;
        this.adminPoliceFlashRate = 5.5;
        TrafficModels.load().then(() => { this.trafficModelsReady = true; }).catch(error => {
            console.error('Unable to load GLB traffic models.', error);
        });
        this.obstacles = [];
        this.collectibles = [];

        // Spawn timer
        this.spawnDistanceTracker = 0;
        this.nextSpawnDistance = 25;

        this.initTextures();
        this.buildInitialRoad();
        this.buildHorizon();
    }

    initTextures() {
        // Procedural road markings canvas texture
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Asphalt base
        ctx.fillStyle = '#181b24';
        ctx.fillRect(0, 0, 512, 512);

        // Asphalt noise grain
        for (let i = 0; i < 15000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.1)';
            ctx.fillRect(x, y, 1, 1);
        }

        // Road edge solid lines (Glowing cyan/yellow)
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(28, 0, 8, 512);
        ctx.fillRect(476, 0, 8, 512);

        // Center lane dashed lines (Bright warm white/yellow)
        ctx.fillStyle = '#ffea75';
        const dashLen = 64;
        const gapLen = 64;
        const lane1X = 178;
        const lane2X = 326;

        for (let y = 16; y < 512; y += dashLen + gapLen) {
            ctx.fillRect(lane1X, y, 8, dashLen);
            ctx.fillRect(lane2X, y, 8, dashLen);
        }

        this.roadTexture = new THREE.CanvasTexture(canvas);
        this.roadTexture.wrapS = THREE.RepeatWrapping;
        this.roadTexture.wrapT = THREE.RepeatWrapping;
        this.roadTexture.repeat.set(1, this.segmentLength / 20);

        // Road material
        this.roadMaterial = new THREE.MeshStandardMaterial({
            map: this.roadTexture,
            roughness: 0.7,
            metalness: 0.15
        });

        // Terrain material (Dark neon grid / synth ground)
        this.groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x090c16,
            roughness: 0.9,
            metalness: 0.1
        });

        // Guardrail material
        this.guardrailMaterial = new THREE.MeshStandardMaterial({
            color: 0x5a6375,
            metalness: 0.8,
            roughness: 0.3
        });
    }

    buildInitialRoad() {
        for (let i = 0; i < this.segmentCount; i++) {
            const z = i * this.segmentLength - 30;
            this.createRoadSegment(z);
        }
    }

    createRoadSegment(zPos) {
        const segment = new THREE.Group();
        segment.position.z = zPos;

        // 1. Asphalt Highway Surface
        const roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.segmentLength);
        roadGeo.rotateX(-Math.PI / 2);
        const roadMesh = new THREE.Mesh(roadGeo, this.roadMaterial);
        roadMesh.receiveShadow = true;
        segment.add(roadMesh);

        // 2. Curbs (Left & Right)
        const curbGeo = new THREE.BoxGeometry(0.5, 0.25, this.segmentLength);
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x2e3444 });
        const curbL = new THREE.Mesh(curbGeo, curbMat);
        curbL.position.set(-this.roadWidth / 2 - 0.25, 0.12, 0);
        const curbR = curbL.clone();
        curbR.position.x = this.roadWidth / 2 + 0.25;
        segment.add(curbL);
        segment.add(curbR);

        // 3. Metal Guardrails
        const railGeo = new THREE.BoxGeometry(0.18, 0.45, this.segmentLength);
        const railL = new THREE.Mesh(railGeo, this.guardrailMaterial);
        railL.position.set(-this.roadWidth / 2 - 0.6, 0.5, 0);
        railL.castShadow = true;
        const railR = railL.clone();
        railR.position.x = this.roadWidth / 2 + 0.6;
        segment.add(railL);
        segment.add(railR);

        // Guardrail Posts
        const postGeo = new THREE.BoxGeometry(0.15, 0.8, 0.15);
        for (let pz = -this.segmentLength / 2 + 5; pz < this.segmentLength / 2; pz += 10) {
            const postL = new THREE.Mesh(postGeo, this.guardrailMaterial);
            postL.position.set(-this.roadWidth / 2 - 0.6, 0.4, pz);
            const postR = postL.clone();
            postR.position.x = this.roadWidth / 2 + 0.6;
            segment.add(postL);
            segment.add(postR);
        }

        // 4. Ground / Terrain Planes on sides
        const terrainW = 90;
        const terrainGeo = new THREE.PlaneGeometry(terrainW, this.segmentLength);
        terrainGeo.rotateX(-Math.PI / 2);
        const groundL = new THREE.Mesh(terrainGeo, this.groundMaterial);
        groundL.position.set(-this.roadWidth / 2 - terrainW / 2 - 0.5, -0.05, 0);
        groundL.receiveShadow = true;
        const groundR = groundL.clone();
        groundR.position.x = this.roadWidth / 2 + terrainW / 2 + 0.5;
        groundR.receiveShadow = true;
        segment.add(groundL);
        segment.add(groundR);

        // 5. Roadside Decor (Trees, Street Lights, Buildings, Billboards)
        this.populateSegmentDecor(segment);

        this.scene.add(segment);
        this.roadSegments.push(segment);
    }

    populateSegmentDecor(segment) {
        // Street lights on alternating sides
        const streetLight = Models.createStreetLight();
        const side = Math.random() > 0.5 ? 1 : -1;
        streetLight.position.set(side * (this.roadWidth / 2 + 1.2), 0, (Math.random() - 0.5) * 20);
        if (side > 0) streetLight.rotation.y = Math.PI;
        segment.add(streetLight);

        // Roadside Trees / Palms
        const treeCount = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < treeCount; i++) {
            const isLeft = Math.random() > 0.5;
            const treeSide = isLeft ? -1 : 1;
            const distFromRoad = this.roadWidth / 2 + 2.5 + Math.random() * 22;
            const tree = Math.random() > 0.4 ? Models.createPalmTree() : Models.createPineTree();

            const s = 0.8 + Math.random() * 0.45;
            tree.scale.set(s, s, s);
            tree.position.set(
                treeSide * distFromRoad,
                0,
                (Math.random() - 0.5) * (this.segmentLength - 4)
            );
            tree.rotation.y = Math.random() * Math.PI * 2;
            segment.add(tree);
        }

        // Low-poly City Buildings further back
        const buildingCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < buildingCount; i++) {
            const bSide = Math.random() > 0.5 ? -1 : 1;
            const bDist = this.roadWidth / 2 + 25 + Math.random() * 30;
            const bHeight = 8 + Math.random() * 22;
            const bWidth = 6 + Math.random() * 8;
            const bDepth = 6 + Math.random() * 8;

            const bldg = Models.createBuilding(bHeight, bWidth, bDepth);
            bldg.position.set(
                bSide * bDist,
                0,
                (Math.random() - 0.5) * (this.segmentLength - 8)
            );
            segment.add(bldg);
        }

        // Occasional Neon Billboard
        if (Math.random() > 0.6) {
            const bbSide = Math.random() > 0.5 ? -1 : 1;
            const bbSlogans = ["CYBER RUN", "OVERDRIVE", "TURBO BOOST", "NEON HIGHWAY", "SYNTH DRIFT"];
            const bbColors = ["#00f0ff", "#ff0077", "#ffaa00", "#7000ff", "#00ff66"];
            const idx = Math.floor(Math.random() * bbSlogans.length);

            const billboard = Models.createBillboard(bbSlogans[idx], bbColors[idx]);
            billboard.position.set(
                bbSide * (this.roadWidth / 2 + 6),
                0,
                (Math.random() - 0.5) * 30
            );
            if (bbSide < 0) billboard.rotation.y = 0.2;
            else billboard.rotation.y = -0.2;
            segment.add(billboard);
        }
    }

    buildHorizon() {
        // Distant retro neon sun / horizon arc
        const sunGeo = new THREE.CircleGeometry(38, 32);
        const sunMat = new THREE.MeshBasicMaterial({
            color: 0xff416c,
            side: THREE.DoubleSide
        });
        const sun = new THREE.Mesh(sunGeo, sunMat);
        sun.position.set(0, 14, 380);
        this.scene.add(sun);
        this.sun = sun;

        // Distant mountain range silhouettes
        const mountainGroup = new THREE.Group();
        const mountainCount = 14;
        for (let i = 0; i < mountainCount; i++) {
            const mGeo = new THREE.ConeGeometry(25 + Math.random() * 35, 30 + Math.random() * 40, 4);
            const mMat = new THREE.MeshStandardMaterial({
                color: 0x150b28,
                roughness: 0.95,
                metalness: 0.1,
                flatShading: true
            });
            const mountain = new THREE.Mesh(mGeo, mMat);
            const mx = (i - mountainCount / 2) * 38 + (Math.random() - 0.5) * 15;
            mountain.position.set(mx, 0, 360 + (Math.random() - 0.5) * 40);
            mountain.rotation.y = Math.random() * Math.PI;
            mountainGroup.add(mountain);
        }
        this.scene.add(mountainGroup);
        this.mountainGroup = mountainGroup;
    }

    // ---------------- DYNAMIC SPAWNING ----------------
    update(playerZ, playerSpeedRatio, dt, playerX = 0, playerSpeed = 32) {
        // 1. Recycle road segments that fall behind player
        this.roadSegments.forEach(segment => {
            if (segment.position.z < playerZ - this.segmentLength * 1.5) {
                // Find farthest segment ahead
                let maxZ = -Infinity;
                this.roadSegments.forEach(s => {
                    if (s.position.z > maxZ) maxZ = s.position.z;
                });
                segment.position.z = maxZ + this.segmentLength;
            }
        });

        // 2. Parallax horizon follows player
        if (this.sun) this.sun.position.z = playerZ + 360;
        if (this.mountainGroup) this.mountainGroup.position.z = playerZ + 340;

        // 3. Spawn traffic, obstacles, or coins based on distance traveled
        this.spawnDistanceTracker += dt * (30 + playerSpeedRatio * 60);

        if (this.adminTrafficDensity > 0 && this.spawnDistanceTracker >= this.nextSpawnDistance / this.adminTrafficDensity) {
            this.spawnDistanceTracker = 0;
            // Spawn interval shortens slightly as speed increases
            this.nextSpawnDistance = 22 + Math.random() * 20 - playerSpeedRatio * 6;
            this.spawnRandomEntity(playerZ, playerX, playerSpeed);
        }

        // 4. Update traffic cars (they move forward down the road)
        for (let i = this.traffic.length - 1; i >= 0; i--) {
            const car = this.traffic[i];
            car.position.z += car.speed * dt;

            if (car.isPolice) {
                car.policeFlashElapsed += dt;
                if (car.policeLights) {
                    const flashCycle = car.policeFlashElapsed * this.adminPoliceFlashRate;
                    const activeLight = Math.floor(flashCycle) % 2;
                    const pulsePhase = flashCycle % 1;
                    const flashOn = pulsePhase < 0.16 || (pulsePhase > 0.3 && pulsePhase < 0.46);
                    car.policeLights.forEach((light, lightIndex) => {
                        light.visible = lightIndex === activeLight && flashOn;
                    });
                }

                const gap = playerZ - car.position.z;
                if (car.policeInterceptionPending && gap > 14) car.policeInterceptionPending = false;
                if (!car.policeInterceptionPending) {
                    car.policeChaseElapsed += dt;
                    if (car.policeChaseElapsed >= this.adminPoliceChaseDuration) {
                        TrafficModels.release(car);
                        this.traffic.splice(i, 1);
                        continue;
                    }
                }

                const playerLane = this.lanes.reduce((closest, lane, index) =>
                    Math.abs(lane - playerX) < Math.abs(this.lanes[closest] - playerX) ? index : closest, 0);
                const targetLane = car.policeInterceptionPending ? car.lane : playerLane;
                car.policeTargetX = this.lanes[targetLane];
                if (car.policeTargetX !== null) {
                    const remainingX = car.policeTargetX - car.position.x;
                    car.position.x += Math.sign(remainingX) * Math.min(Math.abs(remainingX), dt * 2.2);
                }
                // Catch up from behind, then ease off to follow at a safe distance.
                const speedAdjustment = THREE.MathUtils.clamp((gap - 20) * 0.16, -8, 14);
                car.speed = Math.max(12, playerSpeed + speedAdjustment);
            }

            // Rotate wheels
            if (car.wheels) {
                const rot = car.speed * dt * 2.8;
                car.wheels.forEach(w => w.rotation.x += rot);
            }

            // Remove if far behind or too far ahead of player
            const behindLimit = car.isPolice ? 115 : 35;
            if (car.position.z < playerZ - behindLimit || car.position.z > playerZ + 350) {
                TrafficModels.release(car);
                this.traffic.splice(i, 1);
            }
        }

        // 5. Update obstacles & barriers
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];

            // Strobe warning light flash
            if (obs.strobeLight) {
                const flash = Math.sin(Date.now() * 0.015) > 0.2;
                obs.strobeLight.intensity = flash ? 2.5 : 0.1;
                obs.strobeMesh.material.color.setHex(flash ? 0xffaa00 : 0x442200);
            }

            if (obs.position.z < playerZ - 35) {
                this.scene.remove(obs);
                this.obstacles.splice(i, 1);
            }
        }

        // 6. Update collectible coins (spin & bob)
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const coin = this.collectibles[i];
            if (coin.rotationMesh) {
                coin.rotationMesh.rotation.z += dt * 3.5;
                coin.coreMesh.rotation.y += dt * 4.0;
                coin.position.y = 0.8 + Math.sin(Date.now() * 0.006 + coin.position.z) * 0.25;
            }

            if (coin.position.z < playerZ - 35) {
                this.scene.remove(coin);
                this.collectibles.splice(i, 1);
            }
        }
    }

    spawnPolice(playerZ, playerX, playerSpeed): boolean {
        if (!this.trafficModelsReady) return false;
        const activePolice = this.traffic.find(car => car.isPolice);
        const police = activePolice ?? TrafficModels.acquirePolice();
        if (!police) return false;

        const playerLane = this.lanes.reduce((closest, lane, index) =>
            Math.abs(lane - playerX) < Math.abs(this.lanes[closest] - playerX) ? index : closest, 0);
        const spawnLane = playerLane === 0 ? 1 : playerLane - 1;
        police.position.set(this.lanes[spawnLane], 0, playerZ + 65);
        police.speed = Math.max(12, playerSpeed - 8);
        police.lane = spawnLane;
        police.policeFlashElapsed = 0;
        police.policeChaseElapsed = 0;
        police.policeInterceptionPending = true;
        if (!activePolice) {
            this.scene.add(police);
            this.traffic.push(police);
        }
        return true;
    }

    spawnRandomEntity(playerZ, playerX = 0, playerSpeed = 32) {
        // Choose random lane
        const laneIndex = Math.floor(Math.random() * this.lanes.length);
        const laneX = this.lanes[laneIndex];
        const spawnZ = playerZ + 120 + Math.random() * 40;

        // Ensure we don't spawn two items too close in the same lane
        const tooClose = [...this.traffic, ...this.obstacles, ...this.collectibles].some(item => {
            return Math.abs(item.position.x - laneX) < 2.0 && Math.abs(item.position.z - spawnZ) < 18;
        });
        if (tooClose) return;

        const roll = Math.random();

        if (roll < 0.50 && this.trafficModelsReady) {
            // 50% chance: Traffic Car
            const trafficCar = TrafficModels.acquire(!this.traffic.some(car => car.isPolice));
            if (!trafficCar) return;
            if (trafficCar.isPolice) {
                TrafficModels.release(trafficCar);
                this.spawnPolice(playerZ, playerX, playerSpeed);
                return;
            }
            trafficCar.position.set(laneX, 0, spawnZ);
            trafficCar.speed = 22 + Math.random() * 18;
            trafficCar.lane = laneIndex;

            this.scene.add(trafficCar);
            this.traffic.push(trafficCar);
        } else if (roll < 0.75) {
            // 25% chance: Road Hazard (Barrier or Rock)
            const isBarrier = Math.random() > 0.4;
            const obstacle = isBarrier ? Models.createRoadBarrier() : Models.createRock();
            obstacle.position.set(laneX, 0, spawnZ);

            this.scene.add(obstacle);
            this.obstacles.push(obstacle);
        } else {
            // 25% chance: Collectible Energy Coin
            const coin = Models.createCoin();
            coin.position.set(laneX, 0.8, spawnZ);

            this.scene.add(coin);
            this.collectibles.push(coin);
        }
    }

    reset(initialPlayerZ = 0) {
        // Remove all traffic
        this.traffic.forEach(car => TrafficModels.release(car));
        this.traffic = [];

        // Remove all obstacles
        this.obstacles.forEach(obs => this.scene.remove(obs));
        this.obstacles = [];

        // Remove all collectibles
        this.collectibles.forEach(c => this.scene.remove(c));
        this.collectibles = [];

        // Reset road segments ahead of player
        for (let i = 0; i < this.roadSegments.length; i++) {
            this.roadSegments[i].position.z = initialPlayerZ + i * this.segmentLength - 30;
        }

        this.spawnDistanceTracker = 0;
        this.nextSpawnDistance = 25;
    }
}
