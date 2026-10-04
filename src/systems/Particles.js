import * as THREE from 'three';

/**
 * Particle Effects System for Neon Horizon Driving Game
 * Handles speed lines, exhaust flames, tire smoke, crash debris, and coin bursts
 */
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.speedLines = null;
        this.speedLineData = [];
        this.initSpeedLines();
    }

    // ---------------- SPEED LINES EFFECT ----------------
    initSpeedLines() {
        const count = 70;
        const positions = new Float32Array(count * 6); // 2 vertices per line (x,y,z * 2)
        const colors = new Float32Array(count * 6);

        this.speedLineData = [];

        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 26;
            const y = 0.5 + Math.random() * 8;
            const z = Math.random() * 80;
            const len = 3 + Math.random() * 6;

            const idx = i * 6;
            positions[idx] = x;
            positions[idx + 1] = y;
            positions[idx + 2] = z;

            positions[idx + 3] = x;
            positions[idx + 4] = y;
            positions[idx + 5] = z + len;

            // Cyan / white glow
            for (let v = 0; v < 2; v++) {
                colors[idx + v * 3] = 0.4 + Math.random() * 0.6;
                colors[idx + v * 3 + 1] = 0.8 + Math.random() * 0.2;
                colors[idx + v * 3 + 2] = 1.0;
            }

            this.speedLineData.push({
                x, y, z, len,
                speed: 1.2 + Math.random() * 0.8
            });
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending
        });

        this.speedLines = new THREE.LineSegments(geo, mat);
        this.scene.add(this.speedLines);
    }

    updateSpeedLines(carZ, speedRatio, isBoosting) {
        if (!this.speedLines) return;

        // Only visible when speed is moderately high or boosting
        const targetOpacity = isBoosting ? 0.85 : (speedRatio > 0.6 ? (speedRatio - 0.6) * 1.5 : 0);
        this.speedLines.material.opacity += (targetOpacity - this.speedLines.material.opacity) * 0.1;

        if (this.speedLines.material.opacity < 0.01) return;

        const posAttr = this.speedLines.geometry.attributes.position;
        const count = this.speedLineData.length;

        for (let i = 0; i < count; i++) {
            const line = this.speedLineData[i];
            line.z -= (40 + speedRatio * 80) * 0.02 * line.speed;

            // Recycle speed line when it passes behind camera
            if (line.z < carZ - 10) {
                line.z = carZ + 60 + Math.random() * 30;
                line.x = (Math.random() - 0.5) * 24;
                line.y = 0.5 + Math.random() * 7;
            }

            const idx = i * 6;
            posAttr.setXYZ(idx, line.x, line.y, line.z);
            posAttr.setXYZ(idx + 1, line.x, line.y, line.z + line.len * (1 + speedRatio));
        }

        posAttr.needsUpdate = true;
    }

    // ---------------- EXHAUST / NITRO SPARKS ----------------
    spawnExhaust(pos, isNitro = false) {
        const count = isNitro ? 3 : 1;
        for (let i = 0; i < count; i++) {
            const size = isNitro ? 0.16 + Math.random() * 0.12 : 0.08 + Math.random() * 0.06;
            const geo = new THREE.SphereGeometry(size, 4, 4);
            const color = isNitro ? 
                (Math.random() > 0.4 ? 0x00f0ff : 0xffffff) : 
                (Math.random() > 0.3 ? 0xff5500 : 0xffaa00);

            const mat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(pos);
            mesh.position.x += (Math.random() - 0.5) * 0.1;
            mesh.position.y += (Math.random() - 0.5) * 0.05;
            this.scene.add(mesh);

            this.particles.push({
                mesh: mesh,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() * 0.3) + 0.1,
                    -(1.5 + Math.random() * 2.0)
                ),
                scaleDelta: -0.8,
                life: 0.25 + Math.random() * 0.15,
                maxLife: 0.35
            });
        }
    }

    // ---------------- TIRE SMOKE ----------------
    spawnTireSmoke(pos) {
        const geo = new THREE.SphereGeometry(0.2, 6, 6);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.4,
            roughness: 1.0
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.position.y = 0.2;
        this.scene.add(mesh);

        this.particles.push({
            mesh: mesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,
                0.3 + Math.random() * 0.3,
                -(Math.random() * 0.5)
            ),
            scaleDelta: 2.5,
            life: 0.4,
            maxLife: 0.4
        });
    }

    // ---------------- CRASH EXPLOSION ----------------
    createCrashExplosion(position) {
        // 1. Shrapnel / Debris blocks (car parts)
        const debrisColors = [0x00f0ff, 0xff0077, 0x111622, 0xffaa00, 0xdddddd];
        const debrisCount = 35;

        for (let i = 0; i < debrisCount; i++) {
            const w = 0.2 + Math.random() * 0.35;
            const h = 0.15 + Math.random() * 0.25;
            const d = 0.2 + Math.random() * 0.4;
            const geo = new THREE.BoxGeometry(w, h, d);
            const color = debrisColors[Math.floor(Math.random() * debrisColors.length)];
            const mat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.4,
                metalness: 0.6
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            mesh.castShadow = true;
            this.scene.add(mesh);

            const speed = 6 + Math.random() * 12;
            const angle = Math.random() * Math.PI * 2;
            const upSpeed = 4 + Math.random() * 10;

            this.particles.push({
                mesh: mesh,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed,
                    upSpeed,
                    Math.sin(angle) * speed
                ),
                rotationVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15
                ),
                gravity: -18,
                bounce: 0.4,
                life: 2.5,
                maxLife: 2.5
            });
        }

        // 2. Fiery Sparks & Blast Flash
        const sparkCount = 40;
        for (let i = 0; i < sparkCount; i++) {
            const geo = new THREE.SphereGeometry(0.12, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.3 ? 0xff4500 : 0xffea00,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            this.scene.add(mesh);

            const v = new THREE.Vector3(
                (Math.random() - 0.5) * 16,
                Math.random() * 12 + 2,
                (Math.random() - 0.5) * 16
            );

            this.particles.push({
                mesh: mesh,
                velocity: v,
                gravity: -10,
                life: 0.8 + Math.random() * 0.6,
                maxLife: 1.4
            });
        }

        // 3. Expanding Shockwave Ring
        const ringGeo = new THREE.RingGeometry(0.4, 0.8, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(position);
        ring.position.y = 0.1;
        this.scene.add(ring);

        this.particles.push({
            mesh: ring,
            scaleDelta: 25.0,
            life: 0.5,
            maxLife: 0.5
        });
    }

    // ---------------- COIN COLLECT SPARKLES ----------------
    createCoinSparkles(position) {
        const count = 18;
        for (let i = 0; i < count; i++) {
            const geo = new THREE.OctahedronGeometry(0.15, 0);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            this.scene.add(mesh);

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 3.5 + Math.random() * 4.0;

            this.particles.push({
                mesh: mesh,
                velocity: new THREE.Vector3(
                    Math.sin(phi) * Math.cos(theta) * speed,
                    Math.cos(phi) * speed + 2.0,
                    Math.sin(phi) * Math.sin(theta) * speed
                ),
                scaleDelta: -0.5,
                life: 0.6,
                maxLife: 0.6
            });
        }
    }

    // ---------------- UPDATE ALL ACTIVE PARTICLES ----------------
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            const lifeRatio = p.life / p.maxLife;

            // Apply velocity
            if (p.velocity) {
                p.mesh.position.addScaledVector(p.velocity, dt);
            }

            // Apply gravity & ground bounce
            if (p.gravity) {
                p.velocity.y += p.gravity * dt;
                if (p.mesh.position.y < 0.15 && p.bounce) {
                    p.mesh.position.y = 0.15;
                    p.velocity.y = -p.velocity.y * p.bounce;
                    p.velocity.x *= 0.7;
                    p.velocity.z *= 0.7;
                }
            }

            // Apply rotation
            if (p.rotationVelocity) {
                p.mesh.rotation.x += p.rotationVelocity.x * dt;
                p.mesh.rotation.y += p.rotationVelocity.y * dt;
                p.mesh.rotation.z += p.rotationVelocity.z * dt;
            }

            // Apply scaling
            if (p.scaleDelta) {
                const s = 1 + (1 - lifeRatio) * p.scaleDelta;
                p.mesh.scale.set(Math.max(0.01, s), Math.max(0.01, s), Math.max(0.01, s));
            }

            // Fade opacity
            if (p.mesh.material && p.mesh.material.transparent) {
                p.mesh.material.opacity = Math.max(0, lifeRatio);
            }
        }
    }

    reset() {
        for (let i = 0; i < this.particles.length; i++) {
            this.scene.remove(this.particles[i].mesh);
        }
        this.particles = [];
        if (this.speedLines) {
            this.speedLines.material.opacity = 0;
        }
    }
}
