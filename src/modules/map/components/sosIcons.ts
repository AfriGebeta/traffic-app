import type React from 'react';

import SosLightIcon from '../../../../assets/images/sos-light.svg';
import SosDarkIcon from '../../../../assets/images/sos-dark.svg';
import PoliceLightIcon from '../../../../assets/images/police-light.svg';
import PoliceDarkIcon from '../../../../assets/images/police-dark.svg';
import AmbulanceLightIcon from '../../../../assets/images/Ambulance-light.svg';
import AmbulanceDarkIcon from '../../../../assets/images/ambulance-dark.svg';
import FireLightIcon from '../../../../assets/images/fire-light.svg';
import FireDarkIcon from '../../../../assets/images/fire-dark.svg';

export type SosIcon = React.FC<{ width?: number; height?: number }>;

export const SOS_ICON = { light: SosLightIcon, dark: SosDarkIcon } as { light: SosIcon; dark: SosIcon };
export const POLICE_ICON = { light: PoliceLightIcon, dark: PoliceDarkIcon } as { light: SosIcon; dark: SosIcon };
export const AMBULANCE_ICON = { light: AmbulanceLightIcon, dark: AmbulanceDarkIcon } as { light: SosIcon; dark: SosIcon };
export const FIRE_ICON = { light: FireLightIcon, dark: FireDarkIcon } as { light: SosIcon; dark: SosIcon };
