import { apiService } from '../../../shared/services/api';
import { Place, PlaceContributionRequest, SavedPlace, SavePlaceRequest, SavePlaceVoiceRequest, HomeAddressRequiredField, MissingAddressFieldsError } from '../types/place.types';
import { ClaimBusinessRequest, ClaimBusinessResponse } from '../types/claim.types';

export const placeService = {
    async contributePlace(data: PlaceContributionRequest): Promise<Place> {
        const response = await apiService.post<Place>('/api/places', data);

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to contribute place');
        }

        return response.data;
    },

    async getPlaces(): Promise<Place[]> {
        const response = await apiService.get<Place[]>('/api/places');

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch places');
        }

        return response.data;
    },

    async savePlace(data: SavePlaceRequest): Promise<SavedPlace> {
        // console.log('saved place api: json save start', JSON.stringify(data));
        const response = await apiService.post<SavedPlace>('/api/places/saved', data);
        console.log('saved place api: json save done', {
            status: response.status,
            error: response.error,
            id: response.data?.id,
        });

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to save place');
        }

        return response.data;
    },

    async savePlaceWithAudio(data: SavePlaceVoiceRequest): Promise<SavedPlace> {
        console.log('home addr api: voice upload start', {
            type: data.type,
            label: data.label,
            lat: data.lat,
            lng: data.lng,
            isPrivate: data.isPrivate,
            audioUri: data.audioUri,
        });

        const formData = new FormData();
        formData.append('type', data.type);
        formData.append('label', data.label);
        if (data.lat !== undefined) formData.append('lat', String(data.lat));
        if (data.lng !== undefined) formData.append('lng', String(data.lng));
        formData.append('isPrivate', String(data.isPrivate));

        const extension = data.audioUri.split('.').pop()?.toLowerCase() || 'm4a';
        formData.append('audio', {
            uri: data.audioUri,
            name: `recording.${extension}`,
            type: extension === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
        } as any);

        const startedAt = Date.now();
        const response = await apiService.postFormData<SavedPlace>('/api/places/saved', formData);
        console.log(`home addr api: voice upload done in ${Date.now() - startedAt}ms`, {
            status: response.status,
            error: response.error,
            data: response.data ? JSON.stringify(response.data).slice(0, 500) : undefined,
        });

        if (response.error || !response.data) {
            const errorData = response.errorData as { elaboration?: string; values?: string[] } | undefined;
            if (errorData?.elaboration === 'Missing address fields' && Array.isArray(errorData.values) && errorData.values.length > 0) {
                throw new MissingAddressFieldsError(errorData.values as HomeAddressRequiredField[]);
            }
            throw new Error(response.error || 'Failed to save place');
        }

        return response.data;
    },

    async getSavedPlaces(): Promise<SavedPlace[]> {
        const response = await apiService.get<SavedPlace[]>('/api/places/saved');

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch saved places');
        }

        return response.data;
    },

    async deleteSavedPlace(placeId: string): Promise<void> {
        const response = await apiService.delete<void>(`/api/places/saved/${placeId}`);

        if (response.error) {
            throw new Error(response.error || 'Failed to delete saved place');
        }
    },

    async isPlaceSaved(lat: number, lng: number): Promise<SavedPlace | null> {
        try {
            const savedPlaces = await this.getSavedPlaces();

            const threshold = 0.0001;
            return savedPlaces.find(
                place => Math.abs(place.lat - lat) < threshold && Math.abs(place.lng - lng) < threshold
            ) || null;
        } catch (error) {
            return null;
        }
    },

    async claimBusiness(placeId: string, data: ClaimBusinessRequest): Promise<ClaimBusinessResponse> {
        const response = await apiService.post<ClaimBusinessResponse>(`/api/places/${placeId}/claim`, data);

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to claim business');
        }

        return response.data;
    },

    async getPresignedUrl(prefix: string, filename: string): Promise<{ objectName: string; url: string; maxSize: number }> {
        const response = await apiService.post<{ objectName: string; url: string; maxSize: number }>(
            '/api/uploads/presigned',
            { prefix, filename }
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to get presigned URL');
        }

        return response.data;
    },

    async uploadClaimDocument(
        fileUri: string, 
        filename: string,
        onProgress?: (progress: number) => void
    ): Promise<string> {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL;

        if (!apiUrl) {
            throw new Error('api url not configured');
        }

        try {
            onProgress?.(10);
            
            const presignedData = await this.getPresignedUrl('claims', filename);
            
            onProgress?.(30);

            const fileResponse = await fetch(fileUri);
            const fileBlob = await fileResponse.blob();

            const extension = filename.toLowerCase().split('.').pop();
            let contentType = 'application/pdf';

            if (extension === 'pdf') {
                contentType = 'application/pdf';
            } else if (extension === 'png') {
                contentType = 'image/png';
            } else if (extension === 'jpg' || extension === 'jpeg') {
                contentType = 'image/jpeg';
            } else if (fileBlob.type) {
                contentType = fileBlob.type;
            }

            onProgress?.(50);

            const uploadResponse = await fetch(presignedData.url, {
                method: 'PUT',
                body: fileBlob,
                headers: {
                    'Content-Type': contentType,
                },
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload document: ${uploadResponse.status}`);
            }

            onProgress?.(100);

            return presignedData.objectName;
        } catch (error) {
            throw error;
        }
    },
};
