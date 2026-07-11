const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const canvasSource = fs.readFileSync(path.join(__dirname, '../static/js/canvas.js'), 'utf8');

test('API 生成节点包含 1:3 预设及全部分辨率', () => {
    assert.match(canvasSource, /portrait13:\s*\{\s*'1k':'512x1536',\s*'2k':'688x2048',\s*'4k':'1280x3840'\s*\}/);
    assert.match(canvasSource, /<option value="portrait13">1:3<\/option>/);
    assert.match(canvasSource, /portrait13:'1:3'/);
});

test('API 生成节点包含 3:1 预设及全部分辨率', () => {
    assert.match(canvasSource, /landscape31:\s*\{\s*'1k':'1536x512',\s*'2k':'2048x688',\s*'4k':'3840x1280'\s*\}/);
    assert.match(canvasSource, /<option value="landscape31">3:1<\/option>/);
    assert.match(canvasSource, /landscape31:'3:1'/);
});
