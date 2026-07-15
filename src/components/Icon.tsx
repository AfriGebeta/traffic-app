import React from 'react';
import {
    Image,
    ImageResizeMode,
    ImageStyle,
    StyleProp,
    View,
    ViewStyle,
} from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { LocalIconName, localIconRegistry } from './localIconRegistry';

export type IconName = LocalIconName;

export interface IconProps {
    name: IconName;
    size?: number;
    width?: number;
    height?: number;
    color?: string;
    resizeMode?: ImageResizeMode;
    style?: StyleProp<ImageStyle>;
    containerStyle?: StyleProp<ViewStyle>;
}

export const iconNames = Object.keys(localIconRegistry) as IconName[];

export const getIconSource = (name: IconName) => {
    return localIconRegistry[name].source;
};

export const Icon: React.FC<IconProps> = ({
    name,
    size = 24,
    width,
    height,
    color,
    resizeMode = 'contain',
    style,
    containerStyle,
}) => {
    const icon = localIconRegistry[name];
    const iconWidth = width ?? size;
    const iconHeight = height ?? size;

    if (icon.type === 'svg') {
        // Metro transforms local .svg files into React components. Resolving them
        // as image assets produces an invalid URI on Android, which leaves the
        // icon's reserved space empty. Render the transformed SVG directly.
        // `require()` is wrapped as a CommonJS module by Metro for SVG files,
        // so the transformed component is exposed on `default`. Rendering the
        // wrapper object directly causes React's "Element type is invalid"
        // error on Android.
        const svgModule = icon.source as unknown as {
            default?: React.ComponentType<SvgProps>;
        };
        const SvgIcon = svgModule.default ?? (svgModule as React.ComponentType<SvgProps>);

        if (typeof SvgIcon !== 'function') {
            return null;
        }

        return (
            <View style={[{ width: iconWidth, height: iconHeight }, containerStyle]}>
                <SvgIcon
                    width={iconWidth}
                    height={iconHeight}
                    color={color}
                />
            </View>
        );
    }

    return (
        <Image
            source={icon.source}
            resizeMode={resizeMode}
            style={[
                {
                    width: iconWidth,
                    height: iconHeight,
                    tintColor: color,
                },
                style,
            ]}
        />
    );
};

export default Icon;
