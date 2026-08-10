export const MOTION_V_SMOOTH = 0.35;

export const MOTION_STOP_SPEED = 0.7;
export const MOTION_CORR_TAU = 0.75;
export const MOTION_HEADING_TAU = 0.35;
export const MOTION_EXTRAP_GAIN = 0.95;

export const MOTION_EXTRAP_MAX_S = 4;
export const MOTION_DT_CLAMP_S = 0.1;
export const MOTION_BACKWARD_DAMP = 0.6;
export const MOTION_ALONG_TRUST = 0.2;
export const MOTION_HEADING_MIN_SPEED = 2;
export const MOTION_HEADING_LOOKAHEAD_M = 25;

export const MOTION_HEADING_MIN_MOVE = 5;

export const MOTION_STATIONARY_BREAK_M = 15;
export const SNAP_MAX_DIST_M = 30;
export const SNAP_BEARING_LOOKAHEAD_M = 25;
export const SNAP_HEADING_WEIGHT = 0.35;
export const SNAP_STICKY_BONUS_M = 14;
export const SNAP_REVERSAL_ANGLE = 100;
export const SNAP_REVERSAL_PENALTY_M = 80;
export const SNAP_AGAINST_DIGITISATION_M = 12;

export const SNAP_QUERY_HALF_PX = 140;
export const SNAP_QUERY_MIN_MS = 900;
export const SNAP_MIN_SPEED_FOR_HEADING = 2;
export const SNAP_ROAD_LAYER_IDS = [
    'highway-motorway',
    'highway-motorway-ramp',
    'highway-motorway-bridge',
    'highway-trunk',
    'highway-trunk-ramp',
    'highway-trunk-bridge',
    'highway-primary',
    'highway-primary-bridge',
    'highway-secondary',
    'highway-secondary-bridge',
    'highway-tertiary',
    'highway-minor',
    'tunnel-motorway',
    'tunnel-trunk',
    'tunnel-trunk-primary',
    'tunnel-secondary',
    'tunnel-tertiary',
    'tunnel-minor',
    'tunnel-service-track',
];
export const SNAP_NAME_QUERY_SCALE = 3;
export const SNAP_NAME_MAX_DIST_M = 60;
export const SNAP_NAME_LAYER_IDS = [
    'highway-name-major',
    'highway-name-minor',
    'highway-name-path',
];
export const SNAP_NAME_MISS_LIMIT = 8;
export const SNAP_DRIVABLE_CLASSES = new Set([
    'motorway',
    'trunk',
    'primary',
    'secondary',
    'tertiary',
    'minor',
    'service',
    'track',
]);
export const FREE_DRIVE_ZOOM = 17;
export const FREE_DRIVE_PITCH = 60;
export const PUCK_SCREEN_FRACTION = 0.68;
export const PUCK_OVERLAY_SIZE = 48;
export const FREE_DRIVE_GPS_INTERVAL_MS = 1000;
