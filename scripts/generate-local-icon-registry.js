const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outputPath = path.join(root, 'src', 'components', 'localIconRegistry.ts');

const normalizeName = (value) =>
    value
        .replace(/\\/g, '/')
        .replace(/\.[^.]+$/, '')
        .split('/')
        .map((part) =>
            part
                .toLowerCase()
                .replace(/&/g, 'and')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
        )
        .filter(Boolean)
        .join('-');

const walk = (directory) => {
    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(fullPath) : [fullPath];
    });
};

const imageRoot = path.join(root, 'assets', 'images');
const svgRoot = path.join(root, 'assets', 'icons');

const files = [
    ...walk(imageRoot)
        .filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
        .map((file) => ({
            file,
            type: 'image',
            key: normalizeName(path.relative(imageRoot, file)),
        })),
    ...walk(svgRoot)
        .filter((file) => /\.svg$/i.test(file))
        .map((file) => ({
            file,
            type: 'svg',
            key: normalizeName(path.relative(svgRoot, file)),
        })),
].sort((a, b) => a.key.localeCompare(b.key));

const seen = new Map();

for (const item of files) {
    const baseKey = item.key;
    let key = baseKey;
    let suffix = 2;

    while (seen.has(key)) {
        key = `${baseKey}-${suffix}`;
        suffix += 1;
    }

    seen.set(key, item);
    item.key = key;
}

const lines = [
    '/* This file is generated from assets/images and assets/icons. */',
    '/* Run `node scripts/generate-local-icon-registry.js` after adding or removing local icon files. */',
    '',
    'export const localIconRegistry = {',
];

for (const item of files) {
    let relativePath = path
        .relative(path.dirname(outputPath), item.file)
        .replace(/\\/g, '/');

    if (!relativePath.startsWith('.')) {
        relativePath = `./${relativePath}`;
    }

    lines.push(
        `    "${item.key}": { type: "${item.type}", source: require("${relativePath}") },`
    );
}

lines.push('} as const;');
lines.push('');
lines.push('export type LocalIconName = keyof typeof localIconRegistry;');
lines.push('export type LocalIconAsset = (typeof localIconRegistry)[LocalIconName];');

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
