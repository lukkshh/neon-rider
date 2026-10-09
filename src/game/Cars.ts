export interface CarDefinition {
    id: string;
    name: string;
    price: number;
    description: string;
    model: CarModel;
    level: string;
}

export type CarModel = 'sports' | 'formula' | 'cabriolet' | 'supercar';

export const CAR_CATALOG: CarDefinition[] = [
    { id: 'starter', name: 'Redline GT', price: 0, description: 'Level 1 road car with a light, nimble frame.', model: 'sports', level: 'LEVEL 1' },
    { id: 'formula', name: 'Chevrolet Camaro', price: 250, description: 'Level 2 muscle coupe with a strong road stance.', model: 'formula', level: 'LEVEL 2' },
    { id: 'cabriolet', name: 'Lamborghini Aventador', price: 600, description: 'Level 3 Lamborghini hypercar.', model: 'cabriolet', level: 'LEVEL 3' },
    { id: 'supercar', name: 'Apex Racer', price: 1000, description: 'Level 4 race car built for the fastest roads.', model: 'supercar', level: 'LEVEL 4' }
];

export interface GarageSave {
    credits: number;
    ownedCars: string[];
    selectedCar: string;
}

const SAVE_KEY = 'neon_rider_garage_v1';

export function loadGarage(): GarageSave {
    const fallback: GarageSave = { credits: 0, ownedCars: ['starter'], selectedCar: 'starter' };
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return fallback;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return fallback;
        const saved = parsed as Partial<GarageSave>;
        const legacyIds: Record<string, string> = { comet: 'formula', phantom: 'cabriolet', volt: 'supercar' };
        const validIds = new Set(CAR_CATALOG.map(car => car.id));
        const ownedCars = Array.isArray(saved.ownedCars)
            ? [...new Set(saved.ownedCars
                .filter((id): id is string => typeof id === 'string')
                .map(id => legacyIds[id] ?? id)
                .filter(id => validIds.has(id)))]
            : ['starter'];
        if (!ownedCars.includes('starter')) ownedCars.unshift('starter');
        const savedSelection = typeof saved.selectedCar === 'string' ? legacyIds[saved.selectedCar] ?? saved.selectedCar : 'starter';
        const selectedCar = ownedCars.includes(savedSelection)
            ? savedSelection
            : 'starter';
        const credits = typeof saved.credits === 'number' && Number.isFinite(saved.credits)
            ? Math.max(0, Math.floor(saved.credits))
            : 0;
        return { credits, ownedCars, selectedCar };
    } catch {
        return fallback;
    }
}

export function saveGarage(save: GarageSave): void {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* Storage may be unavailable. */ }
}
