export type FencePoint = [number, number];

export interface Fence {
  id: string;
  points: FencePoint[];
  isClosed: boolean;
}

export default class FenceManager {
  private map: any = null;
  private isDrawing: boolean = false;
  private currentFence: Fence | null = null;
  private fences: Fence[] = [];

  constructor(map: any) {
    this.map = map;
  }

  public startFence(): void {
    this.isDrawing = true;
    this.currentFence = {
      id: `fence-${Date.now()}`,
      points: [],
      isClosed: false
    };
  }

  public addFencePoint(
    lngLat: FencePoint,
    customImage: string | null = null,
    onClick: ((lngLat: FencePoint, marker: any, event: any) => void) | null = null
  ): void {
    if (!this.isDrawing || !this.currentFence) {
      console.warn("Fence drawing not started");
      return;
    }

    this.currentFence.points.push(lngLat);
    
    // In React Native, we would add a marker to the map
    // This is a simplified implementation
    console.log(`Added fence point: ${lngLat[0]}, ${lngLat[1]}`);
  }

  public closeFence(): void {
    if (!this.isDrawing || !this.currentFence) {
      console.warn("No fence to close");
      return;
    }

    this.currentFence.isClosed = true;
    this.fences.push(this.currentFence);
    this.isDrawing = false;
    this.currentFence = null;
  }

  public clearFence(): void {
    this.isDrawing = false;
    this.currentFence = null;
  }

  public clearAllFences(): void {
    this.fences = [];
    this.clearFence();
  }

  public getFences(): Fence[] {
    return [...this.fences];
  }

  public getFencePoints(): FencePoint[] {
    if (!this.currentFence) return [];
    return [...this.currentFence.points];
  }

  public isDrawingFence(): boolean {
    return this.isDrawing;
  }
} 