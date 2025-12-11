import MapLibreGL from '@maplibre/maplibre-react-native';

export default class DirectionsManager {
  private map: any = null;
  private currentRoute: any = null;
  private routeLayerIds: string[] = [];
  private routeSourceIds: string[] = [];

  constructor(map: any) {
    this.map = map;
  }

  public async getDirections(
    origin: { lat: number; lng: number }, 
    destination: { lat: number; lng: number }, 
    options?: any
  ): Promise<any> {
    try {
      const response = await fetch(
        `https://api.gebeta.app/directions/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Directions error:", error);
      return null;
    }
  }

  public displayRoute(routeData: any, options?: any): void {
    // storing actual data for rendering
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

  public getCurrentRoute(): any {
    return this.currentRoute;
  }

  public getRouteSummary(): any {
    if (!this.currentRoute) return null;

    // Extract route summary from current route
    return {
      distance: this.currentRoute.properties?.distance || 0,
      duration: this.currentRoute.properties?.duration || 0
    };
  }

  public updateRouteStyle(style: { color?: string; width?: number; opacity?: number }): void {
    if (!this.currentRoute) return;

    this.currentRoute.style = {
      color: style.color || '#007cbf',
      width: style.width || 3,
      opacity: style.opacity || 1
    };
  }
} 