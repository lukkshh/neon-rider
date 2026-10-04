import * as THREE from 'three';

/**
 * Procedural 3D Models Builder for Neon Horizon Driving Game
 * Built entirely with Three.js primitives - zero external models needed!
 */
export const Models = {
    // Shared materials and cache for optimum performance
    materials: {},

    initMaterials() {
        if (this.materials.tire) return;

        this.materials.tire = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.8,
            metalness: 0.1
        });

        this.materials.rim = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.2,
            metalness: 0.9
        });

        this.materials.glass = new THREE.MeshPhysicalMaterial ? 
            new THREE.MeshPhysicalMaterial({
                color: 0x111625,
                roughness: 0.1,
                metalness: 0.9,
                transparent: true,
                opacity: 0.85
            }) :
            new THREE.MeshStandardMaterial({
                color: 0x111625,
                roughness: 0.1,
                metalness: 0.9,
                transparent: true,
                opacity: 0.85
            });

        this.materials.headlight = new THREE.MeshBasicMaterial({
            color: 0xe6f7ff
        });

        this.materials.taillight = new THREE.MeshBasicMaterial({
            color: 0xff1e40
        });

        this.materials.barrierStripe = new THREE.MeshStandardMaterial({
            map: this.createStripedTexture('#ff6b00', '#ffffff'),
            roughness: 0.6
        });

        this.materials.roadSign = new THREE.MeshStandardMaterial({
            map: this.createBillboardTexture('NEON DRIFT', '#00f3ff'),
            roughness: 0.4
        });
    },

    // Helper: Canvas-generated warning stripes texture
    createStripedTexture(color1, color2) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = color2;
        ctx.beginPath();
        for (let i = -128; i < 256; i += 32) {
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 32, 0);
            ctx.lineTo(i + 160, 128);
            ctx.lineTo(i + 128, 128);
            ctx.closePath();
        }
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    },

    // Helper: Procedural billboard texture
    createBillboardTexture(text, glowColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Dark background
        ctx.fillStyle = '#0b0d19';
        ctx.fillRect(0, 0, 256, 128);

        // Neon border
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, 240, 112);

        // Grid lines inside
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        for (let y = 16; y < 120; y += 12) {
            ctx.beginPath();
            ctx.moveTo(12, y);
            ctx.lineTo(244, y);
            ctx.stroke();
        }

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 64);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    },

    // Helper: Procedural building window grid texture
    createBuildingTexture(baseColorHex, litRatio = 0.4) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = baseColorHex;
        ctx.fillRect(0, 0, 128, 256);

        const cols = 6;
        const rows = 16;
        const padX = 6;
        const padY = 8;
        const w = (128 - (cols + 1) * padX) / cols;
        const h = (256 - (rows + 1) * padY) / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = padX + c * (w + padX);
                const y = padY + r * (h + padY);
                if (Math.random() < litRatio) {
                    ctx.fillStyle = Math.random() > 0.4 ? '#ffeaa7' : '#74b9ff';
                } else {
                    ctx.fillStyle = '#151928';
                }
                ctx.fillRect(x, y, w, h);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    },

    // ---------------- PLAYER CAR ----------------
    createPlayerCar() {
        this.initMaterials();
        const car = new THREE.Group();

        // Cyber / arcade paint material (vibrant metallic magenta/cyan gradient aesthetic)
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            roughness: 0.25,
            metalness: 0.85
        });

        const accentMaterial = new THREE.MeshStandardMaterial({
            color: 0x111622,
            roughness: 0.5,
            metalness: 0.6
        });

        const spoilerMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0077,
            roughness: 0.3,
            metalness: 0.7
        });

        // 1. Lower Body Chassis
        const chassisGeo = new THREE.BoxGeometry(1.8, 0.45, 3.8);
        const chassis = new THREE.Mesh(chassisGeo, bodyMaterial);
        chassis.position.y = 0.5;
        chassis.castShadow = true;
        chassis.receiveShadow = true;
        car.add(chassis);

        // Front bumper / splitter
        const splitterGeo = new THREE.BoxGeometry(1.85, 0.12, 0.7);
        const splitter = new THREE.Mesh(splitterGeo, accentMaterial);
        splitter.position.set(0, 0.3, 1.85);
        splitter.castShadow = true;
        car.add(splitter);

        // 2. Cabin / Cockpit Roof
        const cabinGeo = new THREE.BoxGeometry(1.35, 0.48, 1.9);
        const cabin = new THREE.Mesh(cabinGeo, bodyMaterial);
        cabin.position.set(0, 0.88, -0.2);
        cabin.castShadow = true;
        car.add(cabin);

        // Windshield and Windows (Dark Glass)
        const windshieldGeo = new THREE.BoxGeometry(1.36, 0.42, 1.6);
        const windshield = new THREE.Mesh(windshieldGeo, this.materials.glass);
        windshield.position.set(0, 0.87, -0.2);
        windshield.scale.set(1.02, 0.95, 1.05);
        car.add(windshield);

        // 3. Rear Spoiler / Wing
        const wingMountGeo = new THREE.BoxGeometry(0.1, 0.35, 0.1);
        const wingMountL = new THREE.Mesh(wingMountGeo, accentMaterial);
        wingMountL.position.set(-0.6, 0.85, -1.65);
        const wingMountR = wingMountL.clone();
        wingMountR.position.x = 0.6;
        car.add(wingMountL);
        car.add(wingMountR);

        const wingBladeGeo = new THREE.BoxGeometry(1.9, 0.08, 0.4);
        const wingBlade = new THREE.Mesh(wingBladeGeo, spoilerMaterial);
        wingBlade.position.set(0, 1.02, -1.65);
        wingBlade.rotation.x = -0.08;
        wingBlade.castShadow = true;
        car.add(wingBlade);

        // 4. Glowing Headlights
        const headlightGeo = new THREE.BoxGeometry(0.35, 0.12, 0.1);
        const headlightL = new THREE.Mesh(headlightGeo, this.materials.headlight);
        headlightL.position.set(-0.62, 0.55, 1.91);
        const headlightR = headlightL.clone();
        headlightR.position.x = 0.62;
        car.add(headlightL);
        car.add(headlightR);

        // Real forward headlight beams (SpotLights)
        const spotL = new THREE.SpotLight(0xaae7ff, 2.5, 40, Math.PI / 6, 0.5, 1.2);
        spotL.position.set(-0.62, 0.55, 1.9);
        const targetL = new THREE.Object3D();
        targetL.position.set(-0.62, 0.2, 25);
        car.add(targetL);
        spotL.target = targetL;
        car.add(spotL);

        const spotR = new THREE.SpotLight(0xaae7ff, 2.5, 40, Math.PI / 6, 0.5, 1.2);
        spotR.position.set(0.62, 0.55, 1.9);
        const targetR = new THREE.Object3D();
        targetR.position.set(0.62, 0.2, 25);
        car.add(targetR);
        spotR.target = targetR;
        car.add(spotR);

        // 5. Glowing Taillights (Red LED bar)
        const taillightGeo = new THREE.BoxGeometry(1.5, 0.1, 0.08);
        const taillight = new THREE.Mesh(taillightGeo, this.materials.taillight);
        taillight.position.set(0, 0.58, -1.91);
        car.add(taillight);

        // Red taillight glow point light
        const tailGlow = new THREE.PointLight(0xff0044, 1.2, 5);
        tailGlow.position.set(0, 0.58, -2.1);
        car.add(tailGlow);

        // 6. Neon Underglow
        const underglow = new THREE.PointLight(0x00f0ff, 1.5, 3.5);
        underglow.position.set(0, 0.15, 0);
        car.add(underglow);

        // 7. Wheels & Rims
        car.wheels = [];
        car.rollingWheels = [];
        car.frontSteerGroups = [];
        const wheelPositions = [
            { x: -0.92, y: 0.35, z: 1.15, isFront: true },
            { x: 0.92, y: 0.35, z: 1.15, isFront: true },
            { x: -0.92, y: 0.35, z: -1.15, isFront: false },
            { x: 0.92, y: 0.35, z: -1.15, isFront: false }
        ];

        wheelPositions.forEach(pos => {
            const steerGroup = new THREE.Group();
            steerGroup.position.set(pos.x, pos.y, pos.z);

            const rollingGroup = new THREE.Group();

            // Tire
            const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 16);
            tireGeo.rotateZ(Math.PI / 2);
            const tire = new THREE.Mesh(tireGeo, this.materials.tire);
            tire.castShadow = true;
            rollingGroup.add(tire);

            // Rim
            const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.29, 8);
            rimGeo.rotateZ(Math.PI / 2);
            const rim = new THREE.Mesh(rimGeo, this.materials.rim);
            rollingGroup.add(rim);

            steerGroup.add(rollingGroup);
            car.add(steerGroup);

            car.wheels.push(steerGroup);
            car.rollingWheels.push(rollingGroup);
            if (pos.isFront) {
                car.frontSteerGroups.push(steerGroup);
            }
        });

        // 8. Dual Exhaust Tips
        const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8);
        exhaustGeo.rotateX(Math.PI / 2);
        const exhaustL = new THREE.Mesh(exhaustGeo, this.materials.rim);
        exhaustL.position.set(-0.45, 0.32, -1.92);
        const exhaustR = exhaustL.clone();
        exhaustR.position.x = 0.45;
        car.add(exhaustL);
        car.add(exhaustR);

        car.exhaustPoints = [exhaustL, exhaustR];

        // Store reference for animation
        car.bodyMesh = chassis;
        car.taillightMesh = taillight;
        car.underglowLight = underglow;

        return car;
    },

    // ---------------- TRAFFIC CARS ----------------
    createTrafficCar(typeIndex = 0, colorHex = 0xff3344) {
        this.initMaterials();
        const car = new THREE.Group();

        const carPaint = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.3,
            metalness: 0.7
        });

        let bodyWidth = 1.7;
        let bodyHeight = 0.45;
        let bodyLength = 3.6;
        let cabinHeight = 0.45;
        let cabinLength = 1.8;
        let cabinOffsetZ = -0.15;

        // Variety: 0: Coupe/Sedan, 1: SUV, 2: Van, 3: Muscle/Sports
        if (typeIndex === 1) { // SUV
            bodyHeight = 0.55;
            cabinHeight = 0.55;
            cabinLength = 2.2;
            cabinOffsetZ = -0.25;
        } else if (typeIndex === 2) { // Van
            bodyHeight = 0.6;
            cabinHeight = 0.65;
            cabinLength = 2.6;
            cabinOffsetZ = -0.2;
            bodyWidth = 1.8;
        } else if (typeIndex === 3) { // Muscle / Sports
            bodyHeight = 0.4;
            cabinHeight = 0.38;
            cabinLength = 1.5;
            cabinOffsetZ = -0.3;
        }

        // Chassis
        const chassisGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
        const chassis = new THREE.Mesh(chassisGeo, carPaint);
        chassis.position.y = bodyHeight / 2 + 0.25;
        chassis.castShadow = true;
        chassis.receiveShadow = true;
        car.add(chassis);

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(bodyWidth * 0.85, cabinHeight, cabinLength);
        const cabin = new THREE.Mesh(cabinGeo, this.materials.glass);
        cabin.position.set(0, chassis.position.y + bodyHeight / 2 + cabinHeight / 2, cabinOffsetZ);
        cabin.castShadow = true;
        car.add(cabin);

        // Cabin Roof Cap
        const roofGeo = new THREE.BoxGeometry(bodyWidth * 0.85, 0.06, cabinLength);
        const roof = new THREE.Mesh(roofGeo, carPaint);
        roof.position.set(0, cabin.position.y + cabinHeight / 2, cabinOffsetZ);
        car.add(roof);

        // Headlights
        const hlGeo = new THREE.BoxGeometry(0.3, 0.12, 0.08);
        const hlL = new THREE.Mesh(hlGeo, this.materials.headlight);
        hlL.position.set(-bodyWidth * 0.36, chassis.position.y, bodyLength / 2 + 0.04);
        const hlR = hlL.clone();
        hlR.position.x = -hlL.position.x;
        car.add(hlL);
        car.add(hlR);

        // Taillights
        const tlGeo = new THREE.BoxGeometry(0.32, 0.1, 0.08);
        const tlL = new THREE.Mesh(tlGeo, this.materials.taillight);
        tlL.position.set(-bodyWidth * 0.36, chassis.position.y, -bodyLength / 2 - 0.04);
        const tlR = tlL.clone();
        tlR.position.x = -tlL.position.x;
        car.add(tlL);
        car.add(tlR);

        // Wheels
        car.wheels = [];
        const wheelY = 0.32;
        const wheelOffsetZ = bodyLength * 0.3;
        const wheelOffsetX = bodyWidth * 0.52;
        const positions = [
            [-wheelOffsetX, wheelY, wheelOffsetZ],
            [wheelOffsetX, wheelY, wheelOffsetZ],
            [-wheelOffsetX, wheelY, -wheelOffsetZ],
            [wheelOffsetX, wheelY, -wheelOffsetZ]
        ];

        positions.forEach(([x, y, z]) => {
            const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
            wheelGeo.rotateZ(Math.PI / 2);
            const wheel = new THREE.Mesh(wheelGeo, this.materials.tire);
            wheel.position.set(x, y, z);
            wheel.castShadow = true;
            car.add(wheel);
            car.wheels.push(wheel);
        });

        // Bounding box size data for collision
        car.collisionWidth = bodyWidth;
        car.collisionLength = bodyLength;
        car.collisionHeight = bodyHeight + cabinHeight + 0.3;

        return car;
    },

    // ---------------- OBSTACLES: ROAD BLOCK / BARRIER ----------------
    createRoadBarrier() {
        this.initMaterials();
        const barrier = new THREE.Group();

        // Main striped board
        const boardGeo = new THREE.BoxGeometry(2.4, 0.6, 0.12);
        const board = new THREE.Mesh(boardGeo, this.materials.barrierStripe);
        board.position.y = 0.75;
        board.castShadow = true;
        barrier.add(board);

        // Metal Legs
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
        const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8);
        const legL = new THREE.Mesh(legGeo, legMaterial);
        legL.position.set(-0.95, 0.45, 0);
        legL.castShadow = true;
        const legR = legL.clone();
        legR.position.x = 0.95;
        barrier.add(legL);
        barrier.add(legR);

        // Feet
        const footGeo = new THREE.BoxGeometry(0.12, 0.06, 0.6);
        const footL = new THREE.Mesh(footGeo, legMaterial);
        footL.position.set(-0.95, 0.03, 0);
        const footR = footL.clone();
        footR.position.x = 0.95;
        barrier.add(footL);
        barrier.add(footR);

        // Flashing Warning Strobe Light
        const lightBoxGeo = new THREE.BoxGeometry(0.2, 0.2, 0.15);
        const lightBox = new THREE.Mesh(lightBoxGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
        lightBox.position.set(0, 1.15, 0);
        barrier.add(lightBox);

        const strobeGeo = new THREE.SphereGeometry(0.1, 10, 8);
        const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const strobe = new THREE.Mesh(strobeGeo, strobeMat);
        strobe.position.set(0, 1.25, 0);
        barrier.add(strobe);

        const pointLight = new THREE.PointLight(0xffaa00, 1.2, 6);
        pointLight.position.set(0, 1.3, 0);
        barrier.add(pointLight);

        barrier.strobeLight = pointLight;
        barrier.strobeMesh = strobe;

        barrier.collisionWidth = 2.4;
        barrier.collisionLength = 0.6;
        barrier.collisionHeight = 1.3;

        return barrier;
    },

    // ---------------- OBSTACLE: ROCK / BOULDER ----------------
    createRock() {
        const rock = new THREE.Group();
        const rockGeo = new THREE.DodecahedronGeometry(0.7, 1);

        // Jitter vertices for rugged low-poly rock look
        const pos = rockGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            const scale = 0.85 + Math.random() * 0.3;
            pos.setXYZ(i, vx * scale, vy * scale * 0.75, vz * scale);
        }
        rockGeo.computeVertexNormals();

        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x5a5d6b,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
        });

        const mesh = new THREE.Mesh(rockGeo, rockMat);
        mesh.position.y = 0.45;
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        rock.add(mesh);

        rock.collisionWidth = 1.3;
        rock.collisionLength = 1.3;
        rock.collisionHeight = 0.9;

        return rock;
    },

    // ---------------- COLLECTIBLE: GOLD ENERGY COIN ----------------
    createCoin() {
        const coin = new THREE.Group();

        // Glowing outer coin ring
        const coinGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.12, 16);
        coinGeo.rotateX(Math.PI / 2);

        const coinMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffa500,
            emissiveIntensity: 0.5,
            metalness: 0.9,
            roughness: 0.15
        });

        const mesh = new THREE.Mesh(coinGeo, coinMat);
        mesh.position.y = 0.8;
        coin.add(mesh);

        // Inner glowing star/core
        const coreGeo = new THREE.OctahedronGeometry(0.2, 0);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 0.8;
        coin.add(core);

        // Light
        const light = new THREE.PointLight(0xffd700, 1.2, 4);
        light.position.y = 0.8;
        coin.add(light);

        coin.rotationMesh = mesh;
        coin.coreMesh = core;
        coin.collisionRadius = 0.7;

        return coin;
    },

    // ---------------- SCENERY: PINE TREE ----------------
    createPineTree() {
        const tree = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.7;
        trunk.castShadow = true;
        tree.add(trunk);

        // Foliage cones (3 stacked tiers)
        const foliageMat = new THREE.MeshStandardMaterial({
            color: 0x1b4332,
            roughness: 0.8,
            flatShading: true
        });

        const tiers = [
            { r: 1.4, h: 1.6, y: 1.8 },
            { r: 1.1, h: 1.4, y: 2.7 },
            { r: 0.75, h: 1.2, y: 3.5 }
        ];

        tiers.forEach(t => {
            const coneGeo = new THREE.ConeGeometry(t.r, t.h, 6);
            const cone = new THREE.Mesh(coneGeo, foliageMat);
            cone.position.y = t.y;
            cone.castShadow = true;
            tree.add(cone);
        });

        return tree;
    },

    // ---------------- SCENERY: PALM TREE ----------------
    createPalmTree() {
        const tree = new THREE.Group();

        // Trunk with slight curve
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e4726, roughness: 0.85, flatShading: true });
        let currY = 0;
        let currX = 0;
        const segments = 5;

        for (let i = 0; i < segments; i++) {
            const h = 0.8;
            const r1 = 0.24 - i * 0.02;
            const r2 = 0.22 - i * 0.02;
            const segGeo = new THREE.CylinderGeometry(r2, r1, h, 6);
            const seg = new THREE.Mesh(segGeo, trunkMat);
            seg.position.set(currX, currY + h / 2, 0);
            seg.rotation.z = -0.06;
            seg.castShadow = true;
            tree.add(seg);

            currY += h * 0.95;
            currX += 0.07;
        }

        // Palm Fronds
        const frondMat = new THREE.MeshStandardMaterial({
            color: 0x2d6a4f,
            roughness: 0.7,
            side: THREE.DoubleSide,
            flatShading: true
        });

        const frondCount = 7;
        for (let i = 0; i < frondCount; i++) {
            const angle = (i / frondCount) * Math.PI * 2;
            const frondGeo = new THREE.ConeGeometry(0.5, 2.2, 4);
            frondGeo.translate(0, 1.1, 0);
            frondGeo.rotateX(Math.PI / 3);

            const frond = new THREE.Mesh(frondGeo, frondMat);
            frond.position.set(currX, currY, 0);
            frond.rotation.y = angle;
            frond.castShadow = true;
            tree.add(frond);
        }

        return tree;
    },

    // ---------------- SCENERY: STREET LIGHT ----------------
    createStreetLight() {
        const lightGroup = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x2c3345, metalness: 0.8, roughness: 0.3 });

        // Vertical Pole
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6.0, 8);
        const pole = new THREE.Mesh(poleGeo, metalMat);
        pole.position.y = 3.0;
        pole.castShadow = true;
        lightGroup.add(pole);

        // Horizontal Arm
        const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8);
        armGeo.rotateZ(Math.PI / 2);
        const arm = new THREE.Mesh(armGeo, metalMat);
        arm.position.set(0.8, 5.8, 0);
        lightGroup.add(arm);

        // Lamp Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.14, 0.3);
        const head = new THREE.Mesh(headGeo, metalMat);
        head.position.set(1.6, 5.75, 0);
        lightGroup.add(head);

        // Glowing Emissive Face
        const glowGeo = new THREE.PlaneGeometry(0.44, 0.24);
        glowGeo.rotateX(Math.PI / 2);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa });
        const glowPlane = new THREE.Mesh(glowGeo, glowMat);
        glowPlane.position.set(1.6, 5.67, 0);
        lightGroup.add(glowPlane);

        // Point light cast downward
        const light = new THREE.PointLight(0xffeaad, 1.5, 14, 1.5);
        light.position.set(1.6, 5.5, 0);
        lightGroup.add(light);

        return lightGroup;
    },

    // ---------------- SCENERY: PROCEDURAL CITY BUILDING ----------------
    createBuilding(height = 14, width = 6, depth = 6) {
        const building = new THREE.Group();
        const colors = ['#0c1022', '#14172e', '#09101d'];
        const baseColor = colors[Math.floor(Math.random() * colors.length)];

        const geo = new THREE.BoxGeometry(width, height, depth);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x222a42,
            map: this.createBuildingTexture(baseColor, 0.35 + Math.random() * 0.2),
            roughness: 0.6,
            metalness: 0.3
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = height / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        building.add(mesh);

        // Rooftop Antenna with blinking beacon
        if (height > 10) {
            const antennaGeo = new THREE.CylinderGeometry(0.04, 0.08, 2.5, 6);
            const antennaMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
            const antenna = new THREE.Mesh(antennaGeo, antennaMat);
            antenna.position.set(0, height + 1.25, 0);
            building.add(antenna);

            const beaconGeo = new THREE.SphereGeometry(0.12, 6, 6);
            const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
            const beacon = new THREE.Mesh(beaconGeo, beaconMat);
            beacon.position.set(0, height + 2.5, 0);
            building.add(beacon);
        }

        return building;
    },

    // ---------------- SCENERY: BILLBOARD ----------------
    createBillboard(text = "OVERDRIVE", glowColor = "#00f0ff") {
        this.initMaterials();
        const billboard = new THREE.Group();

        // Frame
        const frameGeo = new THREE.BoxGeometry(4.2, 2.2, 0.2);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x111625, metalness: 0.8 });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = 4.5;
        frame.castShadow = true;
        billboard.add(frame);

        // Sign Plane facing oncoming driver
        const signGeo = new THREE.PlaneGeometry(4.0, 2.0);
        const signMat = new THREE.MeshStandardMaterial({
            map: this.createBillboardTexture(text, glowColor),
            roughness: 0.3
        });
        const signMesh = new THREE.Mesh(signGeo, signMat);
        signMesh.position.set(0, 4.5, -0.11);
        signMesh.rotation.y = Math.PI;
        billboard.add(signMesh);

        // Twin Support Pillars
        const pillarGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.5, 8);
        const pillarL = new THREE.Mesh(pillarGeo, frameMat);
        pillarL.position.set(-1.4, 2.25, 0);
        pillarL.castShadow = true;
        const pillarR = pillarL.clone();
        pillarR.position.x = 1.4;
        billboard.add(pillarL);
        billboard.add(pillarR);

        return billboard;
    }
};
