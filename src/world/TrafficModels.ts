import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface GLBTrafficCar extends THREE.Group {
    wheels: THREE.Object3D[];
    collisionWidth: number;
    collisionLength: number;
    collisionHeight: number;
    speed: number;
    lane: number;
    modelKind: 'normal' | 'hypercar';
    modelVariant: number;
    isPolice: boolean;
    policeLights?: THREE.Object3D[];
    policeFlashElapsed: number;
    policeTargetX: number | null;
    policeChaseElapsed: number;
    policeInterceptionPending: boolean;
}

const variants = [
    { path: '/assets/models/level-1-red-car.glb', kind: 'normal' as const, length: 3.8, width: 1.9, height: 1.35 },
    { path: '/assets/models/level-2-camaro.glb', kind: 'normal' as const, length: 4.0, width: 2.0, height: 1.4 },
    { path: '/assets/models/level-3.glb', kind: 'hypercar' as const, length: 3.8, width: 1.95, height: 1.2 },
    { path: '/assets/models/level-4-racing-car.glb', kind: 'hypercar' as const, length: 4.0, width: 2.0, height: 1.2 },
    { path: '/assets/models/npc-car.glb', kind: 'normal' as const, length: 4.0, width: 1.9, height: 1.4 },
    { path: '/assets/models/npc-suv.glb', kind: 'normal' as const, length: 4.3, width: 2.0, height: 1.7 },
    { path: '/assets/models/police-car.glb', kind: 'normal' as const, length: 4.4, width: 2.0, height: 1.7 }
];

const npcPaintColors = [0x28a9e0, 0xe74751, 0xf0b13d, 0x50b96c, 0x8c62dc, 0xe6e9ed, 0x26354a];
let npcPaintOrder: number[] = [];
let policeSpawnChance = 0.1;
const loader = new GLTFLoader();
const pools: GLBTrafficCar[][] = variants.map(() => []);
const templates: Array<THREE.Group | null> = variants.map(() => null);
const tintedMaterials = new Map<string, THREE.Material>();
const paintedTextures = new Map<string, THREE.Texture>();
const policeLightGeometry = new THREE.BoxGeometry(0.3, 0.12, 0.42);
const policeGlowGeometry = new THREE.SphereGeometry(0.3, 8, 6);
const policeLightMaterials = [
    new THREE.MeshBasicMaterial({ color: 0xff1744, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: 0x168cff, toneMapped: false })
];
const policeGlowMaterials = [0xff1744, 0x168cff].map(color => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
}));
let loadPromise: Promise<void> | null = null;

function nextNpcPaint(): number {
    if (npcPaintOrder.length === 0) {
        npcPaintOrder = [...npcPaintColors];
        for (let i = npcPaintOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [npcPaintOrder[i], npcPaintOrder[j]] = [npcPaintOrder[j], npcPaintOrder[i]];
        }
    }
    return npcPaintOrder.pop()!;
}

async function loadVariant(index: number): Promise<THREE.Group> {
    const gltf = await loader.loadAsync(variants[index].path);
    const model = gltf.scene;
    // Red Car faces -Z in its source file; the level 4 racer needs the opposite quarter turn.
    if (index === 0) model.rotation.y = Math.PI;
    if (index === 3) model.rotation.y = Math.PI / 2;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const definition = variants[index];
    // Normalize each axis independently so imported origin/scale differences never create oversized traffic.
    const scaleX = definition.width / Math.max(size.x, 0.001);
    const scaleY = definition.height / Math.max(size.y, 0.001);
    const scaleZ = definition.length / Math.max(size.z, 0.001);
    const fit = new THREE.Group();
    fit.scale.set(scaleX, scaleY, scaleZ);
    fit.position.set(
        -(bounds.min.x + bounds.max.x) * scaleX / 2,
        -bounds.min.y * scaleY,
        -(bounds.min.z + bounds.max.z) * scaleZ / 2
    );
    model.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
            mesh.castShadow = false;
            mesh.receiveShadow = false;
        }
    });
    fit.add(model);
    templates[index] = fit;
    return fit;
}

