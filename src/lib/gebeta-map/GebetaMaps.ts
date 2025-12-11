import MapLibreGL from '@maplibre/maplibre-react-native';
import FenceManager, { Fence, FencePoint } from "./FenceManager";
import ClusteringManager, { ClusteredMarkerData } from "./ClusteringManager";
import GeocodingManager from "./GeocodingManager";
import DirectionsManager from "./DirectionsManager";

declare type MapMethods = {
    [key: string]: any;
};

export declare interface GebetaMapsProps {
    apiKey: string;
}

export interface FlyToOptions {
    center :[number, number];
    zoom?: number;
    duration?: number;
    pitch?: number;
    heading?: number;
}

export class GebetaMaps {
    private gebetaMaps: any = null;
    private camera: any = null;
    private apiKey: string;
    private markerList: any[] = [];
    private fenceManager: FenceManager | null = null;
    private pathLayerIds: string[] = [];
    private pathSourceIds: string[] = [];
    private clusteringManager: ClusteringManager | null = null;
    private geocodingManager: GeocodingManager | null = null;
    private directionsManager: DirectionsManager | null = null;

    constructor({ apiKey }: GebetaMapsProps) {
        this.apiKey = apiKey;

        if (!this.apiKey) {
            console.error("An API key or an access token is required.");
        }
        this.geocodingManager = new GeocodingManager(this.apiKey);
    }

    public init(options: any): any {
        const styleUrl = `https://tiles.gebeta.app/styles/standard/style.json`;

        const mapProps = {
            ...options,
            styleURL: styleUrl,
            attributionEnabled: false,
            logoEnabled: false,
            compassEnabled: true,
            scaleBarEnabled: true,
            zoomEnabled: true,
            scrollEnabled: true,
            rotateEnabled: true,
            pitchEnabled: true,
        };

        // Initialize managers
        this.fenceManager = new FenceManager(this.gebetaMaps);
        this.directionsManager = new DirectionsManager(this.gebetaMaps);

        if (options.clusteringOptions) {
            this.clusteringManager = new ClusteringManager(this.gebetaMaps, options.clusteringOptions);
        }

        return this.gebetaMaps;
    }

    public setMapInstance(map: any): void {
        this.gebetaMaps = map;

        // Initialize managers with the map instance
        if (this.gebetaMaps) {
            this.fenceManager = new FenceManager(this.gebetaMaps);
            this.directionsManager = new DirectionsManager(this.gebetaMaps);
        }
    }

    public getMapInstance(): any {
        return this.gebetaMaps;
    }

    public setCameraInstance(camera: any): void {
        this.camera = camera;
    }

    public addNavigationControls(): void {
        // React Native MapLibre GL handles navigation controls differently
        // They are typically built into the map view
        console.log("Navigation controls are built into the map view in React Native");
    }

    public addGeolocateControls(): void {
        // Geolocation is handled differently in React Native
        console.log("Geolocation should be implemented using React Native's location services");
    }

    /**
     * Animate the map's camera to a new location.
     * @param options - The options for the camera animation.
     */
    public flyTo(options: FlyToOptions): void {
        if (!this.camera) {
            console.warn("Camera instance is not available. Cannot fly to location.");
            return;
        }

        this.camera.setCamera({
            centerCoordinate: options.center,
            zoomLevel: options.zoom,
            animationMode: 'flyTo',
            animationDuration: options.duration || 4000,
            pitch: options.pitch,
            heading: options.heading,
        });
    }

    public addMarker(options?: any): any {
        console.log("this is being called")
        if (!this.gebetaMaps) {
            throw new Error("Map not initialized");
        }

        const marker = { id: `marker-${Date.now()}` };
        if (options) {
            Object.assign(marker, options);
        }

        this.markerList.push(marker);
        return marker;
    }

    public addImageMarker(
        lngLat: [number, number],
        imageUrl: string,
        size: [number, number] = [32, 32],
        onClick?: (lngLat: [number, number], marker: any, event: any) => void,
        zIndex: number = 10,
        popupHtml?: string
    ): { marker: any, popup?: any } {
        if (!this.gebetaMaps) {
            throw new Error("Map not initialized");
        }

        const marker = {
            coordinate: lngLat,
            id: `marker-${Date.now()}-${Math.random()}`,
            icon: imageUrl,
            iconSize: size,
            iconOffset: [0, 0],
            zIndex: zIndex,
            onSelected: onClick
        };

        this.markerList.push(marker);

        return { marker };
    }

    public removeMarker(marker: any): void {
        const index = this.markerList.indexOf(marker);
        if (index > -1) {
            this.markerList.splice(index, 1);
        }
    }

