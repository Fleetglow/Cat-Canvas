(function(root, factory){
    const api = factory();
    if(typeof module !== 'undefined' && module.exports) module.exports = api;
    if(root) root.StudioOutputI2I = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
    function text(value){
        return value == null ? '' : String(value);
    }

    function clone(value){
        return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {};
    }

    function safeUidFactory(uid){
        if(typeof uid === 'function') return uid;
        return prefix => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    function sizeOf(node, fallback){
        return {
            w: Number(node?.w || fallback?.w || 0),
            h: Number(node?.h || fallback?.h || 0)
        };
    }

    function buildOutputI2IChain(options = {}){
        const uid = safeUidFactory(options.uid);
        const point = options.point || {x: 0, y: 0};
        const baseX = Number(point.x || 0);
        const baseY = Number(point.y || 0);
        const generatorBase = clone(options.generatorBase);
        const promptSize = {w: 310, h: 180};
        const imageSize = {w: 260, h: 336};
        const generatorSize = sizeOf(generatorBase, {w: 380, h: 160});
        const columnGap = 220;
        const rowGap = 80;
        const leftColumnH = promptSize.h + rowGap + imageSize.h;
        const leftColumnW = Math.max(promptSize.w, imageSize.w);
        const generatorY = baseY + Math.max(0, Math.round((leftColumnH - generatorSize.h) / 2));
        const imageNode = {
            id: uid('img'),
            type: 'image',
            x: baseX,
            y: baseY + promptSize.h + rowGap,
            url: text(options.imageUrl),
            name: text(options.imageName || 'image')
        };
        const promptNode = {
            id: uid('prompt'),
            type: 'prompt',
            x: baseX,
            y: baseY,
            text: text(options.promptText)
        };
        const generatorNode = {
            ...generatorBase,
            id: uid('gen'),
            type: 'generator',
            x: baseX + leftColumnW + columnGap,
            y: generatorY,
            ratio: 'source',
            inputs: [],
            running: false,
            customRatio: '',
            customSize: '',
            customRatioWidth: '',
            customRatioHeight: '',
            customWidth: '',
            customHeight: '',
        };
        return {
            nodes: [promptNode, imageNode, generatorNode],
            connections: [
                {id: uid('c'), from: promptNode.id, to: generatorNode.id},
                {id: uid('c'), from: imageNode.id, to: generatorNode.id}
            ],
            generatorNodeId: generatorNode.id,
            focusRect: {
                x: baseX,
                y: baseY,
                w: (leftColumnW + columnGap + generatorSize.w),
                h: Math.max(leftColumnH, generatorSize.h)
            }
        };
    }

    function buildImageNodeI2IChain(options = {}){
        const uid = safeUidFactory(options.uid);
        const sourceRect = options.sourceRect || {x: 0, y: 0, w: 260, h: 336};
        const sourceNodeId = text(options.sourceNodeId);
        const sourceX = Number(sourceRect.x || 0);
        const sourceY = Number(sourceRect.y || 0);
        const sourceW = Number(sourceRect.w || 260);
        const sourceH = Number(sourceRect.h || 336);
        const generatorBase = clone(options.generatorBase);
        const promptSize = {w: 310, h: 180};
        const generatorSize = sizeOf(generatorBase, {w: 380, h: 160});
        const columnGap = 220;
        const rowGap = 80;
        const promptNode = {
            id: uid('prompt'),
            type: 'prompt',
            x: sourceX,
            y: sourceY + sourceH + rowGap,
            text: text(options.promptText)
        };
        const generatorNode = {
            ...generatorBase,
            id: uid('gen'),
            type: 'generator',
            x: sourceX + Math.max(sourceW, promptSize.w) + columnGap,
            y: sourceY,
            ratio: 'source',
            inputs: [],
            running: false,
            customRatio: '',
            customSize: '',
            customRatioWidth: '',
            customRatioHeight: '',
            customWidth: '',
            customHeight: '',
        };
        return {
            nodes: [promptNode, generatorNode],
            connections: [
                ...(sourceNodeId ? [{id: uid('c'), from: sourceNodeId, to: generatorNode.id}] : []),
                {id: uid('c'), from: promptNode.id, to: generatorNode.id}
            ],
            generatorNodeId: generatorNode.id,
            focusRect: {
                x: sourceX,
                y: sourceY,
                w: Math.max(sourceW, promptSize.w) + columnGap + generatorSize.w,
                h: Math.max(sourceH, promptNode.y + promptSize.h - sourceY, generatorSize.h)
            }
        };
    }

    return {buildOutputI2IChain, buildImageNodeI2IChain};
});
