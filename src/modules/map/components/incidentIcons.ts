import type React from 'react';

import AccidentLightIcon from '../../../../assets/images/accident-light.svg';
import AccidentDarkIcon from '../../../../assets/images/accident-dark.svg';
import BadWeatherLightIcon from '../../../../assets/images/bad-weather-light.svg';
import BadWeatherDarkIcon from '../../../../assets/images/bad-weather-dark.svg';
import BrokenRoadLightIcon from '../../../../assets/images/broken-road-light.svg';
import BrokenRoadDarkIcon from '../../../../assets/images/broken-road-dark.svg';
import ClosureLightIcon from '../../../../assets/images/closure-light.svg';
import ClosureDarkIcon from '../../../../assets/images/closure-dark.svg';

import CrashLightIcon from '../../../../assets/images/crash-light.svg';
import CrashDarkIcon from '../../../../assets/images/crash-dark.svg';
import GatedCommunityLightIcon from '../../../../assets/images/gated-community-light.svg';
import GatedCommunityDarkIcon from '../../../../assets/images/gated-community-dark.svg';
import HazardLightIcon from '../../../../assets/images/hazard-light.svg';
import HazardDarkIcon from '../../../../assets/images/hazard-dark.svg';
import OtherLightIcon from '../../../../assets/images/other-light.svg';
import OtherDarkIcon from '../../../../assets/images/other-dark.svg';
import RadarLightIcon from '../../../../assets/images/radar-light.svg';
import RadarDarkIcon from '../../../../assets/images/radar-dark.svg';
import TrafficJamLightIcon from '../../../../assets/images/traffic-jam-light.svg';
import TrafficJamDarkIcon from '../../../../assets/images/traffic-jam-dark.svg';

import FloodLightIcon from '../../../../assets/images/flood-light.svg';
import FloodDarkIcon from '../../../../assets/images/flood-dark.svg';

export type IncidentIcon = React.FC<{ width?: number; height?: number }>;

export const INCIDENT_SVG_ICON_MAP: Record<string, { light: IncidentIcon; dark: IncidentIcon }> = {
    'ROAD_CLOSURE': { light: ClosureLightIcon, dark: ClosureDarkIcon },
    'ACCIDENT': { light: AccidentLightIcon, dark: AccidentDarkIcon },
    'TRAFFIC_JAM': { light: TrafficJamLightIcon, dark: TrafficJamDarkIcon },
    'BAD_WEATHER': { light: BadWeatherLightIcon, dark: BadWeatherDarkIcon },
    'HAZARD': { light: HazardLightIcon, dark: HazardDarkIcon },
    'CRASH': { light: CrashLightIcon, dark: CrashDarkIcon },
    'GATED_COMMUNITY': { light: GatedCommunityLightIcon, dark: GatedCommunityDarkIcon },
    'BROKEN_ROAD': { light: BrokenRoadLightIcon, dark: BrokenRoadDarkIcon },
    'RADAR': { light: RadarLightIcon, dark: RadarDarkIcon },
    'FLOOD': { light: FloodLightIcon, dark: FloodDarkIcon },
    'OTHER': { light: OtherLightIcon, dark: OtherDarkIcon },
};
