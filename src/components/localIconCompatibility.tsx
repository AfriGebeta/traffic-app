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
    'chevron-back': 'curved-dark-light-arrow-left',
    'chevron-forward': 'curved-dark-light-arrow-right',
    
    'star': 'curved-dark-light-star',
    'bookmark': 'curved-dark-light-bookmark',
    'log-out': 'curved-dark-light-logout',
    'filter': 'curved-dark-light-filter',
    'briefcase': 'curved-dark-light-work',
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
