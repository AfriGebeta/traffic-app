export interface NavigationPoint {
    lat: number;
    lng: number;
}

export interface NavigationPayload {
    navigationId: string;
    points: Record<string, NavigationPoint>;
}

export interface RequestNavigationHistory {
    navigations: NavigationPayload[];
}

export interface StoredNavigation {
    navigationId: string;
    points: Record<string, NavigationPoint>;
    startTime: number;
}
