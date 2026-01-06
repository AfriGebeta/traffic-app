import MapLibreGL from '@maplibre/maplibre-react-native';

export interface RouteStyle {
  color: string;
  width: number;
  opacity: number;
}

export interface RouteData {
  type: string;
  properties?: {
    distance?: number;
    duration?: number;
    maneuvers?: any[];
  };
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
  style?: RouteStyle;
}

export default class DirectionsManager {
  private map: any = null;
  private currentRoute: RouteData | null = null;

  constructor(map: any) {
    this.map = map;
  }

  public displayRoute(routeData: RouteData, options?: Partial<RouteStyle>): void {
    this.currentRoute = {
      ...routeData,
      style: {
        color: options?.color || '#007cbf',
        width: options?.width || 3,
        opacity: options?.opacity || 1
      }
    };
  }

  public clearRoute(): void {
    this.currentRoute = null;
  }

  public getCurrentRoute(): RouteData | null {
    return this.currentRoute;
  }

  public getRouteSummary(): { distance: number; duration: number } | null {
    if (!this.currentRoute) return null;

    return {
      distance: this.currentRoute.properties?.distance || 0,
      duration: this.currentRoute.properties?.duration || 0
    };
  }

  public updateRouteStyle(style: Partial<RouteStyle>): void {
    if (!this.currentRoute || !this.currentRoute.style) return;

    this.currentRoute.style = {
      ...this.currentRoute.style,
      ...style
    };
  }
} 