    public clearAllMarkers(): void {
        this.markerList = [];
    }

    public getMarkers(): any[] {
        return [...this.markerList];
    }

    // Fence management methods
    public startFence() {
        if (this.fenceManager) {
            this.fenceManager.startFence();
        }
    }

    public addFencePoint(
        lngLat: FencePoint,
        customImage: string | null = null,
        onClick: ((lngLat: FencePoint, marker: any, event: any) => void) | null = null
    ) {
        if (this.fenceManager) {
            this.fenceManager.addFencePoint(lngLat, customImage, onClick);
        }
    }

    public closeFence() {
        if (this.fenceManager) {
            this.fenceManager.closeFence();
        }
    }

    public clearFence() {
        if (this.fenceManager) {
            this.fenceManager.clearFence();
        }
    }

    public clearAllFences() {
        if (this.fenceManager) {
            this.fenceManager.clearAllFences();
        }
    }

    public getFences(): Fence[] {
        return this.fenceManager ? this.fenceManager.getFences() : [];
    }

    public getFencePoints(): FencePoint[] {
        return this.fenceManager ? this.fenceManager.getFencePoints() : [];
    }

    public isDrawingFence(): boolean {
        return this.fenceManager ? this.fenceManager.isDrawingFence() : false;
    }

    // Path management methods
    public addPath(
        path: [number, number][],
        options?: { color?: string; width?: number; opacity?: number }
    ): void {
        if (!this.gebetaMaps) return;

        const sourceId = `path-source-${Date.now()}`;
        const layerId = `path-layer-${Date.now()}`;

        this.pathSourceIds.push(sourceId);
        this.pathLayerIds.push(layerId);

        // Add source
        this.gebetaMaps.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: path
                }
            }
        });

        // Add layer
        this.gebetaMaps.addLayer({
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
    }

    public clearPaths(): void {
        if (!this.gebetaMaps) return;

        this.pathLayerIds.forEach(layerId => {
            if (this.gebetaMaps!.getLayer(layerId)) {
                this.gebetaMaps!.removeLayer(layerId);
            }
        });

        this.pathSourceIds.forEach(sourceId => {
            if (this.gebetaMaps!.getSource(sourceId)) {
                this.gebetaMaps!.removeSource(sourceId);
            }
        });

        this.pathLayerIds = [];
        this.pathSourceIds = [];
    }

    // Clustering methods
    public addClusteredMarker(marker: ClusteredMarkerData) {
        if (this.clusteringManager) {
            this.clusteringManager.addMarker(marker);
        }
    }

    public clearClusteredMarkers() {
        if (this.clusteringManager) {
            this.clusteringManager.clearMarkers();
        }
    }

    public updateClustering() {
        if (this.clusteringManager) {
            this.clusteringManager.updateClustering();
        }
    }

    public setClusteringEnabled(enabled: boolean) {
        if (this.clusteringManager) {
            this.clusteringManager.setEnabled(enabled);
        }
    }

    public setClusterImage(imageUrl: string) {
        if (this.clusteringManager) {
            this.clusteringManager.setClusterImage(imageUrl);
        }
    }

    // Geocoding methods
    public async geocode(name: string) {
        return this.geocodingManager ? await this.geocodingManager.geocode(name) : [];
    }

    public async reverseGeocode(lat: number, lon: number) {
        return this.geocodingManager ? await this.geocodingManager.reverseGeocode(lat, lon) : [];
    }

    // Directions methods
    public async getDirections(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, options?: any) {
        return this.directionsManager ? await this.directionsManager.getDirections(origin, destination, options) : null;
    }

    public displayRoute(routeData: any, options?: any) {
        if (this.directionsManager) {
            this.directionsManager.displayRoute(routeData, options);
        }
    }

    public clearRoute() {
        if (this.directionsManager) {
            this.directionsManager.clearRoute();
        }
    }

    public getCurrentRoute() {
        return this.directionsManager ? this.directionsManager.getCurrentRoute() : null;
    }

    public getRouteSummary() {
        return this.directionsManager ? this.directionsManager.getRouteSummary() : null;
    }

    public updateRouteStyle(style: { color?: string; width?: number; opacity?: number }) {
        if (this.directionsManager) {
            this.directionsManager.updateRouteStyle(style);
        }
    }

    public remove(): void {
        this.clearAllMarkers();
        this.clearPaths();
        this.clearAllFences();
        this.clearClusteredMarkers();
        this.clearRoute();

        this.gebetaMaps = null;
        this.fenceManager = null;
        this.clusteringManager = null;
        this.geocodingManager = null;
        this.directionsManager = null;
    }
}
