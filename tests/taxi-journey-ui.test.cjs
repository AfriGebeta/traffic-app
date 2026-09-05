const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
function setup(prompt = null, language = 'en') {
    const i18n = require('i18next').createInstance();
    const rows = require('../src/shared/utils/localization/translations.json');
    i18n.init({ lng: language, fallbackLng: 'en', initImmediate: false,
        resources: Object.fromEntries([['en', 'EN_US'], ['am', 'AM']].map(([lang, column]) =>
            [lang, { translation: Object.fromEntries(rows.map(row => [row.key, row[column]])) }])),
        interpolation: { escapeValue: false } });
    const runtime = createRuntime({
        'react-i18next': { useTranslation: () => ({ t: i18n.t.bind(i18n) }) },
        'react-native': {
            View: 'View', Text: 'Text', TouchableOpacity: 'Button', Modal: 'Modal',
            ScrollView: 'ScrollView', TextInput: 'TextInput', ActivityIndicator: 'Spinner',
            KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'android' }
        },
        '@expo/vector-icons': { Ionicons: 'Icon' },
        '/contribute-taxi-light.svg': { default: 'TaxiLightIcon' },
        '/contribute-taxi-dark.svg': { default: 'TaxiDarkIcon' },
        'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
        '/ThemeContext': {
            useTheme: () => ({
                colors: {
                    textPrimary: '#111', textSecondary: '#666',
                    background: '#fff', surface: '#eee', border: '#ddd'
                }
            })
        },
        '/navigation.service': { navigationService: { geocodePlace: async () => [] } },
    });
    const Card = runtime.load('src/modules/taxi/components/TaxiJourneyCard.tsx').default;
    const props = {
        prompt, isOnTaxi: false, boardingTarget: 'Bole Roundabout', targetName: 'Megenagna',
        hasLocation: true, canUndo: true, busy: false, error: null,
        onRequest: () => { props.prompt = { kind: 'board', reason: 'manual' }; },
        onConfirm: () => { props.prompt = null; }, onDismiss: () => { props.prompt = null; },
        onUndo() { }, onDifferentDropoff: async () => { }
    };
    return { props, render: () => runtime.render(Card, props) };
}
function nodes(tree) {
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (tree.type === 'Modal' && !tree.props.visible) return [];
    return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
    if (tree == null || typeof tree === 'boolean') return '';
    if (typeof tree !== 'object') return String(tree);
    if (Array.isArray(tree)) return tree.map(text).join('');
    return text(tree.props?.children);
}
test('idle navigation shows a small correction control, without a question or persistent undo card', () => {
    const visible = nodes(setup().render());
    assert.equal(visible.filter(node => node.type === 'Button').length, 2);
    assert.equal(visible.filter(node => node.props.accessibilityRole === 'header').length, 0);
    assert.ok(!visible.some(node => node.type === 'Text' && text(node).includes('Undo')));
});
test('automatic questions use two side-by-side answers and never open the options sheet', () => {
    const visible = nodes(setup({ kind: 'board', reason: 'near' }).render());
    const answers = visible.find(node => node.type === 'View' && node.props.style?.flexDirection === 'row'
        && nodes(node).filter(child => child.type === 'Button').length === 2);
    assert.ok(answers);
    assert.equal(answers.props.children[0].length ?? answers.props.children.length, 2);
    assert.ok(text(answers).includes('Yes, boarded'));
    assert.ok(text(answers).includes('Not yet'));
    assert.equal(visible.some(node => node.type === 'Modal'), false);
});
test('alternate drop-off and undo are revealed only after opening Trip options', () => {
    const h = setup();
    const more = nodes(h.render()).find(node => node.props.accessibilityLabel === 'Trip options');
    more.props.onPress();
    const visible = nodes(h.render());
    assert.ok(visible.some(node => node.type === 'Modal'));
    assert.ok(visible.some(node => node.type === 'Button' && text(node) === 'Undo last change'));
    assert.ok(visible.some(node => node.type === 'Button' && text(node) === 'My taxi goes somewhere else'));
});
test('questions float over the bottom panel without opening a screen-blocking modal', () => {
    const h = setup({ kind: 'alight', reason: 'near' });
    h.props.isOnTaxi = true;
    const visible = nodes(h.render());
    const popup = visible.find(node => node.type === 'View' && node.props.style?.position === 'absolute');
    assert.ok(popup);
    assert.equal(popup.props.style.bottom, 0, 'anchor to the controls inside the bottom panel');
    assert.equal(popup.props.style.borderWidth, undefined);
    assert.equal(visible.some(node => node.type === 'Modal'), false);
    const close = nodes(popup).find(node => node.props.accessibilityLabel === 'Dismiss question for now');
    close.props.onPress();
    assert.equal(h.props.prompt, null);
});


test('boarding popup still confirms boarding explicitly', () => {
    const h = setup({ kind: 'board', reason: 'manual' });
    const confirm = nodes(h.render()).find(node => node.type === 'Button' && text(node) === 'Yes, boarded');
    confirm.props.onPress();
    assert.equal(h.props.prompt, null);
});

test('Amharic boarding and drop-off prompts translate questions, answers, and destination interpolation', () => {
    const h = setup({ kind: 'board', reason: 'near' }, 'am');
    let visible = nodes(h.render());
    assert.ok(visible.some(node => text(node) === 'ወደ Bole Roundabout በሚሄድ ታክሲ ተሳፍረዋል?'));
    assert.ok(visible.some(node => node.type === 'Button' && text(node) === 'አዎ፣ ተሳፍሬያለሁ'));
    h.props.isOnTaxi = true;
    h.props.prompt = { kind: 'alight', reason: 'near' };
    visible = nodes(h.render());
    assert.ok(visible.some(node => text(node) === 'Megenagna ላይ ወርደዋል?'));
    assert.ok(visible.some(node => node.type === 'Button' && text(node) === 'አዎ፣ ወርጃለሁ'));
    h.props.prompt = { kind: 'alight', reason: 'route' };
    visible = nodes(h.render());
    assert.ok(visible.some(node => text(node) === 'አሁንም ወደ Megenagna እየሄዱ ነው?'));
});
