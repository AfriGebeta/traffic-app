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
    if (!this.map || !routeData) return;

    this.clearRoute();

    const sourceId = `route-source-${Date.now()}`;
    const layerId = `route-layer-${Date.now()}`;

    this.routeSourceIds.push(sourceId);
    this.routeLayerIds.push(layerId);

    // Add route source
    this.map.addSource(sourceId, {
      type: 'geojson',
      data: routeData
    });

    // Add route layer
    this.map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': options?.color || '#007cbf',
        'line-width': options?.width || 3,
        'line-opacity': options?.opacity || 1
      }
    });

    this.currentRoute = routeData;
  }

  public clearRoute(): void {
    if (!this.map) return;

    this.routeLayerIds.forEach(layerId => {
      if (this.map!.getLayer(layerId)) {
        this.map!.removeLayer(layerId);
      }
    });

    this.routeSourceIds.forEach(sourceId => {
      if (this.map!.getSource(sourceId)) {
        this.map!.removeSource(sourceId);
      }
    });

    this.routeLayerIds = [];
    this.routeSourceIds = [];
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
    if (!this.map || this.routeLayerIds.length === 0) return;

    this.routeLayerIds.forEach(layerId => {
      if (this.map!.getLayer(layerId)) {
        this.map!.setPaintProperty(layerId, 'line-color', style.color || '#007cbf');
        this.map!.setPaintProperty(layerId, 'line-width', style.width || 3);
        this.map!.setPaintProperty(layerId, 'line-opacity', style.opacity || 1);
      }
    });
  }
} 