export interface CarDefinition {
    id: string;
    name: string;
    price: number;
    description: string;
    color: string;
}

export const CAR_CATALOG: CarDefinition[] = [
    { id: 'starter', name: 'Neon GT', price: 0, description: 'Your balanced starter ride.', color: '#00f0ff' },
    { id: 'comet', name: 'Comet XR', price: 250, description: 'Gold body with a sharp racing profile.', color: '#ffbe0b' },
    { id: 'phantom', name: 'Phantom', price: 600, description: 'Violet stealth finish, cyan trim.', color: '#9b59ff' },
    { id: 'volt', name: 'Volt R', price: 1000, description: 'Electric green with an agile silhouette.', color: '#39ff88' }
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
        const validIds = new Set(CAR_CATALOG.map(car => car.id));
        const ownedCars = Array.isArray(saved.ownedCars)
            ? [...new Set(saved.ownedCars.filter((id): id is string => typeof id === 'string' && validIds.has(id)))]
            : ['starter'];
        if (!ownedCars.includes('starter')) ownedCars.unshift('starter');
        const selectedCar = typeof saved.selectedCar === 'string' && ownedCars.includes(saved.selectedCar)
            ? saved.selectedCar
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
