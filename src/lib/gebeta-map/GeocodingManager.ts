export default class GeocodingManager {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async geocode(name: string): Promise<any[]> {
    try {
      const response = await fetch(
        `https://api.gebeta.app/geocoding/v1/search?q=${encodeURIComponent(name)}&key=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error("Geocoding error:", error);
      return [];
    }
  }

  public async reverseGeocode(lat: number, lon: number): Promise<any[]> {
    try {
      const response = await fetch(
        `https://api.gebeta.app/geocoding/v1/reverse?lat=${lat}&lon=${lon}&key=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return [];
    }
  }
} 