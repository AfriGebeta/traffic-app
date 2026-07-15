import { Text, TextInput } from 'react-native';

const FONT_FAMILY = 'PlusJakartaSans-Regular';

function injectFont(type: unknown, props: any) {
    if ((type === Text || type === TextInput) && props) {
        return { ...props, style: [{ fontFamily: FONT_FAMILY }, props.style] };
    }
    return props;
}

function patchRuntime(mod: any, key: string) {
    const original = mod?.[key];
    if (typeof original !== 'function') return;
    mod[key] = function (type: unknown, props: any, ...rest: unknown[]) {
        return original(type, injectFont(type, props), ...rest);
    };
}

export function applyGlobalFont() {
    try {
        const runtime = require('react-native-css-interop/jsx-runtime');
        patchRuntime(runtime, 'jsx');
        patchRuntime(runtime, 'jsxs');
    } catch {}
    try {
        const devRuntime = require('react-native-css-interop/jsx-dev-runtime');
        patchRuntime(devRuntime, 'jsxDEV');
        patchRuntime(devRuntime, 'jsx');
        patchRuntime(devRuntime, 'jsxs');
    } catch {}
    try {
        patchRuntime(require('react/jsx-runtime'), 'jsx');
        patchRuntime(require('react/jsx-runtime'), 'jsxs');
    } catch {}
    try {
        patchRuntime(require('react/jsx-dev-runtime'), 'jsxDEV');
    } catch {}
}
