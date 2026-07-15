import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';

type LocalIconProps = {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
};

const iconByIoniconName: Record<string, IconName> = {
    'arrow-back': 'curved-dark-light-arrow-left',
    'arrow-forward': 'curved-dark-light-arrow-right',
    'chevron-back': 'curved-dark-light-arrow-left',
    'chevron-forward': 'curved-dark-light-arrow-right',
    'close': 'curved-dark-light-close-square',
    'close-circle': 'curved-dark-light-close-square',
    'close-circle-outline': 'curved-dark-light-close-square',
    'add': 'curved-dark-light-plus',
    'add-circle': 'curved-dark-light-plus',
    'add-circle-outline': 'curved-dark-light-plus',
    'search': 'curved-dark-light-search',
    'search-outline': 'curved-dark-light-search',
    'location': 'curved-dark-light-location',
    'location-outline': 'curved-dark-light-location',
    'locate': 'curved-dark-light-location',
    'locate-outline': 'curved-dark-light-location',
    'home': 'curved-dark-light-home',
    'home-outline': 'curved-dark-light-home',
    'person': 'curved-dark-light-profile',
    'person-outline': 'curved-dark-light-profile',
    'settings': 'curved-dark-light-setting',
    'settings-outline': 'curved-dark-light-setting',
    'heart': 'curved-dark-light-heart',
    'heart-outline': 'curved-dark-light-heart',
    'star': 'curved-dark-light-star',
    'star-outline': 'curved-dark-light-star',
    'bookmark': 'curved-dark-light-bookmark',
    'bookmark-outline': 'curved-dark-light-bookmark',
    'camera': 'curved-dark-light-camera',
    'camera-outline': 'curved-dark-light-camera',
    'call': 'curved-dark-light-call',
    'call-outline': 'curved-dark-light-call',
    'lock-closed': 'curved-dark-light-lock',
    'lock-open-outline': 'curved-dark-light-lock',
    'log-out': 'curved-dark-light-logout',
    'trash': 'curved-dark-light-delete',
    'trash-outline': 'curved-dark-light-delete',
    'create': 'curved-dark-light-edit',
    'create-outline': 'curved-dark-light-edit',
    'filter': 'curved-dark-light-filter',
    'filter-outline': 'curved-dark-light-filter',
    'information-circle': 'curved-dark-light-info-square',
    'information-circle-outline': 'curved-dark-light-info-square',
    'notifications': 'curved-dark-light-notification',
    'notifications-outline': 'curved-dark-light-notification',
    'briefcase': 'curved-dark-light-work',
    'briefcase-outline': 'curved-dark-light-work',
    'business': 'building',
    'medical': 'hospital',
    'restaurant': 'restaurant',
    'car': 'taxi-station',
    'car-outline': 'taxi-station',
    'warning': 'accident',
    'warning-outline': 'accident',
    'cloudy': 'bad-weather',
    'rainy': 'bad-weather',
};

const fallbackIcon: IconName = 'curved-dark-light-more-circle';

/**
 * Drop-in local replacement for Ionicons. It keeps existing screen code
 * working while ensuring every rendered icon comes from this repository.
 */
export const Ionicons: React.FC<LocalIconProps> & { glyphMap: Record<string, string> } = ({
    name,
    size = 24,
    color,
    style,
}) => (
    <Icon
        name={iconByIoniconName[name] ?? fallbackIcon}
        size={size}
        color={color}
        containerStyle={style}
    />
);

Ionicons.glyphMap = Object.keys(iconByIoniconName).reduce<Record<string, string>>(
    (glyphMap, name) => {
        glyphMap[name] = name;
        return glyphMap;
    },
    {},
);
