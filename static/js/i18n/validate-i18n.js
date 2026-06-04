const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../../..');
const files = [
    'static/js/i18n-core.js',
    'static/js/i18n/common.js',
    'static/js/i18n/studio.js',
    'static/js/i18n/api-settings.js',
    'static/js/i18n/canvas.js',
    'static/js/i18n/comfyui-settings.js',
    'static/js/i18n.js',
];

const sandbox = {
    window: {},
    document: {
        readyState: 'complete',
        currentScript: null,
        addEventListener(){},
        createElement(){ return {}; },
        head: { appendChild(){} },
        write(){},
        querySelectorAll(){ return []; },
        documentElement: { setAttribute(){} },
    },
    localStorage: { getItem(){ return null; }, setItem(){} },
    CustomEvent: function(type, init){ return { type, ...init }; },
    console,
};
sandbox.window.dispatchEvent = function(){};

for(const file of files){
    const abs = path.join(root, file);
    new vm.Script(fs.readFileSync(abs, 'utf8'), { filename:file }).runInNewContext(sandbox);
}

const entries = sandbox.window.StudioI18n?.entries?.() || { zh:{} };
const dict = entries.zh || {};

const bad = [];
for(const [key, value] of Object.entries(dict)){
    if(typeof value !== 'string') bad.push(key);
    if(/[�]|璁|娴|澶|鎻|鐢|鍙|杈|绋|鏂|涓/.test(value)) bad.push(key);
}

const used = new Set();
const scanFiles = fs.readdirSync(path.join(root, 'static'))
    .filter(name => name.endsWith('.html'))
    .map(name => path.join(root, 'static', name))
    .concat(fs.readdirSync(path.join(root, 'static/js'))
        .filter(name => name.endsWith('.js') && !name.startsWith('i18n.monolith-') && !name.startsWith('i18n.js.broken-'))
        .map(name => path.join(root, 'static/js', name)));

for(const file of scanFiles){
    const text = fs.readFileSync(file, 'utf8');
    for(const re of [
        /data-i18n(?:-[a-z]+)?=["']([^"']+)["']/g,
        /\btr\(\s*["']([^"']+)["']\s*\)/g,
        /\btrf\(\s*["']([^"']+)["']/g,
        /\btf\(\s*["']([^"']+)["']/g,
    ]){
        let match;
        while((match = re.exec(text))) used.add(match[1]);
    }
}

const unresolved = [...used].filter(key => !(key in dict)).sort();

if(bad.length || unresolved.length){
    if(bad.length) console.error('Possible mojibake:', bad.join(', '));
    if(unresolved.length) console.error('Unresolved keys:', unresolved.join(', '));
    process.exit(1);
}

console.log(`i18n ok: ${Object.keys(dict).length} keys`);
