import type { TaxiNavigationResponse } from '../../taxi/types/taxi.types';
import { taxiService } from '../../taxi/services/taxi.service';
import { navigationService } from './navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';
import { calculateDistance } from '../utils/navigationUtils';
import { nextTaxiPlanId, prepareTaxiJourney, walkingLeg, type TaxiFix } from '../utils/taxiJourney';

export async function changeTaxiDropoff(
    route: TaxiNavigationResponse, from: TaxiFix, dropoff: TaxiFix & { name: string },
): Promise<TaxiNavigationResponse> {
    const ride = await navigationService.getNavigation({
        origin: [from.lat, from.lng], destination: [dropoff.lat, dropoff.lng], costing: 'auto',
    });
    const trip = ride?.data?.trip;
    if (!trip?.legs?.length) throw new Error('No road route');
    const coords = trip.legs.flatMap(leg => decodePolyline(leg.shape, 6));
    if (coords.length < 2) throw new Error('No ride geometry');
    const atDestination = calculateDistance(dropoff.lat, dropoff.lng, route.destination.lat, route.destination.lng) < 40;
    const continuation = atDestination ? null : await taxiService.requestTaxiNavigation({
        origin: [dropoff.lat, dropoff.lng], destination: [route.destination.lat, route.destination.lng],
    });
    if (continuation && (!continuation.success || !continuation.segments?.length)) throw new Error('No onward trip');
    const remaining = continuation ? prepareTaxiJourney(continuation).segments! : [walkingLeg(dropoff, route.destination)];
    return {
        ...route, origin: from, planId: nextTaxiPlanId(),
        segments: [{
            type: 'taxi', mode: 'auto', from, to: dropoff,
            toNode: { ...dropoff, id: -1 }, polyline: '', overrideCoords: coords,
            distance: trip.summary.length, time: trip.summary.time,
        }, ...remaining],
        summary: {
            ...(continuation?.summary ?? route.summary), estimatedFare: continuation?.summary.estimatedFare ?? 0,
            pricingSource: 'onward-only'
        },
    };
}
