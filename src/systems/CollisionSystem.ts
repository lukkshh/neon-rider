import * as THREE from 'three';
import type { Player } from '../player/Player';
import type { World } from '../world/World';
import type { TrafficCarMesh, ObstacleMesh, CoinMesh } from '../world/Models';

/**
 * Callbacks triggered by the collision system during each check.
 */
export interface CollisionCallbacks {
    onCrash: () => void;
    onNearMiss: (pos: THREE.Vector3) => void;
    onCollectCoin: (coin: CoinMesh, index: number) => void;
}

/**
 * Collision System
 * Performs AABB bounding checks and proximity calculations for traffic, obstacles, and collectibles
 */
export class CollisionSystem {
    private passedEntities: Set<THREE.Object3D>;
    private readonly carHalfW: number;
    private readonly carHalfL: number;

    constructor() {
        this.passedEntities = new Set();
        this.carHalfW = 0.9;
        this.carHalfL = 1.8;
    }

    reset(): void {
        this.passedEntities.clear();
    }

    check(player: Player, world: World, callbacks: CollisionCallbacks): void {
        const pX = player.pos.x;
        const pZ = player.pos.z;

        // 1. Traffic Cars
        for (let i = 0; i < world.traffic.length; i++) {
            const traffic: TrafficCarMesh = world.traffic[i];
            const tX = traffic.position.x;
            const tZ = traffic.position.z;
            const tHalfW = (traffic.collisionWidth ?? 1.7) / 2;
            const tHalfL = (traffic.collisionLength ?? 3.6) / 2;

            const dx = Math.abs(pX - tX);
            const dz = Math.abs(pZ - tZ);

            // Crash Collision Check (AABB)
            if (dx < (this.carHalfW + tHalfW) * 0.9 && dz < (this.carHalfL + tHalfL) * 0.9) {
                callbacks.onCrash();
                return;
            }

            // Near Miss Check (Pass close on the side without colliding)
            const minTrafficSideX = (this.carHalfW + tHalfW) * 0.9;
            const maxTrafficNearMissX = (this.carHalfW + tHalfW) + 1.3;
            if (dx >= minTrafficSideX && dx < maxTrafficNearMissX && dz < (this.carHalfL + tHalfL) * 0.85) {
                if (!this.passedEntities.has(traffic)) {
                    this.passedEntities.add(traffic);
                    callbacks.onNearMiss(traffic.position);
                }
            }
        }

        // 2. Obstacles (Barriers, Rocks)
        for (let i = 0; i < world.obstacles.length; i++) {
            const obs: ObstacleMesh = world.obstacles[i];
            const oX = obs.position.x;
            const oZ = obs.position.z;
            const oHalfW = (obs.collisionWidth ?? 2.0) / 2;
            const oHalfL = (obs.collisionLength ?? 1.0) / 2;

            const dx = Math.abs(pX - oX);
            const dz = Math.abs(pZ - oZ);

            if (dx < (this.carHalfW + oHalfW) * 0.85 && dz < (this.carHalfL + oHalfL) * 0.85) {
                callbacks.onCrash();
                return;
            }

            // Near Miss Check for obstacles
            const minObsSideX = (this.carHalfW + oHalfW) * 0.85;
            const maxObsNearMissX = (this.carHalfW + oHalfW) + 1.2;
            if (dx >= minObsSideX && dx < maxObsNearMissX && dz < (this.carHalfL + oHalfL) * 0.85) {
                if (!this.passedEntities.has(obs)) {
                    this.passedEntities.add(obs);
                    callbacks.onNearMiss(obs.position);
                }
            }
        }

        // 3. Collectibles (Gold Energy Coins)
        for (let i = world.collectibles.length - 1; i >= 0; i--) {
            const coin: CoinMesh = world.collectibles[i];
            const dist = Math.hypot(pX - coin.position.x, pZ - coin.position.z);

            if (dist < 1.8) {
                callbacks.onCollectCoin(coin, i);
            }
        }
    }
}