function applyNpcPaint(body: THREE.Group, paint: number): void {
    body.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        let baseMaterials = mesh.userData.npcBaseMaterials as THREE.Material[] | undefined;
        if (!baseMaterials) {
            baseMaterials = Array.isArray(mesh.material) ? [...mesh.material] : [mesh.material];
            mesh.userData.npcBaseMaterials = baseMaterials;
        }
        const tint = (material: THREE.Material): THREE.Material => {
            const key = `${material.uuid}:${paint}`;
            let tinted = tintedMaterials.get(key);
            if (!tinted) {
                tinted = material.clone();
                const standard = tinted as THREE.MeshStandardMaterial;
                const sourceMap = (material as THREE.MeshStandardMaterial).map;
                if (standard.color) standard.color.set(0xffffff);
                if (sourceMap?.image && typeof document !== 'undefined') {
                    const textureKey = `${sourceMap.uuid}:${paint}`;
                    let paintedMap = paintedTextures.get(textureKey);
                    if (!paintedMap) {
                        const image = sourceMap.image as CanvasImageSource & { width: number; height: number };
                        const canvas = document.createElement('canvas');
                        canvas.width = image.width;
                        canvas.height = image.height;
                        const context = canvas.getContext('2d');
                        if (context) {
                            context.drawImage(image, 0, 0);
                            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                            // Canvas pixels are sRGB bytes; avoid THREE.Color's linearized
                            // channel values here or colors become skewed when baked to the map.
                            const tr = (paint >> 16) & 0xff;
                            const tg = (paint >> 8) & 0xff;
                            const tb = paint & 0xff;
                            for (let i = 0; i < pixels.data.length; i += 4) {
                                const r = pixels.data[i];
                                const g = pixels.data[i + 1];
                                const b = pixels.data[i + 2];
                                // The source atlases use orange for painted body panels. Leave the
                                // neutral gray glass and dark trim pixels exactly as authored.
                                if (r > 150 && g > 55 && g < 210 && b < 100 && r - b > 90) {
                                    const shade = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                                    pixels.data[i] = Math.min(255, tr * shade);
                                    pixels.data[i + 1] = Math.min(255, tg * shade);
                                    pixels.data[i + 2] = Math.min(255, tb * shade);
                                }
                            }
                            context.putImageData(pixels, 0, 0);
                            paintedMap = new THREE.CanvasTexture(canvas);
                            paintedMap.colorSpace = sourceMap.colorSpace;
                            paintedMap.wrapS = sourceMap.wrapS;
                            paintedMap.wrapT = sourceMap.wrapT;
                            paintedMap.flipY = sourceMap.flipY;
                            paintedMap.needsUpdate = true;
                            paintedTextures.set(textureKey, paintedMap);
                        }
                    }
                    if (paintedMap) standard.map = paintedMap;
                } else if (standard.color) {
                    standard.color.setHex(paint);
                }
                tintedMaterials.set(key, tinted);
            }
            return tinted;
        };
        const nextMaterials = baseMaterials.map(tint);
        mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0];
    });
}

function makeCar(index: number): GLBTrafficCar {
    const definition = variants[index];
    const template = templates[index];
    if (!template) throw new Error(`Traffic GLB ${definition.path} has not finished loading.`);
    const car = new THREE.Group() as GLBTrafficCar;
    const body = template.clone(true);

    car.add(body);
    car.isPolice = index === 6;
    car.policeFlashElapsed = 0;
    car.policeTargetX = null;
    car.policeChaseElapsed = 0;
    car.policeInterceptionPending = false;
    if (car.isPolice) {
        car.policeLights = policeLightMaterials.map((material, lightIndex) => {
            const assembly = new THREE.Group();
            const glow = new THREE.Mesh(policeGlowGeometry, policeGlowMaterials[lightIndex]);
            glow.scale.set(1.5, 0.75, 1.4);
            const beacon = new THREE.Mesh(policeLightGeometry, material);
            assembly.position.set(lightIndex === 0 ? -0.17 : 0.17, definition.height - 0.08, 0);
            assembly.add(glow, beacon);
            assembly.visible = false;
            car.add(assembly);
            return assembly;
        });
    }
    car.wheels = [];
    car.modelKind = definition.kind;
    car.modelVariant = index;
    car.collisionWidth = definition.width;
    car.collisionLength = definition.length;
    car.collisionHeight = definition.height;
    car.speed = 0;
    car.lane = 0;
    return car;
}

export const TrafficModels = {
    load(): Promise<void> {
        if (!loadPromise) {
            loadPromise = Promise.all(variants.map((_, index) => loadVariant(index)))
                .then(() => undefined)
                .catch(error => {
                    loadPromise = null;
                    templates.fill(null);
                    throw error;
                });
        }
        return loadPromise;
    },

    acquire(allowPolice = true): GLBTrafficCar | null {
        // Level cars belong to the garage; road traffic uses only the two dedicated NPC GLBs.
        const index = allowPolice && Math.random() < policeSpawnChance ? 6 : Math.random() < 0.55 ? 4 : 5;
        if (!templates[index]) return null;
        const car = pools[index].pop() ?? makeCar(index);
        if (index === 4 || index === 5) {
            applyNpcPaint(car, nextNpcPaint());
        }
        car.policeFlashElapsed = 0;
        car.policeTargetX = null;
        car.policeChaseElapsed = 0;
        car.policeInterceptionPending = false;
        if (car.policeLights) car.policeLights.forEach(light => { light.visible = false; });
        car.visible = true;
        return car;
    },

    acquirePolice(): GLBTrafficCar | null {
        if (!templates[6]) return null;
        const car = pools[6].pop() ?? makeCar(6);
        car.policeFlashElapsed = 0;
        car.policeTargetX = null;
        car.policeChaseElapsed = 0;
        car.policeInterceptionPending = false;
        car.policeLights?.forEach(light => { light.visible = false; });
        car.visible = true;
        return car;
    },

    setPoliceSpawnChance(chance: number): void {
        policeSpawnChance = THREE.MathUtils.clamp(chance, 0, 1);
    },

    async createGaragePreview(carModel: string): Promise<THREE.Group> {
        await this.load();
        const index = carModel === 'formula' ? 1
            : carModel === 'cabriolet' ? 2
                : carModel === 'supercar' ? 3
                    : 0;
        const preview = new THREE.Group();
        preview.add(templates[index]!.clone(true));
        return preview;
    },

    createPlayerVisual(carModel: string): Promise<THREE.Group> {
        return this.createGaragePreview(carModel);
    },

    release(car: GLBTrafficCar): void {
        car.removeFromParent();
        car.visible = false;
        const pool = pools[car.modelVariant];
        if (pool.length < 4) pool.push(car);
    }
};
