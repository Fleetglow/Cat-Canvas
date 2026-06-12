const test = require('node:test');
const assert = require('node:assert/strict');

const { buildOutputI2IChain, buildImageNodeI2IChain } = require('../static/js/output-i2i-helper');

test('图生图链路会保留空提示词节点', () => {
    const chain = buildOutputI2IChain({
        imageUrl: 'https://example.com/ref.png',
        promptText: '',
        point: {x: 120, y: 80},
        uid: prefix => `${prefix}-1`,
        providerId: 'comfly',
        model: 'demo-model'
    });

    assert.equal(chain.nodes.length, 3);
    assert.deepEqual(chain.nodes.map(node => node.type), ['prompt', 'image', 'generator']);
    assert.equal(chain.nodes[0].text, '');
    assert.equal(chain.nodes[2].ratio, 'source');
    assert.ok(chain.nodes[0].y < chain.nodes[1].y);
    assert.equal(chain.connections.length, 2);
    assert.deepEqual(chain.connections.map(link => [link.from, link.to]), [['prompt-1', 'gen-1'], ['img-1', 'gen-1']]);
});

test('image节点图生图只新增提示词和生成节点', () => {
    const chain = buildImageNodeI2IChain({
        sourceNodeId: 'img-0',
        sourceRect: {x: 100, y: 200, w: 260, h: 336},
        promptText: '',
        generatorBase: {w: 380, h: 0},
        uid: prefix => `${prefix}-1`
    });

    assert.deepEqual(chain.nodes.map(node => node.type), ['prompt', 'generator']);
    assert.equal(chain.connections.length, 2);
    assert.deepEqual(chain.connections.map(link => [link.from, link.to]), [['img-0', 'gen-1'], ['prompt-1', 'gen-1']]);
    assert.ok(chain.nodes[0].y > 200);
    assert.ok(chain.nodes[1].x > chain.nodes[0].x);
});
