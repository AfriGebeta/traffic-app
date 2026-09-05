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
  taxiBoardingPromptRadiusM: number;
  taxiDropoffPromptRadiusM: number;
  taxiConfirmationSnoozeMs: number;
  taxiOffRouteThresholdM: number;
  arrivalDistanceM: number;

  // off route/heading
  offRouteThresholdM: number;
  offRouteDelayMs: number;
  taxiWalkOffRouteDelayMs: number;
  taxiAutoOffRouteThresholdM: number;
  taxiAutoOffRouteDelayMs: number;
  headingDivergeAngleDeg: number;
  headingDivergeTimeMs: number;
  headingMinSpeed: number;
  headingMinDistanceM: number;

  // taxi in-leg reroute + new-station suggestion
  taxiRerouteCooldownMs: number;
  taxiReplanFloorWalkM: number;
  taxiReplanFloorAutoM: number;
  taxiReplanRatioWalk: number;
  taxiReplanRatioAuto: number;
  taxiReplanGateStreak: number;
  taxiRerouteFailStreak: number;
  taxiAwayFixCount: number;
  taxiAwayNetGainWalkM: number;
  taxiAwayNetGainAutoM: number;
  taxiSuggestSnoozeMs: number;
  taxiSuggestRearmGrowth: number;

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
  taxiBoardingPromptRadiusM: 100,
  taxiDropoffPromptRadiusM: 150,
  taxiConfirmationSnoozeMs: 120000,
  taxiOffRouteThresholdM: 30,
  arrivalDistanceM: 80,

  offRouteThresholdM: 30,
  offRouteDelayMs: 2000,
  taxiWalkOffRouteDelayMs: 2000,
  taxiAutoOffRouteThresholdM: 70,
  taxiAutoOffRouteDelayMs: 15000,
  headingDivergeAngleDeg: 50,
  headingDivergeTimeMs: 3000,
  headingMinSpeed: 3,
  headingMinDistanceM: 20,

  taxiRerouteCooldownMs: 8000,
  taxiReplanFloorWalkM: 500,
  taxiReplanFloorAutoM: 1500,
  taxiReplanRatioWalk: 2.5,
  taxiReplanRatioAuto: 2,
  taxiReplanGateStreak: 2,
  taxiRerouteFailStreak: 2,
  taxiAwayFixCount: 10,
  taxiAwayNetGainWalkM: 150,
  taxiAwayNetGainAutoM: 600,
  taxiSuggestSnoozeMs: 180000,
  taxiSuggestRearmGrowth: 1.5,

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
  navZoom: 17,
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
  taxiBoardingPromptRadiusM: 'taxi_boarding_prompt_radius_m',
  taxiDropoffPromptRadiusM: 'taxi_dropoff_prompt_radius_m',
  taxiConfirmationSnoozeMs: 'taxi_confirmation_snooze_ms',
  taxiOffRouteThresholdM: 'taxi_off_route_threshold_m',
  arrivalDistanceM: 'arrival_distance_m',

  offRouteThresholdM: 'off_route_threshold_m',
  offRouteDelayMs: 'off_route_delay_ms',
  taxiWalkOffRouteDelayMs: 'taxi_walk_off_route_delay_ms',
  taxiAutoOffRouteThresholdM: 'taxi_auto_off_route_threshold_m',
  taxiAutoOffRouteDelayMs: 'taxi_auto_off_route_delay_ms',
  headingDivergeAngleDeg: 'heading_diverge_angle_deg',
  headingDivergeTimeMs: 'heading_diverge_time_ms',
  headingMinSpeed: 'heading_min_speed',
  headingMinDistanceM: 'heading_min_distance_m',

  taxiRerouteCooldownMs: 'taxi_reroute_cooldown_ms',
  taxiReplanFloorWalkM: 'taxi_replan_floor_walk_m',
  taxiReplanFloorAutoM: 'taxi_replan_floor_auto_m',
  taxiReplanRatioWalk: 'taxi_replan_ratio_walk',
  taxiReplanRatioAuto: 'taxi_replan_ratio_auto',
  taxiReplanGateStreak: 'taxi_replan_gate_streak',
  taxiRerouteFailStreak: 'taxi_reroute_fail_streak',
  taxiAwayFixCount: 'taxi_away_fix_count',
  taxiAwayNetGainWalkM: 'taxi_away_net_gain_walk_m',
  taxiAwayNetGainAutoM: 'taxi_away_net_gain_auto_m',
  taxiSuggestSnoozeMs: 'taxi_suggest_snooze_ms',
  taxiSuggestRearmGrowth: 'taxi_suggest_rearm_growth',

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
