import { apiService, ApiResponse } from '../../../shared/services/api';
import { ApiError } from '../../../shared/utils/apiErrors';
import {
    BusinessOffer,
    CollectionOverview,
    CollectionStatus,
    CollectorData,
    FollowedPlace,
    LoyaltyVisit,
    OfferUse,
    SavedOffer,
    StudentCheck,
    NearbyBuilding,
    NearbyOfferPlace,
    OfferIdea,
    PlaceOffers,
    PublicPlace,
} from '../types/business.types';

// some endpoints wrap the body in { data }
const unwrap = <T>(response: ApiResponse<any>, fallback: string): T => {
    if (response.error || response.data === undefined) throw new ApiError(response, fallback);
    const body = response.data;
    return (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body ? body.data : body) as T;
};

const query = (params: Record<string, string | number | undefined>) =>
    Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&');

export const businessService = {
    async nearbyBuildings(lat: number, lng: number, radius = 1000): Promise<NearbyBuilding[]> {
        const response = await apiService.get(`/api/places/buildings?${query({ lat, lng, radius })}`);
        const rows = unwrap<NearbyBuilding[]>(response, 'Failed to load buildings');
        return Array.isArray(rows) ? rows : [];
    },

    // collector tools ---------------------------------------------------------

    async collection(filters: { search?: string; campus?: string; group?: string; status?: string } = {}): Promise<CollectionOverview> {
        const qs = query(filters);
        const response = await apiService.get(`/api/places/collection${qs ? `?${qs}` : ''}`);
        // TEMP: check the overview shape
        console.log('[collection]', response.status, response.error ?? '', JSON.stringify(response.data)?.slice(0, 1500));
        const body = unwrap<CollectionOverview>(response, 'Failed to load collection');
        return { ...body, buildings: body?.buildings ?? [], streetLevel: body?.streetLevel ?? [] };
    },

    async setCollectionStatus(placeId: string, status: CollectionStatus): Promise<{ status: CollectionStatus; heldByPlaceForge?: boolean }> {
        const response = await apiService.patch(`/api/places/${placeId}/collection-status`, { status });
        return unwrap(response, 'Failed to set status');
    },

    async collectorData(placeId: string): Promise<CollectorData> {
        const response = await apiService.get(`/api/places/${placeId}/collector-data`);
        return unwrap(response, 'Failed to load details');
    },

    async regeneratePin(placeId: string): Promise<string> {
        const response = await apiService.post(`/api/places/${placeId}/offer-pin`);
        return unwrap<{ offerPin: string }>(response, 'Failed to make a new PIN').offerPin;
    },

    async setOfferPaused(placeId: string, offerId: string, paused: boolean): Promise<void> {
        const response = await apiService.patch(`/api/places/${placeId}/offers/${offerId}`, { paused });
        if (response.error) throw new ApiError(response, 'Failed to update offer');
    },

    async updatePlace(placeId: string, body: Record<string, unknown>): Promise<any> {
        const response = await apiService.put(`/api/places/${placeId}`, body);
        return unwrap(response, 'Failed to save');
    },

    async offerIdeas(body: Record<string, unknown>): Promise<OfferIdea[]> {
        const response = await apiService.post('/api/places/offer-ideas', body);
        return unwrap<{ ideas: OfferIdea[] }>(response, 'No ideas right now').ideas ?? [];
    },

    // customers ---------------------------------------------------------------

    async getPlace(placeId: string): Promise<PublicPlace> {
        const response = await apiService.get(`/api/places/${placeId}`);
        return unwrap<PublicPlace>(response, 'Failed to load place');
    },

    async follow(placeId: string, following: boolean): Promise<boolean> {
        const response = following ? await apiService.post(`/api/places/${placeId}/follow`) : await apiService.delete(`/api/places/${placeId}/follow`);
        return unwrap<{ following: boolean }>(response, 'Could not update').following;
    },

    async following(): Promise<FollowedPlace[]> {
        const response = await apiService.get('/api/places/following');
        const rows = unwrap<FollowedPlace[]>(response, 'Failed to load');
        return Array.isArray(rows) ? rows : [];
    },

    async nearbyOffers(lat: number, lng: number, radius = 1000): Promise<NearbyOfferPlace[]> {
        const response = await apiService.get(`/api/places/offers/nearby?${query({ lat, lng, radius })}`);
        const rows = unwrap<NearbyOfferPlace[]>(response, 'Failed to load offers');
        return Array.isArray(rows) ? rows : [];
    },

    async placeOffers(placeId: string): Promise<PlaceOffers> {
        const response = await apiService.get(`/api/places/${placeId}/offers`);
        const body = unwrap<PlaceOffers>(response, 'Failed to load offers');
        return { month: body?.month ?? null, offers: body?.offers ?? [] };
    },

    async requestCode(placeId: string, offerId: string): Promise<{ code: string; expiresAt: string }> {
        const response = await apiService.post(`/api/places/${placeId}/offers/${offerId}/code`);
        return unwrap(response, 'Could not get a code');
    },

    async confirmCode(
        placeId: string,
        code: string,
        pin: string
    ): Promise<{ confirmed: boolean; offer?: Pick<BusinessOffer, 'id' | 'text'>; confirmedAt?: string; loyalty?: LoyaltyVisit | null }> {
        const response = await apiService.post(`/api/places/${placeId}/offers/confirm`, { code, pin });
        return unwrap(response, 'Could not confirm');
    },

    async useOffer(placeId: string, offerId: string): Promise<OfferUse> {
        const response = await apiService.post(`/api/places/${placeId}/offers/${offerId}/use`);
        return unwrap(response, 'Could not use the offer');
    },

    async redemptionFeedback(placeId: string, code: string, given: boolean, note?: string): Promise<void> {
        const response = await apiService.post(`/api/places/${placeId}/redemptions/${encodeURIComponent(code)}/feedback`, {
            given,
            ...(note?.trim() && { note: note.trim() }),
        });
        if (response.error) throw new ApiError(response, 'Could not send');
    },

    async setOfferSaved(placeId: string, offerId: string, saved: boolean): Promise<boolean> {
        const path = `/api/places/${placeId}/offers/${offerId}/save`;
        const response = saved ? await apiService.post(path) : await apiService.delete(path);
        return unwrap<{ saved: boolean }>(response, 'Could not update').saved;
    },

    async savedOffers(): Promise<SavedOffer[]> {
        const response = await apiService.get('/api/places/offers/saved');
        const rows = unwrap<SavedOffer[]>(response, 'Failed to load');
        return Array.isArray(rows) ? rows : [];
    },

    async remindOffer(placeId: string, offerId: string, at: string): Promise<string> {
        const response = await apiService.post(`/api/places/${placeId}/offers/${offerId}/remind`, { at });
        return unwrap<{ remindAt: string }>(response, 'Could not set a reminder').remindAt;
    },


    async studentCheck(): Promise<StudentCheck | null> {
        const response = await apiService.get('/api/users/student-check');
        return unwrap<{ check: StudentCheck | null }>(response, 'Failed to load').check ?? null;
    },

    async sendStudentCheck(body: { kind: 'student' | 'resident'; areaKey: string; photoKey: string }): Promise<StudentCheck> {
        const response = await apiService.post('/api/users/student-check', body);
        return unwrap<{ check: StudentCheck }>(response, 'Could not send').check;
    },
};
