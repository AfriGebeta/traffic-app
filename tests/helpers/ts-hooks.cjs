const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

exports.createRuntime = function (mocks = {}) {
    const slots = [];
    let cursor = 0;
    let effects = [];
    let dirty = false;
    const changed = (a, b) => !a || !b || b.some((value, i) => !Object.is(a[i], value));
    const react = {
        createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
        Fragment: 'Fragment',
        useRef(initial) { return slots[cursor++] ??= { current: initial }; },
        useState(initial) {
            const index = cursor++;
            if (!slots[index]) {
                slots[index] = { value: typeof initial === 'function' ? initial() : initial };
                slots[index].set = update => {
                    const value = typeof update === 'function' ? update(slots[index].value) : update;
                    if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
                };
            }
            return [slots[index].value, slots[index].set];
        },


        useCallback(fn, deps) {
            const index = cursor++;
            if (changed(slots[index]?.deps, deps)) slots[index] = { value: fn, deps };
            return slots[index].value;
        },
        useEffect(fn, deps) {
            const index = cursor++;
            if (changed(slots[index]?.deps, deps)) {
                const previous = slots[index];
                slots[index] = { deps };
                effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); });
            }
        },
    };
    react.default = react;
    const cache = new Map();
    function load(filename) {
        filename = path.resolve(filename);
        if (cache.has(filename)) return cache.get(filename).exports;
        const module = { exports: {} };
        cache.set(filename, module);
        const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
        }).outputText;
        function requireMock(id) {
            if (id === 'react') return react;
            for (const [suffix, value] of Object.entries(mocks)) if (id.endsWith(suffix)) return value;
            return load(path.resolve(path.dirname(filename), `${id}.ts`));
        }
        new Function('require', 'module', 'exports', '__DEV__', code)(requireMock, module, module.exports, false);
        return module.exports;
    }
    return {
        load, render(hook, props) {
            let output;
            let rounds = 0;
            do {
                if (++rounds > 20) throw new Error('Render loop');
                cursor = 0; effects = []; dirty = false;
                output = hook(props);
                effects.forEach(fn => fn());
            } while (dirty);
            return output;
        }
    };
};
