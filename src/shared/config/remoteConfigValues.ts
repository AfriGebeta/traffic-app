import { getNumber, type FirebaseRemoteConfigTypes } from '@react-native-firebase/remote-config';

//central registry for remote config - without api key
export interface AppConfigValues {
  // gps/location update
  navGpsIntervalMs: number;
  userLocationIntervalMs: number;
  collectorTrackingIntervalMs: number;

  // arrival thresholds
  stationArrivalThresholdM: number;
  walkingEndThresholdM: number;
  taxiStationArrivalThresholdM: number;
  taxiWalkingEndThresholdM: number;
  taxiOffRouteThresholdM: number;
  arrivalDistanceM: number;

  // off route/heading
  offRouteThresholdM: number;
  offRouteDelayMs: number;
  headingDivergeAngleDeg: number;
  headingDivergeTimeMs: number;
  headingMinSpeed: number;
  headingMinDistanceM: number;

  // proxiimity alerts
  incidentAlertDistanceKm: number;
  incidentClearDistanceKm: number;
  ruleAlertDistanceKm: number;
  ruleClearDistanceKm: number;

  // voice/instruction 
  voiceMinSpeakIntervalMs: number;
  advanceThresholdM: number;
  preTransitionLeadTimeSec: number;
  preTransitionMinDistanceM: number;
  preTransitionMaxDistanceM: number;

  // telemetry
  trackingPointIntervalMs: number;
  trackingFlushIntervalMs: number;

  // map defaults
  defaultMapCenterLng: number;
  defaultMapCenterLat: number;
  userLocationZoom: number;
  navZoom: number;
  maxRecentSearches: number;
}

export const APP_CONFIG_DEFAULTS: AppConfigValues = {
  navGpsIntervalMs: 1000,
  userLocationIntervalMs: 5000,
  collectorTrackingIntervalMs: 5000,

  stationArrivalThresholdM: 50,
  walkingEndThresholdM: 20,
  taxiStationArrivalThresholdM: 80,
  taxiWalkingEndThresholdM: 40,
  taxiOffRouteThresholdM: 30,
  arrivalDistanceM: 80,

  offRouteThresholdM: 30,
  offRouteDelayMs: 2000,
  headingDivergeAngleDeg: 50,
  headingDivergeTimeMs: 3000,
  headingMinSpeed: 3,
  headingMinDistanceM: 20,

  incidentAlertDistanceKm: 1,
  incidentClearDistanceKm: 0.2,
  ruleAlertDistanceKm: 0.2,
  ruleClearDistanceKm: 0.05,

  voiceMinSpeakIntervalMs: 3000,
  advanceThresholdM: 60,
  preTransitionLeadTimeSec: 10,
  preTransitionMinDistanceM: 70,
  preTransitionMaxDistanceM: 200,

  trackingPointIntervalMs: 5000,
  trackingFlushIntervalMs: 30000,

  defaultMapCenterLng: 38.7463,
  defaultMapCenterLat: 9.0223,
  userLocationZoom: 15,
  navZoom: 19,
  maxRecentSearches: 5,
};

export const RC_KEYS: Record<keyof AppConfigValues, string> = {
  navGpsIntervalMs: 'nav_gps_interval_ms',
  userLocationIntervalMs: 'user_location_interval_ms',
  collectorTrackingIntervalMs: 'collector_tracking_interval_ms',

  stationArrivalThresholdM: 'station_arrival_threshold_m',
  walkingEndThresholdM: 'walking_end_threshold_m',
  taxiStationArrivalThresholdM: 'taxi_station_arrival_threshold_m',
  taxiWalkingEndThresholdM: 'taxi_walking_end_threshold_m',
  taxiOffRouteThresholdM: 'taxi_off_route_threshold_m',
  arrivalDistanceM: 'arrival_distance_m',

  offRouteThresholdM: 'off_route_threshold_m',
  offRouteDelayMs: 'off_route_delay_ms',
  headingDivergeAngleDeg: 'heading_diverge_angle_deg',
  headingDivergeTimeMs: 'heading_diverge_time_ms',
  headingMinSpeed: 'heading_min_speed',
  headingMinDistanceM: 'heading_min_distance_m',

  incidentAlertDistanceKm: 'incident_alert_distance_km',
  incidentClearDistanceKm: 'incident_clear_distance_km',
  ruleAlertDistanceKm: 'rule_alert_distance_km',
  ruleClearDistanceKm: 'rule_clear_distance_km',

  voiceMinSpeakIntervalMs: 'voice_min_speak_interval_ms',
  advanceThresholdM: 'advance_threshold_m',
  preTransitionLeadTimeSec: 'pre_transition_lead_time_sec',
  preTransitionMinDistanceM: 'pre_transition_min_distance_m',
  preTransitionMaxDistanceM: 'pre_transition_max_distance_m',

  trackingPointIntervalMs: 'tracking_point_interval_ms',
  trackingFlushIntervalMs: 'tracking_flush_interval_ms',

  defaultMapCenterLng: 'default_map_center_lng',
  defaultMapCenterLat: 'default_map_center_lat',
  userLocationZoom: 'user_location_zoom',
  navZoom: 'nav_zoom',
  maxRecentSearches: 'max_recent_searches',
};

const CONFIG_KEYS = Object.keys(RC_KEYS) as (keyof AppConfigValues)[];

let current: AppConfigValues = { ...APP_CONFIG_DEFAULTS };

export function getAppConfig(): AppConfigValues {
  return current;
}

export function buildRemoteConfigDefaults(): Record<string, number> {
  const defaults: Record<string, number> = {};
  for (const key of CONFIG_KEYS) {
    defaults[RC_KEYS[key]] = APP_CONFIG_DEFAULTS[key];
  }
  return defaults;
}

export function hydrateAppConfig(rc: FirebaseRemoteConfigTypes.Module): void {
  const next: AppConfigValues = { ...APP_CONFIG_DEFAULTS };
  for (const key of CONFIG_KEYS) {
    try {
      const value = getNumber(rc, RC_KEYS[key]);
      if (Number.isFinite(value) && value > 0) {
        next[key] = value;
      }
    } catch {
    }
  }
  current = next;
}
