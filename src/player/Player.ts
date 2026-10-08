import * as THREE from 'three';
import { Models } from '../world/Models.js';

/**
 * Player Controller
 * Manages player vehicle physics, input responsiveness, 3D mesh transforms, and animation
 */
export class Player {
    // Visual mesh extensions are supplied by the procedural model builder.
    [key: string]: any;
    private readonly exhaustWorldPosition = new THREE.Vector3();
    private laneIndex = 1;
    private previousSteer = false;
    private previousRight = false;
    private readonly lanePositions = [-4.2, 0, 4.2];
    constructor(carId = 'starter') {
        this.mesh = Models.createPlayerCar(carId);
        this.pos = new THREE.Vector3(0, 0, 0);

        // Movement physics configuration
        this.baseSpeed = 32;       // Base units/sec (~100 km/h)
        this.currentSpeed = 32;
        this.maxNormalSpeed = 68;  // Climbs over distance (~220 km/h)
        this.nitroSpeed = 95;      // When boosting (~300 km/h)
        this.minSpeed = 20;        // When braking
        this.maxRoadX = 4.2;

        this.velocityX = 0;
        this.nitro = 100; // 0 to 100

        this.isBoosting = false;
        this.isBraking = false;
        this.isAccelerating = false;

        this.reset();
    }

    reset() {
        this.pos.set(0, 0, 0);
        this.laneIndex = 1;
        this.previousSteer = false;
        this.previousRight = false;
        this.velocityX = 0;
        this.currentSpeed = this.baseSpeed;
        this.nitro = 100;
        this.isBoosting = false;
        this.isBraking = false;
        this.isAccelerating = false;

        this.mesh.position.set(0, 0, 0);
        this.mesh.rotation.set(0, 0, 0);
        this.mesh.visible = true;

        if (this.mesh.underglowLight) {
            this.mesh.underglowLight.intensity = 1.5;
        }
    }

    getSpeedRatio() {
        return (this.currentSpeed - this.minSpeed) / (this.nitroSpeed - this.minSpeed);
    }

    update(dt, keys, totalDistance, particles, soundCtrl) {
        // 1. Difficulty progression: Base speed scales with distance
        const speedProgression = Math.min(1.0, totalDistance / 2500);
        const dynamicBaseSpeed = this.baseSpeed + speedProgression * (this.maxNormalSpeed - this.baseSpeed);

        // 2. Nitro & Speed Controls
        this.isBoosting = false;
        this.isBraking = false;
        this.isAccelerating = false;

        let targetSpeed = dynamicBaseSpeed;

        if ((keys.boost || keys.up) && this.nitro > 0) {
            // Nitro Boost Active
            targetSpeed = this.nitroSpeed;
            this.nitro = Math.max(0, this.nitro - dt * 28);
            this.isBoosting = true;
            this.isAccelerating = true;
            if (soundCtrl && Math.random() < 0.3) soundCtrl.playBoost();
        } else if (keys.up) {
            // Standard Throttle
            targetSpeed = dynamicBaseSpeed * 1.25;
            this.isAccelerating = true;
            // Slow nitro regen
            this.nitro = Math.min(100, this.nitro + dt * 4);
        } else if (keys.down) {
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

        // 3. Forward Movement
        const deltaZ = this.currentSpeed * dt;
        this.pos.z += deltaZ;

        // Lane changes are discrete and bounded to the three marked road lanes.
        if (keys.left && !this.previousSteer) this.laneIndex = Math.min(2, this.laneIndex + 1);
        if (keys.right && !this.previousRight) this.laneIndex = Math.max(0, this.laneIndex - 1);
        this.previousSteer = keys.left;
        this.previousRight = keys.right;
        const steerInput = keys.left ? 1 : keys.right ? -1 : 0;
        const targetX = this.lanePositions[this.laneIndex];
        const previousX = this.pos.x;
        this.pos.x += (targetX - this.pos.x) * Math.min(1, dt * 9);
        this.velocityX = (this.pos.x - previousX) / Math.max(dt, 0.001);

        // Clamp numerical drift at the outer lane centers.
        let hitWall = false;
        if (this.pos.x < -this.maxRoadX) {
            this.pos.x = -this.maxRoadX;
            this.velocityX = 2.0; // Soft guardrail bounce
            hitWall = true;
            if (particles) particles.spawnTireSmoke(this.mesh.position);
        } else if (this.pos.x > this.maxRoadX) {
            this.pos.x = this.maxRoadX;
            this.velocityX = -2.0;
            hitWall = true;
            if (particles) particles.spawnTireSmoke(this.mesh.position);
        }

        // 5. Update Car Mesh & Visuals
        this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);

        // Body roll / tilt during steering (leaning slightly into turn)
        const targetRoll = this.velocityX * 0.018;
        this.mesh.rotation.z += (targetRoll - this.mesh.rotation.z) * dt * 10;

        // Pitch tilt (rearing up on nitro, diving on brakes)
        let targetPitch = 0;
        if (this.isBoosting) targetPitch = -0.04;
        else if (this.isBraking) targetPitch = 0.04;
        this.mesh.rotation.x += (targetPitch - this.mesh.rotation.x) * dt * 8;

        // Car yaw / angle into the turn
        const targetYaw = this.velocityX * 0.012;
        this.mesh.rotation.y += (targetYaw - this.mesh.rotation.y) * dt * 10;

        // Wheels rotation
        const wheelRotDelta = deltaZ * 2.8;
        if (this.mesh.rollingWheels) {
            this.mesh.rollingWheels.forEach(w => w.rotation.x += wheelRotDelta);
        }
        // Front wheels turn
        if (this.mesh.frontSteerGroups) {
            const steerAngle = steerInput * 0.35;
            this.mesh.frontSteerGroups.forEach(w => {
                w.rotation.y = steerAngle;
            });
        }

        // Taillights flare when braking
        if (this.mesh.taillightMesh) {
            const tColor = this.isBraking ? 0xff0022 : 0xaa0022;
            this.mesh.taillightMesh.material.color.setHex(tColor);
        }

        // Exhaust Particles
        if (particles && this.mesh.exhaustPoints) {
            this.mesh.exhaustPoints.forEach(ex => {
                ex.getWorldPosition(this.exhaustWorldPosition);
                if (this.isBoosting) {
                    particles.spawnExhaust(this.exhaustWorldPosition, true);
                } else if (this.isAccelerating || Math.random() < 0.25) {
                    particles.spawnExhaust(this.exhaustWorldPosition, false);
                }
            });
        }

        // Tire Smoke when swerving hard
        if (particles && Math.abs(this.velocityX) > 8.0) {
            particles.spawnTireSmoke(this.mesh.position);
        }

        return {
            deltaZ,
            speedRatio: this.getSpeedRatio(),
            hitWall
        };
    }

    setCar(carId: string): void {
        const previous = this.mesh;
        this.mesh = Models.createPlayerCar(carId);
        this.mesh.position.copy(previous.position);
        this.mesh.rotation.copy(previous.rotation);
        this.mesh.visible = previous.visible;
        this.mesh.updateMatrixWorld(true);
    }
}
