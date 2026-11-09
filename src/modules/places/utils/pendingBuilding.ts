export interface PendingBuilding {
    id: string;
    name: string;
    floorCount: string | null;
}

let pending: PendingBuilding | null = null;

export const setPendingBuilding = (building: PendingBuilding) => {
    pending = building;
};

export const takePendingBuilding = (): PendingBuilding | null => {
    const next = pending;
    pending = null;
    return next;
};
