function refreshIcons(){ if(window.lucide) lucide.createIcons(); }
refreshIcons();
function tr(key){ return window.StudioI18n ? StudioI18n.t(key) : key; }
function trf(key, values={}){
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), tr(key));
}
function actionFailed(labelKey, detail=''){
    const label = tr(labelKey);
    return `${label}失败${detail ? `：${detail}` : ''}`;
}
function noReturnedImage(labelKey){ return `${tr(labelKey)}失败：未返回图片`; }
window.addEventListener('message', event => {
    if(event.data?.type === 'canvas_updated') handleCanvasUpdatedMessage(event.data);
    if(event.data?.type === 'canvas-focus'){
        // 从其他标签页切换回画布时，重新拉取工作流列表并刷新节点
        loadConfig().then(() => {
            if(typeof render === 'function') render();
        });
        if(canvas) syncRemoteCanvasNow();
        // 没有打开画布时，尝试恢复上次的画布
        if(!canvas) {
            const lastId = localStorage.getItem(LAST_CANVAS_ID_KEY);
            if(lastId) openCanvas(lastId).catch(() => {});
        }
    }
});
window.addEventListener('studio-lang-change', () => {
    document.title = tr('canvas.title');
    refreshGateViewControls();
    if(canvas) currentCanvasTitle.textContent = canvas?.title || tr('canvas.untitled');
    renderCanvasList();
    render();
});
const shell = document.getElementById('shell');
const canvasGate = document.getElementById('canvasGate');
const board = document.getElementById('board');
const world = document.getElementById('world');
const nodesEl = document.getElementById('nodes');
const minimap = document.getElementById('minimap');
const minimapContent = document.getElementById('minimapContent');
let minimapViewport = document.getElementById('minimapViewport');
const zoomPercentLabel = document.getElementById('zoomPercentLabel');
const settingsModal = document.getElementById('settingsModal');
let showGenTime = localStorage.getItem('canvas_showGenTime') !== '0';
const showGenTimeSwitch = document.getElementById('showGenTimeSwitch');
if(showGenTimeSwitch) showGenTimeSwitch.checked = showGenTime;
let swapCtrlShift = localStorage.getItem('canvas_swapCtrlShift') === '1';
function isMultiSelectKey(e){ return swapCtrlShift ? e.shiftKey : (e.ctrlKey || e.metaKey); }
function isKnifeKey(e){ return swapCtrlShift ? (e.ctrlKey || e.metaKey) : e.shiftKey; }
const swapCtrlShiftSwitch = document.getElementById('swapCtrlShiftSwitch');
if(swapCtrlShiftSwitch) swapCtrlShiftSwitch.checked = swapCtrlShift;
let enableXDelete = localStorage.getItem('canvas_enableXDelete') === '1';
const enableXDeleteSwitch = document.getElementById('enableXDeleteSwitch');
if(enableXDeleteSwitch) enableXDeleteSwitch.checked = enableXDelete;
let preserveConnections = localStorage.getItem('canvas_preserveConnections') !== '0';
const preserveConnectionsSwitch = document.getElementById('preserveConnectionsSwitch');
if(preserveConnectionsSwitch) preserveConnectionsSwitch.checked = preserveConnections;
let spacePan = false;
let spacePanDownPos = null; // 记录空格平移开始的鼠标位置，用于阻止误触 click
const linksEl = document.getElementById('links');
const linkControlsEl = document.getElementById('linkControls');
const knifeTrailSvg = document.getElementById('knifeTrailSvg');
const dropOverlay = document.getElementById('dropOverlay');
const createMenu = document.getElementById('createMenu');
const linkCreateMenu = document.getElementById('linkCreateMenu');
const nodeInputMenu = document.getElementById('nodeInputMenu');
const nodeOutputMenu = document.getElementById('nodeOutputMenu');
const imageNodeMenu = document.getElementById('imageNodeMenu');
const selectionBox = document.getElementById('selectionBox');
const selectionHub = document.getElementById('selectionHub');
const gateStatus = document.getElementById('gateStatus');
const gateCreateBtn = document.getElementById('gateCreateBtn');
const gateRefreshBtn = document.getElementById('gateRefreshBtn');
const gateBackBtn = document.getElementById('gateBackBtn');
const gateTrashBtn = document.getElementById('gateTrashBtn');
const gateTrashCount = document.getElementById('gateTrashCount');
const gateTitleText = document.getElementById('gateTitleText');
const gateSubtitle = document.getElementById('gateSubtitle');
const gateCanvasList = document.getElementById('gateCanvasList');
const gateTitleInput = document.getElementById('gateTitleInput');
const gateConfirmBtn = document.getElementById('gateConfirmBtn');
const gateCancelBtn = document.getElementById('gateCancelBtn');
const backToManagerBtn = document.getElementById('backToManagerBtn');
const currentCanvasTitle = document.getElementById('currentCanvasTitle');
const currentCanvasTime = document.getElementById('currentCanvasTime');
const outputLightbox = document.getElementById('outputLightbox');
const outputPreview = document.getElementById('outputPreview');
const outputLightboxImg = document.getElementById('outputLightboxImg');
const outputCompareContainer = document.getElementById('outputCompareContainer');
const outputCompareResult = document.getElementById('outputCompareResult');
const outputCompareOriginal = document.getElementById('outputCompareOriginal');
const outputCompareOriginalWrap = document.getElementById('outputCompareOriginalWrap');
const outputCompareSlider = document.getElementById('outputCompareSlider');
const outputResolution = document.getElementById('outputResolution');
const outputDownloadBtn = document.getElementById('outputDownloadBtn');
const outputLightboxVideo = document.getElementById('outputLightboxVideo');
const outputPromptText = document.getElementById('outputPromptText');
const outputPromptExpandBtn = document.getElementById('outputPromptExpandBtn');
const outputCopyPromptBtn = document.getElementById('outputCopyPromptBtn');
const outputRerunBtn = document.getElementById('outputRerunBtn');
const outputSendToCanvasBtn = document.getElementById('outputSendToCanvasBtn');
const outputI2IBtn = document.getElementById('outputI2IBtn');
const outputDeleteBtn = document.getElementById('outputDeleteBtn');
const outputRefsSection = document.getElementById('outputRefsSection');
const outputRefsList = document.getElementById('outputRefsList');
const outputParamsGrid = document.getElementById('outputParamsGrid');
const outputCopyToast = document.getElementById('outputCopyToast');
const logModal = document.getElementById('logModal');
const logList = document.getElementById('logList');
let logLayout = 'grid'; // 只保留网格视图
const errorModal = document.getElementById('errorModal');
const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');
let canvases = [];
let deletedCanvases = [];
let canvas = null;
let nodes = [];
let connections = [];
let viewport = {x: -1800, y: -1000, scale: 1};
let dragNode = null;
let dragBoard = null;
let minimapDrag = false;
let minimapState = null;
let minimapRenderQueued = false;
let resizeNode = null;
let llmPaneDrag = null;
let tempLink = null;
let knifeActive = false;
let knifePoint = null;
let knifeTrail = [];
let knifeChanged = false;
let knifeNeedsRender = false;
let knifeTrailEl = null;
let selectDrag = null;
let menuPoint = null;
let linkCreateState = null;
let internalDrag = false;
let selected = new Set();
let saveTimer = null;
let creatingCanvas = false;
let trashMode = false;
let pendingDeleteCanvasId = null;
let pendingPurgeCanvasId = null;
let emojiPickerCanvasId = null;
let localCanvasDirty = false;
let savingCanvasNow = false;
let saveCanvasAgain = false;
let applyingRemoteCanvas = false;
let remoteSyncTimer = null;
let remoteSyncInterval = null;
let remoteSyncBusy = false;
let lastCanvasUpdatedAt = 0;
let models = {gpt:'gpt-image-2', nano:'nano-banana-pro'};
let imageModels = ['gpt-image-2', 'nano-banana-pro'];
let chatModels = ['gpt-4o-mini'];
let videoModels = [];
let msChatModels = [];
let apiProviders = [];

let managedProviderId = 'comfly';
let localImageModels = [];
let localChatModels = [];
let hasManagedImageModels = false;
let hasManagedChatModels = false;
let outputCompareDrag = false;
let outputPreviewZoom = 1;
let outputPreviewPan = {x: 0, y: 0};
let outputPreviewPanDrag = null;
let currentOutputCompareUrl = '';
let currentOutputMeta = null;
let currentOutputLog = null;
let currentOutputLightboxOutId = '';
let currentOutputLightboxUrl = '';
let currentOutputFromLog = false;
const missingAssetUrls = new Set();
let outputTimer = null;
let loopContext = null;
let clipboard = {nodes:[], connections:[]};
let lastImagePasteAt = 0;
const activeCanvasTaskPolls = new Set();
let hoveredConnectionId = '';
let lastMouseBoard = {x: 0, y: 0};
let undoStack = [];
let redoStack = [];
const UNDO_MAX = 30;
const cascadeRunningIds = new Set();
const cascadeStopIds = new Set();
const cascadeSerialIds = new Set(); // 记录以串行循环模式启动的运行，用于停止按钮
let cropState = null;
let cropDrag = null;
let imageEditMode = 'crop';
let _previewPanX = 0, _previewPanY = 0;
let imageEditModeTouched = false;
let editDrawState = null;
let editDrawUndoStack = [];
let editDrawRedoStack = [];
const EDIT_DRAW_HISTORY_MAX = 40;
let brushTool = 'free';
let brushLabelCounter = 1;
let gridCustomMode = false;
let gridCustomLines = []; // [{type:'h'|'v', pos:0-1}] 相对图片尺寸的分数位置
let gridCustomOrientation = 'h'; // 当前点击放置方向
let gridCustomHistory = []; // 撤销栈：每次放线前快照
let gridCustomDrag = null; // {index, pointerId}
let imageEditZoom = 1.0;
let lastEditPointerEvent = null;
let imageEditBaseW = 0; // zoom=1 时图片显示宽度
let imageEditBaseH = 0;
let imageEditLayoutW = 0;
let imageEditLayoutH = 0;
let textSelectionGuard = null;
const PROMPT_TEXT_MAX_LENGTH = 20000;
const CLIENT_ID = 'canvas_' + Math.random().toString(36).slice(2);
const CANVAS_EMOJIS = ['layers','sparkles','image','palette','wand-2','star','heart','rocket','flame','moon','cloud','leaf','gem','compass','pin','flag','bookmark','crown'];
function renderCanvasIcon(icon, size = 14) {
    // 旧的默认 emoji 或空值都映射为 layers
    if(!icon || icon === '🧩') return `<i data-lucide="layers" style="width:${size}px;height:${size}px"></i>`;
    // 含非 ASCII 字符（用户旧选过的 emoji）继续按文本渲染
    if(/[^\x00-\x7F]/.test(icon)) return escapeHtml(icon);
    return `<i data-lucide="${escapeHtml(icon)}" style="width:${size}px;height:${size}px"></i>`;
}

const SIZE_MAP = {
    square: { '1k':'1024x1024', '2k':'2048x2048', '4k':'3840x2160' },
    portrait: { '1k':'1024x1536', '2k':'1360x2048', '4k':'2352x3520' },
    portrait43: { '1k':'1008x1344', '2k':'1536x2048', '4k':'2448x3264' },
    landscape43: { '1k':'1344x1008', '2k':'2048x1536', '4k':'3264x2448' },
    landscape: { '1k':'1536x1024', '2k':'2048x1360', '4k':'3520x2352' },
    story: { '1k':'720x1280', '2k':'1152x2048', '4k':'2160x3840' },
    wide: { '1k':'1280x720', '2k':'2048x1152', '4k':'3840x2160' }
};
const RES_LONG_SIDE = { '1k':1536, '2k':2048, '4k':3840 };
const RES_PIXEL_LIMIT = { '1k':1572864, '2k':4194304, '4k':8294400 };
const CUSTOM_IMAGE_MODELS_KEY = 'canvas_custom_image_models';
const MANAGED_IMAGE_MODELS_KEY = 'canvas_image_models_ordered';
const MANAGED_CHAT_MODELS_KEY = 'canvas_chat_models_ordered';
const CANVAS_THEME_KEY = 'canvas_theme';
const LAST_CANVAS_ID_KEY = 'canvas_last_id';
const QUICK_TOOLBAR_COLLAPSED_KEY = 'canvas_quick_toolbar_collapsed';
const DEFAULT_VIDEO_MODELS = [
    // Veo
    'veo2', 'veo2-fast', 'veo2-pro',
    'veo3', 'veo3-fast', 'veo3-pro',
    'veo3.1', 'veo3.1-fast', 'veo3.1-quality', 'veo3.1-lite',
    // Sora
    'sora-2', 'sora-2-pro',
    // 通义万相
    'wan2.6-t2v', 'wan2.6-i2v',
    'wan2.5-t2v-preview', 'wan2.5-i2v-preview',
    'wan2.2-t2v-plus', 'wan2.2-i2v-plus', 'wan2.2-i2v-flash',
    // Seedance
    'doubao-seedance-2-0-260128',
    'doubao-seedance-2-0-fast-260128',
    'doubao-seedance-1-5-pro-251215',
    'doubao-seedance-1-0-pro-250528',
    'doubao-seedance-1-0-lite-t2v-250428',
    'doubao-seedance-1-0-lite-i2v-250428'
];

function uid(prefix='n'){ return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`; }
function applyTheme(theme){
    const dark = theme === 'dark';
    document.documentElement.classList.toggle('studio-theme-dark', dark);
    document.documentElement.classList.toggle('theme-dark', dark);
    document.body.classList.toggle('studio-theme-dark', dark);
    document.body.classList.toggle('theme-dark', dark);
    shell.classList.toggle('theme-dark', dark);
}
function applyQuickToolbarState(){
    const toolbar = document.getElementById('quickToolbar');
    if(!toolbar) return;
    const collapsed = localStorage.getItem(QUICK_TOOLBAR_COLLAPSED_KEY) === '1';
    toolbar.classList.toggle('collapsed', collapsed);
    const btn = toolbar.querySelector('.toolbar-toggle');
    if(btn){
        btn.title = collapsed ? '展开快捷菜单' : '折叠快捷菜单';
        btn.setAttribute('aria-label', btn.title);
    }
    refreshIcons();
}
function toggleQuickToolbar(){
    const toolbar = document.getElementById('quickToolbar');
    const next = !toolbar?.classList.contains('collapsed');
    localStorage.setItem(QUICK_TOOLBAR_COLLAPSED_KEY, next ? '1' : '0');
    applyQuickToolbarState();
}
function loadLocalModelLists(){
    try {
        const managedRaw = localStorage.getItem(MANAGED_IMAGE_MODELS_KEY);
        const raw = JSON.parse(managedRaw || localStorage.getItem(CUSTOM_IMAGE_MODELS_KEY) || '[]');
        localImageModels = Array.isArray(raw) ? raw.filter(Boolean) : [];
        hasManagedImageModels = Boolean(managedRaw);
    } catch(e) {
        localImageModels = [];
        hasManagedImageModels = false;
    }
    try {
        const managedRaw = localStorage.getItem(MANAGED_CHAT_MODELS_KEY);
        const raw = JSON.parse(managedRaw || '[]');
        localChatModels = Array.isArray(raw) ? raw.filter(Boolean) : [];
        hasManagedChatModels = Boolean(managedRaw);
    } catch(e) {
        localChatModels = [];
        hasManagedChatModels = false;
    }
}
function uniqueModels(list){
    const seen = new Set();
    return list.map(item => String(item || '').trim()).filter(item => {
        if(!item || seen.has(item)) return false;
        seen.add(item);
        return true;
    });
}
function defaultApiProviders(){
    return [{id:'comfly', name:'Comfly', base_url:'', enabled:true, image_models:imageModels, chat_models:chatModels, video_models:videoModels.length ? videoModels : DEFAULT_VIDEO_MODELS, has_key:false, key_preview:''}];
}
function sortApiProviders(list){
    const builtin = ['comfly'];
    list.sort((a, b) => {
        const ai = builtin.indexOf(a.id);
        const bi = builtin.indexOf(b.id);
        if(ai !== -1 && bi !== -1) return ai - bi;
        if(ai !== -1) return -1;
        if(bi !== -1) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
}
function normalizeProviderId(value){
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 40);
}
function imageApiProviders(){
    const providers = (apiProviders.length ? apiProviders : defaultApiProviders())
        .filter(p => p.enabled !== false && (p.image_models || []).length);
    return providers;
}
function providerById(id){
    return (apiProviders.length ? apiProviders : defaultApiProviders()).find(p => p.id === id) || imageApiProviders()[0] || defaultApiProviders()[0];
}
function resolveProviderId(id){
    return providerById(id)?.id || 'comfly';
}
function chatApiProviders(){
    const providers = (apiProviders.length ? apiProviders : defaultApiProviders())
        .filter(p => p.enabled !== false && (p.chat_models || []).length);
    return providers.length ? providers : defaultApiProviders();
}
function resolveChatProviderId(id){
    const providers = chatApiProviders();
    return providers.find(p => p.id === id)?.id || providers[0]?.id || 'comfly';
}
function chatProviderOptions(selectedId){
    const selected = resolveChatProviderId(selectedId);
    return chatApiProviders().map(provider => `<option value="${escapeHtml(provider.id)}" ${provider.id === selected ? 'selected' : ''}>${escapeHtml(provider.name || provider.id)}</option>`).join('');
}
function providerChatModels(providerId){
    const provider = apiProviders.find(p => p.id === providerId);
    return uniqueModels(provider?.chat_models || []);
}
function resolveImageProviderId(id){
    const providers = imageApiProviders();
    return providers.find(p => p.id === id)?.id || providers[0]?.id || '';
}
function providerOptions(selectedId){
    const selected = resolveImageProviderId(selectedId);
    const providers = imageApiProviders();
    if(!providers.length) return `<option value="" disabled selected>${tr('canvas.noApiProviders') || '暂无 API 平台'}</option>`;
    return providers.map(provider => `<option value="${escapeHtml(provider.id)}" ${provider.id === selected ? 'selected' : ''}>${escapeHtml(provider.name || provider.id)}</option>`).join('');
}
function providerImageModels(providerId){
    // 不走 providerById（会 fallback 到第一个 provider，造成串台），直接查精确匹配
    const provider = apiProviders.find(p => p.id === providerId);
    return uniqueModels(provider?.image_models || []);
}
function videoApiProviders(){
    const providers = (apiProviders.length ? apiProviders : defaultApiProviders())
        .filter(p => p.enabled !== false);
    return providers.length ? providers : defaultApiProviders();
}
function resolveVideoProviderId(id){
    const providers = videoApiProviders();
    return providers.find(p => p.id === id)?.id || providers[0]?.id || 'comfly';
}
function videoProviderOptions(selectedId){
    const selected = resolveVideoProviderId(selectedId);
    return videoApiProviders().map(provider => `<option value="${escapeHtml(provider.id)}" ${provider.id === selected ? 'selected' : ''}>${escapeHtml(provider.name || provider.id)}</option>`).join('');
}
function providerVideoModels(providerId){
    // 不走 providerById（会 fallback 到第一个 provider，造成串台），直接查精确匹配
    const provider = apiProviders.find(p => p.id === providerId);
    return uniqueModels(provider?.video_models || []);
}
function videoModelOptions(selectedModel, providerId){
    const models = providerVideoModels(providerId);
    if(!models.length){
        return `<option value="" disabled selected>${tr('canvas.noModelsHint') || '暂无模型，请到 API 设置添加'}</option>`;
    }
    const selected = selectedModel || models[0];
    return uniqueModels([selected, ...models]).filter(Boolean).map(model => `<option value="${escapeHtml(model)}" ${model === selected ? 'selected' : ''}>${escapeHtml(model)}</option>`).join('');
}
function allImageModels(providerId){
    const providerModels = providerImageModels(providerId || managedProviderId);
    return uniqueModels(providerModels);
}
function currentMsModelId(modelKey, node){
    if(modelKey === 'custom') return node.msCustomModel || 'Tongyi-MAI/Z-Image-Turbo';
    if(modelKey === 'zimage') return 'Tongyi-MAI/Z-Image-Turbo';
    if(modelKey === 'qwen_edit') return 'Qwen/Qwen-Image-Edit-2511';
    if(modelKey === 'klein_edit') return 'black-forest-labs/FLUX.2-klein-9B';
    return 'Tongyi-MAI/Z-Image-Turbo';
}
function allChatModels(){
    const providerModels = chatApiProviders().flatMap(p => p.chat_models || []);
    return uniqueModels(hasManagedChatModels ? localChatModels : [...providerModels, ...chatModels, ...localChatModels]);
}
function resolveImageModel(value){
    if(value === 'gpt') return models.gpt;
    if(value === 'nano') return models.nano;
    return value || allImageModels(managedProviderId)[0] || models.gpt;
}
function normalizedImageQuality(value){
    const quality = String(value || 'auto').trim().toLowerCase();
    return ['low','medium','high'].includes(quality) ? quality : '';
}
function resolveChatModel(value, providerId=''){
    const providerModels = providerId ? providerChatModels(providerId) : [];
    return value || providerModels[0] || allChatModels()[0] || chatModels[0] || 'gpt-4o-mini';
}
function showErrorModal(message, title=tr('canvas.generationFailed')){
    if(!errorModal || !errorMessage){
        alert(message || title);
        return;
    }
    errorTitle.textContent = title || tr('canvas.generationFailed');
    errorMessage.textContent = message || title;
    errorModal.classList.add('open');
    refreshIcons();
}
function apiErrorMessage(data, fallback='请求失败'){
    if(!data) return fallback;
    if(typeof data === 'string') return data || fallback;
    const detail = data.detail ?? data.error ?? data.message;
    if(typeof detail === 'string') return detail || fallback;
    if(Array.isArray(detail)){
        const messages = detail.map(item => {
            if(typeof item === 'string') return item;
            const loc = Array.isArray(item?.loc) ? item.loc.filter(x => x !== 'body').join('.') : '';
            const msg = item?.msg || item?.message || JSON.stringify(item);
            return loc ? `${loc}: ${msg}` : msg;
        }).filter(Boolean);
        return messages.join('\n') || fallback;
    }
    if(detail && typeof detail === 'object'){
        return detail.message || detail.msg || JSON.stringify(detail);
    }
    try {
        return JSON.stringify(data);
    } catch(e) {
        return fallback;
    }
}
async function responseErrorMessage(response, fallback='请求失败'){
    try {
        const data = await response.clone().json();
        return apiErrorMessage(data, fallback);
    } catch(e) {
        try {
            const text = await response.text();
            return text || fallback;
        } catch(_) {
            return fallback;
        }
    }
}
function closeErrorModal(){
    if(errorModal) errorModal.classList.remove('open');
}
async function copyErrorMessage(){
    const text = errorMessage?.textContent || '';
    if(!text) return;
    try {
        await navigator.clipboard.writeText(text);
    } catch(e) {
        const range = document.createRange();
        range.selectNodeContents(errorMessage);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}
async function copyTextToClipboard(text){
    const value = String(text || '');
    if(!value) return false;
    try {
        if(navigator.clipboard?.writeText){
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch(_) {}
    try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch(_) {
        return false;
    }
}
function parseRatioValue(value){
    const raw = String(value || '').trim();
    if(!raw) return null;
    if(raw.includes(':')){
        const [w,h] = raw.split(':').map(Number);
        if(w > 0 && h > 0) return w / h;
    }
    const n = Number(raw);
    return n > 0 ? n : null;
}
function parseSizeValue(value){
    const match = String(value || '').trim().match(/^(\d+)\s*[xX*]\s*(\d+)$/);
    return match ? {width:match[1], height:match[2]} : null;
}
function gcdInt(a, b){
    a = Math.abs(Math.round(Number(a) || 0));
    b = Math.abs(Math.round(Number(b) || 0));
    while(b){ const t = b; b = a % b; a = t; }
    return a || 1;
}
function ratioPartsFromDimensions(width, height){
    const w = Math.max(1, Math.round(Number(width) || 1));
    const h = Math.max(1, Math.round(Number(height) || 1));
    const target = w / h;
    let best = {width:1, height:1, score:Infinity};
    const maxPart = 21;
    for(let rw = 1; rw <= maxPart; rw++){
        for(let rh = 1; rh <= maxPart; rh++){
            const ratio = rw / rh;
            const relativeError = Math.abs(ratio - target) / target;
            const complexityPenalty = Math.max(rw, rh) * 0.0008;
            const score = relativeError + complexityPenalty;
            if(score < best.score) best = {width:rw, height:rh, score};
        }
    }
    const g = gcdInt(best.width, best.height);
    return {width:best.width / g, height:best.height / g};
}
function apiImageSize(ratioValue, resolutionValue, customRatioValue = '', customSizeValue = ''){
    if(resolutionValue === 'custom') return String(customSizeValue || '').trim();
    const resolutionKey = resolutionValue || '1k';
    if(ratioValue === 'custom' || ratioValue === 'source'){
        const parsed = parseRatioValue(customRatioValue);
        const longSide = RES_LONG_SIDE[resolutionKey] || 1024;
        if(parsed){
            const pixelLimit = RES_PIXEL_LIMIT[resolutionKey] || (longSide * longSide);
            const rawWidth = parsed >= 1 ? longSide : Math.min(longSide * parsed, Math.sqrt(pixelLimit * parsed));
            const rawHeight = parsed >= 1 ? Math.min(longSide / parsed, Math.sqrt(pixelLimit / parsed)) : longSide;
            const width = Math.floor(rawWidth / 16) * 16;
            const height = Math.floor(rawHeight / 16) * 16;
            return `${Math.max(64, width)}x${Math.max(64, height)}`;
        }
    }
    const ratioKey = ratioValue && SIZE_MAP[ratioValue] ? ratioValue : 'square';
    return SIZE_MAP[ratioKey]?.[resolutionKey] || SIZE_MAP.square[resolutionKey] || SIZE_MAP.square['1k'];
}
function normalizeApiNodeSizeChoice(node){
    if(!node) return;
    if(node.resolution === '4k' && (node.ratio || 'square') === 'square'){
        node.ratio = 'wide';
    }
}
async function generatorSizeForRun(gen, refs){
    if((gen.ratio || 'square') === 'source'){
        const ref = refs?.[0];
        if(ref?.url){
            try {
                const dims = await getImageDimensions(ref.url);
                const parts = ratioPartsFromDimensions(dims.width, dims.height);
                gen.customRatioWidth = String(parts.width);
                gen.customRatioHeight = String(parts.height);
                gen.customRatio = `${parts.width}:${parts.height}`;
            } catch(_) {}
        }
    }
    const ratio = (gen.ratio === 'source' && !gen.customRatio)
        ? (gen.resolution === '4k' ? 'wide' : 'square')
        : (gen.ratio ?? 'square');
    return apiImageSize(ratio, gen.resolution || '1k', gen.customRatio || '', gen.customSize || '');
}
function normalizeApiNodeLayout(node){
    if(!node || node.type !== 'generator') return;
    if(Number(node.w || 0) === 418) node.w = 380;
}
function imageModelOptions(selectedModel, providerId){
    if(!imageApiProviders().length){
        return `<option value="" disabled selected>${tr('canvas.noApiProvidersHint') || '暂无 API 平台，请到 API 设置添加'}</option>`;
    }
    const models = allImageModels(providerId);
    if(!models.length){
        return `<option value="" disabled selected>${tr('canvas.noImageModelsHint') || '暂无生图模型，请到 API 设置添加'}</option>`;
    }
    const selectedValue = resolveImageModel(selectedModel);
    const options = models.map(model => `<option value="${escapeHtml(model)}" ${model === selectedValue ? 'selected' : ''}>${escapeHtml(model)}</option>`).join('');
    const hasSelected = models.includes(selectedValue);
    return `${hasSelected || !selectedValue ? '' : `<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)}</option>`}${options}`;
}
function chatModelOptions(selectedModel, providerId=''){
    const models = providerId ? providerChatModels(providerId) : allChatModels();
    if(!models.length){
        return `<option value="" disabled selected>${tr('canvas.noModelsHint') || '暂无模型，请到 API 设置添加'}</option>`;
    }
    const selectedValue = resolveChatModel(selectedModel, providerId);
    const options = models.map(model => `<option value="${escapeHtml(model)}" ${model === selectedValue ? 'selected' : ''}>${escapeHtml(model)}</option>`).join('');
    const hasSelected = models.includes(selectedValue);
    return `${hasSelected || !selectedValue ? '' : `<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)}</option>`}${options}`;
}
function formatCanvasTime(value){
    if(!value) return '--';
    const raw = Number(value);
    const time = raw < 10000000000 ? raw * 1000 : raw;
    const date = new Date(time);
    if(Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function setStatus(text){
    document.getElementById('saveState').textContent = text;
    if(gateStatus) gateStatus.textContent = text;
}
function refreshGateViewControls(){
    canvasGate.classList.toggle('trash-mode', trashMode);
    if(gateTitleText) gateTitleText.textContent = trashMode ? tr('canvas.trash') : tr('canvas.selectCanvas');
    if(gateSubtitle) gateSubtitle.textContent = trashMode ? tr('canvas.trashSubtitle') : tr('canvas.subtitle');
    const trashCount = deletedCanvases.length;
    if(gateTrashCount){
        gateTrashCount.textContent = String(trashCount);
        gateTrashCount.classList.toggle('visible', trashCount > 0);
    }
    const countPill = document.getElementById('gateCountPill');
    if(countPill){
        const items = trashMode ? deletedCanvases : canvases;
        const suffix = tr('canvas.countSuffix');
        countPill.textContent = suffix ? `${items.length} ${suffix}` : String(items.length);
    }
}
function setCanvasMode(open){
    shell.classList.toggle('no-canvas', !open);
    if(!open){
        nodesEl.innerHTML = '';
        linksEl.innerHTML = '';
        linkControlsEl.innerHTML = '';
        selectionHub.classList.remove('open');
    } else if(currentCanvasTitle) {
        currentCanvasTitle.textContent = canvas?.title || tr('canvas.untitled');
        currentCanvasTime.textContent = formatCanvasTime(canvas?.updated_at || canvas?.created_at);
    }
    refreshIcons();
}
function ensureCanvas(){
    if(canvas) return true;
    setStatus(tr('canvas.needCanvas'));
    return false;
}
function setCreateMode(active){
    creatingCanvas = active;
    if(active) trashMode = false;
    canvasGate.classList.toggle('creating', active);
    refreshGateViewControls();
    setStatus(active ? tr('canvas.enterCanvasName') : (canvases.length ? tr('canvas.chooseFirst') : tr('canvas.noCanvasCreateFirst')));
    if(active) {
        gateTitleInput.placeholder = tr('canvas.newCanvasPlaceholder');
        gateTitleInput.focus();
        gateTitleInput.select();
    } else {
        gateTitleInput.value = '';
        gateTitleInput.placeholder = tr('canvas.newCanvasPlaceholder');
    }
    refreshIcons();
}
function screenToWorld(clientX, clientY){
    const rect = board.getBoundingClientRect();
    return { x:(clientX - rect.left - viewport.x) / viewport.scale, y:(clientY - rect.top - viewport.y) / viewport.scale };
}
function applyViewport(){
    world.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`;
    scheduleMinimapRender();
    if(zoomPercentLabel) zoomPercentLabel.textContent = Math.round((viewport.scale || 1) * 100) + '%';
}
function estimatedNodeRect(n){
    const el = nodesEl?.querySelector?.(`.node[data-id="${CSS.escape(n.id)}"]`);
    const size = defaultNodeSize(n.type);
    const w = el?.offsetWidth || n.w || size.w || 260;
    const h = el?.offsetHeight || n.h || size.h || 160;
    return {x:n.x || 0, y:n.y || 0, w, h};
}
function currentWorldViewRect(){
    const rect = board.getBoundingClientRect();
    const scale = viewport.scale || 1;
    return {
        x:-viewport.x / scale,
        y:-viewport.y / scale,
        w:rect.width / scale,
        h:rect.height / scale
    };
}
function minimapBounds(){
    const rects = (nodes || []).map(estimatedNodeRect);
    rects.push(currentWorldViewRect());
    if(!rects.length) return {x:0, y:0, w:1000, h:700};
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rects.forEach(r => {
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w);
        maxY = Math.max(maxY, r.y + r.h);
    });
    const pad = Math.max(240, Math.max(maxX - minX, maxY - minY) * 0.08);
    return {x:minX - pad, y:minY - pad, w:Math.max(1, maxX - minX + pad * 2), h:Math.max(1, maxY - minY + pad * 2)};
}
function scheduleMinimapRender(){
    if(minimapRenderQueued) return;
    minimapRenderQueued = true;
    requestAnimationFrame(() => {
        minimapRenderQueued = false;
        renderMinimap();
    });
}
function renderMinimap(){
    if(!minimapContent || !minimapViewport) return;
    const bounds = minimapBounds();
    const cw = minimapContent.clientWidth || 172;
    const ch = minimapContent.clientHeight || 110;
    const scale = Math.min(cw / bounds.w, ch / bounds.h);
    const mapW = bounds.w * scale;
    const mapH = bounds.h * scale;
    const ox = (cw - mapW) / 2;
    const oy = (ch - mapH) / 2;
    minimapState = {bounds, scale, ox, oy, cw, ch};
    const nodeHtml = (nodes || []).map(n => {
        const r = estimatedNodeRect(n);
        return `<div class="minimap-node ${selected.has(n.id) ? 'selected' : ''}" style="left:${ox + (r.x - bounds.x) * scale}px;top:${oy + (r.y - bounds.y) * scale}px;width:${Math.max(3, r.w * scale)}px;height:${Math.max(3, r.h * scale)}px"></div>`;
    }).join('');
    minimapContent.innerHTML = `${nodeHtml}${nodes?.length ? '' : '<div class="minimap-empty">EMPTY</div>'}<div id="minimapViewport" class="minimap-viewport"></div>`;
    minimapViewport = document.getElementById('minimapViewport');
    updateMinimapViewport();
}
function updateMinimapViewport(){
    if(!minimapViewport || !minimapState) return;
    const r = currentWorldViewRect();
    const {bounds, scale, ox, oy} = minimapState;
    minimapViewport.style.left = `${ox + (r.x - bounds.x) * scale}px`;
    minimapViewport.style.top = `${oy + (r.y - bounds.y) * scale}px`;
    minimapViewport.style.width = `${Math.max(8, r.w * scale)}px`;
    minimapViewport.style.height = `${Math.max(8, r.h * scale)}px`;
}
function minimapEventToWorld(e){
    if(!minimapState) renderMinimap();
    const state = minimapState;
    const rect = minimapContent.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.ox) / state.scale + state.bounds.x;
    const y = (e.clientY - rect.top - state.oy) / state.scale + state.bounds.y;
    return {x, y};
}
function centerViewportOnWorldPoint(point){
    const rect = board.getBoundingClientRect();
    viewport.x = rect.width / 2 - point.x * viewport.scale;
    viewport.y = rect.height / 2 - point.y * viewport.scale;
    applyViewport();
    renderLinks();
    renderSelectionHub();
}
function refreshGeometry(){
    renderLinks();
    renderSelectionHub();
}
function refreshGeometryAfterLayout(){
    requestAnimationFrame(() => {
        refreshGeometry();
        requestAnimationFrame(refreshGeometry);
    });
}
function scheduleSave(){
    if(!canvas || applyingRemoteCanvas) return;
    localCanvasDirty = true;
    setStatus('Saving...');
    clearTimeout(saveTimer);
    if(savingCanvasNow){
        saveCanvasAgain = true;
        return;
    }
    saveTimer = setTimeout(saveCanvas, 500);
}
function refreshOutputTimer(){
    const hasPending = nodes.some(n => n.type === 'output' && (n._pending || []).length);
    if(hasPending && !outputTimer){
        outputTimer = setInterval(() => {
            const pendingById = new Map();
            nodes.filter(n => n.type === 'output').forEach(node => {
                (node._pending || []).forEach(p => pendingById.set(p.id, p));
            });
            if(pendingById.size){
                document.querySelectorAll('.output-time-pill.running').forEach(pill => {
                    const pendingId = pill.closest('[data-pending-id]')?.dataset.pendingId;
                    const pending = pendingById.get(pendingId);
                    if(pending) pill.textContent = formatRunDuration(nowMs() - Number(pending.startedAt || nowMs()));
                });
            } else {
                clearInterval(outputTimer);
                outputTimer = null;
            }
        }, 1000);
    } else if(!hasPending && outputTimer){
        clearInterval(outputTimer);
        outputTimer = null;
    }
}
async function saveCanvas(){
    if(!canvas || applyingRemoteCanvas) return;
    if(savingCanvasNow){
        saveCanvasAgain = true;
        return;
    }
    sanitizeConnections();
    savingCanvasNow = true;
    saveCanvasAgain = false;
    try {
        const res = await fetch(`/api/canvases/${canvas.id}`, {
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                title:canvas.title,
                icon:canvas.icon || '🧩',
                nodes,
                connections,
                viewport,
                logs:canvas.logs || [],
                client_id:CLIENT_ID,
                base_updated_at:Number(lastCanvasUpdatedAt || canvas.updated_at || 0)
            })
        });
        if(res.status === 409){
            const data = await res.json().catch(() => ({}));
            const remote = data.detail?.canvas || data.canvas;
            if(localCanvasDirty || saveCanvasAgain){
                lastCanvasUpdatedAt = Number(data.detail?.updated_at || data.updated_at || remote?.updated_at || lastCanvasUpdatedAt || 0);
                saveCanvasAgain = true;
                setStatus('Saving...');
                return;
            }
            if(remote) applyRemoteCanvasData(remote);
            setStatus('Synced');
            return;
        }
        if(!res.ok) throw new Error('save failed');
        const data = await res.json().catch(() => ({}));
        if(data.canvas) canvas = {...canvas, ...data.canvas};
        canvas.updated_at = Number(canvas.updated_at || Date.now());
        lastCanvasUpdatedAt = canvas.updated_at;
        localCanvasDirty = Boolean(saveCanvasAgain);
        if(currentCanvasTime) currentCanvasTime.textContent = formatCanvasTime(canvas.updated_at);
        setStatus('Saved');
        loadCanvasList(false);
    } catch(e) {
        setStatus('Save failed');
        console.error(e);
    } finally {
        savingCanvasNow = false;
        if(saveCanvasAgain && canvas && !applyingRemoteCanvas){
            saveCanvasAgain = false;
            localCanvasDirty = true;
            setTimeout(saveCanvas, 0);
        }
    }
}

async function loadConfig(){
    loadLocalModelLists();
    try {
        const cfg = await fetch('/api/config').then(r=>r.json());
        imageModels = cfg.image_models?.length ? cfg.image_models : imageModels;
        chatModels = cfg.chat_models?.length ? cfg.chat_models : chatModels;
        videoModels = cfg.video_models?.length ? cfg.video_models : DEFAULT_VIDEO_MODELS;
        msChatModels = cfg.ms_chat_models?.length ? cfg.ms_chat_models : msChatModels;
        apiProviders = Array.isArray(cfg.api_providers) && cfg.api_providers.length ? cfg.api_providers : defaultApiProviders();
        sortApiProviders(apiProviders);
        models.nano = imageModels.find(m => m.toLowerCase().includes('nano')) || 'nano-banana-pro';
        models.gpt = imageModels.find(m => !m.toLowerCase().includes('nano')) || cfg.image_model || 'gpt-image-2';
    } catch(e) {
        apiProviders = defaultApiProviders();
    }
}

// 监听 API 设置页面的变更广播，实时刷新画布的模型/平台下拉
try {
    const apiChannel = new BroadcastChannel('studio-api');
    apiChannel.onmessage = async (e) => {
        if(e.data?.type === 'providers-changed' || e.data?.type === 'workflows-changed'){
            await loadConfig();
            if(typeof render === 'function') render();
        }
    };
} catch(e) { /* 不支持 BroadcastChannel 的旧浏览器忽略 */ }
async function loadCanvasList(openFirst=true){
    try {
        const res = await fetch('/api/canvases');
        if(!res.ok) throw new Error(tr('canvas.canvasListFailed'));
        const data = await res.json();
        canvases = data.canvases || [];
        refreshGateViewControls();
        renderCanvasList();
        refreshTrashCount();
        if(openFirst && canvases[0]) await openCanvas(canvases[0].id);
        else if(!canvas) {
            setCanvasMode(false);
            setStatus(trashMode ? (deletedCanvases.length ? tr('canvas.trash') : tr('canvas.trashEmpty')) : (canvases.length ? tr('canvas.chooseFirst') : tr('canvas.noCanvasCreateFirst')));
        }
    } catch(e) {
        setStatus(tr('canvas.canvasListFailed'));
        console.error(e);
    }
}
async function loadTrashList(){
    try {
        const res = await fetch('/api/canvases/trash');
        if(!res.ok) throw new Error(tr('canvas.trashLoadFailed'));
        const data = await res.json();
        deletedCanvases = data.canvases || [];
        refreshGateViewControls();
        renderCanvasList();
        setStatus(deletedCanvases.length ? tr('canvas.trash') : tr('canvas.trashEmpty'));
    } catch(e) {
        setStatus(tr('canvas.trashLoadFailed'));
        console.error(e);
    }
}
async function refreshTrashCount(){
    if(trashMode) return;
    try {
        const res = await fetch('/api/canvases/trash');
        if(!res.ok) return;
        const data = await res.json();
        deletedCanvases = data.canvases || [];
        refreshGateViewControls();
    } catch(e) {}
}
async function setTrashMode(active){
    trashMode = active;
    creatingCanvas = false;
    pendingDeleteCanvasId = null;
    pendingPurgeCanvasId = null;
    emojiPickerCanvasId = null;
    canvasGate.classList.toggle('creating', false);
    refreshGateViewControls();
    if(trashMode) await loadTrashList();
    else await loadCanvasList(false);
    refreshIcons();
}
function renderCanvasList(){
    renderCanvasListInto(gateCanvasList);
}
function renderCanvasListInto(list){
    if(!list) return;
    refreshGateViewControls();
    const items = trashMode ? deletedCanvases : canvases;
    list.innerHTML = '';
    if(!items.length){
        const empty = document.createElement('div');
        empty.className = 'gate-list-empty';
        empty.innerHTML = trashMode
            ? `<div class="gate-list-empty-icon"><i data-lucide="trash-2" class="w-6 h-6"></i></div>${tr('canvas.trashEmpty')}`
            : `<div class="gate-list-empty-icon"><i data-lucide="layout-grid" class="w-6 h-6"></i></div>${tr('canvas.noCanvas')}<br>${tr('canvas.startWithNewCanvas')}`;
        list.appendChild(empty);
        refreshIcons();
        return;
    }
    items.forEach(item => {
        const row = document.createElement('div');
        row.className = `canvas-item ${canvas?.id === item.id ? 'active' : ''}`;
        row.innerHTML = `
            <div class="canvas-open" role="button" tabindex="${trashMode ? '-1' : '0'}">
                <div class="canvas-card-icon-row">
                    <span class="canvas-preview-mark" role="button" tabindex="0" title="${trashMode ? tr('canvas.deletedCanvas') : tr('canvas.changeIcon')}">${renderCanvasIcon(item.icon, 16)}</span>
                </div>
                <div class="canvas-card-title">${escapeHtml(item.title)}</div>
                <div class="canvas-card-meta">
                    <span class="canvas-card-meta-dot"></span>
                    <div class="canvas-card-time">${trashMode ? `${tr('canvas.deletedAt')} ${formatCanvasTime(item.deleted_at)}` : formatCanvasTime(item.updated_at || item.created_at)}</div>
                </div>
            </div>
            ${trashMode ? (pendingPurgeCanvasId === item.id ? `
                <div class="canvas-delete-confirm">
                    <div class="canvas-delete-box">
                        <div class="canvas-delete-title">${tr('canvas.purgeConfirm')}</div>
                        <div class="canvas-delete-actions">
                            <button class="canvas-confirm-btn" type="button">${tr('common.confirm')}</button>
                            <button class="canvas-cancel-btn" type="button">${tr('common.cancel')}</button>
                        </div>
                    </div>
                </div>
            ` : `
                <button class="canvas-delete canvas-restore" type="button" title="${tr('canvas.restoreCanvas')}" aria-label="${tr('canvas.restoreCanvas')} ${escapeHtml(item.title)}" style="right:42px">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                </button>
                <button class="canvas-delete canvas-purge" type="button" title="${tr('canvas.purgeCanvas')}" aria-label="${tr('canvas.purgeCanvas')} ${escapeHtml(item.title)}">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
            `) : (pendingDeleteCanvasId === item.id ? `
                <div class="canvas-delete-confirm">
                    <div class="canvas-delete-box">
                        <div class="canvas-delete-title">${tr('canvas.moveToTrashConfirm')}</div>
                        <div class="canvas-delete-actions">
                            <button class="canvas-confirm-btn" type="button">${tr('common.confirm')}</button>
                            <button class="canvas-cancel-btn" type="button">${tr('common.cancel')}</button>
                        </div>
                    </div>
                </div>
            ` : `
                <button class="canvas-card-edit" type="button" title="${tr('canvas.rename')}" aria-label="${tr('canvas.rename')} ${escapeHtml(item.title)}">
                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                </button>
                <button class="canvas-delete" type="button" title="${tr('canvas.moveToTrash')}" aria-label="${tr('canvas.moveToTrash')} ${escapeHtml(item.title)}">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            `)}
            ${!trashMode && emojiPickerCanvasId === item.id ? `
                <div class="emoji-picker">
                    ${CANVAS_EMOJIS.map(icon => `<button class="emoji-option" type="button" data-icon="${escapeHtml(icon)}">${renderCanvasIcon(icon, 14)}</button>`).join('')}
                </div>
            ` : ''}
        `;
        if(!trashMode) row.querySelector('.canvas-open').onclick = () => openCanvas(item.id);
        const titleEl = row.querySelector('.canvas-card-title');
        const editBtn = row.querySelector('.canvas-card-edit');
        if(editBtn && titleEl && !trashMode) {
            editBtn.onmousedown = e => e.stopPropagation();
            editBtn.onclick = e => { e.stopPropagation(); startTitleEdit(item.id, titleEl); };
        }
        const iconBtn = row.querySelector('.canvas-preview-mark');
        if(iconBtn && !trashMode) {
            iconBtn.onclick = e => toggleEmojiPicker(item.id, e);
            iconBtn.onkeydown = e => {
                if(e.key === 'Enter' || e.key === ' ') toggleEmojiPicker(item.id, e);
            };
        }
        row.querySelectorAll('.emoji-option').forEach(btn => {
            btn.onclick = e => setCanvasIcon(item.id, btn.dataset.icon, e);
        });
        const deleteBtn = row.querySelector('.canvas-delete');
        if(deleteBtn) deleteBtn.onclick = e => requestDeleteCanvas(item.id, e);
        const confirmBtn = row.querySelector('.canvas-confirm-btn');
        if(confirmBtn) confirmBtn.onclick = e => trashMode ? purgeCanvas(item.id, e) : deleteCanvas(item.id, e);
        const cancelBtn = row.querySelector('.canvas-cancel-btn');
        if(cancelBtn) cancelBtn.onclick = e => cancelDeleteCanvas(e);
        const restoreBtn = row.querySelector('.canvas-restore');
        if(restoreBtn) restoreBtn.onclick = e => restoreCanvas(item.id, e);
        const purgeBtn = row.querySelector('.canvas-purge');
        if(purgeBtn) purgeBtn.onclick = e => requestPurgeCanvas(item.id, e);
        list.appendChild(row);
    });
    refreshIcons();
}
async function createCanvas(){
    const customTitle = gateTitleInput?.value.trim();
    const title = customTitle || `${tr('canvas.newCanvas')} ${new Date().toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'})}`;
    trashMode = false;
    refreshGateViewControls();
    setStatus('Creating...');
    try {
        const res = await fetch('/api/canvases', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({title, icon:'🧩', kind:'classic'})
        });
        if(!res.ok) throw new Error(tr('canvas.createFailed'));
        const data = await res.json();
        canvas = data.canvas;
        canvas.logs = canvas.logs || [];
        nodes = canvas.nodes || [];
        connections = canvas.connections || [];
        viewport = canvas.viewport || {x:0, y:0, scale:1};
        sanitizeConnections();
        selected.clear();
        setCanvasMode(true);
        render();
        setStatus('Saved');
        setCreateMode(false);
        await loadCanvasList(false);
        renderCanvasList();
    } catch(e) {
        setStatus(tr('canvas.createFailed'));
        console.error(e);
    }
}
function toggleEmojiPicker(id, event){
    event?.preventDefault();
    event?.stopPropagation();
    pendingDeleteCanvasId = null;
    emojiPickerCanvasId = emojiPickerCanvasId === id ? null : id;
    renderCanvasList();
}
async function setCanvasIcon(id, icon, event){
    event?.preventDefault();
    event?.stopPropagation();
    const item = canvases.find(c => c.id === id);
    if(item) item.icon = icon || 'layers';
    emojiPickerCanvasId = null;
    renderCanvasList();
    try {
        let target = canvas?.id === id ? canvas : null;
        if(!target) {
            const data = await fetch(`/api/canvases/${id}`).then(r => r.json());
            target = data.canvas;
        }
        target.icon = icon || 'layers';
        const res = await fetch(`/api/canvases/${id}`, {
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                title:target.title,
                icon:target.icon,
                nodes:target.nodes || [],
                connections:target.connections || [],
                viewport:target.viewport || {x:0, y:0, scale:1}
            })
        });
        if(!res.ok) throw new Error('图标保存失败');
        if(canvas?.id === id) canvas.icon = target.icon;
        await loadCanvasList(false);
    } catch(e) {
        setStatus('图标保存失败');
        console.error(e);
    }
}
function startTitleEdit(id, titleEl){
    if(!titleEl || titleEl.querySelector('input')) return;
    const item = canvases.find(c => c.id === id);
    const current = item?.title || titleEl.textContent || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 80;
    input.value = current;
    input.className = 'canvas-card-title-input';
    titleEl.innerHTML = '';
    titleEl.appendChild(input);
    input.onmousedown = e => e.stopPropagation();
    input.onclick = e => e.stopPropagation();
    input.focus();
    input.select();
    let done = false;
    const finish = async (commit) => {
        if(done) return;
        done = true;
        const newTitle = input.value.trim();
        if(commit && newTitle && newTitle !== current){
            await setCanvasTitle(id, newTitle);
        } else {
            renderCanvasList();
        }
    };
    input.onblur = () => finish(true);
    input.onkeydown = e => {
        e.stopPropagation();
        if(e.key === 'Enter'){ e.preventDefault(); finish(true); }
        if(e.key === 'Escape'){ e.preventDefault(); finish(false); }
    };
}
async function setCanvasTitle(id, title){
    const item = canvases.find(c => c.id === id);
    if(item) item.title = title;
    if(canvas?.id === id) canvas.title = title;
    renderCanvasList();
    try {
        let target = canvas?.id === id ? canvas : null;
        if(!target){
            const data = await fetch(`/api/canvases/${id}`).then(r => r.json());
            target = data.canvas;
        }
        target.title = title;
        const res = await fetch(`/api/canvases/${id}`, {
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                title:target.title,
                icon:target.icon,
                nodes:target.nodes || [],
                connections:target.connections || [],
                viewport:target.viewport || {x:0, y:0, scale:1}
            })
        });
        if(!res.ok) throw new Error('重命名失败');
        if(currentCanvasTitle && canvas?.id === id) currentCanvasTitle.textContent = title;
        await loadCanvasList(false);
    } catch(e){
        setStatus('重命名失败');
        console.error(e);
    }
}
async function openCanvas(id){
    setStatus('Opening...');
    try {
        const res = await fetch(`/api/canvases/${id}`);
        if(!res.ok) throw new Error(tr('canvas.openFailed'));
        const data = await res.json();
        canvas = data.canvas;
        canvas.logs = canvas.logs || [];
        nodes = canvas.nodes || [];
        connections = canvas.connections || [];
        viewport = canvas.viewport || {x:0, y:0, scale:1};
        lastCanvasUpdatedAt = Number(canvas.updated_at || 0);
        localCanvasDirty = false;
        nodes.forEach(n => { if(n.running) n.running = false; });
        sanitizeConnections();
        await refreshMissingCanvasAssets();
        selected.clear();
        setCanvasMode(true);
        renderCanvasList();
        render();
        resumeCanvasImageTasks();
        startCanvasRemotePolling();
        localStorage.setItem(LAST_CANVAS_ID_KEY, id);
        setStatus('Ready');
    } catch(e) {
        setStatus(tr('canvas.openFailed'));
        console.error(e);
    }
}
function applyRemoteCanvasData(remote){
    if(!remote || !canvas || remote.id !== canvas.id) return;
    applyingRemoteCanvas = true;
    try {
        canvas = remote;
        canvas.logs = canvas.logs || [];
        nodes = canvas.nodes || [];
        connections = canvas.connections || [];
        viewport = canvas.viewport || {x:0, y:0, scale:1};
        lastCanvasUpdatedAt = Number(canvas.updated_at || Date.now());
        localCanvasDirty = false;
        nodes.forEach(n => { if(n.running) n.running = false; });
        sanitizeConnections();
        refreshMissingCanvasAssets().then(() => render());
        selected.clear();
        renderCanvasList();
        render();
        resumeCanvasImageTasks();
        if(currentCanvasTitle) currentCanvasTitle.textContent = canvas.title || tr('canvas.untitled');
        if(currentCanvasTime) currentCanvasTime.textContent = formatCanvasTime(canvas.updated_at || canvas.created_at);
        setStatus('Synced');
    } finally {
        applyingRemoteCanvas = false;
    }
}
function canvasLocalAssetUrls(){
    const urls = new Set();
    const add = value => {
        const url = outputUrlValue(value);
        if(url && (url.startsWith('/output/') || url.startsWith('/assets/'))) urls.add(url);
    };
    nodes.forEach(node => {
        if(node.url) add(node.url);
        (node.images || []).forEach(add);
        (node.generatedOutputs || []).forEach(add);
        Object.entries(node.imageComparisons || {}).forEach(([key, value]) => {
            add(key);
            add(value);
        });
    });
    (canvas?.logs || []).forEach(log => {
        (log.outputs || []).forEach(add);
        (log.refs || []).forEach(add);
        (log.run?.refs || []).forEach(add);
    });
    return [...urls];
}
async function refreshMissingCanvasAssets(){
    missingAssetUrls.clear();
    const urls = canvasLocalAssetUrls();
    if(!urls.length) return;
    try {
        const data = await fetch('/api/canvas-assets/check', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({urls})
        }).then(r => r.json());
        const exists = data.exists || {};
        Object.entries(exists).forEach(([url, ok]) => { if(!ok) missingAssetUrls.add(url); });
    } catch(e) {
        console.warn('canvas asset check failed', e);
    }
}
async function syncRemoteCanvasNow(){
    if(!canvas) return;
    try {
        const res = await fetch(`/api/canvases/${canvas.id}`);
        if(!res.ok) throw new Error(tr('canvas.openFailed'));
        const data = await res.json();
        const remote = data.canvas;
        if(Number(remote?.updated_at || 0) >= Number(lastCanvasUpdatedAt || 0)){
            applyRemoteCanvasData(remote);
        }
    } catch(e) {
        console.error(e);
        setStatus('Sync failed');
    }
}
async function checkRemoteCanvasVersion(){
    if(!canvas || applyingRemoteCanvas || remoteSyncBusy) return;
    if(document.hidden) return;
    remoteSyncBusy = true;
    try {
        const res = await fetch(`/api/canvases/${canvas.id}/meta`);
        if(!res.ok) throw new Error('meta failed');
        const meta = await res.json();
        const remoteUpdatedAt = Number(meta.updated_at || 0);
        if(remoteUpdatedAt > Number(lastCanvasUpdatedAt || 0)){
            await syncRemoteCanvasNow();
        }
    } catch(e) {
        // 轮询失败不打扰创作；下一轮会重试。
    } finally {
        remoteSyncBusy = false;
    }
}
function startCanvasRemotePolling(){
    stopCanvasRemotePolling();
    remoteSyncInterval = setInterval(checkRemoteCanvasVersion, 2500);
}
function stopCanvasRemotePolling(){
    if(remoteSyncInterval){
        clearInterval(remoteSyncInterval);
        remoteSyncInterval = null;
    }
}
function handleCanvasUpdatedMessage(data){
    if(!canvas || !data || data.type !== 'canvas_updated') return;
    if(data.client_id && data.client_id === CLIENT_ID) return;
    if(data.canvas_id !== canvas.id) return;
    const remoteUpdatedAt = Number(data.updated_at || 0);
    if(remoteUpdatedAt && remoteUpdatedAt <= Number(lastCanvasUpdatedAt || 0)) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    localCanvasDirty = false;
    clearTimeout(remoteSyncTimer);
    remoteSyncTimer = setTimeout(syncRemoteCanvasNow, savingCanvasNow ? 700 : 120);
    setStatus('Syncing...');
}
async function returnToCanvasManager(){
    clearTimeout(saveTimer);
    if(canvas && localCanvasDirty) await saveCanvas();
    stopCanvasRemotePolling();
    canvas = null;
    nodes = [];
    connections = [];
    selected.clear();
    viewport = {x: -1800, y: -1000, scale: 1};
    setCanvasMode(false);
    trashMode = false;
    pendingPurgeCanvasId = null;
    refreshGateViewControls();
    await loadCanvasList(false);
    setCreateMode(false);
}
function requestDeleteCanvas(id, event){
    event?.preventDefault();
    event?.stopPropagation();
    emojiPickerCanvasId = null;
    pendingPurgeCanvasId = null;
    pendingDeleteCanvasId = id;
    renderCanvasList();
}
function requestPurgeCanvas(id, event){
    event?.preventDefault();
    event?.stopPropagation();
    emojiPickerCanvasId = null;
    pendingDeleteCanvasId = null;
    pendingPurgeCanvasId = id;
    renderCanvasList();
}
function cancelDeleteCanvas(event){
    event?.preventDefault();
    event?.stopPropagation();
    pendingDeleteCanvasId = null;
    pendingPurgeCanvasId = null;
    renderCanvasList();
}
async function deleteCanvas(id, event){
    event?.preventDefault();
    event?.stopPropagation();
    setStatus('Moving to trash...');
    try {
        const res = await fetch(`/api/canvases/${id}`, {method:'DELETE'});
        if(!res.ok) throw new Error(tr('canvas.moveToTrashFailed'));
        const deletingCurrent = canvas?.id === id;
        pendingDeleteCanvasId = null;
        canvases = canvases.filter(item => item.id !== id);
        if(deletingCurrent){
            canvas = null;
            nodes = [];
            connections = [];
            selected.clear();
            viewport = {x: -1800, y: -1000, scale: 1};
            setCanvasMode(false);
        }
        renderCanvasList();
        setStatus(canvases.length ? tr('canvas.movedToTrash') : tr('canvas.noCanvasCreateFirst'));
        await loadCanvasList(false);
    } catch(e) {
        setStatus(tr('canvas.moveToTrashFailed'));
        console.error(e);
    }
}
async function restoreCanvas(id, event){
    event?.preventDefault();
    event?.stopPropagation();
    setStatus('Restoring...');
    try {
        const res = await fetch(`/api/canvases/${id}/restore`, {method:'POST'});
        if(!res.ok) throw new Error(tr('canvas.restoreFailed'));
        pendingPurgeCanvasId = null;
        deletedCanvases = deletedCanvases.filter(item => item.id !== id);
        await loadCanvasList(false);
        await loadTrashList();
        setStatus(tr('canvas.restored'));
    } catch(e) {
        setStatus(tr('canvas.restoreFailed'));
        console.error(e);
    }
}
async function purgeCanvas(id, event){
    event?.preventDefault();
    event?.stopPropagation();
    setStatus('Deleting...');
    try {
        const res = await fetch(`/api/canvases/${id}/purge`, {method:'DELETE'});
        if(!res.ok) throw new Error(tr('canvas.purgeFailed'));
        pendingPurgeCanvasId = null;
        deletedCanvases = deletedCanvases.filter(item => item.id !== id);
        renderCanvasList();
        setStatus(deletedCanvases.length ? tr('canvas.purged') : tr('canvas.trashEmpty'));
        await loadTrashList();
    } catch(e) {
        setStatus(tr('canvas.purgeFailed'));
        console.error(e);
    }
}
window.createCanvas = createCanvas;
window.loadCanvasList = loadCanvasList;
window.openCanvas = openCanvas;
window.deleteCanvas = deleteCanvas;
window.returnToCanvasManager = returnToCanvasManager;
gateCreateBtn.addEventListener('click', () => setCreateMode(true));
gateBackBtn.addEventListener('click', () => setTrashMode(false));
gateTrashBtn.addEventListener('click', () => setTrashMode(true));
gateRefreshBtn.addEventListener('click', () => trashMode ? loadTrashList() : loadCanvasList(false));
gateConfirmBtn.addEventListener('click', createCanvas);
gateCancelBtn.addEventListener('click', () => setCreateMode(false));
gateTitleInput.addEventListener('keydown', e => {
    if(e.key === 'Enter') createCanvas();
    if(e.key === 'Escape') setCreateMode(false);
});
document.addEventListener('mousedown', e => {
    if(emojiPickerCanvasId === null) return;
    if(e.target.closest('.emoji-picker') || e.target.closest('.canvas-preview-mark')) return;
    emojiPickerCanvasId = null;
    renderCanvasList();
});
window.addEventListener('studio-theme-change', event => applyTheme(event.detail?.theme || 'light'));
document.getElementById('cropBox').addEventListener('mousedown', event => beginCropDrag(event, 'move'));
document.getElementById('cropHandle').addEventListener('mousedown', event => beginCropDrag(event, 'resize'));
document.querySelectorAll('[data-image-edit-mode]').forEach(btn => {
    btn.addEventListener('click', event => {
        event.stopPropagation();
        setImageEditMode(btn.dataset.imageEditMode || 'crop', true);
    });
});
document.getElementById('editDrawCanvas').addEventListener('pointerdown', beginEditDraw);
document.getElementById('editDrawCanvas').addEventListener('pointermove', moveEditDraw);
document.getElementById('editDrawCanvas').addEventListener('pointermove', _updateBrushCursor);
document.getElementById('editDrawCanvas').addEventListener('pointerenter', _updateBrushCursor);
document.getElementById('editDrawCanvas').addEventListener('pointerleave', _hideBrushCursor);
document.getElementById('editDrawCanvas').addEventListener('pointerup', endEditDraw);
document.getElementById('editDrawCanvas').addEventListener('pointercancel', endEditDraw);
document.getElementById('editDrawCanvas').addEventListener('pointerleave', endEditDraw);
['gridHorizontalLines','gridVerticalLines','gridGapSize'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        syncGridGapValue();
        refreshGridSplitPreview();
    });
});
// 图片编辑区滚轮缩放
document.getElementById('imageEditStage').addEventListener('wheel', event => {
    if(!cropState) return;
    event.preventDefault();
    event.stopPropagation();
    lastEditPointerEvent = {clientX: event.clientX, clientY: event.clientY};
    const stage = event.currentTarget;
    const oldZoom = imageEditZoom;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    imageEditZoom = Math.max(0.15, Math.min(6.0, imageEditZoom * factor));
    // 焦点缩放：保持鼠标指向的图片位置不动
    const stageRect = stage.getBoundingClientRect();
    const mx = event.clientX - stageRect.left; // 鼠标在 stage 内偏移
    const my = event.clientY - stageRect.top;
    const contentX = stage.scrollLeft + mx;
    const contentY = stage.scrollTop + my;
    applyImageEditZoom();
    const scale = imageEditZoom / oldZoom;
    stage.scrollLeft = contentX * scale - mx;
    stage.scrollTop = contentY * scale - my;
    syncImageEditLayout();
    requestAnimationFrame(syncImageEditLayout);
}, {passive: false});

// 预览模式：应用平移变换
function _applyPreviewPan(){
    const inner = document.querySelector('#imageEditStage > .image-edit-stage-inner');
    if(inner) inner.style.transform = 'translate(' + _previewPanX + 'px,' + _previewPanY + 'px)';
}
// 预览模式：鼠标左键拖拽平移；所有模式：鼠标中键拖拽平移
let _previewPanDrag = null;
document.getElementById('imageEditStage').addEventListener('mousedown', e => {
    if(!cropState) return;
    const isMiddle = e.button === 1;
    const isPreviewLeft = imageEditMode === 'preview' && e.button === 0;
    if(!isMiddle && !isPreviewLeft) return;
    e.preventDefault();
    _previewPanDrag = { startX: e.clientX, startY: e.clientY, origX: _previewPanX, origY: _previewPanY };
    e.currentTarget.querySelector('.crop-canvas')?.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
    if(!_previewPanDrag) return;
    e.preventDefault();
    _previewPanX = _previewPanDrag.origX + (e.clientX - _previewPanDrag.startX);
    _previewPanY = _previewPanDrag.origY + (e.clientY - _previewPanDrag.startY);
    _applyPreviewPan();
});
window.addEventListener('mouseup', () => {
    if(_previewPanDrag){
        document.querySelector('#imageEditStage .crop-canvas')?.classList.remove('dragging');
        _previewPanDrag = null;
    }
});
// 预览模式：双击重置缩放
document.getElementById('imageEditStage').addEventListener('dblclick', e => {
    if(imageEditMode !== 'preview' || !cropState) return;
    resetImageEditZoom();
});

window.addEventListener('resize', () => {
    if(cropState) syncImageEditOverflow();
});
backToManagerBtn.addEventListener('click', returnToCanvasManager);

function addNode(node){
    if(!ensureCanvas()) return;
    nodes.push(node);
    render();
    scheduleSave();
    return node;
}
function defaultPoint(dx=0, dy=0){ return screenToWorld(window.innerWidth / 2 + dx, window.innerHeight / 2 + dy); }
function findEmptyPoint(w, h, margin=80){
    if(!nodes || !nodes.length){
        const rect = board.getBoundingClientRect();
        const center = screenToWorld(rect.width / 2, rect.height / 2);
        return {x: center.x - (w||0)/2, y: center.y - (h||0)/2};
    }
    const m = margin || 80;
    const rightMost = Math.max(...nodes.map(n => n.x + (n.w || defaultNodeSize(n.type).w || 200)));
    const topMost = Math.min(...nodes.map(n => n.y));
    return {x: rightMost + m, y: topMost};
}
function focusOnPoint(x, y, w, h){
    if(!board) return;
    const rect = board.getBoundingClientRect();
    const scale = viewport.scale || 1;
    viewport.x = rect.width / 2 - (x + (w||0) / 2) * scale;
    viewport.y = rect.height / 2 - (y + (h||0) / 2) * scale;
    applyTransform();
    scheduleSave();
}
function addImageNode(point){
    const p = point || defaultPoint(-120, 0);
    return addNode({id:uid('img'), type:'image', x:p.x, y:p.y, url:'', name:'空白图片'});
}
function addPromptNode(point){
    const p = point || defaultPoint(0, 0);
    return addNode({id:uid('prompt'), type:'prompt', x:p.x, y:p.y, text:''});
}
function addLoopNode(point){
    const p = point || defaultPoint(40, 0);
    return addNode({
        id:uid('loop'),
        type:'loop',
        x:p.x,
        y:p.y,
        count:3,
        mode:'serial',
        showPrompt:false,
        variablePrompt:'',
        fixedPrompt:''
    });
}
function addGroupNode(point){
    const p = point || defaultPoint(40, 0);
    return addNode({id:uid('grp'), type:'group', x:p.x, y:p.y, w:300, h:220, items:[]});
}
function addLLMNode(point){
    const p = point || defaultPoint(80, 0);
    const providerId = chatApiProviders()[0]?.id || 'comfly';
    return addNode({
        id:uid('llm'),
        type:'llm',
        x:p.x,
        y:p.y,
        llmProvider:providerId,
        model:resolveChatModel('', providerId),
        mode:'node',
        systemPrompt:'You are a helpful assistant. Rewrite the input into a concise image prompt.',
        chatInput:'',
        messages:[],
        outputText:'',
        llmInputHeight:110,
        llmOutputHeight:150,
        running:false
    });
}
function addGeneratorNode(point){
    const p = point || defaultPoint(120, 0);
    const providerId = imageApiProviders()[0]?.id || '';
    return addNode({id:uid('gen'), type:'generator', x:p.x, y:p.y, apiProvider:providerId, model:allImageModels(providerId)[0] || '', ratio:'square', resolution:'1k', customRatio:'', customSize:'', customRatioWidth:'', customRatioHeight:'', customWidth:'', customHeight:'', inputs:[]});
}
function addVideoNode(point){
    const p = point || defaultPoint(160, 0);
    const providerId = videoApiProviders()[0]?.id || 'comfly';
    return addNode({
        id:uid('vid'),
        type:'video',
        x:p.x,
        y:p.y,
        apiProvider:providerId,
        model:videoModels[0] || DEFAULT_VIDEO_MODELS[0],
        duration:5,
        aspectRatio:'16:9',
        resolution:'',
        enhancePrompt:false,
        enableUpsample:false,
        watermark:false,
        cameraFixed:false,
        generateAudio:false,
        useFrameRoles:false,
        inputs:[],
        running:false
    });
}
async function getImageDimensions(url){
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({width: img.naturalWidth, height: img.naturalHeight});
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = url;
    });
}
async function urlToBase64(url){
    const res = await fetch(url);
    if(!res.ok) throw new Error('图片读取失败');
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
function addOutputNode(point){
    const p = point || defaultPoint(260, 0);
    return addNode({id:uid('out'), type:'output', x:p.x, y:p.y, images:[]});
}
function openCreateMenu(clientX, clientY){
    menuPoint = screenToWorld(clientX, clientY);
    closeLinkCreateMenu();
    createMenu.style.left = `${clientX}px`;
    createMenu.style.top = `${clientY}px`;
    createMenu.classList.add('open');
    refreshIcons();
}
function closeCreateMenu(){
    createMenu.classList.remove('open');
    closeLinkCreateMenu();
    closeImageNodeMenu();
}
function linkCreateOptions(state){
    const node = nodes.find(n => n.id === state?.originId);
    if(!node) return [];
    if(state.originKind === 'out'){
        if(['image','prompt','loop','group','promptGroup','llm'].includes(node.type)){
            return [
                {type:'generator', label:tr('canvas.apiGenerate'), icon:'wand-sparkles'},
                {type:'video', label:tr('canvas.videoGenerateNode'), icon:'clapperboard'},
                {type:'llm', label:'LLM', icon:'message-square-text'}
            ];
        }
        return [];
    }
    if(CANVAS_GENERATOR_TYPES.includes(node.type) || node.type === 'llm'){
        return [
            {type:'image', label:tr('canvas.imageCard'), icon:'image-plus'},
            {type:'prompt', label:tr('canvas.prompt'), icon:'text-cursor-input'},
            {type:'loop', label:tr('canvas.loopNode'), icon:'repeat-2'},
            {type:'group', label:tr('canvas.group'), icon:'group'},
            {type:'llm', label:'LLM', icon:'message-square-text'}
        ];
    }
    return [];
}
function openLinkCreateMenu(originId, originKind, clientX, clientY){
    const state = {originId, originKind, point:screenToWorld(clientX, clientY)};
    const options = linkCreateOptions(state);
    if(!options.length) return false;
    linkCreateState = state;
    createMenu.classList.remove('open');
    linkCreateMenu.innerHTML = options.map(opt => `<button class="menu-btn" data-link-create="${escapeAttr(opt.type)}"><i data-lucide="${escapeAttr(opt.icon)}" class="w-4 h-4"></i><span>${escapeHtml(opt.label)}</span></button>`).join('');
    linkCreateMenu.style.left = `${clientX}px`;
    linkCreateMenu.style.top = `${clientY}px`;
    linkCreateMenu.classList.add('open');
    linkCreateMenu.querySelectorAll('[data-link-create]').forEach(btn => {
        btn.onclick = e => {
            e.stopPropagation();
            createLinkedNode(btn.dataset.linkCreate);
        };
    });
    refreshIcons();
    return true;
}
function openGeneratorNodeMenu(nodeId, clientX, clientY){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || !CANVAS_GENERATOR_TYPES.includes(node.type)) return false;
    const el = nodesEl.querySelector(`.node[data-id="${CSS.escape(nodeId)}"]`);
    const rect = el?.getBoundingClientRect();
    const point = screenToWorld(clientX, clientY);
    const inputOptions = linkCreateOptions({originId:nodeId, originKind:'in', point});
    const outputOptions = [
        {type:'output', label:'Output', icon:'circle-dot'},
        ...(CANVAS_IMAGE_OUTPUT_TYPES.includes(node.type) ? [
            {type:'generator', label:tr('canvas.apiGenerate'), icon:'wand-sparkles'},
            {type:'video', label:tr('canvas.videoGenerateNode'), icon:'clapperboard'}
        ] : [])
    ];
    const buttonsHtml = (options, kind) => `<div class="node-port-menu-grid">${options.map(opt => `<button class="menu-btn" data-link-create="${escapeAttr(opt.type)}" data-link-kind="${kind}" title="${escapeAttr(opt.label)}"><i data-lucide="${escapeAttr(opt.icon)}"></i><span>${escapeHtml(opt.label.replace('生成', ''))}</span></button>`).join('')}</div>`;
    linkCreateState = {originId:nodeId, originKind:'in', point};
    createMenu.classList.remove('open');
    linkCreateMenu.classList.remove('open');
    nodeInputMenu.classList.add('node-port-menu');
    nodeOutputMenu.classList.add('node-port-menu');
    nodeInputMenu.innerHTML = `<div class="menu-section-title">添加输入</div>${buttonsHtml(inputOptions, 'in')}`;
    nodeOutputMenu.innerHTML = `<div class="menu-section-title">添加输出</div>${buttonsHtml(outputOptions, 'out')}`;
    const inputLeft = Math.max(10, (rect?.left || clientX) - 158);
    const outputLeft = Math.min(window.innerWidth - 158, (rect?.right || clientX) + 10);
    const menuTop = Math.max(10, Math.min(window.innerHeight - 260, (rect?.top || clientY) + 36));
    nodeInputMenu.style.left = `${inputLeft}px`;
    nodeInputMenu.style.top = `${menuTop}px`;
    nodeOutputMenu.style.left = `${outputLeft}px`;
    nodeOutputMenu.style.top = `${menuTop}px`;
    nodeInputMenu.classList.add('open');
    nodeOutputMenu.classList.add('open');
    [nodeInputMenu, nodeOutputMenu].forEach(menu => menu.querySelectorAll('[data-link-create]').forEach(btn => {
        btn.onclick = e => {
            e.stopPropagation();
            linkCreateState = {originId:nodeId, originKind:btn.dataset.linkKind || 'in', point};
            createLinkedNode(btn.dataset.linkCreate);
        };
    }));
    refreshIcons();
    return true;
}
function closeLinkCreateMenu(){
    linkCreateMenu.classList.remove('open');
    linkCreateMenu.innerHTML = '';
    nodeInputMenu.classList.remove('open');
    nodeOutputMenu.classList.remove('open');
    nodeInputMenu.classList.remove('node-port-menu');
    nodeOutputMenu.classList.remove('node-port-menu');
    nodeInputMenu.innerHTML = '';
    nodeOutputMenu.innerHTML = '';
    linkCreateState = null;
}
function openImageNodeMenu(nodeId, clientX, clientY){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || node.type !== 'image') return;
    closeCreateMenu();
    imageNodeMenu.innerHTML = `<button class="menu-btn" data-image-replace="${escapeAttr(nodeId)}"><i data-lucide="image-plus" class="w-4 h-4"></i><span>替换</span></button><button class="menu-btn" data-image-i2i="${escapeAttr(nodeId)}"><i data-lucide="sparkles" class="w-4 h-4"></i><span>图生图</span></button>`;
    imageNodeMenu.style.left = `${clientX}px`;
    imageNodeMenu.style.top = `${clientY}px`;
    imageNodeMenu.classList.add('open');
    imageNodeMenu.querySelector('[data-image-replace]').onclick = e => {
        e.stopPropagation();
        closeImageNodeMenu();
        pickImageForNode(nodeId);
    };
    imageNodeMenu.querySelector('[data-image-i2i]').onclick = e => {
        e.stopPropagation();
        closeImageNodeMenu();
        spawnImageNodeI2IChain(nodeId);
    };
    refreshIcons();
}
function openOutputNodeMenu(nodeId, clientX, clientY){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || node.type !== 'output') return;
    closeCreateMenu();
    const imageCount = (node.images || []).map(outputUrlValue).filter(url => url && !isVideoUrl(url)).length;
    const downloadableCount = outputDownloadableImageUrls(node).length;
    imageNodeMenu.classList.add('output-node-menu');
    imageNodeMenu.innerHTML = `
        <div class="menu-section-title">${tr('canvas.outputGroupActions')}</div>
        <button class="menu-btn" data-output-convert="${escapeAttr(nodeId)}" ${imageCount ? '' : 'disabled'}><i data-lucide="replace" class="w-4 h-4"></i><span>${tr('canvas.outputConvertToInputGroup')}</span></button>
        <button class="menu-btn" data-output-copy="${escapeAttr(nodeId)}" ${imageCount ? '' : 'disabled'}><i data-lucide="copy-plus" class="w-4 h-4"></i><span>${tr('canvas.outputCopyToInputGroup')}</span></button>
        <div class="menu-divider"></div>
        <div class="menu-section-title">${tr('canvas.outputFileActions')}</div>
        <button class="menu-btn" data-output-download="${escapeAttr(nodeId)}" ${downloadableCount ? '' : 'disabled'}><i data-lucide="download" class="w-4 h-4"></i><span>${tr('canvas.outputDownloadAllImages')}</span></button>
    `;
    const menuWidth = 260;
    imageNodeMenu.style.left = `${Math.max(10, Math.min(window.innerWidth - menuWidth - 10, clientX))}px`;
    imageNodeMenu.style.top = `${clientY}px`;
    imageNodeMenu.classList.add('open');
    const convertBtn = imageNodeMenu.querySelector('[data-output-convert]');
    if(convertBtn){
        convertBtn.onclick = e => {
            e.stopPropagation();
            convertOutputNodeToInputGroup(nodeId);
            closeImageNodeMenu();
        };
    }
    imageNodeMenu.querySelector('[data-output-copy]').onclick = e => {
        e.stopPropagation();
        copyOutputNodeToInputGroup(nodeId);
        closeImageNodeMenu();
    };
    const downloadBtn = imageNodeMenu.querySelector('[data-output-download]');
    if(downloadBtn){
        downloadBtn.onclick = e => {
            e.stopPropagation();
            downloadOutputNodeImages(nodeId);
            closeImageNodeMenu();
        };
    }
    refreshIcons();
}
function closeImageNodeMenu(){
    imageNodeMenu.classList.remove('open');
    imageNodeMenu.classList.remove('output-node-menu');
    imageNodeMenu.innerHTML = '';
}
function outputImageUrls(node){
    return (node?.images || []).map(outputUrlValue).filter(url => url && !isVideoUrl(url));
}
function outputDownloadableImageUrls(node){
    return outputImageUrls(node).filter(url => !isMissingAssetUrl(url) && (url.startsWith('/output/') || url.startsWith('/assets/')));
}
function createInputGroupFromOutput(node, point){
    const urls = outputImageUrls(node);
    if(!node || !urls.length) return null;
    const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(urls.length))));
    const cardW = 260;
    const cardH = 336;
    const gap = 24;
    const base = point || {x:Number(node.x || 0), y:Number(node.y || 0)};
    const imageNodes = urls.map((url, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const img = {
            id:uid('img'),
            type:'image',
            x:base.x + 24 + col * (cardW + gap),
            y:base.y + 58 + row * (cardH + gap),
            w:cardW,
            h:cardH,
            url,
            name:outputImageName(url)
        };
        nodes.push(img);
        return img;
    });
    const rows = Math.ceil(urls.length / cols);
    const group = {
        id:uid('grp'),
        type:'group',
        x:base.x,
        y:base.y,
        w:cols * cardW + (cols - 1) * gap + 48,
        h:rows * cardH + (rows - 1) * gap + 90,
        items:imageNodes.map(img => img.id)
    };
    nodes.push(group);
    return group;
}
function convertOutputNodeToInputGroup(nodeId){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || node.type !== 'output') return;
    if(!outputImageUrls(node).length) return;
    pushUndo();
    const downstream = connections.filter(c => c.from === nodeId).map(c => c.to);
    const group = createInputGroupFromOutput(node, {x:Number(node.x || 0), y:Number(node.y || 0)});
    if(!group) return;
    nodes = nodes.filter(n => n.id !== nodeId);
    connections = connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    downstream.forEach(toId => {
        if(canConnect(group.id, toId) && !connections.some(c => c.from === group.id && c.to === toId)){
            connections.push({id:uid('c'), from:group.id, to:toId});
        }
    });
    selected.clear();
    selected.add(group.id);
    syncGeneratorInputs();
    refreshGeneratorInputViews();
    render();
    scheduleSave();
}
function copyOutputNodeToInputGroup(nodeId){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || node.type !== 'output') return;
    if(!outputImageUrls(node).length) return;
    pushUndo();
    const group = createInputGroupFromOutput(node, {x:Number(node.x || 0) + 36, y:Number(node.y || 0) + 36});
    if(!group) return;
    selected.clear();
    selected.add(group.id);
    syncGeneratorInputs();
    refreshGeneratorInputViews();
    render();
    scheduleSave();
}
async function downloadOutputNodeImages(nodeId){
    const node = nodes.find(n => n.id === nodeId);
    const urls = outputDownloadableImageUrls(node);
    if(!node || !urls.length){
        alert(tr('canvas.outputDownloadEmpty'));
        return;
    }
    try {
        const res = await fetch('/api/canvas-assets/download', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                urls,
                filename:`${(canvas?.title || 'canvas-output').slice(0, 48)}-${node.id}.zip`
            })
        });
        if(!res.ok) throw new Error(await responseErrorMessage(res, tr('canvas.outputDownloadEmpty')));
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${(canvas?.title || 'canvas-output').slice(0, 48)}-${node.id}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch(err) {
        alert(err.message || tr('canvas.outputDownloadEmpty'));
    }
}
function createLinkedNode(type){
    const state = linkCreateState;
    closeLinkCreateMenu();
    if(!state) return;
    const origin = nodes.find(n => n.id === state.originId);
    if(!origin) return;
    pushUndo();
    const created = createNodeByType(type, state.point);
    if(!created) return;
    const fromId = state.originKind === 'out' ? origin.id : created.id;
    const toId = state.originKind === 'out' ? created.id : origin.id;
    if(canConnect(fromId, toId) && !connections.some(c => c.from === fromId && c.to === toId)){
        connections.push({id:uid('c'), from:fromId, to:toId});
        syncGeneratorInputs();
        scheduleSave();
        render();
    }
}
function createNodeByType(type, point){
    if(type === 'image') return addImageNode(point);
    if(type === 'prompt') return addPromptNode(point);
    if(type === 'loop') return addLoopNode(point);
    if(type === 'group') return addGroupNode(point);
    if(type === 'llm') return addLLMNode(point);
    if(type === 'generator') return addGeneratorNode(point);
    if(type === 'video') return addVideoNode(point);
    if(type === 'output') return addOutputNode(point);
    return null;
}
function menuAdd(type){
    closeCreateMenu();
    if(type === 'image') addImageNode(menuPoint);
    if(type === 'prompt') addPromptNode(menuPoint);
    if(type === 'loop') addLoopNode(menuPoint);
    if(type === 'llm') addLLMNode(menuPoint);
    if(type === 'generator') addGeneratorNode(menuPoint);
    if(type === 'video') addVideoNode(menuPoint);
    if(type === 'output') addOutputNode(menuPoint);
    if(type === 'group') addGroupNode(menuPoint);
}
async function uploadImages(files, point){
    if(!ensureCanvas()) return;
    const imgs = [...files].filter(file => file.type.startsWith('image/'));
    if(!imgs.length) return;
    const form = new FormData();
    imgs.forEach(file => form.append('files', file));
    const data = await fetch('/api/ai/upload', {method:'POST', body:form}).then(r=>r.json());
    const base = point || screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    (data.files || []).forEach((file, i) => {
        nodes.push({id:uid('img'), type:'image', x:base.x + i * 36, y:base.y + i * 36, url:file.url, name:file.name});
    });
    render();
    scheduleSave();
}
function imageUrlFromDataTransfer(dataTransfer){
    if(!dataTransfer) return '';
    const values = [
        dataTransfer.getData?.('text/uri-list') || '',
        dataTransfer.getData?.('text/plain') || ''
    ].join('\n');
    const html = dataTransfer.getData?.('text/html') || '';
    const htmlMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    const candidates = [
        htmlMatch?.[1] || '',
        ...values.split(/\r?\n/)
    ].map(s => String(s || '').trim()).filter(Boolean);
    return candidates.find(s => /^https?:\/\/.+/i.test(s) || /^data:image\//i.test(s) || /^blob:/i.test(s)) || '';
}
function createImageCardFromUrl(url, point, name='image'){
    if(!ensureCanvas() || !url || isVideoUrl(url)) return;
    const p = point || defaultPoint(0, 0);
    nodes.push({id:uid('img'), type:'image', x:p.x, y:p.y, url, name:name || outputImageName(url)});
    render();
    scheduleSave();
}
async function fillImageNode(nodeId, files){
    if(!ensureCanvas()) return;
    const imgs = [...files].filter(file => file.type.startsWith('image/'));
    if(!imgs.length) return;
    const form = new FormData();
    form.append('files', imgs[0]);
    const data = await fetch('/api/ai/upload', {method:'POST', body:form}).then(r=>r.json());
    const file = data.files?.[0];
    const node = nodes.find(n => n.id === nodeId);
    if(file && node){
        node.url = file.url;
        node.name = file.name;
        render();
        scheduleSave();
    }
}
function setImageNodeFromOutput(nodeId, url){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || node.type !== 'image' || !url || isVideoUrl(url)) return;
    pushUndo();
    node.url = url;
    node.name = outputImageName(url);
    render();
    scheduleSave();
}
function clearImageNode(nodeId, event=null){
    if(event){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
    }
    const node = nodes.find(n => n.id === nodeId);
    if(!node || node.type !== 'image') return;
    pushUndo();
    node.url = '';
    node.name = '空白图片';
    render();
    scheduleSave();
}
function pickImageForNode(nodeId){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => fillImageNode(nodeId, input.files);
    input.click();
}
function cropBounds(){
    const img = document.getElementById('cropImage');
    return {w:img.clientWidth || 1, h:img.clientHeight || 1};
}
function editDrawCanvas(){
    return document.getElementById('editDrawCanvas');
}
function resizeEditDrawCanvas(){
    const img = document.getElementById('cropImage');
    const canvasEl = editDrawCanvas();
    const w = Math.max(1, img.naturalWidth || img.clientWidth || 1);
    const h = Math.max(1, img.naturalHeight || img.clientHeight || 1);
    if(canvasEl.width !== w || canvasEl.height !== h){
        canvasEl.width = w;
        canvasEl.height = h;
    }
    canvasEl.style.width = `${img.clientWidth || 1}px`;
    canvasEl.style.height = `${img.clientHeight || 1}px`;
    if(imageEditMode === 'grid') refreshGridSplitPreview();
}
function setImageEditMode(mode, userTouched=false){
    if(userTouched) imageEditModeTouched = true;
    const prevImageEditMode = imageEditMode;
    imageEditMode = ['preview','crop','mask','brush','grid'].includes(mode) ? mode : 'crop';
    const cropCanvasEl = document.getElementById('cropCanvas');
    cropCanvasEl.classList.toggle('preview-mode', imageEditMode === 'preview');
    cropCanvasEl.classList.toggle('mask-mode', imageEditMode === 'mask');
    cropCanvasEl.classList.toggle('brush-mode', imageEditMode === 'brush');
    cropCanvasEl.classList.toggle('grid-mode', imageEditMode === 'grid');
    _syncGridCustomCursor();
    _syncBrushCursor();
    // 预览 ↔ 非预览 切换时，清除缩放产生的内联样式，让 CSS max-width 重新生效
    const isPreviewTransition = (prevImageEditMode === 'preview') !== (imageEditMode === 'preview');
    const img = document.getElementById('cropImage');
    if(isPreviewTransition && prevImageEditMode){
        img.style.width = ''; img.style.height = '';
        img.style.maxWidth = ''; img.style.maxHeight = '';
        imageEditZoom = 1.0;
        _previewPanX = 0; _previewPanY = 0;
        const inner = document.querySelector('#imageEditStage > .image-edit-stage-inner');
        if(inner) inner.style.transform = '';
    }
    document.querySelectorAll('[data-image-edit-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.imageEditMode === imageEditMode));
    document.getElementById('imageMaskTools').classList.toggle('active', imageEditMode === 'mask');
    document.getElementById('imageBrushTools').classList.toggle('active', imageEditMode === 'brush');
    document.getElementById('imageGridTools').classList.toggle('active', imageEditMode === 'grid');
    syncGridGapValue();
    const title = document.getElementById('imageEditTitle');
    const sub = document.getElementById('imageEditSub');
    const apply = document.getElementById('imageEditApplyBtn');
    const icon = imageEditMode === 'preview' ? 'eye' : imageEditMode === 'crop' ? 'crop' : imageEditMode === 'mask' ? 'brush' : imageEditMode === 'brush' ? 'paintbrush' : 'grid-3x3';
    const labelKey = imageEditMode === 'preview' ? 'canvas.closePreview' : imageEditMode === 'crop' ? 'canvas.applyCrop' : imageEditMode === 'mask' ? 'canvas.applyMask' : imageEditMode === 'brush' ? 'canvas.applyBrush' : 'canvas.applyGrid';
    const titleKey = imageEditMode === 'preview' ? 'canvas.previewImage' : imageEditMode === 'crop' ? 'canvas.cropImage' : imageEditMode === 'mask' ? 'canvas.maskEdit' : imageEditMode === 'brush' ? 'canvas.brushEdit' : 'canvas.modeGrid';
    const subKey = imageEditMode === 'preview' ? 'canvas.previewHint' : imageEditMode === 'crop' ? 'canvas.cropHint' : imageEditMode === 'mask' ? 'canvas.maskHint2' : imageEditMode === 'brush' ? 'canvas.brushHint' : 'canvas.gridHint';
    title.textContent = tr(titleKey);
    sub.textContent = tr(subKey);
    apply.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${tr(labelKey)}</span>`;
    // 延迟到下一帧确保 CSS 类切换和样式清除后的布局已稳定
    const doResize = () => {
        resizeEditDrawCanvas();
        if(imageEditMode === 'grid') refreshGridSplitPreview();
        else if(imageEditMode === 'crop') clearEditDrawing(true);
        else if(imageEditMode === 'preview'){ clearEditDrawing(true); resetCropBox(); _applyPreviewPan(); }
        else if(prevImageEditMode === 'grid') clearEditDrawing(true);
        if(isPreviewTransition && prevImageEditMode){
            imageEditBaseW = img.clientWidth; imageEditBaseH = img.clientHeight;
            const stage = document.getElementById('imageEditStage');
            if(stage){ stage.scrollLeft = 0; stage.scrollTop = 0; }
            syncImageEditOverflow();
        }
        if(imageEditMode === 'preview' && !isPreviewTransition){
            imageEditBaseW = img.clientWidth; imageEditBaseH = img.clientHeight;
        }
        syncImageEditLayout();
        requestAnimationFrame(syncImageEditLayout);
        _updateZoomLabel();
    };
    if(isPreviewTransition && prevImageEditMode){ requestAnimationFrame(doResize); }
    else { doResize(); }
    syncEditDrawingHistoryButtons();
    syncBrushToolButtons();
    refreshIcons();
}
function editDrawSnapshot(){
    const canvasEl = editDrawCanvas();
    return {
        imageData: canvasEl.getContext('2d').getImageData(0, 0, canvasEl.width, canvasEl.height),
        labelCounter: brushLabelCounter,
    };
}
function restoreEditDrawSnapshot(snapshot){
    if(!snapshot) return;
    const canvasEl = editDrawCanvas();
    const imageData = snapshot.imageData || snapshot;
    canvasEl.getContext('2d').putImageData(imageData, 0, 0);
    if(snapshot.labelCounter) brushLabelCounter = snapshot.labelCounter;
}
function pushEditDrawHistory(){
    editDrawUndoStack.push(editDrawSnapshot());
    if(editDrawUndoStack.length > EDIT_DRAW_HISTORY_MAX) editDrawUndoStack.shift();
    editDrawRedoStack = [];
    syncEditDrawingHistoryButtons();
}
function syncEditDrawingHistoryButtons(){
    ['maskUndoBtn','brushUndoBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn){ btn.disabled = !editDrawUndoStack.length; btn.style.opacity = editDrawUndoStack.length ? '1' : '.42'; }
    });
    ['maskRedoBtn','brushRedoBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn){ btn.disabled = !editDrawRedoStack.length; btn.style.opacity = editDrawRedoStack.length ? '1' : '.42'; }
    });
}
function undoEditDrawing(){
    if(!editDrawUndoStack.length) return;
    editDrawRedoStack.push(editDrawSnapshot());
    restoreEditDrawSnapshot(editDrawUndoStack.pop());
    syncEditDrawingHistoryButtons();
}
function redoEditDrawing(){
    if(!editDrawRedoStack.length) return;
    editDrawUndoStack.push(editDrawSnapshot());
    restoreEditDrawSnapshot(editDrawRedoStack.pop());
    syncEditDrawingHistoryButtons();
}
function clearEditDrawing(silent=false){
    const canvasEl = editDrawCanvas();
    if(!silent && editCanvasHasPixels()) pushEditDrawHistory();
    canvasEl.getContext('2d').clearRect(0, 0, canvasEl.width, canvasEl.height);
    brushLabelCounter = 1;
    syncEditDrawingHistoryButtons();
}
function resetEditDrawingHistory(){
    editDrawUndoStack = [];
    editDrawRedoStack = [];
    brushLabelCounter = 1;
    syncEditDrawingHistoryButtons();
}
function setBrushTool(tool){
    brushTool = ['free','rect','ellipse','label'].includes(tool) ? tool : 'free';
    syncBrushToolButtons();
}
function syncBrushToolButtons(){
    document.querySelectorAll('[data-brush-tool]').forEach(btn => {
        const active = btn.dataset.brushTool === brushTool;
        btn.classList.toggle('primary', active);
        btn.classList.toggle('secondary', !active);
    });
}
function editDrawPoint(event){
    const canvasEl = editDrawCanvas();
    const rect = canvasEl.getBoundingClientRect();
    return {
        x:(event.clientX - rect.left) * canvasEl.width / Math.max(1, rect.width),
        y:(event.clientY - rect.top) * canvasEl.height / Math.max(1, rect.height),
    };
}
function gridCustomLineHit(point){
    if(!gridCustomLines.length) return -1;
    const canvasEl = editDrawCanvas();
    const threshold = Math.max(8, Math.min(canvasEl.width, canvasEl.height) / 80);
    let best = -1;
    let bestDist = Infinity;
    gridCustomLines.forEach((line, index) => {
        const dist = line.type === 'h'
            ? Math.abs(point.y - line.pos * canvasEl.height)
            : Math.abs(point.x - line.pos * canvasEl.width);
        if(dist < bestDist && dist <= threshold){
            best = index;
            bestDist = dist;
        }
    });
    return best;
}
function setGridCustomLinePos(index, point){
    const canvasEl = editDrawCanvas();
    const line = gridCustomLines[index];
    if(!line) return;
    line.pos = line.type === 'h'
        ? Math.max(0.001, Math.min(0.999, point.y / Math.max(1, canvasEl.height)))
        : Math.max(0.001, Math.min(0.999, point.x / Math.max(1, canvasEl.width)));
}
function editBrushSize(){
    const id = imageEditMode === 'mask' ? 'maskBrushSize' : 'paintBrushSize';
    return Number(document.getElementById(id)?.value || 20);
}
function brushColor(){
    return document.getElementById('paintBrushColor')?.value || '#ff2d55';
}
const MASK_BRUSH_ALPHA = 115;
const MASK_BRUSH_COLOR = `rgba(255,0,0,${MASK_BRUSH_ALPHA / 255})`;
function setupDrawStyle(ctx){
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = editBrushSize();
    ctx.strokeStyle = imageEditMode === 'mask' ? MASK_BRUSH_COLOR : brushColor();
    ctx.fillStyle = imageEditMode === 'mask' ? MASK_BRUSH_COLOR : brushColor();
    ctx.globalCompositeOperation = 'source-over';
}
function normalizeMaskPreviewCanvas(canvasEl=editDrawCanvas()){
    if(imageEditMode !== 'mask' || !canvasEl?.width || !canvasEl?.height) return;
    const ctx = canvasEl.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
    const data = imageData.data;
    let changed = false;
    for(let i = 0; i < data.length; i += 4){
        if(data[i + 3] <= 0) continue;
        data[i] = 255;
        data[i + 1] = 0;
        data[i + 2] = 0;
        if(data[i + 3] > MASK_BRUSH_ALPHA) data[i + 3] = MASK_BRUSH_ALPHA;
        changed = true;
    }
    if(changed) ctx.putImageData(imageData, 0, 0);
}
function normalizeMaskPreviewRegion(canvasEl, x, y, w, h){
    if(imageEditMode !== 'mask' || !canvasEl?.width || !canvasEl?.height) return;
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(canvasEl.width, Math.ceil(x + w));
    const y1 = Math.min(canvasEl.height, Math.ceil(y + h));
    const rw = x1 - x0;
    const rh = y1 - y0;
    if(rw <= 0 || rh <= 0) return;
    const ctx = canvasEl.getContext('2d');
    const imageData = ctx.getImageData(x0, y0, rw, rh);
    const data = imageData.data;
    let changed = false;
    for(let i = 0; i < data.length; i += 4){
        if(data[i + 3] <= 0) continue;
        data[i] = 255;
        data[i + 1] = 0;
        data[i + 2] = 0;
        if(data[i + 3] > MASK_BRUSH_ALPHA) data[i + 3] = MASK_BRUSH_ALPHA;
        changed = true;
    }
    if(changed) ctx.putImageData(imageData, x0, y0);
}
function circledNumber(n){
    if(n >= 1 && n <= 20) return String.fromCharCode(0x2460 + n - 1);
    return String(n);
}
function drawBrushShape(ctx, start, end, preview=false){
    setupDrawStyle(ctx);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    if(brushTool === 'rect'){
        ctx.strokeRect(x, y, w, h);
    } else if(brushTool === 'ellipse'){
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
    }
}
function drawNumberLabel(point){
    const canvasEl = editDrawCanvas();
    const ctx = canvasEl.getContext('2d');
    const size = Math.max(18, editBrushSize() * 2.2);
    const text = circledNumber(brushLabelCounter++);
    setupDrawStyle(ctx);
    ctx.save();
    ctx.font = `900 ${size}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeText(text, point.x, point.y);
    ctx.fillStyle = brushColor();
    ctx.fillText(text, point.x, point.y);
    ctx.restore();
}
function drawFreeBrushDot(ctx, point){
    const radius = Math.max(0.5, editBrushSize() / 2);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    normalizeMaskPreviewRegion(ctx.canvas, point.x - radius - 2, point.y - radius - 2, radius * 2 + 4, radius * 2 + 4);
}
function drawFreeBrushSegments(ctx, state, points){
    if(!points.length) return;
    const pad = editBrushSize() * 1.75 + 8;
    let minX = state.lastMid?.x ?? state.x;
    let minY = state.lastMid?.y ?? state.y;
    let maxX = minX;
    let maxY = minY;
    ctx.beginPath();
    if(state.lastMid) ctx.moveTo(state.lastMid.x, state.lastMid.y);
    else ctx.moveTo(state.x, state.y);
    points.forEach(point => {
        const mid = {
            x:(state.x + point.x) / 2,
            y:(state.y + point.y) / 2,
        };
        ctx.quadraticCurveTo(state.x, state.y, mid.x, mid.y);
        minX = Math.min(minX, state.x, point.x, mid.x);
        minY = Math.min(minY, state.y, point.y, mid.y);
        maxX = Math.max(maxX, state.x, point.x, mid.x);
        maxY = Math.max(maxY, state.y, point.y, mid.y);
        state.x = point.x;
        state.y = point.y;
        state.lastMid = mid;
    });
    ctx.stroke();
    normalizeMaskPreviewRegion(ctx.canvas, minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
}
function beginEditDraw(event){
    if(event.button !== 0) return; // 仅左键绘图
    if(imageEditMode === 'crop') return;
    if(imageEditMode === 'grid'){
        if(!gridCustomMode) return;
        // 自定义模式：拖动已有线，或点击空白处放置新线
        event.preventDefault();
        event.stopPropagation();
        const canvasEl = editDrawCanvas();
        canvasEl.setPointerCapture?.(event.pointerId);
        const point = editDrawPoint(event);
        const hitIndex = gridCustomLineHit(point);
        gridCustomHistory.push([...gridCustomLines.map(line => ({...line}))]);
        if(hitIndex >= 0){
            gridCustomDrag = {index: hitIndex, pointerId: event.pointerId};
            setGridCustomLinePos(hitIndex, point);
            refreshGridSplitPreview();
            _syncGridCustomUndoBtn();
            return;
        }
        const rect = canvasEl.getBoundingClientRect();
        const fracX = Math.max(0.001, Math.min(0.999, (event.clientX - rect.left) / rect.width));
        const fracY = Math.max(0.001, Math.min(0.999, (event.clientY - rect.top) / rect.height));
        gridCustomLines.push({type: gridCustomOrientation, pos: gridCustomOrientation === 'h' ? fracY : fracX});
        gridCustomDrag = {index: gridCustomLines.length - 1, pointerId: event.pointerId};
        _syncGridCustomUndoBtn();
        refreshGridSplitPreview();
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    const canvasEl = editDrawCanvas();
    canvasEl.setPointerCapture?.(event.pointerId);
    const ctx = canvasEl.getContext('2d');
    const p = editDrawPoint(event);
    pushEditDrawHistory();
    if(imageEditMode === 'brush' && brushTool === 'label'){
        drawNumberLabel(p);
        editDrawState = null;
        canvasEl.releasePointerCapture?.(event.pointerId);
        syncEditDrawingHistoryButtons();
        return;
    }
    editDrawState = {x:p.x, y:p.y, sx:p.x, sy:p.y, lastMid:null, pointerId:event.pointerId, snapshot:(imageEditMode === 'brush' && brushTool !== 'free') ? editDrawSnapshot() : null};
    setupDrawStyle(ctx);
    if(imageEditMode === 'mask' || brushTool === 'free') drawFreeBrushDot(ctx, p);
}
function moveEditDraw(event){
    if(imageEditMode === 'grid' && gridCustomMode && gridCustomDrag){
        event.preventDefault();
        event.stopPropagation();
        setGridCustomLinePos(gridCustomDrag.index, editDrawPoint(event));
        refreshGridSplitPreview();
        return;
    }
    if(!editDrawState || imageEditMode === 'crop' || imageEditMode === 'grid') return;
    event.preventDefault();
    event.stopPropagation();
    const ctx = editDrawCanvas().getContext('2d');
    if(imageEditMode === 'brush' && brushTool !== 'free'){
        const p = editDrawPoint(event);
        restoreEditDrawSnapshot(editDrawState.snapshot);
        drawBrushShape(ctx, {x:editDrawState.sx, y:editDrawState.sy}, p, true);
        return;
    }
    setupDrawStyle(ctx);
    const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
    drawFreeBrushSegments(ctx, editDrawState, events.map(item => editDrawPoint(item)));
}
function endEditDraw(event){
    const shouldNormalizeMask = !!editDrawState && imageEditMode === 'mask';
    if(editDrawState && event?.pointerId != null) editDrawCanvas().releasePointerCapture?.(event.pointerId);
    if(gridCustomDrag && event?.pointerId != null) editDrawCanvas().releasePointerCapture?.(event.pointerId);
    if(shouldNormalizeMask) normalizeMaskPreviewCanvas();
    editDrawState = null;
    gridCustomDrag = null;
    syncEditDrawingHistoryButtons();
}
function editCanvasHasPixels(){
    const canvasEl = editDrawCanvas();
    const data = canvasEl.getContext('2d').getImageData(0, 0, canvasEl.width, canvasEl.height).data;
    for(let i = 3; i < data.length; i += 4) if(data[i] > 0) return true;
    return false;
}
function syncGridGapValue(){
    const input = document.getElementById('gridGapSize');
    const value = Math.max(0, Math.min(240, Number(input?.value || 0)));
    if(input) input.value = value;
    const label = document.getElementById('gridGapValue');
    if(label) label.textContent = String(value);
    return value;
}
function gridSplitSettings(){
    const hLines = Math.max(0, Math.min(20, Number(document.getElementById('gridHorizontalLines')?.value || 0)));
    const vLines = Math.max(0, Math.min(20, Number(document.getElementById('gridVerticalLines')?.value || 0)));
    const gap = syncGridGapValue();
    return {rows:hLines + 1, cols:vLines + 1, gap};
}
function gridSplitRects(width, height){
    if(gridCustomMode) return gridSplitRectsCustom(width, height);
    const {rows, cols, gap} = gridSplitSettings();
    const halfGap = gap / 2;
    const rects = [];
    for(let row = 0; row < rows; row++){
        const topLine = row * height / rows;
        const bottomLine = (row + 1) * height / rows;
        const y1 = Math.round(row === 0 ? 0 : topLine + halfGap);
        const y2 = Math.round(row === rows - 1 ? height : bottomLine - halfGap);
        for(let col = 0; col < cols; col++){
            const leftLine = col * width / cols;
            const rightLine = (col + 1) * width / cols;
            const x1 = Math.round(col === 0 ? 0 : leftLine + halfGap);
            const x2 = Math.round(col === cols - 1 ? width : rightLine - halfGap);
            if(x2 > x1 && y2 > y1) rects.push({row, col, x:x1, y:y1, w:x2 - x1, h:y2 - y1});
        }
    }
    return rects;
}
function gridSplitRectsCustom(width, height){
    const gap = Math.max(0, Math.min(240, Number(document.getElementById('gridGapSize')?.value || 0)));
    const halfGap = gap / 2;
    // 按方向归类，转换为像素位置（去重并排序）
    const rawH = [...new Set(gridCustomLines.filter(l => l.type === 'h').map(l => l.pos * height))].sort((a, b) => a - b);
    const rawV = [...new Set(gridCustomLines.filter(l => l.type === 'v').map(l => l.pos * width))].sort((a, b) => a - b);
    const hCuts = [0, ...rawH, height]; // 切割边界（含图片两端）
    const vCuts = [0, ...rawV, width];
    const rects = [];
    for(let row = 0; row < hCuts.length - 1; row++){
        for(let col = 0; col < vCuts.length - 1; col++){
            const y1 = Math.round(row === 0 ? hCuts[row] : hCuts[row] + halfGap);
            const y2 = Math.round(row === hCuts.length - 2 ? hCuts[row + 1] : hCuts[row + 1] - halfGap);
            const x1 = Math.round(col === 0 ? vCuts[col] : vCuts[col] + halfGap);
            const x2 = Math.round(col === vCuts.length - 2 ? vCuts[col + 1] : vCuts[col + 1] - halfGap);
            if(x2 > x1 && y2 > y1) rects.push({row, col, x:x1, y:y1, w:x2 - x1, h:y2 - y1});
        }
    }
    return rects;
}
function gridLayoutFromRects(rects){
    const rows = Math.max(1, ...rects.map(r => Number(r.row || 0) + 1));
    const cols = Math.max(1, ...rects.map(r => Number(r.col || 0) + 1));
    return {type:'grid-split', groupId:uid('grid'), rows, cols};
}
function applyGridPreset(rows, cols){
    gridCustomMode = false;
    gridCustomLines = [];
    gridCustomHistory = [];
    gridCustomDrag = null;
    const h = document.getElementById('gridHorizontalLines');
    const v = document.getElementById('gridVerticalLines');
    if(h){ h.disabled = false; h.value = String(Math.max(0, Number(rows || 1) - 1)); }
    if(v){ v.disabled = false; v.value = String(Math.max(0, Number(cols || 1) - 1)); }
    const toggle = document.getElementById('gridCustomToggle');
    const custom = document.getElementById('gridCustomControls');
    const regular = document.getElementById('gridRegularControls');
    if(toggle){
        toggle.classList.remove('primary');
        toggle.classList.add('secondary');
    }
    if(custom) custom.style.display = 'none';
    if(regular) regular.style.display = 'contents';
    _syncGridCustomCursor();
    _syncGridCustomUndoBtn();
    refreshGridSplitPreview();
}
// ——— 自定义宫格辅助函数 ———
function toggleGridCustomMode(){
    gridCustomMode = !gridCustomMode;
    if(gridCustomMode){ gridCustomLines = []; gridCustomHistory = []; } // 进入自定义时清空旧线及历史
    gridCustomDrag = null;
    const toggle = document.getElementById('gridCustomToggle');
    const regular = document.getElementById('gridRegularControls');
    const custom = document.getElementById('gridCustomControls');
    toggle.classList.toggle('primary', gridCustomMode);
    toggle.classList.toggle('secondary', !gridCustomMode);
    // 禁用/启用常规输入
    ['gridHorizontalLines','gridVerticalLines'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.disabled = gridCustomMode;
    });
    if(custom) custom.style.display = gridCustomMode ? 'flex' : 'none';
    _syncGridCustomCursor();
    _syncGridCustomUndoBtn();
    refreshGridSplitPreview();
}
function setGridCustomOrientation(orient){
    gridCustomOrientation = orient;
    document.getElementById('gridOrientH').classList.toggle('primary', orient === 'h');
    document.getElementById('gridOrientH').classList.toggle('secondary', orient !== 'h');
    document.getElementById('gridOrientV').classList.toggle('primary', orient === 'v');
    document.getElementById('gridOrientV').classList.toggle('secondary', orient !== 'v');
    _syncGridCustomCursor();
}
function clearGridCustomLines(){
    gridCustomHistory = [];
    gridCustomLines = [];
    gridCustomDrag = null;
    _syncGridCustomUndoBtn();
    refreshGridSplitPreview();
}
function undoGridCustomLine(){
    if(!gridCustomHistory.length) return;
    gridCustomLines = gridCustomHistory.pop();
    gridCustomDrag = null;
    _syncGridCustomUndoBtn();
    refreshGridSplitPreview();
}
function _syncGridCustomUndoBtn(){
    const btn = document.getElementById('gridUndoBtn');
    if(!btn) return;
    btn.disabled = gridCustomHistory.length === 0;
    btn.style.opacity = gridCustomHistory.length === 0 ? '0.4' : '1';
}
// ——— 图片缩放 ———
function applyImageEditZoom(){
    if(!imageEditBaseW) return;
    const img = document.getElementById('cropImage');
    const oldW = img.clientWidth;
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.width = Math.round(imageEditBaseW * imageEditZoom) + 'px';
    img.style.height = Math.round(imageEditBaseH * imageEditZoom) + 'px';
    resizeEditDrawCanvas();
    // 按比例同步裁剪框位置
    if(cropState && oldW > 0){
        const scale = img.clientWidth / oldW;
        cropState.x = Math.round(cropState.x * scale);
        cropState.y = Math.round(cropState.y * scale);
        cropState.w = Math.round(cropState.w * scale);
        cropState.h = Math.round(cropState.h * scale);
        clampCrop();
        renderCropBox();
    }
    imageEditLayoutW = img.clientWidth || imageEditLayoutW;
    imageEditLayoutH = img.clientHeight || imageEditLayoutH;
    if(imageEditMode === 'grid') refreshGridSplitPreview();
    syncImageEditOverflow();
    _updateZoomLabel();
}
function syncImageEditOverflow(){
    const stage = document.getElementById('imageEditStage');
    const crop = document.getElementById('cropCanvas');
    if(!stage || !crop) return;
    const rect = crop.getBoundingClientRect();
    const pad = 36;
    const overflowX = rect.width + pad > stage.clientWidth;
    const overflowY = rect.height + pad > stage.clientHeight;
    stage.classList.toggle('overflowing', overflowX || overflowY);
    stage.classList.toggle('overflow-x', overflowX);
    stage.classList.toggle('overflow-y', overflowY);
}
function syncImageEditLayout(){
    const img = document.getElementById('cropImage');
    const nextW = img?.clientWidth || 0;
    const nextH = img?.clientHeight || 0;
    if(cropState && imageEditLayoutW > 0 && imageEditLayoutH > 0 && nextW > 0 && nextH > 0 && (nextW !== imageEditLayoutW || nextH !== imageEditLayoutH)){
        const scaleX = nextW / imageEditLayoutW;
        const scaleY = nextH / imageEditLayoutH;
        cropState.x = Math.round(cropState.x * scaleX);
        cropState.y = Math.round(cropState.y * scaleY);
        cropState.w = Math.round(cropState.w * scaleX);
        cropState.h = Math.round(cropState.h * scaleY);
    }
    if(nextW > 0) imageEditLayoutW = nextW;
    if(nextH > 0) imageEditLayoutH = nextH;
    resizeEditDrawCanvas();
    if(cropState && imageEditMode === 'crop'){
        clampCrop();
        renderCropBox();
    }
    if(imageEditMode === 'grid') refreshGridSplitPreview();
    syncImageEditOverflow();
    _refreshBrushCursorSize();
    if(lastEditPointerEvent) _updateBrushCursor(lastEditPointerEvent);
}
function resetImageEditZoom(){
    const stage = document.getElementById('imageEditStage');
    imageEditZoom = 1.0;
    applyImageEditZoom();
    if(stage){ stage.scrollLeft = 0; stage.scrollTop = 0; }
    _previewPanX = 0; _previewPanY = 0; _applyPreviewPan();
    syncImageEditLayout();
    requestAnimationFrame(syncImageEditLayout);
}
function _updateZoomLabel(){
    const el = document.getElementById('imageEditZoomLabel');
    if(el) el.textContent = Math.round(imageEditZoom * 100) + '%';
}
function _syncGridCustomCursor(){
    const cropCanvasEl = document.getElementById('cropCanvas');
    cropCanvasEl.classList.toggle('grid-custom-h', imageEditMode === 'grid' && gridCustomMode && gridCustomOrientation === 'h');
    cropCanvasEl.classList.toggle('grid-custom-v', imageEditMode === 'grid' && gridCustomMode && gridCustomOrientation === 'v');
}
let _brushCursorEl = null;
function _getBrushCursorEl(){
    if(!_brushCursorEl){
        _brushCursorEl = document.createElement('div');
        _brushCursorEl.className = 'brush-cursor';
        document.getElementById('cropCanvas').appendChild(_brushCursorEl);
    }
    return _brushCursorEl;
}
function _updateBrushCursor(event){
    if(event) lastEditPointerEvent = {
        clientX: event.clientX,
        clientY: event.clientY
    };
    if(imageEditMode !== 'mask' && imageEditMode !== 'brush'){
        _getBrushCursorEl().style.display = 'none';
        return;
    }
    if(!lastEditPointerEvent) return;
    const canvasEl = editDrawCanvas();
    const rect = canvasEl.getBoundingClientRect();
    const x = lastEditPointerEvent.clientX - rect.left;
    const y = lastEditPointerEvent.clientY - rect.top;
    const scale = rect.width / canvasEl.width;
    const diameter = Math.max(2, editBrushSize() * scale);
    const cursor = _getBrushCursorEl();
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    cursor.style.width = diameter + 'px';
    cursor.style.height = diameter + 'px';
    cursor.style.display = 'block';
}
function _hideBrushCursor(){
    if(_brushCursorEl) _brushCursorEl.style.display = 'none';
}
function _refreshBrushCursorSize(){
    if(!_brushCursorEl || _brushCursorEl.style.display === 'none') return;
    if(imageEditMode !== 'mask' && imageEditMode !== 'brush') return;
    const canvasEl = editDrawCanvas();
    const scale = canvasEl.getBoundingClientRect().width / canvasEl.width;
    const diameter = Math.max(2, editBrushSize() * scale);
    _brushCursorEl.style.width = diameter + 'px';
    _brushCursorEl.style.height = diameter + 'px';
}
function _syncBrushCursor(){
    if(imageEditMode === 'mask' || imageEditMode === 'brush'){
        _getBrushCursorEl();
    } else {
        _hideBrushCursor();
    }
}
function refreshGridSplitPreview(){
    const canvasEl = editDrawCanvas();
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if(imageEditMode !== 'grid') return;
    const countEl = document.getElementById('gridSplitCount');
    const lineWidth = Math.max(2, Math.round(Math.min(canvasEl.width, canvasEl.height) / 320));
    const drawGuideLine = (x1, y1, x2, y2) => {
        ctx.save();
        ctx.lineWidth = lineWidth + 2;
        ctx.strokeStyle = 'rgba(2,6,23,0.72)';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
    };
    if(gridCustomMode){
        // 自定义模式：按已放置线渲染（包含空心范围预览）
        const gap = Math.max(0, Math.min(240, Number(document.getElementById('gridGapSize')?.value || 0)));
        const hLines = gridCustomLines.filter(l => l.type === 'h');
        const vLines = gridCustomLines.filter(l => l.type === 'v');
        if(countEl) countEl.textContent = tr('canvas.gridWillOutput').replace('{n}', (hLines.length + 1) * (vLines.length + 1));
        ctx.save();
        hLines.forEach(l => {
            const y = l.pos * canvasEl.height;
            if(gap > 0){
                drawGuideLine(0, y - gap / 2, canvasEl.width, y - gap / 2);
                drawGuideLine(0, y + gap / 2, canvasEl.width, y + gap / 2);
            } else {
                drawGuideLine(0, y, canvasEl.width, y);
            }
        });
        vLines.forEach(l => {
            const x = l.pos * canvasEl.width;
            if(gap > 0){
                drawGuideLine(x - gap / 2, 0, x - gap / 2, canvasEl.height);
                drawGuideLine(x + gap / 2, 0, x + gap / 2, canvasEl.height);
            } else {
                drawGuideLine(x, 0, x, canvasEl.height);
            }
        });
        ctx.restore();
        return;
    }
    // 常规模式
    const {rows, cols, gap} = gridSplitSettings();
    if(countEl) countEl.textContent = tr('canvas.gridWillOutput').replace('{n}', rows * cols);
    ctx.save();
    const scaleX = canvasEl.width;
    const scaleY = canvasEl.height;
    for(let i = 1; i < cols; i++){
        const x = i * scaleX / cols;
        if(gap > 0){
            drawGuideLine(x - gap / 2, 0, x - gap / 2, scaleY);
            drawGuideLine(x + gap / 2, 0, x + gap / 2, scaleY);
        } else {
            drawGuideLine(x, 0, x, scaleY);
        }
    }
    for(let i = 1; i < rows; i++){
        const y = i * scaleY / rows;
        if(gap > 0){
            drawGuideLine(0, y - gap / 2, scaleX, y - gap / 2);
            drawGuideLine(0, y + gap / 2, scaleX, y + gap / 2);
        } else {
            drawGuideLine(0, y, scaleX, y);
        }
    }
    ctx.restore();
}
function imageEditorOutputPoint(node, offsetY=0){
    return {x:(node.x || 0) + Number(node.w || 260) + 36, y:(node.y || 0) + offsetY};
}
function imageEditorOutputNode(sourceNode){
    let out = connections.filter(c => c.from === sourceNode.id)
        .map(c => nodes.find(n => n.id === c.to))
        .find(n => n?.type === 'output');
    if(!out){
        const p = imageEditorOutputPoint(sourceNode, 0);
        out = {id:uid('out'), type:'output', x:p.x, y:p.y, images:[]};
        nodes.push(out);
    }
    return out;
}
function addGeneratedImageNode(file, sourceNode, suffix, offsetY=0, extra={}){
    const p = imageEditorOutputPoint(sourceNode, offsetY);
    const next = {id:uid('img'), type:'image', x:p.x, y:p.y, url:file.url, name:file.name || suffix, ...extra};
    nodes.push(next);
    selected.clear();
    selected.add(next.id);
    return next;
}
function renderCropBox(){
    if(!cropState) return;
    const box = document.getElementById('cropBox');
    box.style.left = `${cropState.x}px`;
    box.style.top = `${cropState.y}px`;
    box.style.width = `${cropState.w}px`;
    box.style.height = `${cropState.h}px`;
}
function resetCropBox(){
    if(!cropState) return;
    const {w, h} = cropBounds();
    cropState.x = 0;
    cropState.y = 0;
    cropState.w = Math.round(w);
    cropState.h = Math.round(h);
    renderCropBox();
}
function openImageEditor(nodeId){
    const node = nodes.find(n => n.id === nodeId);
    if(!node?.url) return;
    cropState = {nodeId, x:0, y:0, w:0, h:0};
    // 重置自定义宫格状态
    gridCustomMode = false;
    gridCustomLines = [];
    gridCustomHistory = [];
    gridCustomDrag = null;
    gridCustomOrientation = 'h';
    imageEditZoom = 1.0;
    imageEditBaseW = 0;
    imageEditBaseH = 0;
    imageEditLayoutW = 0;
    imageEditLayoutH = 0;
    imageEditModeTouched = false;
    const toggle = document.getElementById('gridCustomToggle');
    if(toggle){ toggle.classList.add('secondary'); toggle.classList.remove('primary'); }
    const custom = document.getElementById('gridCustomControls');
    if(custom) custom.style.display = 'none';
    ['gridHorizontalLines','gridVerticalLines'].forEach(id => { const el = document.getElementById(id); if(el) el.disabled = false; });
    const orientH = document.getElementById('gridOrientH');
    const orientV = document.getElementById('gridOrientV');
    if(orientH){ orientH.classList.add('primary'); orientH.classList.remove('secondary'); }
    if(orientV){ orientV.classList.add('secondary'); orientV.classList.remove('primary'); }
    _syncGridCustomUndoBtn();
    _updateZoomLabel();
    const modal = document.getElementById('imageEditModal');
    const img = document.getElementById('cropImage');
    img.style.width = '';
    img.style.height = '';
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    modal.classList.add('open');
    img.onload = () => {
        // 记录 zoom=1 时的基础显示尺寸
        imageEditBaseW = img.clientWidth;
        imageEditBaseH = img.clientHeight;
        imageEditLayoutW = img.clientWidth;
        imageEditLayoutH = img.clientHeight;
        _updateZoomLabel();
        resizeEditDrawCanvas();
        resetEditDrawingHistory();
        clearEditDrawing(true);
        resetCropBox();
        if(!imageEditModeTouched) setImageEditMode('preview');
        syncImageEditOverflow();
        refreshIcons();
    };
    img.crossOrigin = 'anonymous';
    img.src = node.url;
    setImageEditMode('preview');
    refreshIcons();
}
function closeImageEditor(){
    document.getElementById('imageEditModal').classList.remove('open');
    const img = document.getElementById('cropImage');
    img.onload = null;
    img.removeAttribute('src');
    img.style.width = '';
    img.style.height = '';
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    clearEditDrawing(true);
    cropState = null;
    cropDrag = null;
    editDrawState = null;
    lastEditPointerEvent = null;
    resetEditDrawingHistory();
    gridCustomDrag = null;
    imageEditZoom = 1.0;
    imageEditBaseW = 0;
    imageEditBaseH = 0;
    imageEditLayoutW = 0;
    imageEditLayoutH = 0;
    imageEditModeTouched = false;
    _previewPanX = 0; _previewPanY = 0; _previewPanDrag = null;
    { const _si = document.querySelector('#imageEditStage > .image-edit-stage-inner'); if(_si) _si.style.transform = ''; }
    document.getElementById('imageEditStage')?.classList.remove('overflowing', 'overflow-x', 'overflow-y');
    const cropCanvasEl = document.getElementById('cropCanvas');
    cropCanvasEl.classList.remove('grid-custom-h', 'grid-custom-v');
    _hideBrushCursor();
}
function clampCrop(){
    if(!cropState) return;
    const {w, h} = cropBounds();
    cropState.w = Math.max(24, Math.min(cropState.w, w));
    cropState.h = Math.max(24, Math.min(cropState.h, h));
    cropState.x = Math.max(0, Math.min(cropState.x, w - cropState.w));
    cropState.y = Math.max(0, Math.min(cropState.y, h - cropState.h));
}
function beginCropDrag(event, mode){
    if(!cropState) return;
    if(event.button !== 0) return; // 仅左键操作裁剪框
    event.preventDefault();
    event.stopPropagation();
    cropDrag = {mode, sx:event.clientX, sy:event.clientY, start:{...cropState}};
}
window.addEventListener('mousemove', event => {
    if(!cropDrag || !cropState) return;
    const dx = event.clientX - cropDrag.sx;
    const dy = event.clientY - cropDrag.sy;
    if(cropDrag.mode === 'move'){
        cropState.x = cropDrag.start.x + dx;
        cropState.y = cropDrag.start.y + dy;
    } else {
        cropState.w = cropDrag.start.w + dx;
        cropState.h = cropDrag.start.h + dy;
    }
    clampCrop();
    renderCropBox();
});
window.addEventListener('mouseup', () => { cropDrag = null; });
async function uploadCroppedBlob(blob, name){
    const form = new FormData();
    form.append('files', blob, name);
    const data = await fetch('/api/ai/upload', {method:'POST', body:form}).then(r=>r.json());
    return data.files?.[0];
}
async function uploadImageBlobs(blobs){
    const form = new FormData();
    blobs.forEach(item => form.append('files', item.blob, item.name));
    const data = await fetch('/api/ai/upload', {method:'POST', body:form}).then(r=>r.json());
    return data.files || [];
}
async function applyImageCrop(){
    if(!cropState) return;
    const node = nodes.find(n => n.id === cropState.nodeId);
    const img = document.getElementById('cropImage');
    if(!node || !img.naturalWidth || !img.naturalHeight) return;
    const scaleX = img.naturalWidth / (img.clientWidth || 1);
    const scaleY = img.naturalHeight / (img.clientHeight || 1);
    const sx = Math.max(0, Math.round(cropState.x * scaleX));
    const sy = Math.max(0, Math.round(cropState.y * scaleY));
    const sw = Math.max(1, Math.round(cropState.w * scaleX));
    const sh = Math.max(1, Math.round(cropState.h * scaleY));
    const canvasEl = document.createElement('canvas');
    canvasEl.width = sw;
    canvasEl.height = sh;
    canvasEl.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
    if(!blob) return;
    const base = (node.name || 'image').replace(/\.[^.]+$/, '');
    const file = await uploadCroppedBlob(blob, `${base}_crop.png`);
    if(file){
        node.url = file.url;
        node.name = file.name;
        closeImageEditor();
        render();
        scheduleSave();
    }
}
async function applyImageMask(){
    if(!cropState) return;
    const node = nodes.find(n => n.id === cropState.nodeId);
    if(!node || !editCanvasHasPixels()) return;
    const mask = maskCanvasFromDrawCanvas(editDrawCanvas());
    const blob = await new Promise(resolve => mask.toBlob(resolve, 'image/png'));
    if(!blob) return;
    const base = (node.name || 'image').replace(/\.[^.]+$/, '');
    const file = await uploadCroppedBlob(blob, `${base}_mask.png`);
    if(file){
        addGeneratedImageNode(file, node, 'mask', 28, {role:'mask'});
        closeImageEditor();
        render();
        scheduleSave();
    }
}
function maskCanvasFromDrawCanvas(src){
    const mask = document.createElement('canvas');
    mask.width = src.width;
    mask.height = src.height;
    const srcCtx = src.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, src.width, src.height);
    const ctx = mask.getContext('2d');
    const out = ctx.createImageData(mask.width, mask.height);
    for(let i = 0; i < srcData.data.length; i += 4){
        const painted = srcData.data[i + 3] > 8;
        const v = painted ? 255 : 0;
        out.data[i] = v;
        out.data[i + 1] = v;
        out.data[i + 2] = v;
        out.data[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    return mask;
}
async function applyImageBrush(){
    if(!cropState) return;
    const node = nodes.find(n => n.id === cropState.nodeId);
    const img = document.getElementById('cropImage');
    if(!node || !img.naturalWidth || !img.naturalHeight || !editCanvasHasPixels()) return;
    const canvasEl = document.createElement('canvas');
    canvasEl.width = img.naturalWidth;
    canvasEl.height = img.naturalHeight;
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(editDrawCanvas(), 0, 0);
    const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
    if(!blob) return;
    const base = (node.name || 'image').replace(/\.[^.]+$/, '');
    const file = await uploadCroppedBlob(blob, `${base}_paint.png`);
    if(file){
        node.url = file.url;
        node.name = file.name;
        closeImageEditor();
        render();
        scheduleSave();
    }
}
async function applyImageGridSplit(){
    if(!cropState) return;
    const node = nodes.find(n => n.id === cropState.nodeId);
    const img = document.getElementById('cropImage');
    if(!node || !img.naturalWidth || !img.naturalHeight) return;
    const rects = gridSplitRects(img.naturalWidth, img.naturalHeight);
    if(!rects.length) return;
    const base = (node.name || 'image').replace(/\.[^.]+$/, '');
    const blobs = [];
    for(const rect of rects){
        const canvasEl = document.createElement('canvas');
        canvasEl.width = rect.w;
        canvasEl.height = rect.h;
        canvasEl.getContext('2d').drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
        const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
        if(blob) blobs.push({blob, name:`${base}_r${rect.row + 1}_c${rect.col + 1}.png`});
    }
    if(!blobs.length) return;
    const files = await uploadImageBlobs(blobs);
    if(files.length){
        const out = imageEditorOutputNode(node);
        const urls = files.map(file => file.url).filter(Boolean);
        const layout = gridLayoutFromRects(rects);
        appendOutputImages(out, urls, {url:node.url, name:node.name || 'source image'}, urls.map((url, i) => ({
            runMs:0,
            run:{prompt:'宫格切分', refs:[{url:node.url, name:node.name || 'source image'}]},
            grid:{...layout, row:rects[i]?.row || 0, col:rects[i]?.col || 0, w:rects[i]?.w || 1, h:rects[i]?.h || 1}
        })), layout);
        closeImageEditor();
        render();
        scheduleSave();
    }
}
function applyImageEdit(){
    if(imageEditMode === 'preview') return closeImageEditor();
    if(imageEditMode === 'mask') return applyImageMask();
    if(imageEditMode === 'brush') return applyImageBrush();
    if(imageEditMode === 'grid') return applyImageGridSplit();
    return applyImageCrop();
}

function render(){
    const outputScrolls = captureOutputScrolls();
    applyViewport();
    nodesEl.innerHTML = '';
    nodes.forEach(node => nodesEl.appendChild(renderNode(node)));
    restoreOutputScrolls(outputScrolls);
    refreshGeometry();
    refreshGeometryAfterLayout();
    refreshIcons();
    refreshOutputTimer();
}
function refreshNodes(ids=[]){
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];
    if(!uniqueIds.length) return;
    const outputScrolls = captureOutputScrolls();
    applyViewport();
    for(const id of uniqueIds){
        const node = nodes.find(n => n.id === id);
        if(!node) continue;
        if(node.type === 'output' && refreshOutputNodeContent(node)) continue;
        const current = nodesEl.querySelector(`.node[data-id="${CSS.escape(id)}"]`);
        if(!current){
            render();
            return;
        }
        current.replaceWith(renderNode(node));
    }
    restoreOutputScrolls(outputScrolls);
    refreshGeometry();
    refreshGeometryAfterLayout();
    refreshIcons();
    refreshOutputTimer();
}
function refreshRunNodes(node, out=null){
    refreshNodes([node?.id, out?.id]);
}
function captureOutputScrolls(){
    const state = new Map();
    // output 节点滚动位置
    nodesEl.querySelectorAll('.output-node').forEach(el => {
        const body = el.querySelector('.node-body');
        if(body) state.set('out:' + el.dataset.id, { top:body.scrollTop, left:body.scrollLeft });
    });
    // LLM 聊天日志滚动位置（记录是否在底部，以便恢复时保持底部）
    nodesEl.querySelectorAll('.llm-node').forEach(el => {
        const log = el.querySelector('.llm-chat-log');
        if(!log) return;
        const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 12;
        state.set('llm:' + el.dataset.id, { top:log.scrollTop, atBottom });
    });
    return state;
}
function restoreOutputScrolls(state){
    requestAnimationFrame(() => {
        state.forEach((pos, key) => {
            if(key.startsWith('out:')){
                const id = key.slice(4);
                const body = nodesEl.querySelector(`.output-node[data-id="${CSS.escape(id)}"] .node-body`);
                if(body){ body.scrollTop = pos.top || 0; body.scrollLeft = pos.left || 0; }
            } else if(key.startsWith('llm:')){
                const id = key.slice(4);
                const log = nodesEl.querySelector(`.llm-node[data-id="${CSS.escape(id)}"] .llm-chat-log`);
                if(log){
                    // 之前在底部 → 保持底部（显示最新消息）；否则恢复原位
                    log.scrollTop = pos.atBottom ? log.scrollHeight : (pos.top || 0);
                }
            }
        });
    });
}
function isNodeControl(target){
    return !!target.closest('textarea, input, select, option, button, [contenteditable="true"], .seg, .gen-btn, .input-item, .blank-image, .mode-tabs, .ms-model-tabs, .llm-provider, .llm-output, .llm-chat-log, .llm-bubble, .llm-pane-resizer, .loop-preview');
}
function isNodeDragSurface(target){
    return !isNodeControl(target) && !target.closest('.port, .resize-handle, .output-img-wrap');
}
function renderNode(node){
    normalizeApiNodeLayout(node);
    const el = document.createElement('div');
    const size = defaultNodeSize(node.type);
    const hasFixedSize = Boolean(node.h || size.h);
    el.className = `node ${node.type}-node ${node.url ? 'has-image' : ''} ${hasFixedSize ? 'sized' : ''} ${selected.has(node.id) ? 'selected' : ''}`;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.w || size.w}px`;
    if(node.h || size.h) el.style.height = `${node.h || size.h}px`;
    el.dataset.id = node.id;
    el.onclick = (e) => {
        e.stopPropagation();
        if(isNodeControl(e.target)) return;
        if(isMultiSelectKey(e)) selected.has(node.id) ? selected.delete(node.id) : selected.add(node.id);
        else if(!selected.has(node.id)) { selected.clear(); selected.add(node.id); }
        refreshSelectionVisuals();
    };
    el.oncontextmenu = e => {
        if(!CANVAS_GENERATOR_TYPES.includes(node.type) && node.type !== 'output') return;
        e.preventDefault();
        e.stopPropagation();
        if(node.type === 'output') openOutputNodeMenu(node.id, e.clientX, e.clientY);
        else openGeneratorNodeMenu(node.id, e.clientX, e.clientY);
    };
    const title = node.type === 'image' ? 'Image' : node.type === 'prompt' ? 'Prompt' : node.type === 'loop' ? tr('canvas.loopNode') : node.type === 'promptGroup' ? 'Prompts' : node.type === 'group' ? 'Group' : node.type === 'output' ? 'Output' : node.type === 'llm' ? 'LLM' : node.type === 'video' ? tr('canvas.videoGenerateNode') : tr('canvas.apiGenerate');
    // 失败徽章只在一键运行模式中显示，单节点失败已通过 alert 提示
    const showStatus = ['generator','llm'].includes(node.type) && node.runStatus
        && (node.runStatus !== 'failed' || node._cascadeFailed);
    const statusHtml = showStatus ? (() => {
        const label = { queued:'排队中', running:'运行中', done:'完成', failed:'失败' }[node.runStatus] || '';
        return `<span class="node-run-status ${node.runStatus}"><span class="dot"></span>${escapeHtml(label)}${node._cascadeIdx?' '+node._cascadeIdx:''}</span>`;
    })() : '';
    el.innerHTML = `<div class="node-head"><span class="node-title">${title}</span><div style="display:flex;align-items:center;gap:8px">${statusHtml}<button onclick="deleteNode('${node.id}', event)" class="text-gray-300 hover:text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button></div></div>`;
    const body = document.createElement('div');
    body.className = 'node-body';
    if(node.type === 'image') {
        if(node.url) {
            const missing = isMissingAssetUrl(node.url);
            body.innerHTML = `<div class="image-preview-wrap">${missing ? missingAssetHtml(node.url) : `<img src="${escapeAttr(node.url)}" draggable="false">`}</div><div class="image-caption text-[11px] text-gray-400 truncate">${escapeHtml(node.name || 'image')}${missing ? ` · 文件缺失` : ''}</div>`;
            const previewWrap = body.querySelector('.image-preview-wrap');
            const loadedImg = body.querySelector('img');
            const openEditor = e => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                openImageEditor(node.id);
            };
            body.onmousedown = e => {
                if(spacePan){ startBoardPan(e); return; }
                if(e.detail >= 2){
                    openEditor(e);
                    return;
                }
                startNodeDrag(e, node);
            };
            body.ondragover = e => {
                if(hasImageDropData(e.dataTransfer) || hasOutputImageDrag(e.dataTransfer)){
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = hasOutputImageDrag(e.dataTransfer) ? 'copy' : 'move';
                    previewWrap.classList.add('drag-over');
                    /* 节点内拖拽时把画布全局的毛玻璃覆盖层关掉，避免 stopPropagation 后 board 没机会清它 */
                    dropOverlay.classList.remove('active');
                }
            };
            body.ondragleave = e => {
                e.stopPropagation();
                previewWrap.classList.remove('drag-over');
            };
            body.ondrop = e => {
                if(hasOutputImageDrag(e.dataTransfer)){
                    e.preventDefault();
                    e.stopPropagation();
                    previewWrap.classList.remove('drag-over');
                    dropOverlay.classList.remove('active');
                    setImageNodeFromOutput(node.id, e.dataTransfer.getData('application/x-canvas-output-image'));
                } else if(hasImageFiles(e.dataTransfer?.items)){
                    e.preventDefault();
                    e.stopPropagation();
                    previewWrap.classList.remove('drag-over');
                    dropOverlay.classList.remove('active');
                    fillImageNode(node.id, e.dataTransfer.files);
                } else {
                    const droppedUrl = imageUrlFromDataTransfer(e.dataTransfer);
                    if(droppedUrl){
                        e.preventDefault();
                        e.stopPropagation();
                        previewWrap.classList.remove('drag-over');
                        dropOverlay.classList.remove('active');
                        node.url = droppedUrl;
                        node.name = outputImageName(droppedUrl);
                        render();
                        scheduleSave();
                    }
                }
            };
            body.oncontextmenu = e => {
                e.preventDefault();
                e.stopPropagation();
                openImageNodeMenu(node.id, e.clientX, e.clientY);
            };
            if(loadedImg){
                loadedImg.addEventListener('mousedown', e => {
                    if(e.detail >= 2) openEditor(e);
                }, true);
                loadedImg.addEventListener('dblclick', openEditor, true);
            }
            body.addEventListener('dblclick', openEditor, true);
            if(loadedImg && loadedImg.complete && loadedImg.naturalHeight > 0){
                requestAnimationFrame(refreshGeometry);
            } else if(loadedImg) {
                loadedImg.onload = () => refreshGeometryAfterLayout();
            }
        } else {
        body.innerHTML = `<div class="blank-image"><i data-lucide="image-plus" class="w-7 h-7"></i><div class="text-[11px] font-bold">${tr('canvas.clickDragPasteImage')}</div></div>`;
            const blank = body.querySelector('.blank-image');
            blank.onclick = () => pickImageForNode(node.id);
            blank.ondragover = e => { if(hasImageDropData(e.dataTransfer) || hasOutputImageDrag(e.dataTransfer)){ e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = hasOutputImageDrag(e.dataTransfer) ? 'copy' : 'move'; blank.classList.add('drag-over'); dropOverlay.classList.remove('active'); } };
            blank.ondragleave = e => { e.stopPropagation(); blank.classList.remove('drag-over'); };
            blank.ondrop = e => {
                if(hasOutputImageDrag(e.dataTransfer)){
                    e.preventDefault();
                    e.stopPropagation();
                    blank.classList.remove('drag-over');
                    dropOverlay.classList.remove('active');
                    setImageNodeFromOutput(node.id, e.dataTransfer.getData('application/x-canvas-output-image'));
                } else if(hasImageFiles(e.dataTransfer?.items)){
                    e.preventDefault();
                    e.stopPropagation();
                    blank.classList.remove('drag-over');
                    dropOverlay.classList.remove('active');
                    fillImageNode(node.id, e.dataTransfer.files);
                } else {
                    const droppedUrl = imageUrlFromDataTransfer(e.dataTransfer);
                    if(droppedUrl){
                        e.preventDefault();
                        e.stopPropagation();
                        blank.classList.remove('drag-over');
                        dropOverlay.classList.remove('active');
                        node.url = droppedUrl;
                        node.name = outputImageName(droppedUrl);
                        render();
                        scheduleSave();
                    }
                }
            };
        }
    }
    if(node.type === 'prompt') {
        body.innerHTML = `<div class="prompt-editor"><textarea placeholder="${tr('canvas.promptPlaceholder')}">${escapeHtml(node.text || '')}</textarea>${promptCounterHtml(node.text || '')}</div>`;
        const textarea = body.querySelector('textarea');
        bindScrollableText(textarea);
        textarea.addEventListener('keydown', e => {
            if((e.ctrlKey || e.metaKey) && !e.altKey){
                if(e.key === '=' || e.key === '+' || e.key === '-' || e.key === '0'){
                    e.preventDefault();
                    e.returnValue = false;
                }
            }
        });
        textarea.oninput = e => {
            node.text = e.target.value;
            refreshPromptCounter(body, node.text);
            scheduleSave();
            syncGeneratorInputs();
            refreshGeneratorInputViews();
        };
    }
    if(node.type === 'loop') body.appendChild(renderLoopBody(node));
    if(node.type === 'group') {
        const items = (node.items || []).map(id => nodes.find(n => n.id === id)).filter(Boolean);
        const imgCount = items.filter(n => n.type === 'image').length;
        const promptCount = items.filter(n => n.type === 'prompt').length;
        const parts = [];
        if(imgCount) parts.push(`${imgCount} ${tr('canvas.imageCount')}`);
        if(promptCount) parts.push(`${promptCount} ${tr('canvas.promptCount')}`);
        const text = parts.length ? `${parts.join(' · ')} ${tr('canvas.grouped')}` : tr('canvas.groupEmpty');
        body.innerHTML = `<div class="text-[11px] text-gray-400">${text}</div>`;
    }
    if(node.type === 'promptGroup') {
        const promptNodes = (node.items || []).map(id => nodes.find(n => n.id === id)).filter(Boolean);
        body.innerHTML = `<div class="text-[11px] text-gray-400">${promptNodes.length} ${tr('canvas.promptCount')} ${tr('canvas.grouped')}</div>`;
    }
    if(node.type === 'llm') body.appendChild(renderLLMBody(node));
    if(node.type === 'generator') body.appendChild(renderGeneratorBody(node));
    if(node.type === 'video') body.appendChild(renderVideoBody(node));
    if(node.type === 'output') {
        const pendingHtml = (node._pending || []).map(p =>
            `<div class="output-img-wrap loading-wrap" data-pending-id="${escapeAttr(p.id)}"><span class="output-time-pill running">${formatRunDuration(nowMs() - Number(p.startedAt || nowMs()))}</span><div class="output-spinner"></div><button class="output-del" title="${tr('common.delete')}">×</button></div>`
        ).join('');
        body.innerHTML = renderOutputGrid(node, pendingHtml);
        body.onwheel = handleOutputBodyWheel;
        body.querySelectorAll('.output-img-wrap').forEach(wrap => bindOutputWrap(wrap, node));
    }
    el.appendChild(body);
    el.querySelectorAll('button, select, textarea, input').forEach(control => {
        control.addEventListener('mousedown', e => e.stopPropagation());
        control.addEventListener('click', e => e.stopPropagation());
    });
    el.onmousedown = e => {
        if(e.button !== 0 || !isNodeDragSurface(e.target)) return;
        startNodeDrag(e, node);
    };
    const canInput = ['generator','output','llm','video'].includes(node.type) || (node.type === 'loop' && (node.imageInput || node.showPrompt));
    const canOutput = ['image','prompt','loop','group','promptGroup','generator','llm','video'].includes(node.type);
    if(canInput) el.insertAdjacentHTML('beforeend', `<div class="port in" title="${tr('canvas.connectHere')}"></div>`);
    if(canOutput) el.insertAdjacentHTML('beforeend', `<div class="port out" title="${tr('canvas.dragConnect')}"></div>`);
    el.insertAdjacentHTML('beforeend', `<div class="resize-handle" title="${tr('canvas.resize')}"></div>`);
    el.querySelector('.node-head').onmousedown = e => { if(e.button === 0 && !spacePan) startNodeDrag(e, node); };
    el.querySelector('.resize-handle').onmousedown = e => { if(e.button === 0 && !isKnifeKey(e)) startNodeResize(e, node); };
    el.ondragstart = e => {
        // 输出节点图片拖动时，不阻止默认行为
        if(e.target.tagName === 'IMG' && e.target.dataset.url) return;
        e.preventDefault();
        e.stopPropagation();
    };
    const out = el.querySelector('.port.out');
    if(out) out.onmousedown = e => { if(e.button === 0 && !isKnifeKey(e)) startLink(e, node.id, 'out'); };
    const inp = el.querySelector('.port.in');
    if(inp) inp.onmousedown = e => { if(e.button === 0 && !isKnifeKey(e)) startLink(e, node.id, 'in'); };
    return el;
}
function bindOutputWrap(wrap, node){
    const img = wrap.querySelector('img');
    const video = wrap.querySelector('video');
    const del = wrap.querySelector('.output-del');
    if(img){
        img.draggable = true;
        img.ondragstart = e => {
            e.stopPropagation();
            img.dataset.dragging = '1';
            setOutputDragPreview(e, img);
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('application/x-canvas-output-image', img.dataset.url);
            e.dataTransfer.setData('text/uri-list', img.dataset.url);
        };
        img.ondragend = () => setTimeout(() => { delete img.dataset.dragging; }, 0);
        img.onclick = e => {
            e.stopPropagation();
            if(img.dataset.dragging) return;
            openOutputLightbox(img.dataset.url, node);
        };
    }
    if(video){
        video.onclick = e => {
            e.stopPropagation();
            openOutputLightbox(video.dataset.url, node);
        };
    }
    if(del){
        del.onmousedown = e => e.stopPropagation();
        del.onclick = e => {
            e.stopPropagation();
            const pid = wrap.dataset.pendingId;
            if(pid){
                node._pending = (node._pending || []).filter(p => p.id !== pid);
            } else {
                const url = img?.dataset.url || video?.dataset.url || wrap.dataset.outputUrl || wrap.dataset.missingUrl || '';
                node.images = (node.images || []).filter(item => outputUrlValue(item) !== url);
                if(node.imageComparisons) delete node.imageComparisons[url];
                scheduleSave();
            }
            refreshNodes([node.id]);
        };
    }
}
function outputDomKeyForItem(item){
    return `url:${outputUrlValue(item)}`;
}
function outputDomKeyForPending(pending){
    return `pending:${pending?.id || ''}`;
}
function handleOutputBodyWheel(e){
    // Shift 按住 → 不缩放
    if(e.shiftKey) { e.stopPropagation(); return; }
    // Ctrl/Alt 按住 → 缩放
    if(e.ctrlKey || e.metaKey || e.altKey){
        e.preventDefault();
        e.stopPropagation();
        applyWheelZoom(e);
    } else {
        e.stopPropagation();
    }
}
function refreshOutputNodeContent(node){
    const el = nodesEl.querySelector(`.output-node[data-id="${CSS.escape(node.id)}"]`);
    const body = el?.querySelector('.node-body');
    const grid = body?.querySelector('.output-grid');
    if(!body || !grid) return false;
    const layout = outputGridLayout(node);
    grid.classList.toggle('grid-layout', !!layout);
    if(layout) grid.style.setProperty('--grid-cols', String(Math.max(1, Number(layout.cols || 1))));
    else grid.style.removeProperty('--grid-cols');
    const items = [
        ...(node.images || []).map(item => ({
            key:outputDomKeyForItem(item),
            html:renderOutputMedia(item, !!layout)
        })),
        ...(node._pending || []).map(p => ({
            key:outputDomKeyForPending(p),
            html:`<div class="output-img-wrap loading-wrap" data-pending-id="${escapeAttr(p.id)}"><span class="output-time-pill running">${formatRunDuration(nowMs() - Number(p.startedAt || nowMs()))}</span><div class="output-spinner"></div><button class="output-del" title="${tr('common.delete')}">×</button></div>`
        }))
    ];
    const wanted = new Set(items.map(item => item.key));
    [...grid.children].forEach(child => {
        const key = child.dataset.pendingId ? outputDomKeyForPending({id:child.dataset.pendingId}) : `url:${child.dataset.outputUrl || child.dataset.missingUrl || child.querySelector('img,video')?.dataset.url || ''}`;
        if(!wanted.has(key)) child.remove();
        else child.dataset.outputKey = key;
    });
    items.forEach(item => {
        let child = [...grid.children].find(el => el.dataset.outputKey === item.key);
        if(!child){
            grid.insertAdjacentHTML('beforeend', item.html);
            child = grid.lastElementChild;
            child.dataset.outputKey = item.key;
            bindOutputWrap(child, node);
        }
        grid.appendChild(child);
    });
    refreshOutputTimer();
    return true;
}
function defaultNodeSize(type){
    if(type === 'image') return {w:260, h:336};
    if(type === 'prompt') return {w:310, h:0};
    if(type === 'loop') return {w:336, h:0};
    if(type === 'llm') return {w:420, h:590};
    if(type === 'generator') return {w:380, h:0};
    if(type === 'video') return {w:400, h:0};
    if(type === 'output') return {w:460, h:0};
    return {w:260, h:0};
}
function loopCount(node){
    return Math.max(1, Math.min(100, Number(node?.count || 1) || 1));
}
function splitPromptIntoItems(text){
    const trimmed = String(text || '').trim();
    if(!trimmed) return [];
    const numbered = trimmed.split(/\s*(?:^|\s)\d+\s*[.、)）．]\s+/).map(s => s.trim()).filter(Boolean);
    if(numbered.length >= 2) return numbered;
    const lines = trimmed.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
    if(lines.length >= 2) return lines;
    return [trimmed];
}
const loopPromptVisiting = new Set();
function loopInputPromptItems(node){
    if(!node?.showPrompt) return [];
    if(loopPromptVisiting.has(node.id)) return [];
    loopPromptVisiting.add(node.id);
    try {
        const items = [];
        connections.filter(c => c.to === node.id)
            .map(c => nodes.find(n => n.id === c.from))
            .filter(Boolean)
            .forEach(n => {
                let text = '';
                if(n.type === 'prompt') text = n.text || '';
                else if(n.type === 'promptGroup') {
                    const parts = (n.items || []).map(id => nodes.find(x => x.id === id)).filter(Boolean).map(p => p.text || '').filter(Boolean);
                    parts.forEach(part => splitPromptIntoItems(part).forEach(item => items.push(item)));
                    return;
                }
                else if(n.type === 'loop') text = renderLoopPrompt(n);
                else if(n.type === 'llm') text = n.outputText || '';
                splitPromptIntoItems(text).forEach(item => items.push(item));
            });
        return items;
    } finally {
        loopPromptVisiting.delete(node.id);
    }
}
function loopInputPrompt(node, ctx=loopContext){
    const items = loopInputPromptItems(node);
    if(!items.length) return '';
    const startBase = Math.max(1, Number(node?.loopStart) || 1);
    const currentIndex = Math.max(1, Number(ctx?.index || startBase) || startBase);
    return items[(currentIndex - 1) % items.length];
}
function renderLoopPrompt(node, ctx=loopContext){
    if(!node?.showPrompt) return '';
    const variable = String(node?.variablePrompt || '').trim();
    const count = loopCount(node);
    const index = Math.max(1, Number(ctx?.index || 1) || 1);
    const total = Math.max(1, Number(ctx?.total || count) || count);
    const replaceVars = text => String(text || '')
        .replaceAll('《计数》', String(index))
        .replaceAll('《总数》', String(total))
        .replaceAll('《进度》', `${index}/${total}`)
        .replaceAll(`[${tr('canvas.counterToken')}]`, String(index))
        .replaceAll(`[${tr('canvas.totalToken')}]`, String(total))
        .replaceAll(`[${tr('canvas.progressToken')}]`, `${index}/${total}`);
    const selected = loopInputPrompt(node, ctx);
    if(selected) return replaceVars(selected);
    return replaceVars(variable);
}
function imageRefsFromNode(node){
    if(!node) return [];
    if(node.type === 'image' && node.url) return [{url:node.url, name:node.name || 'image', role:node.role || ''}];
    if(node.type === 'group'){
        return (node.items || [])
            .map(id => nodes.find(x => x.id === id))
            .filter(x => x?.type === 'image' && x?.url)
            .map(img => ({url:img.url, name:img.name || 'image', role:img.role || ''}));
    }
    if(node.type === 'output'){
        return (node.images || [])
            .map(outputUrlValue)
            .filter(url => url && !isVideoUrl(url))
            .map((url, i) => ({url, name:outputImageName(url) || `output-${i + 1}.png`}));
    }
    if(CANVAS_IMAGE_OUTPUT_TYPES.includes(node.type)) return generatedImageRefs(node);
    return [];
}
function loopInputImageRefs(node, ctx=loopContext){
    if(!node?.imageInput) return [];
    const allRefs = connections
        .filter(c => c.to === node.id)
        .flatMap(c => imageRefsFromNode(nodes.find(n => n.id === c.from)))
        .filter(ref => ref?.url);
    if(!allRefs.length) return [];
    const startBase = Math.max(1, Number(node.loopStart) || 1);
    const batchSize = Math.max(1, Math.min(100, Number(node.imageBatchSize) || 1));
    const currentIndex = Math.max(1, Number(ctx?.index || startBase) || startBase);
    const start = Math.max(0, currentIndex - 1);
    return allRefs.slice(start, start + batchSize);
}
function loopTokenLabel(token){
    if(token === '《计数》') return tr('canvas.counterToken');
    if(token === '《总数》') return tr('canvas.totalToken');
    if(token === '《进度》') return tr('canvas.progressToken');
    return token;
}
function autoSizeLoopNode(node, opening){
    if(!node) return;
    if(opening){
        node.w = Math.max(Number(node.w || 0), 336);
        node.h = Math.max(Number(node.h || 0), 360);
    } else {
        node.w = Math.min(Number(node.w || 336), 336);
        delete node.h;
    }
}
function autoSizeLoopForPanels(node){
    if(!node) return;
    node.w = Math.max(Number(node.w || 0), 336);
    if(node.showPrompt && node.imageInput) node.h = 390;
    else if(node.showPrompt) node.h = 330;
    else if(node.imageInput) node.h = 320;
    else delete node.h;
}
function loopTokenChipHtml(token){
    return `<span class="loop-token-chip" contenteditable="false" data-token="${escapeAttr(token)}"><span>${escapeHtml(loopTokenLabel(token))}</span><button type="button" aria-label="${tr('common.delete')}" title="${tr('common.delete')}">×</button></span>`;
}
function loopVariableHtml(text){
    const token = '《计数》';
    return String(text || '').split(token).map((part, i) => `${i ? loopTokenChipHtml(token) : ''}${escapeHtml(part)}`).join('');
}
function loopEditorText(editor){
    const walk = node => {
        if(node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
        if(node.nodeType !== Node.ELEMENT_NODE) return '';
        if(node.classList?.contains('loop-token-chip')) return node.dataset.token || '';
        if(node.tagName === 'BR') return '\n';
        return [...node.childNodes].map(walk).join('');
    };
    return [...(editor?.childNodes || [])].map(walk).join('').replace(/\u00a0/g, ' ');
}
function insertLoopToken(editor, token){
    if(!editor) return;
    editor.focus();
    const chipWrap = document.createElement('span');
    chipWrap.innerHTML = loopTokenChipHtml(token);
    const chip = chipWrap.firstElementChild;
    const spacer = document.createTextNode(' ');
    const sel = window.getSelection();
    if(sel && sel.rangeCount && editor.contains(sel.anchorNode)){
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(spacer);
        range.insertNode(chip);
        range.setStartAfter(spacer);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        editor.appendChild(chip);
        editor.appendChild(spacer);
    }
}
function promptTextLength(text){
    return Array.from(String(text || '')).length;
}
function promptCounterHtml(text){
    const count = promptTextLength(text);
    const over = count > PROMPT_TEXT_MAX_LENGTH;
    return `<div class="prompt-counter ${over ? 'over' : ''}"><span>${count.toLocaleString()}</span><span>/ ${PROMPT_TEXT_MAX_LENGTH.toLocaleString()}</span></div>`;
}
function refreshPromptCounter(container, text){
    const counter = container?.querySelector('.prompt-counter');
    if(!counter) return;
    const count = promptTextLength(text);
    counter.classList.toggle('over', count > PROMPT_TEXT_MAX_LENGTH);
    counter.innerHTML = `<span>${count.toLocaleString()}</span><span>/ ${PROMPT_TEXT_MAX_LENGTH.toLocaleString()}</span>`;
}
function renderLoopBody(node){
    const wrap = document.createElement('div');
    wrap.className = 'loop-body';
    node.count = loopCount(node);
    node.loopStart = Math.max(1, Number(node.loopStart) || 1);
    node.imageBatchSize = Math.max(1, Math.min(100, Number(node.imageBatchSize) || 1));
    node.mode = node.mode === 'parallel' ? 'parallel' : 'serial';
    node.showPrompt = Boolean(node.showPrompt);
    node.imageInput = Boolean(node.imageInput);
    const imageInputCount = loopInputImageRefs(node, {index:node.loopStart}).length;
    const promptItemCount = node.showPrompt ? loopInputPromptItems(node).length : 0;
    const hasUpstreamPrompt = promptItemCount > 0;
    const loopTargetId = findLoopCascadeTarget(node.id);
    const loopTargetOrder = loopTargetId ? computeCascadeOrder(loopTargetId) : [];
    const loopRunHtml = loopTargetId ? (cascadeSerialIds.has(loopTargetId)
        ? `<div class="gen-run-row"><button class="gen-cascade-btn gen-cascade-stop" type="button" data-loop-cascade-stop="${loopTargetId}" ${cascadeStopIds.has(loopTargetId) ? 'disabled' : ''}><i data-lucide="square" class="w-4 h-4"></i><span>${cascadeStopIds.has(loopTargetId) ? '停止中…' : '停止循环'}</span></button></div>`
        : `<div class="gen-run-row"><button class="gen-cascade-btn" type="button" data-loop-cascade="${loopTargetId}" title="从当前循环节点启动整条工作流"><i data-lucide="play-circle" class="w-4 h-4"></i><span>开始 ${loopTargetOrder.length || 1} 个节点 × ${node.count} ${tr('canvas.loopRounds')}</span></button></div>`)
        : '';
    wrap.innerHTML = `
        <div class="loop-count-row">
            <div class="loop-run-row">
                <div class="loop-count-group">
                    <span class="loop-count-label">${tr('canvas.loopCount')}</span>
                    <input class="loop-count-input" type="number" min="1" max="100" step="1" value="${node.count}">
                </div>
                <div class="seg loop-mode">
                    <button type="button" data-loop-mode="serial" class="${node.mode !== 'parallel' ? 'active' : ''}">${tr('canvas.loopSerial')}</button>
                    <button type="button" data-loop-mode="parallel" class="${node.mode === 'parallel' ? 'active' : ''}">${tr('canvas.loopParallel')}</button>
                </div>
            </div>
            <div class="loop-toggle-row">
                <button class="loop-toggle loop-image-toggle ${node.imageInput ? 'active' : ''}" type="button"><i data-lucide="image" class="w-3.5 h-3.5"></i>${tr('canvas.loopImageToggle')}</button>
                <button class="loop-toggle loop-prompt-toggle ${node.showPrompt ? 'active' : ''}" type="button"><i data-lucide="text-cursor-input" class="w-3.5 h-3.5"></i>${tr('canvas.loopPromptToggle')}</button>
            </div>
        </div>
        ${node.imageInput ? `<div class="loop-image-panel">
            <div class="loop-image-row">
                <span class="loop-count-label">${tr('canvas.loopImageStart')}</span>
                <input class="loop-count-input loop-image-start-input" type="number" min="1" max="9999" step="1" value="${node.loopStart}">
                <span class="loop-count-label">${tr('canvas.loopBatchSize')}</span>
                <input class="loop-count-input loop-batch-input" type="number" min="1" max="100" step="1" value="${node.imageBatchSize}">
            </div>
            <div class="loop-image-hint">${imageInputCount ? trf('canvas.loopImageWillOutput', {n:imageInputCount}) : tr('canvas.loopImageEmpty')}</div>
        </div>` : ''}
        ${node.showPrompt ? `<div class="loop-prompt-panel ${hasUpstreamPrompt ? 'has-upstream' : ''}">
            <div class="loop-field">
                <div class="loop-variable-editor ${hasUpstreamPrompt ? 'is-disabled' : ''}" contenteditable="${hasUpstreamPrompt ? 'false' : 'true'}" data-placeholder="${escapeAttr(tr('canvas.loopVariablePlaceholder'))}">${loopVariableHtml(node.variablePrompt || '')}</div>
            </div>
            ${hasUpstreamPrompt ? `<div class="loop-prompt-hint">已识别 ${promptItemCount} 条提示词，按计数轮流输出</div>` : ''}
            <div class="loop-start-row">
                <button class="loop-token-btn loop-counter-token-btn" type="button" data-token="《计数》">${tr('canvas.counterToken')}</button>
                <span class="loop-count-label">${tr('canvas.loopStart')}</span>
                <input class="loop-count-input loop-start-input" type="number" min="1" max="9999" step="1" value="${node.loopStart}">
            </div>
        </div>` : ''}
        ${loopRunHtml}
    `;
    const countInput = wrap.querySelector('.loop-count-input');
    const variable = wrap.querySelector('.loop-variable-editor');
    const toggle = wrap.querySelector('.loop-prompt-toggle');
    const imageToggle = wrap.querySelector('.loop-image-toggle');
    if(variable) {
        variable.onmousedown = e => e.stopPropagation();
        variable.onclick = e => e.stopPropagation();
        variable.onwheel = e => e.stopPropagation();
    }
    const refreshPreview = () => {
        const preview = wrap.querySelector('.loop-preview:last-child');
        if(preview) preview.textContent = renderLoopPrompt(node, {index:1, total:loopCount(node)}) || tr('canvas.noPromptMeta');
    };
    const refreshImageHint = () => {
        const hint = wrap.querySelector('.loop-image-hint');
        if(!hint) return;
        const count = loopInputImageRefs(node, {index:node.loopStart}).length;
        hint.textContent = count ? trf('canvas.loopImageWillOutput', {n:count}) : tr('canvas.loopImageEmpty');
    };
    countInput.oninput = e => {
        node.count = loopCount({count:e.target.value});
        e.target.value = node.count;
        refreshPreview();
        /* 同步底部级联按钮上的轮数文字，避免输入循环次数后下游"× N 轮"残留旧值
           不直接 render() 是为了不破坏当前正在输入的 input 焦点 */
        const loopCascadeBtn = wrap.querySelector('[data-loop-cascade]');
        if(loopCascadeBtn){
            const span = loopCascadeBtn.querySelector('span');
            if(span) span.textContent = `开始 ${loopTargetOrder.length || 1} 个节点 × ${node.count} ${tr('canvas.loopRounds')}`;
        }
        if(loopTargetId){
            const targetEl = document.querySelector(`.node[data-id="${loopTargetId}"]`);
            const targetCascadeBtn = targetEl?.querySelector('[data-cascade]');
            if(targetCascadeBtn){
                const span = targetCascadeBtn.querySelector('span');
                if(span){
                    const targetOrder = computeCascadeOrder(loopTargetId);
                    span.textContent = `一键运行 ${targetOrder.length} 个节点 × ${node.count} ${tr('canvas.loopRounds')}`;
                }
            }
        }
        scheduleSave();
    };
    const startInput = wrap.querySelector('.loop-start-input');
    if(startInput){
        startInput.onmousedown = e => e.stopPropagation();
        startInput.onclick = e => e.stopPropagation();
        startInput.oninput = e => {
            node.loopStart = Math.max(1, Number(e.target.value) || 1);
            refreshImageHint();
            scheduleSave();
            syncGeneratorInputs();
            refreshGeneratorInputViews();
        };
    }
    const imageStartInput = wrap.querySelector('.loop-image-start-input');
    if(imageStartInput){
        imageStartInput.onmousedown = e => e.stopPropagation();
        imageStartInput.onclick = e => e.stopPropagation();
        imageStartInput.oninput = e => {
            node.loopStart = Math.max(1, Number(e.target.value) || 1);
            refreshImageHint();
            scheduleSave();
            syncGeneratorInputs();
            refreshGeneratorInputViews();
        };
    }
    const batchInput = wrap.querySelector('.loop-batch-input');
    if(batchInput){
        batchInput.onmousedown = e => e.stopPropagation();
        batchInput.onclick = e => e.stopPropagation();
        batchInput.oninput = e => {
            node.imageBatchSize = Math.max(1, Math.min(100, Number(e.target.value) || 1));
            e.target.value = node.imageBatchSize;
            refreshImageHint();
            scheduleSave();
            syncGeneratorInputs();
            refreshGeneratorInputViews();
        };
    }
    wrap.querySelectorAll('[data-loop-mode]').forEach(btn => {
        btn.onclick = e => {
            e.stopPropagation();
            node.mode = btn.dataset.loopMode === 'parallel' ? 'parallel' : 'serial';
            render();
            scheduleSave();
        };
    });
    toggle.onclick = e => {
        e.stopPropagation();
        const opening = !node.showPrompt;
        node.showPrompt = opening;
        autoSizeLoopNode(node, opening);
        autoSizeLoopForPanels(node);
        if(!opening){
            connections = connections.filter(c => c.to !== node.id || canConnect(c.from, node.id));
        }
        render();
        scheduleSave();
        syncGeneratorInputs();
        refreshGeneratorInputViews();
    };
    if(variable) {
        variable.oninput = e => {
            node.variablePrompt = loopEditorText(variable);
            refreshPreview();
            scheduleSave();
            syncGeneratorInputs();
            refreshGeneratorInputViews();
        };
        variable.addEventListener('click', e => {
            const btn = e.target.closest('.loop-token-chip button');
            if(!btn) return;
            e.preventDefault();
            e.stopPropagation();
            btn.closest('.loop-token-chip')?.remove();
            node.variablePrompt = loopEditorText(variable);
            refreshPreview();
            scheduleSave();
            syncGeneratorInputs();
            refreshGeneratorInputViews();
        });
    }
    wrap.querySelectorAll('[data-token]').forEach(btn => {
        btn.onclick = e => {
            e.stopPropagation();
            const token = btn.dataset.token || '';
            if(!variable) return;
            insertLoopToken(variable, token);
            node.variablePrompt = loopEditorText(variable);
            variable.focus();
            refreshPreview();
            scheduleSave();
            syncGeneratorInputs();
            refreshGeneratorInputViews();
        };
    });
    if(imageToggle){
        imageToggle.onclick = e => {
            e.stopPropagation();
            node.imageInput = !node.imageInput;
            if(node.imageInput){
                node.loopStart = Math.max(1, Number(node.loopStart) || 1);
                node.imageBatchSize = Math.max(1, Math.min(100, Number(node.imageBatchSize) || 1));
            } else {
                connections = connections.filter(c => c.to !== node.id || canConnect(c.from, node.id));
            }
            autoSizeLoopForPanels(node);
            render();
            scheduleSave();
            syncGeneratorInputs();
            refreshGeneratorInputViews();
        };
    }
    wrap.querySelectorAll('[data-loop-cascade]').forEach(btn => {
        btn.onmousedown = e => e.stopPropagation();
        btn.onclick = e => {
            e.stopPropagation();
            runNodeCascade(btn.dataset.loopCascade);
        };
    });
    wrap.querySelectorAll('[data-loop-cascade-stop]').forEach(btn => {
        btn.onmousedown = e => e.stopPropagation();
        btn.onclick = e => {
            e.stopPropagation();
            requestCascadeStop(btn.dataset.loopCascadeStop);
        };
    });
    return wrap;
}
function renderLLMBody(node){
    const wrap = document.createElement('div');
    wrap.className = 'llm-body';
    const mode = node.mode || 'node';
    node.llmProvider = resolveChatProviderId(node.llmProvider || 'comfly');
    const llmProv = node.llmProvider;
    if(!providerChatModels(llmProv).includes(node.model)) node.model = providerChatModels(llmProv)[0] || node.model;
    const modelOpts = chatModelOptions(node.model, llmProv);
    const imgs = llmInputImages(node);
    const imgBadge = imgs.length ? `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;background:rgba(16,185,129,.12);color:#047857;font-size:10.5px;font-weight:700;width:fit-content;line-height:1.4"><i data-lucide="image" class="w-3 h-3"></i>已连接 ${imgs.length} 张图片 · 需选 VL 视觉模型（如 Qwen2.5-VL）</div>` : '';
    node.showSystem = Boolean(node.showSystem);
    wrap.innerHTML = `
        <div class="llm-row">
            <select class="select-lite llm-provider-select" style="flex:1">${chatProviderOptions(llmProv)}</select>
            <select class="select-lite llm-model">${modelOpts}</select>
            <div class="llm-mode"><button data-mode="node">${tr('canvas.nodeMode')}</button><button data-mode="chat">${tr('canvas.chatMode')}</button></div>
            <button class="llm-sys-toggle ${node.showSystem ? 'active' : ''}" type="button">System</button>
        </div>
        ${imgBadge}
        ${node.showSystem ? `<textarea class="llm-system" placeholder="${tr('canvas.systemPrompt')}">${escapeHtml(node.systemPrompt || '')}</textarea>` : ''}
        <div class="llm-node-pane"></div>
        <div class="llm-chat-pane"></div>
    `;
    const providerSelect = wrap.querySelector('.llm-provider-select');
    const modelSelect = wrap.querySelector('.llm-model');
    providerSelect.value = llmProv;
    modelSelect.value = resolveChatModel(node.model, llmProv);
    [providerSelect, modelSelect].forEach(input => {
        input.onmousedown = e => e.stopPropagation();
        input.onclick = e => e.stopPropagation();
    });
    providerSelect.onchange = e => {
        e.stopPropagation();
        node.llmProvider = e.target.value;
        const models = providerChatModels(node.llmProvider);
        node.model = models[0] || '';
        render();
        scheduleSave();
    };
    modelSelect.onchange = e => {
        e.stopPropagation();
        node.model = e.target.value;
        scheduleSave();
    };
    wrap.querySelector('.llm-sys-toggle').onclick = e => { e.stopPropagation(); node.showSystem = !node.showSystem; render(); scheduleSave(); };
    const sysEl = wrap.querySelector('.llm-system');
    if(sysEl){ sysEl.oninput = e => { node.systemPrompt = e.target.value; scheduleSave(); }; bindScrollableText(sysEl); }
    wrap.querySelectorAll('[data-mode]').forEach(btn => {
        btn.classList.toggle('active', mode === btn.dataset.mode);
        btn.onclick = e => { e.stopPropagation(); node.mode = btn.dataset.mode; render(); scheduleSave(); };
    });
    const nodePane = wrap.querySelector('.llm-node-pane');
    const chatPane = wrap.querySelector('.llm-chat-pane');
    if(mode === 'chat'){
        nodePane.style.display = 'none';
        renderLLMChatPane(chatPane, node);
    } else {
        chatPane.style.display = 'none';
        renderLLMNodePane(nodePane, node);
    }
    return wrap;
}
function renderLLMNodePane(container, node){
    const connectedInput = llmInputText(node);
    const isReadonly = connectedInput.length > 0;
    const inputValue = connectedInput || node.userInput || '';
    const inputHeight = Math.max(70, node.llmInputHeight || 110);
    const outputHeight = Math.max(70, node.llmOutputHeight || 150);
    const inputPlaceholder = '直接输入，或连接提示词节点…';
    container.innerHTML = `
        <div class="llm-pane-label">Input${isReadonly ? ' <span style="font-size:9px;opacity:.5;font-weight:600;text-transform:none;letter-spacing:0">(来自连接)</span>' : ''}</div>
        <textarea class="llm-input-area llm-input-output" style="height:${inputHeight}px; flex:0 0 ${inputHeight}px;" ${isReadonly ? 'readonly' : ''} placeholder="${inputPlaceholder}">${escapeHtml(inputValue)}</textarea>
        <div class="llm-pane-resizer" title="${tr('canvas.resizePanes')}"></div>
        <div class="llm-pane-label">Output</div>
        <div class="llm-output-wrap" style="height:${outputHeight}px; flex:0 0 ${outputHeight}px;">
            <button class="llm-copy-btn llm-output-copy" type="button" title="复制"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
            <div class="llm-output llm-result-output">${escapeHtml(node.outputText || tr('canvas.llmOutputEmpty'))}</div>
        </div>
        <div class="gen-run-row mt-2">
            <button class="llm-run ${node.running ? 'running' : ''}" ${node.running ? 'disabled' : ''}><i data-lucide="play" class="w-4 h-4"></i>${node.running ? tr('canvas.running') : 'Run LLM'}</button>
            ${cascadeBtnHtml(node)}
        </div>
        ${retryBarHtml(node)}
    `;
    const inputEl = container.querySelector('.llm-input-output');
    bindScrollableText(inputEl);
    if(!isReadonly){
        inputEl.oninput = e => { node.userInput = e.target.value; };
    }
    bindScrollableText(container.querySelector('.llm-result-output'));
    container.querySelector('.llm-pane-resizer').onmousedown = e => startLLMPaneResize(e, node);
    container.querySelector('.llm-run').onclick = e => { e.stopPropagation(); runLLMNode(node.id); };
    bindCascadeButtons(container, node.id);
    const copyBtn = container.querySelector('.llm-output-copy');
    if(copyBtn){
        copyBtn.onmousedown = e => e.stopPropagation();
        copyBtn.onclick = async e => {
            e.stopPropagation();
            const text = node.outputText || '';
            if(!text) return;
            if(await copyTextToClipboard(text)){
                copyBtn.classList.add('copied');
                setTimeout(() => copyBtn.classList.remove('copied'), 1500);
            }
        };
    }
}
function renderLLMChatPane(container, node){
    const messages = node.messages || [];
    container.innerHTML = `
        <div class="llm-chat-log">${messages.length ? messages.map((msg, mi) => `<div class="llm-bubble ${msg.role === 'user' ? 'user' : 'assistant'}" data-msg-idx="${mi}">${escapeHtml(msg.content || '')}${msg.role === 'assistant' ? `<button class="llm-bubble-copy" type="button" title="复制"><i data-lucide="copy" style="width:11px;height:11px;display:inline-block;vertical-align:middle"></i></button>` : ''}</div>`).join('') : `<div class="text-[11px] text-gray-300">${tr('canvas.startChat')}</div>`}</div>
        <textarea class="llm-chat-input mt-2" rows="2" placeholder="${tr('canvas.chatInput')}">${escapeHtml(node.chatInput || '')}</textarea>
        <button class="llm-run mt-2" ${node.running ? 'disabled' : ''}><i data-lucide="send" class="w-4 h-4"></i>${node.running ? tr('canvas.sending') : 'Send'}</button>
    `;
    bindScrollableText(container.querySelector('.llm-chat-log'));
    bindScrollableText(container.querySelector('.llm-chat-input'));
    const chatInputEl = container.querySelector('.llm-chat-input');
    chatInputEl.oninput = e => { node.chatInput = e.target.value; scheduleSave(); };
    chatInputEl.onkeydown = e => {
        if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){
            e.preventDefault();
            e.stopPropagation();
            runLLMChat(node.id);
        }
    };
    container.querySelector('.llm-run').onclick = e => { e.stopPropagation(); runLLMChat(node.id); };
    container.querySelectorAll('.llm-bubble-copy').forEach(btn => {
        btn.onmousedown = e => e.stopPropagation();
        btn.onclick = async e => {
            e.stopPropagation();
            const bubble = btn.closest('.llm-bubble');
            const idx = Number(bubble?.dataset.msgIdx);
            const msg = (node.messages || [])[idx];
            if(!msg) return;
            if(await copyTextToClipboard(msg.content || '')){
                btn.classList.add('copied');
                setTimeout(() => btn.classList.remove('copied'), 1500);
            }
        };
    });
}
function bindScrollableText(el){
    if(!el) return;
    const stop = e => e.stopPropagation();
    const beginSelection = e => {
        e.stopPropagation();
        textSelectionGuard = {
            el,
            scrollTop:el.scrollTop || 0,
            scrollLeft:el.scrollLeft || 0,
            clientY:e.clientY,
            wheelUntil:0,
            active:true
        };
    };
    el.addEventListener('mousedown', beginSelection);
    el.addEventListener('mousemove', e => {
        e.stopPropagation();
        if(textSelectionGuard?.el === el) textSelectionGuard.clientY = e.clientY;
    });
    el.addEventListener('mouseup', e => {
        e.stopPropagation();
        if(textSelectionGuard?.el === el) textSelectionGuard.active = false;
    });
    el.addEventListener('mouseleave', e => {
        e.stopPropagation();
        if(textSelectionGuard?.el === el) {
            el.scrollTop = textSelectionGuard.scrollTop;
            el.scrollLeft = textSelectionGuard.scrollLeft;
        }
    });
    el.addEventListener('scroll', () => {
        const guard = textSelectionGuard;
        if(!guard || guard.el !== el || !guard.active || Date.now() < guard.wheelUntil) {
            if(guard?.el === el) {
                guard.scrollTop = el.scrollTop || 0;
                guard.scrollLeft = el.scrollLeft || 0;
            }
            return;
        }
        const nextTop = el.scrollTop || 0;
        const prevTop = guard.scrollTop || 0;
        const rect = el.getBoundingClientRect();
        const pointerBelow = Number.isFinite(guard.clientY) && guard.clientY > rect.bottom - 10;
        const pointerAbove = Number.isFinite(guard.clientY) && guard.clientY < rect.top + 10;
        const jumpedToTop = prevTop > Math.max(80, el.clientHeight * 0.45) && nextTop < 4 && !pointerAbove;
        const wrongDirectionJump = pointerBelow && nextTop < prevTop - Math.max(40, el.clientHeight * 0.25);
        if(jumpedToTop || wrongDirectionJump) {
            requestAnimationFrame(() => {
                if(textSelectionGuard?.el === el && textSelectionGuard.active) {
                    el.scrollTop = prevTop;
                    el.scrollLeft = guard.scrollLeft || 0;
                }
            });
            return;
        }
        guard.scrollTop = nextTop;
        guard.scrollLeft = el.scrollLeft || 0;
    }, {passive:true});
    el.addEventListener('click', stop);
    el.addEventListener('dblclick', stop);
    el.addEventListener('wheel', e => {
        e.stopPropagation();
        // Shift 按住 → 不缩放
        if(e.shiftKey) return;
        // Ctrl/Alt 按住 → 缩放
        if(e.ctrlKey || e.metaKey || e.altKey){
            e.preventDefault();
            applyWheelZoom(e);
        }
        if(textSelectionGuard?.el === el) textSelectionGuard.wheelUntil = Date.now() + 180;
    }, {passive:false});
}
function startLLMPaneResize(e, node){
    e.preventDefault();
    e.stopPropagation();
    llmPaneDrag = {
        node,
        sy:e.clientY,
        inputStart:Math.max(70, node.llmInputHeight || 110),
        outputStart:Math.max(70, node.llmOutputHeight || 150)
    };
    window.onmousemove = onLLMPaneResize;
    window.onmouseup = endDrag;
}
function onLLMPaneResize(e){
    if(!llmPaneDrag) return;
    const total = llmPaneDrag.inputStart + llmPaneDrag.outputStart;
    const delta = (e.clientY - llmPaneDrag.sy) / viewport.scale;
    const minPane = 70;
    const nextInput = Math.max(minPane, Math.min(total - minPane, llmPaneDrag.inputStart + delta));
    const nextOutput = Math.max(minPane, total - nextInput);
    llmPaneDrag.node.llmInputHeight = Math.round(nextInput);
    llmPaneDrag.node.llmOutputHeight = Math.round(nextOutput);
    const el = nodesEl.querySelector(`.node[data-id="${llmPaneDrag.node.id}"]`);
    if(el){
        const inputEl = el.querySelector('.llm-input-output');
        const outputEl = el.querySelector('.llm-result-output');
        if(inputEl){
            inputEl.style.height = `${llmPaneDrag.node.llmInputHeight}px`;
            inputEl.style.flexBasis = `${llmPaneDrag.node.llmInputHeight}px`;
        }
        if(outputEl){
            outputEl.style.height = `${llmPaneDrag.node.llmOutputHeight}px`;
            outputEl.style.flexBasis = `${llmPaneDrag.node.llmOutputHeight}px`;
        }
    }
}
function llmInputText(node){
    return connections.filter(c => c.to === node.id).map(c => nodes.find(n => n.id === c.from)).filter(Boolean).map(n => {
        if(n.type === 'prompt') return n.text || '';
        if(n.type === 'loop') return renderLoopPrompt(n);
        if(n.type === 'promptGroup') return (n.items || []).map(id => nodes.find(x => x.id === id)).filter(Boolean).map(p => p.text || '').filter(Boolean).join('\n\n');
        if(n.type === 'llm') return n.outputText || '';
        return '';
    }).filter(Boolean).join('\n\n');
}
function llmInputImages(node){
    const urls = [];
    connections.filter(c => c.to === node.id).map(c => nodes.find(n => n.id === c.from)).filter(Boolean).forEach(n => {
        if(n.type === 'image' && n.url) urls.push(n.url);
        if(n.type === 'output' && (n.images||[]).length){
            const last = [...n.images].reverse().find(x => typeof x === 'string');
            if(last) urls.push(last);
        }
        if(n.type === 'group'){
            (n.items || []).map(id => nodes.find(x => x.id === id)).filter(x => x?.type === 'image' && x?.url).forEach(img => urls.push(img.url));
        }
    });
    return urls;
}
function renderGeneratorBody(node){
    const wrap = document.createElement('div');
    wrap.className = 'generator-body';
    const inputSources = generatorSources(node);
    const ordered = orderedSources(node, inputSources);
    const imageInputs = ordered.filter(src => src.refs?.length);
    const promptInputs = ordered.filter(src => src.prompt && !src.refs?.length);
    node.apiProvider = resolveImageProviderId(node.apiProvider || '');
    const imageProviderModels = providerImageModels(node.apiProvider);
    if(!imageProviderModels.length) node.model = '';
    else if(!imageProviderModels.includes(resolveImageModel(node.model))) node.model = imageProviderModels[0] || '';
    wrap.innerHTML = `
        <div class="prompt-list mb-3"></div>
        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">${tr('canvas.images')}</div>
        <div class="input-list"></div>
        <div class="gen-settings">
            <div class="gen-settings-row">
                <select class="select-lite provider-select">${providerOptions(node.apiProvider)}</select>
                <select class="select-lite model-select">${imageModelOptions(node.model, node.apiProvider)}</select>
            </div>
            <div class="gen-settings-row api-size-row">
                <select class="select-lite resolution compact-select" data-field="resolution">
                    <option value="1k">1K</option>
                    <option value="2k">2K</option>
                    <option value="4k">4K</option>
                    <option value="custom">${tr('canvas.custom')}</option>
                </select>
                <select class="select-lite ratio compact-select" data-field="ratio">
                    <option value="square">1:1</option>
                    <option value="portrait">2:3</option>
                    <option value="landscape">3:2</option>
                    <option value="portrait43">3:4</option>
                    <option value="landscape43">4:3</option>
                    <option value="story">9:16</option>
                    <option value="wide">16:9</option>
                    <option value="source">${tr('canvas.adaptiveRatio')}</option>
                    <option value="custom">${tr('canvas.custom')}</option>
                </select>
                <select class="select-lite quality-select">
                    <option value="auto">Q auto</option>
                    <option value="low">Q low</option>
                    <option value="medium">Q med</option>
                    <option value="high">Q high</option>
                </select>
                <div class="gen-count-row">
                    <div class="gen-stepper">
                        <button class="gen-step-btn" data-step="-1" type="button" title="${tr('canvas.decrease')}" aria-label="${tr('canvas.decreaseCount')}"><i data-lucide="chevron-left" class="w-3.5 h-3.5"></i></button>
                        <input class="gen-count-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${Math.max(1, Math.min(8, Number(node.count || 1)))}">
                        <button class="gen-step-btn" data-step="1" type="button" title="${tr('canvas.increase')}" aria-label="${tr('canvas.increaseCount')}"><i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>
            </div>
            <div class="gen-settings-row custom-ratio-row" style="display:none">
                <label class="field">
                    <div class="setting-title">${tr('canvas.ratioWidth')}</div>
                    <input class="setting-input custom-ratio-w-input" type="number" min="1" step="1" value="${escapeHtml(node.customRatioWidth || '')}" placeholder="4">
                </label>
                <label class="field">
                    <div class="setting-title">${tr('canvas.ratioHeight')}</div>
                    <input class="setting-input custom-ratio-h-input" type="number" min="1" step="1" value="${escapeHtml(node.customRatioHeight || '')}" placeholder="3">
                </label>
            </div>
            <div class="gen-settings-row custom-size-row" style="display:none">
                <label class="field">
                    <div class="setting-title">${tr('canvas.width')}</div>
                    <input class="setting-input custom-w-input" type="number" min="64" step="64" value="${escapeHtml(node.customWidth || '')}" placeholder="Auto">
                </label>
                <label class="field">
                    <div class="setting-title">${tr('canvas.height')}</div>
                    <input class="setting-input custom-h-input" type="number" min="64" step="64" value="${escapeHtml(node.customHeight || '')}" placeholder="Auto">
                </label>
                <button class="secondary-btn fit-size-btn" type="button" style="height:32px;align-self:flex-end;padding:0 10px;font-size:11px">${tr('canvas.fitImageSize')}</button>
            </div>
        </div>
        <div class="gen-run-row">
            <button class="gen-btn ${node.running ? 'running' : ''}" ${node.running ? 'disabled' : ''}><i data-lucide="zap" class="w-4 h-4"></i>${node.running ? tr('canvas.generating') : tr('canvas.apiGenerate')}</button>
            ${cascadeBtnHtml(node)}
        </div>
        ${retryBarHtml(node)}
    `;
    const providerSelect = wrap.querySelector('.provider-select');
    const modelSelect = wrap.querySelector('.model-select');
    providerSelect.onmousedown = e => e.stopPropagation();
    providerSelect.onclick = e => e.stopPropagation();
    providerSelect.onchange = e => {
        e.stopPropagation();
        node.apiProvider = e.target.value;
        const providerModels = providerImageModels(node.apiProvider);
        if(!providerModels.includes(resolveImageModel(node.model))) node.model = providerModels[0] || '';
        modelSelect.innerHTML = imageModelOptions(node.model, node.apiProvider);
        syncQualityControls();
        scheduleSave();
    };
    modelSelect.onmousedown = e => e.stopPropagation();
    modelSelect.onclick = e => e.stopPropagation();
    modelSelect.onchange = e => {
        e.stopPropagation();
        node.model = e.target.value;
        syncQualityControls();
        scheduleSave();
    };
    const ratioSelect = wrap.querySelector('.ratio');
    const resolutionSelect = wrap.querySelector('.resolution');
    const qualitySelect = wrap.querySelector('.quality-select');
    const customRatioRow = wrap.querySelector('.custom-ratio-row');
    const customSizeRow = wrap.querySelector('.custom-size-row');
    const customRatioWInput = wrap.querySelector('.custom-ratio-w-input');
    const customRatioHInput = wrap.querySelector('.custom-ratio-h-input');
    const customWInput = wrap.querySelector('.custom-w-input');
    const customHInput = wrap.querySelector('.custom-h-input');
    const fitSizeBtn = wrap.querySelector('.fit-size-btn');
    const referenceImages = ordered.flatMap(src => src.refs || []);
    const syncQualityControls = () => {
        qualitySelect.disabled = false;
        if(!['auto','low','medium','high'].includes(String(node.quality || 'auto'))) node.quality = 'auto';
        qualitySelect.value = node.quality || 'auto';
    };
    const hydrateCustomParts = () => {
        if((!node.customRatioWidth || !node.customRatioHeight) && node.customRatio) {
            const raw = String(node.customRatio || '');
            if(raw.includes(':')){
                const [w,h] = raw.split(':');
                node.customRatioWidth = node.customRatioWidth || w;
                node.customRatioHeight = node.customRatioHeight || h;
            }
        }
        if((!node.customWidth || !node.customHeight) && node.customSize) {
            const parsed = parseSizeValue(node.customSize);
            node.customWidth = node.customWidth || parsed?.width || '';
            node.customHeight = node.customHeight || parsed?.height || '';
        }
    };
    hydrateCustomParts();
    let sourceRatioRequest = 0;
    const updateSourceRatioFromFirstRef = async () => {
        if(node.ratio !== 'source') return;
        const ref = referenceImages.find(item => item.url);
        const requestId = ++sourceRatioRequest;
        if(!ref){
            node.customRatio = '';
            node.customRatioWidth = '';
            node.customRatioHeight = '';
            customRatioWInput.value = '';
            customRatioHInput.value = '';
            return;
        }
        try {
            const dims = await getImageDimensions(ref.url);
            if(requestId !== sourceRatioRequest || node.ratio !== 'source') return;
            const parts = ratioPartsFromDimensions(dims.width, dims.height);
            node.customRatioWidth = String(parts.width);
            node.customRatioHeight = String(parts.height);
            node.customRatio = `${parts.width}:${parts.height}`;
            customRatioWInput.value = node.customRatioWidth;
            customRatioHInput.value = node.customRatioHeight;
            scheduleSave();
        } catch(_) {}
    };
    const syncSizeControls = () => {
        normalizeApiNodeSizeChoice(node);
        const squareOption = ratioSelect.querySelector('option[value="square"]');
        if(squareOption){
            squareOption.disabled = node.resolution === '4k';
            squareOption.title = node.resolution === '4k' ? '4K 不支持 1:1' : '';
        }
        const ratioValue = node.ratio && [...ratioSelect.options].some(opt => opt.value === node.ratio) ? node.ratio : 'square';
        ratioSelect.value = ratioValue;
        resolutionSelect.value = node.resolution || '1k';
        ratioSelect.disabled = node.resolution === 'custom';
        customRatioRow.style.display = (node.ratio === 'custom' || node.ratio === 'source') ? 'flex' : 'none';
        customSizeRow.style.display = node.resolution === 'custom' ? 'flex' : 'none';
        customRatioWInput.disabled = node.ratio === 'source';
        customRatioHInput.disabled = node.ratio === 'source';
        customRatioWInput.value = node.customRatioWidth || '';
        customRatioHInput.value = node.customRatioHeight || '';
        customWInput.value = node.customWidth || '';
        customHInput.value = node.customHeight || '';
        if(fitSizeBtn) fitSizeBtn.disabled = !referenceImages.some(ref => ref.url);
        syncQualityControls();
        if(node.ratio === 'source') updateSourceRatioFromFirstRef();
    };
    qualitySelect.onmousedown = e => e.stopPropagation();
    qualitySelect.onclick = e => e.stopPropagation();
    qualitySelect.onchange = e => {
        e.stopPropagation();
        node.quality = e.target.value;
        scheduleSave();
    };
    ratioSelect.onmousedown = e => e.stopPropagation();
    ratioSelect.onclick = e => e.stopPropagation();
    ratioSelect.onchange = e => {
        e.stopPropagation();
        node.ratio = e.target.value;
        normalizeApiNodeSizeChoice(node);
        if(node.ratio !== 'custom' && node.ratio !== 'source') {
            node.customRatio = '';
            node.customRatioWidth = '';
            node.customRatioHeight = '';
        } else if(node.ratio === 'source') {
            node.customRatio = '';
            node.customRatioWidth = '';
            node.customRatioHeight = '';
        }
        syncSizeControls();
        scheduleSave();
    };
    resolutionSelect.onmousedown = e => e.stopPropagation();
    resolutionSelect.onclick = e => e.stopPropagation();
    resolutionSelect.onchange = e => {
        e.stopPropagation();
        node.resolution = e.target.value;
        if(node.resolution === 'custom') {
            node.ratio = '';
        } else if(!node.ratio) {
            node.ratio = 'square';
            node.customSize = '';
            node.customWidth = '';
            node.customHeight = '';
        } else {
            node.customSize = '';
            node.customWidth = '';
            node.customHeight = '';
        }
        normalizeApiNodeSizeChoice(node);
        syncSizeControls();
        scheduleSave();
    };
    [customRatioWInput, customRatioHInput].forEach(input => {
        input.onmousedown = e => e.stopPropagation();
        input.onclick = e => e.stopPropagation();
        input.oninput = e => {
            node.customRatioWidth = customRatioWInput.value;
            node.customRatioHeight = customRatioHInput.value;
            node.customRatio = node.customRatioWidth && node.customRatioHeight ? `${node.customRatioWidth}:${node.customRatioHeight}` : '';
            node.ratio = 'custom';
            syncSizeControls();
            scheduleSave();
        };
    });
    [customWInput, customHInput].forEach(input => {
        input.onmousedown = e => e.stopPropagation();
        input.onclick = e => e.stopPropagation();
        input.oninput = e => {
            node.customWidth = customWInput.value;
            node.customHeight = customHInput.value;
            node.customSize = node.customWidth && node.customHeight ? `${node.customWidth}x${node.customHeight}` : '';
            node.resolution = 'custom';
            node.ratio = '';
            syncSizeControls();
            scheduleSave();
        };
    });
    if(fitSizeBtn){
        fitSizeBtn.onmousedown = e => e.stopPropagation();
        fitSizeBtn.onclick = async e => {
            e.stopPropagation();
            const ref = referenceImages.find(item => item.url);
            if(!ref) return;
            try {
                const dims = await getImageDimensions(ref.url);
                node.customWidth = dims.width;
                node.customHeight = dims.height;
                node.customSize = `${dims.width}x${dims.height}`;
                node.resolution = 'custom';
                node.ratio = '';
                syncSizeControls();
                scheduleSave();
            } catch(err) {
                    showErrorModal(tr('canvas.imageReadFailed'));
            }
        };
    }
    syncSizeControls();
    const countInput = wrap.querySelector('.gen-count-input');
    countInput.onmousedown = e => e.stopPropagation();
    countInput.onclick = e => e.stopPropagation();
    countInput.oninput = e => {
        const value = Math.max(1, Math.min(8, Number(e.target.value) || 1));
        node.count = value;
        scheduleSave();
    };
    countInput.onblur = e => { e.target.value = String(Math.max(1, Math.min(8, Number(node.count || 1)))); };
    wrap.querySelectorAll('[data-step]').forEach(btn => {
        btn.onclick = e => {
            e.stopPropagation();
            const next = Math.max(1, Math.min(8, Number(node.count || 1) + Number(btn.dataset.step || 0)));
            node.count = next;
            countInput.value = String(next);
            scheduleSave();
        };
    });
    const list = wrap.querySelector('.input-list');
    renderImageInputList(list, node, imageInputs);
    renderPromptPreview(wrap.querySelector('.prompt-list'), promptInputs);
    wrap.querySelector('.gen-btn').onclick = e => { e.stopPropagation(); runCanvasGenerate(node.id); };
    bindCascadeButtons(wrap, node.id);
    return wrap;
}
function renderVideoBody(node){
    const wrap = document.createElement('div');
    wrap.className = 'generator-body';
    const inputSources = generatorSources(node);
    const ordered = orderedSources(node, inputSources);
    const imageInputs = ordered.filter(src => src.refs?.length);
    const promptInputs = ordered.filter(src => src.prompt && !src.refs?.length);
    node.apiProvider = resolveVideoProviderId(node.apiProvider || 'comfly');
    node.model = node.model || 'veo3-fast';
    wrap.innerHTML = `
        <div class="prompt-list mb-3"></div>
        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">${tr('canvas.images') || 'Images'}</div>
        <div class="input-list video-img-list"></div>
        <div class="gen-settings">
            <div class="gen-settings-row">
                <select class="select-lite video-provider" style="flex:1">${videoProviderOptions(node.apiProvider)}</select>
                <select class="select-lite video-model" style="flex:2">${videoModelOptions(node.model, node.apiProvider)}</select>
            </div>
            <div class="gen-settings-row">
                <label class="field" style="flex:1">
                    <div class="setting-title">${tr('canvas.videoDuration')}</div>
                    <input class="setting-input video-duration" type="number" min="1" max="60" step="1" value="${Number(node.duration || 5)}">
                </label>
                <label class="field" style="flex:1">
                    <div class="setting-title">${tr('canvas.videoAspect')}</div>
                    <select class="select-lite video-aspect compact-select">
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                        <option value="4:3">4:3</option>
                        <option value="3:4">3:4</option>
                        <option value="21:9">21:9</option>
                        <option value="9:21">9:21</option>
                        <option value="keep_ratio">keep</option>
                        <option value="adaptive">adapt</option>
                    </select>
                </label>
                <label class="field" style="flex:1">
                    <div class="setting-title">${tr('canvas.videoResolution')}</div>
                    <select class="select-lite video-resolution compact-select">
                        <option value="">Auto</option>
                        <option value="480p">480p</option>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                        <option value="780P">780P</option>
                    </select>
                </label>
            </div>
            <div class="gen-settings-row" style="flex-wrap:wrap">
                <button type="button" class="setting-check ${node.enhancePrompt ? 'active' : ''}" data-video-toggle="enhancePrompt"><span class="check-dot"></span>${tr('canvas.videoEnhancePrompt')}</button>
                <button type="button" class="setting-check ${node.enableUpsample ? 'active' : ''}" data-video-toggle="enableUpsample"><span class="check-dot"></span>${tr('canvas.videoUpsample')}</button>
                <button type="button" class="setting-check ${node.watermark ? 'active' : ''}" data-video-toggle="watermark"><span class="check-dot"></span>${tr('canvas.videoWatermark')}</button>
                <button type="button" class="setting-check ${node.cameraFixed ? 'active' : ''}" data-video-toggle="cameraFixed"><span class="check-dot"></span>${tr('canvas.videoCameraFixed')}</button>
                <button type="button" class="setting-check ${node.generateAudio ? 'active' : ''}" data-video-toggle="generateAudio"><span class="check-dot"></span>${tr('canvas.videoGenerateAudio')}</button>
                <button type="button" class="setting-check ${node.useFrameRoles ? 'active' : ''}" data-video-toggle="useFrameRoles"><span class="check-dot"></span>${tr('canvas.videoFirstLastFrames')}</button>
            </div>
        </div>
        <div class="gen-run-row">
            <button class="gen-btn ${node.running ? 'running' : ''}" ${node.running ? 'disabled' : ''}><i data-lucide="clapperboard" class="w-4 h-4"></i>${node.running ? tr('canvas.generating') : tr('canvas.videoGenerate')}</button>
            ${cascadeBtnHtml(node)}
        </div>
        ${retryBarHtml(node)}
    `;
    const providerSelect = wrap.querySelector('.video-provider');
    const modelSelect = wrap.querySelector('.video-model');
    const durationSelect = wrap.querySelector('.video-duration');
    const aspectSelect = wrap.querySelector('.video-aspect');
    const resolutionSelect = wrap.querySelector('.video-resolution');
    providerSelect.value = node.apiProvider;
    durationSelect.value = String(node.duration || 5);
    aspectSelect.value = node.aspectRatio || '16:9';
    resolutionSelect.value = node.resolution || '';
    [providerSelect, modelSelect, durationSelect, aspectSelect, resolutionSelect].forEach(input => {
        input.onmousedown = e => e.stopPropagation();
        input.onclick = e => e.stopPropagation();
    });
    providerSelect.onchange = e => {
        e.stopPropagation();
        node.apiProvider = e.target.value;
        const models = providerVideoModels(node.apiProvider);
        if(!models.includes(node.model)) node.model = models[0] || node.model;
        modelSelect.innerHTML = videoModelOptions(node.model, node.apiProvider);
        scheduleSave();
    };
    modelSelect.onchange = e => { e.stopPropagation(); node.model = e.target.value; scheduleSave(); };
    durationSelect.oninput = e => { e.stopPropagation(); node.duration = Math.max(1, Math.min(60, Number(e.target.value || 5))); scheduleSave(); };
    durationSelect.onblur = e => { e.target.value = String(Math.max(1, Math.min(60, Number(node.duration || 5)))); };
    aspectSelect.onchange = e => { e.stopPropagation(); node.aspectRatio = e.target.value; scheduleSave(); };
    resolutionSelect.onchange = e => { e.stopPropagation(); node.resolution = e.target.value; scheduleSave(); };
    wrap.querySelectorAll('[data-video-toggle]').forEach(btn => {
        btn.onmousedown = e => e.stopPropagation();
        btn.onclick = e => {
            e.stopPropagation();
            const field = btn.dataset.videoToggle;
            node[field] = !node[field];
            render();
            scheduleSave();
        };
    });
    const list = wrap.querySelector('.video-img-list');
    renderVideoImageInputs(list, node, imageInputs);
    renderPromptPreview(wrap.querySelector('.prompt-list'), promptInputs);
    wrap.querySelector('.gen-btn').onclick = e => { e.stopPropagation(); runCanvasGenerate(node.id); };
    bindCascadeButtons(wrap, node.id);
    return wrap;
}
function renderPromptPreview(container, promptInputs){
    if(!container) return;
    container.innerHTML = promptInputs.length ? `<div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Prompts</div>${promptInputs.map(src => `<div class="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 line-clamp-2">${escapeHtml(src.label)}</div>`).join('')}` : '';
}
function renderImageInputList(list, node, imageInputs, emptyText=null){
    if(!list) return;
    list.innerHTML = imageInputs.length ? '' : `<div class="text-[11px] text-gray-300 py-2">${escapeHtml(emptyText || tr('canvas.inputImagesEmpty'))}</div>`;
    imageInputs.forEach((src, i) => {
        const item = document.createElement('div');
        item.className = 'input-item';
        item.draggable = true;
        item.dataset.sourceId = src.id;
        const previewHtml = src.preview && !isMissingAssetUrl(src.preview) ? `<img src="${escapeAttr(src.preview)}">` : (src.preview ? missingAssetHtml(src.preview, true) : '<i data-lucide="image" class="w-6 h-6 text-slate-400"></i>');
        item.innerHTML = `<span class="input-index">${i + 1}</span>${previewHtml}<span class="input-label">${escapeHtml(src.label)}</span>`;
        item.ondragstart = e => {
            e.stopPropagation();
            internalDrag = true;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-canvas-input', src.id);
        };
        item.ondragend = () => { internalDrag = false; };
        item.ondragover = e => { e.preventDefault(); e.stopPropagation(); };
        item.ondrop = e => {
            e.preventDefault();
            e.stopPropagation();
            reorderInput(node, e.dataTransfer.getData('application/x-canvas-input'), src.id);
            internalDrag = false;
        };
        list.appendChild(item);
    });
    refreshIcons();
}
function renderVideoImageInputs(list, node, imageInputs){
    if(!list) return;
    list.innerHTML = imageInputs.length ? '' : `<div class="text-[11px] text-gray-300 py-2">${tr('canvas.groupEmpty')}</div>`;
    imageInputs.forEach((src, i) => {
        const item = document.createElement('div');
        item.className = 'input-item video-input-item';
        item.draggable = true;
        item.dataset.sourceId = src.id;
        const frameLabel = node.useFrameRoles && i === 0 ? tr('canvas.videoRoleFirstFrame') : node.useFrameRoles && i === 1 ? tr('canvas.videoRoleLastFrame') : '';
        const previewHtml = src.preview && !isMissingAssetUrl(src.preview) ? `<img src="${escapeAttr(src.preview)}">` : (src.preview ? missingAssetHtml(src.preview, true) : '<i data-lucide="image" class="w-6 h-6 text-slate-400"></i>');
        item.innerHTML = `
            <div class="video-input-thumb">
                <span class="input-index">${i + 1}</span>
                ${previewHtml}
                <span class="input-label">${escapeHtml(src.label)}</span>
            </div>
            ${frameLabel ? `<div class="video-frame-label">${frameLabel}</div>` : ''}
        `;
        item.ondragstart = e => { e.stopPropagation(); internalDrag = true; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-canvas-input', src.id); };
        item.ondragend = () => { internalDrag = false; };
        item.ondragover = e => { e.preventDefault(); e.stopPropagation(); };
        item.ondrop = e => { e.preventDefault(); e.stopPropagation(); reorderInput(node, e.dataTransfer.getData('application/x-canvas-input'), src.id); internalDrag = false; };
        list.appendChild(item);
    });
    refreshIcons();
}

const CANVAS_GENERATOR_TYPES = ['generator','video'];
const CANVAS_IMAGE_OUTPUT_TYPES = ['generator'];
function hasExplicitOutputConnection(nodeId){
    return connections.some(c => {
        if(c.from !== nodeId) return false;
        const to = nodes.find(n => n.id === c.to);
        return to?.type === 'output';
    });
}
function hasDownstreamGenerator(nodeId){
    return connections.some(c => {
        if(c.from !== nodeId) return false;
        const to = nodes.find(n => n.id === c.to);
        if(!to) return false;
        if(CANVAS_GENERATOR_TYPES.includes(to.type)) return true;
        if(to.type !== 'output') return false;
        return connections.some(cc => {
            if(cc.from !== to.id) return false;
            const next = nodes.find(n => n.id === cc.to);
            return next && CANVAS_GENERATOR_TYPES.includes(next.type);
        });
    });
}
function shouldCreateOutputForNode(node){
    if(!node) return false;
    if(hasExplicitOutputConnection(node.id)) return true;
    return !hasDownstreamGenerator(node.id);
}
function outputForNode(node, dx=460){
    if(!node || !shouldCreateOutputForNode(node)) return null;
    let out = connections
        .filter(c => c.from === node.id)
        .map(c => nodes.find(n => n.id === c.to))
        .find(n => n?.type === 'output');
    if(!out){
        out = {id:uid('out'), type:'output', x:node.x + dx, y:node.y, images:[]};
        nodes.push(out);
        connections.push({id:uid('c'), from:node.id, to:out.id});
    }
    return out;
}
function generatedImageRefs(node){
    return (node?.generatedOutputs || [])
        .map(outputUrlValue)
        .filter(Boolean)
        .filter(url => !isVideoUrl(url))
        .map((url, i) => ({url, name:`${node.type || 'generated'}-${i + 1}.png`}));
}
function generatorSources(gen){
    return connections.filter(c => c.to === gen.id).map(c => nodes.find(n => n.id === c.from)).filter(Boolean).map(n => {
        if(n.type === 'output' && (n.images||[]).length){
            // 从 output 节点取最新一张图当作 reference 给下游
            const last = [...n.images].reverse().map(outputUrlValue).find(Boolean);
            if(last) return {id:n.id, type:'outputImage', label:'上游输出', preview:last, refs:[{url:last, name:'output.png'}], prompt:''};
        }
        if(CANVAS_IMAGE_OUTPUT_TYPES.includes(n.type)){
            const refs = generatedImageRefs(n);
            if(refs.length){
                return refs.map((ref, i) => ({
                    id:`${n.id}:generated:${i}:${ref.url}`,
                    type:'generatedImage',
                    label:`上游生成 ${i + 1}`,
                    preview:ref.url,
                    refs:[ref],
                    prompt:''
                }));
            }
        }
        if(n.type === 'image' && n.url) return {id:n.id, type:'image', label:n.name || 'image', preview:n.url, refs:[{url:n.url, name:n.name || 'image', role:n.role || ''}], prompt:''};
        if(n.type === 'group') {
            const items = (n.items || []).map(id => nodes.find(x => x.id === id)).filter(Boolean);
            const sources = items.filter(x => x.type === 'image' && x.url).map(img => ({
                id:`${n.id}:${img.id}`,
                type:'groupImage',
                groupId:n.id,
                imageId:img.id,
                label:img.name || 'image',
                preview:img.url,
                refs:[{url:img.url, name:img.name || 'image', role:img.role || ''}],
                prompt:''
            }));
            const prompts = items.filter(x => x.type === 'prompt').map(p => p.text || '').filter(Boolean);
            if(prompts.length){
                const combined = prompts.join('\n\n');
                sources.push({
                    id:`${n.id}:prompts`,
                    type:'groupPrompt',
                    groupId:n.id,
                    label:combined.slice(0, 32),
                    refs:[],
                    prompt:combined
                });
            }
            return sources;
        }
        if(n.type === 'prompt') return {id:n.id, type:'prompt', label:(n.text || '提示词').slice(0, 32), refs:[], prompt:n.text || ''};
        if(n.type === 'loop') {
            const prompt = renderLoopPrompt(n);
            const refs = loopInputImageRefs(n);
            if(refs.length){
                const currentIndex = Math.max(1, Number(loopContext?.index || n.loopStart || 1) || 1);
                return refs.map((ref, i) => ({
                    id:`${n.id}:image:${currentIndex + i}:${ref.url}`,
                    type:'loopImage',
                    label:trf('canvas.loopImageLabel', {n:currentIndex + i}),
                    preview:ref.url,
                    refs:[ref],
                    prompt:i === 0 ? prompt : ''
                }));
            }
            return {id:n.id, type:'loop', label:`${tr('canvas.loopNode')} ${loopCount(n)}x`, refs:[], prompt};
        }
        if(n.type === 'promptGroup') {
            const prompts = (n.items || []).map(id => nodes.find(x => x.id === id)).filter(Boolean).map(p => p.text || '').filter(Boolean);
            return {id:n.id, type:'promptGroup', label:`提示词 ${prompts.length} 个`, refs:[], prompt:prompts.join('\n\n')};
        }
        if(n.type === 'llm' && (n.mode || 'node') === 'node' && n.outputText) return {id:n.id, type:'llm', label:(n.outputText || 'LLM').slice(0, 32), refs:[], prompt:n.outputText || ''};
        return null;
    }).flat().filter(Boolean);
}
function orderedSources(gen, sources){
    gen.inputs = (gen.inputs || []).filter(id => sources.some(s => s.id === id));
    sources.forEach(s => { if(!gen.inputs.includes(s.id)) gen.inputs.push(s.id); });
    return gen.inputs.map(id => sources.find(s => s.id === id)).filter(Boolean);
}
function reorderInput(gen, movedId, targetId){
    if(!movedId || movedId === targetId) return;
    const sources = generatorSources(gen);
    const imageIds = sources.filter(s => s.refs?.length).map(s => s.id);
    if(!imageIds.includes(movedId) || !imageIds.includes(targetId)) return;
    const promptIds = (gen.inputs || []).filter(id => !imageIds.includes(id));
    const ids = (gen.inputs || []).filter(id => imageIds.includes(id));
    const from = ids.indexOf(movedId), to = ids.indexOf(targetId);
    if(from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    gen.inputs = [...ids, ...promptIds];
    render();
    scheduleSave();
}
function syncGeneratorInputs(){
    nodes.filter(n => ['generator','video'].includes(n.type)).forEach(gen => orderedSources(gen, generatorSources(gen)));
}
function refreshGeneratorInputViews(){
    nodes.filter(n => ['generator','video'].includes(n.type)).forEach(gen => {
        const el = nodesEl.querySelector(`.node[data-id="${gen.id}"]`);
        if(!el) return;
        const sources = orderedSources(gen, generatorSources(gen));
        const imageInputs = sources.filter(src => src.refs?.length);
        renderPromptPreview(el.querySelector('.prompt-list'), sources.filter(src => src.prompt && !src.refs?.length));
        if(gen.type === 'generator') renderImageInputList(el.querySelector('.input-list'), gen, imageInputs);
        if(gen.type === 'video') renderVideoImageInputs(el.querySelector('.video-img-list'), gen, imageInputs);
    });
}
async function runGenerator(genId, opts={}){
    const gen = nodes.find(n => n.id === genId);
    if(!gen || (gen.running && !opts.cascade)) return;
    const sources = orderedSources(gen, generatorSources(gen));
    const prompt = sources.map(s => s.prompt).filter(Boolean).join('\n\n');
    const refs = sources.flatMap(s => s.refs || []);
    if(!prompt && !refs.length){ alert(tr('canvas.needPromptOrImage')); return; }
    const count = Math.max(1, Math.min(8, Number(gen.count || 1)));
    let out = outputForNode(gen, 460);
    const run = runSnapshot(gen, prompt || 'Edit the reference images.', refs);
    const payload = {
        prompt: prompt || 'Edit the reference images.',
        provider_id:resolveImageProviderId(gen.apiProvider || 'comfly'),
        model:resolveImageModel(gen.model),
        size:await generatorSizeForRun(gen, refs),
        reference_images:refs
    };
    const quality = normalizedImageQuality(gen.quality);
    if(quality) payload.quality = quality;
    let pendingIds = [];
    if(!opts.cascade){ gen.running = true; }
    try {
        const taskInfos = await Promise.all(Array.from({length:count}, () => createCanvasImageTask(payload)));
        pendingIds = taskInfos.map(() => uid('p'));
        if(out) out._pending = [
            ...(out._pending || []),
            ...taskInfos.map((task, index) => makePending(pendingIds[index], run, {
                canvasTaskId:task.task_id,
                canvasTaskType:'online-image',
                appendGenerated:Boolean(opts.cascade)
            }))
        ];
        refreshRunNodes(gen, out);
        scheduleSave();
        await saveCanvas();
        const statuses = await Promise.all(taskInfos.map(task => pollCanvasImageTask(task.task_id)));
        if(statuses.includes('failed')) throw new Error(gen.runError || tr('canvas.generationFailed'));
    } catch(err) {
        const remainingIds = pendingIds.filter(id => pendingById(out, id));
        if(remainingIds.length){
            const metas = collectRunMetas(out, remainingIds);
            addGenerationLog({run, outputs:[], runMs:Math.max(...metas.map(m => m.runMs || 0), 0), error:err.message || String(err)});
            if(out) out._pending = (out._pending||[]).filter(p => !remainingIds.includes(p.id));
        }
        gen.runStatus = 'failed'; gen.runError = err.message || String(err);
        gen.running = false;
        refreshRunNodes(gen, out);
        scheduleSave();
        if(opts.cascade) throw err;
        showErrorModal(err.message || tr('canvas.generationFailed'), tr('canvas.apiFailed'));
    }
}
async function runGeneratorLegacy(genId, opts={}){
    const gen = nodes.find(n => n.id === genId);
    if(!gen || (gen.running && !opts.cascade)) return;
    const sources = orderedSources(gen, generatorSources(gen));
    const prompt = sources.map(s => s.prompt).filter(Boolean).join('\n\n');
    const refs = sources.flatMap(s => s.refs || []);
    if(!prompt && !refs.length){ alert(tr('canvas.needPromptOrImage')); return; }
    const count = Math.max(1, Math.min(8, Number(gen.count || 1)));
    let out = outputForNode(gen, 460);
    const pendingIds = Array.from({length:count}, () => uid('p'));
    const run = runSnapshot(gen, prompt || 'Edit the reference images.', refs);
    if(out) out._pending = [...(out._pending||[]), ...pendingIds.map(id => makePending(id, run))];
    if(!opts.cascade){
        gen.running = true;
        refreshRunNodes(gen, out);
        setTimeout(() => { gen.running = false; refreshRunNodes(gen, out); }, 2000);
    }
    else refreshRunNodes(gen, out);
    try {
        const payload = {
            prompt: prompt || 'Edit the reference images.',
            provider_id:resolveImageProviderId(gen.apiProvider || 'comfly'),
            model:resolveImageModel(gen.model),
            size:await generatorSizeForRun(gen, refs),
            reference_images:refs
        };
        const quality = normalizedImageQuality(gen.quality);
        if(quality) payload.quality = quality;
        const results = await Promise.all(Array.from({length:count}, () => fetch('/api/online-image', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(payload)
        }).then(async r => { if(!r.ok) throw new Error(await responseErrorMessage(r, tr('canvas.generationFailed'))); return r.json(); })));
        const images = results.flatMap(result => result.images || []);
        const metas = collectRunMetas(out, pendingIds);
        run.request = results[0] ? requestMetaFromResult(results[0]) : {};
        if(out) out._pending = (out._pending||[]).filter(p => !pendingIds.includes(p.id));
        appendOutputImages(out, images, refs[0], metas);
        mergeGeneratedOutputs(gen, images, Boolean(opts.cascade));
        addGenerationLog({run, outputs:images, runMs:Math.max(...metas.map(m => m.runMs || 0), 0)});
        gen.runStatus = 'done'; gen.runError = '';
        refreshRunNodes(gen, out);
        scheduleSave();
    } catch(err) {
        const metas = collectRunMetas(out, pendingIds);
        addGenerationLog({run, outputs:[], runMs:Math.max(...metas.map(m => m.runMs || 0), 0), error:err.message || String(err)});
        if(out) out._pending = (out._pending||[]).filter(p => !pendingIds.includes(p.id));
        gen.runStatus = 'failed'; gen.runError = err.message || String(err);
        refreshRunNodes(gen, out);
        if(opts.cascade) throw err;
        showErrorModal(err.message || tr('canvas.generationFailed'), tr('canvas.apiFailed'));
    }
}
async function runVideoNode(nodeId, opts={}){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || (node.running && !opts.cascade)) return;
    const sources = orderedSources(node, generatorSources(node));
    const prompt = sources.map(s => s.prompt).filter(Boolean).join('\n\n');
    const refs = sources.flatMap(s => s.refs || []);
    if(node.useFrameRoles && refs[0]) refs[0] = {...refs[0], role:'first_frame'};
    if(node.useFrameRoles && refs[1]) refs[1] = {...refs[1], role:'last_frame'};
    if(!prompt){ alert(tr('canvas.videoNeedsPrompt')); return; }
    let out = outputForNode(node, 460);
    const pendingId = uid('p');
    const run = runSnapshot(node, prompt, refs);
    if(out) out._pending = [...(out._pending || []), makePending(pendingId, run)];
    if(!opts.cascade){ node.running = true; refreshRunNodes(node, out); }
    else refreshRunNodes(node, out);
    try {
        const result = await fetch('/api/canvas-video', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                prompt,
                provider_id:resolveVideoProviderId(node.apiProvider || 'comfly'),
                model:node.model || 'veo3-fast',
                duration:Number(node.duration || 5),
                aspect_ratio:node.aspectRatio || '16:9',
                resolution:node.resolution || '',
                images:refs,
                enhance_prompt:Boolean(node.enhancePrompt),
                enable_upsample:Boolean(node.enableUpsample),
                watermark:Boolean(node.watermark),
                camerafixed:Boolean(node.cameraFixed),
                generate_audio:Boolean(node.generateAudio)
            })
        }).then(async r => { if(!r.ok) throw new Error(await responseErrorMessage(r, tr('canvas.videoFailed'))); return r.json(); });
        const meta = collectRunMeta(out, pendingId);
        if(out) out._pending = (out._pending || []).filter(p => p.id !== pendingId);
        const outputUrls = result.videos || [];
        run.request = requestMetaFromResult(result);
        appendOutputImages(out, outputUrls, refs[0], [meta]);
        mergeGeneratedOutputs(node, outputUrls, Boolean(opts.cascade));
        addGenerationLog({run, outputs:outputUrls, runMs:meta.runMs || 0});
        node.runStatus = 'done'; node.runError = '';
        refreshRunNodes(node, out);
        scheduleSave();
    } catch(err) {
        const meta = collectRunMeta(out, pendingId);
        addGenerationLog({run, outputs:[], runMs:meta.runMs || 0, error:err.message || String(err)});
        if(out) out._pending = (out._pending || []).filter(p => p.id !== pendingId);
        node.runStatus = 'failed'; node.runError = err.message || String(err);
        refreshRunNodes(node, out);
        if(opts.cascade) throw err;
        alert(err.message || tr('canvas.videoFailed'));
    } finally {
        node.running = false;
        refreshRunNodes(node, out);
    }
}
async function callCanvasLLM(node, message, messages=[]){
    const llmProv = resolveChatProviderId(node.llmProvider || 'comfly');
    const model = resolveChatModel(node.model, llmProv);
    const images = llmInputImages(node);
    const result = await fetch('/api/canvas-llm', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            message,
            model,
            provider: llmProv,
            system_prompt:node.systemPrompt || 'You are a helpful assistant.',
            messages,
            images,
        })
    }).then(async r => {
        if(!r.ok){
            throw new Error(await responseErrorMessage(r, 'LLM 运行失败'));
        }
        return r.json();
    });
    return result.text || '';
}
async function runLLMNode(nodeId, opts={}){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || (node.running && !opts.cascade)) return;
    const input = llmInputText(node) || node.userInput || '';
    if(!input){
        if(opts.cascade) throw new Error('LLM 缺少提示词输入');
        alert(tr('canvas.needPromptToLLM')); return;
    }
    if(!opts.cascade){ node.running = true; refreshNodes([node.id]); }
    try {
        node.outputText = await callCanvasLLM(node, input, []);
        if(!opts.cascade) node.running = false;
        node.runStatus = 'done'; node.runError = '';
        refreshNodes([node.id]);
        scheduleSave();
    } catch(err) {
        if(!opts.cascade) node.running = false;
        node.runStatus = 'failed'; node.runError = err.message || String(err);
        refreshNodes([node.id]);
        if(opts.cascade) throw err;
        alert(err.message || 'LLM 运行失败');
    }
}
// 判断是不是「链尾」节点：没有下游生成节点（直接相连或经 Output 中转都算）
function isTerminalGenerator(nodeId){
    const GEN_TYPES = ['generator','llm','video'];
    for(const c of connections.filter(c => c.from === nodeId)){
        const t = nodes.find(n => n.id === c.to);
        if(!t) continue;
        if(GEN_TYPES.includes(t.type)) return false;
        if(t.type === 'output'){
            for(const c2 of connections.filter(cc => cc.from === t.id)){
                const t2 = nodes.find(n => n.id === c2.to);
                if(t2 && GEN_TYPES.includes(t2.type)) return false;
            }
        }
    }
    return true;
}
function findLoopCascadeTarget(loopId){
    const runTypes = canvasRunTypes();
    const seen = new Set();
    const candidates = [];
    const walk = (id, depth=0) => {
        if(seen.has(id)) return;
        seen.add(id);
        connections.filter(c => c.from === id).forEach(c => {
            const next = nodes.find(n => n.id === c.to);
            if(!next) return;
            if(runTypes.includes(next.type)){
                candidates.push({id:next.id, depth:depth + 1, terminal:isTerminalGenerator(next.id)});
            }
            walk(next.id, depth + 1);
        });
    };
    walk(loopId);
    const terminal = candidates.filter(c => c.terminal).sort((a, b) => b.depth - a.depth)[0];
    return (terminal || candidates.sort((a, b) => b.depth - a.depth)[0])?.id || '';
}
function cascadeBtnHtml(node){
    // 仅链尾节点显示一键运行
    if(!isTerminalGenerator(node.id)) return '';
    // 也要求至少有上游生成节点，否则没意义
    const order = computeCascadeOrder(node.id);
    const loop = resolveCascadeLoop(node.id);
    if(order.length <= 1 && !loop) return '';
    const suffix = loop ? ` × ${loop.count} ${tr('canvas.loopRounds')}` : '';
    // 仅在以串行模式启动的运行中显示停止按钮
    if(cascadeSerialIds.has(node.id)){
        const stopping = cascadeStopIds.has(node.id);
        return `<button class="gen-cascade-btn gen-cascade-stop" type="button" data-cascade-stop="${node.id}" ${stopping ? 'disabled' : ''}><i data-lucide="square" class="w-4 h-4"></i><span>${stopping ? '停止中…' : '停止循环'}</span></button>`;
    }
    return `<button class="gen-cascade-btn" type="button" data-cascade="${node.id}" title="一键运行整条工作流（追溯所有上游生成节点）"><i data-lucide="play-circle" class="w-4 h-4"></i><span>一键运行 ${order.length} 个节点${suffix}</span></button>`;
}
function retryBarHtml(node){
    // 只在一键运行模式中失败才显示；普通单节点失败直接弹 alert，不显示这条
    if(node.runStatus !== 'failed' || !node._cascadeFailed) return '';
    return `<div class="node-retry-bar" data-retry-bar>
        <span class="node-retry-msg" title="${escapeAttr(node.runError||'')}">${escapeHtml((node.runError||tr('canvas.generationFailed')).slice(0,60))}</span>
        <button class="node-retry-btn" type="button" data-retry="${node.id}">重试</button>
        <button class="node-stop-btn" type="button" data-stop="${node.id}">停止</button>
    </div>`;
}
function bindCascadeButtons(wrap, nodeId){
    wrap.querySelectorAll(`[data-cascade="${nodeId}"]`).forEach(b => {
        b.onmousedown = e => e.stopPropagation();
        b.onclick = e => { e.stopPropagation(); runNodeCascade(nodeId); };
    });
    wrap.querySelectorAll(`[data-cascade-stop="${nodeId}"]`).forEach(b => {
        b.onmousedown = e => e.stopPropagation();
        b.onclick = e => { e.stopPropagation(); requestCascadeStop(nodeId); };
    });
    wrap.querySelectorAll(`[data-retry="${nodeId}"]`).forEach(b => {
        b.onmousedown = e => e.stopPropagation();
        b.onclick = e => { e.stopPropagation(); retryNodeAndDownstream(nodeId); };
    });
    wrap.querySelectorAll(`[data-stop="${nodeId}"]`).forEach(b => {
        b.onmousedown = e => e.stopPropagation();
        b.onclick = e => { e.stopPropagation(); cancelCascade(nodeId); };
    });
}
// —— 一键运行：从目标节点反向追溯到所有上游生成节点，按拓扑顺序串行执行 ——
function runCascadeNodeByType(node, opts={}){
    const runOpts = {cascade:true, ...opts};
    if(node.type === 'generator') return runGenerator(node.id, runOpts);
    if(node.type === 'llm') return runLLMNode(node.id, runOpts);
    if(node.type === 'video') return runVideoNode(node.id, runOpts);
    return Promise.resolve();
}
function runCascadeNodeWithLoopContext(node, ctx, opts={}){
    const previous = loopContext;
    loopContext = ctx || null;
    const promise = runCascadeNodeByType(node, opts);
    loopContext = previous;
    return promise;
}
function cascadeParallelLimit(order, totalRounds){
    return Math.max(1, Math.min(totalRounds, 6));
}
async function runLimitedCascadeRounds(rounds, limit, runner){
    let next = 0;
    const workers = Array.from({length:Math.max(1, Math.min(limit, rounds.length))}, async () => {
        while(next < rounds.length){
            const round = rounds[next++];
            await runner(round);
        }
    });
    return Promise.allSettled(workers);
}
function canvasRunTypes(){
    return ['generator','llm','video'];
}
function canvasWorkflowEdges(){
    const runTypes = canvasRunTypes();
    const direct = [];
    connections.forEach(c => {
        const from = nodes.find(n => n.id === c.from);
        const to = nodes.find(n => n.id === c.to);
        if(!from || !to || !runTypes.includes(from.type)) return;
        if(runTypes.includes(to.type)){
            direct.push([from.id, to.id]);
            return;
        }
        if(to.type === 'output'){
            connections.filter(cc => cc.from === to.id).forEach(cc => {
                const next = nodes.find(n => n.id === cc.to);
                if(next && runTypes.includes(next.type)) direct.push([from.id, next.id]);
            });
        }
    });
    return direct;
}
function computeConnectedWorkflowOrder(anchorId){
    const anchor = nodes.find(n => n.id === anchorId);
    const runTypes = canvasRunTypes();
    if(!anchor || !runTypes.includes(anchor.type)) return [];
    const edges = canvasWorkflowEdges();
    const connected = new Set([anchorId]);
    let changed = true;
    while(changed){
        changed = false;
        edges.forEach(([from, to]) => {
            if(connected.has(from) && !connected.has(to)){ connected.add(to); changed = true; }
            if(connected.has(to) && !connected.has(from)){ connected.add(from); changed = true; }
        });
    }
    const order = [];
    const seen = new Set();
    const visit = id => {
        if(seen.has(id)) return;
        seen.add(id);
        edges.filter(([, to]) => to === id).forEach(([from]) => {
            if(connected.has(from)) visit(from);
        });
        if(connected.has(id)) order.push(id);
    };
    nodes.filter(n => connected.has(n.id) && runTypes.includes(n.type)).forEach(n => visit(n.id));
    return order;
}
async function runCanvasGenerate(nodeId){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || node.running || cascadeRunningIds.has(nodeId)) return;
    const order = computeConnectedWorkflowOrder(nodeId);
    if(order.length > 1){
        cascadeRunningIds.add(nodeId);
        refreshNodes(order);
        try {
            await runOneCascadePass(order);
        } finally {
            cascadeRunningIds.delete(nodeId);
            refreshNodes(order);
        }
        return;
    }
    return runCascadeNodeByType(node, {cascade:false});
}
function computeCascadeOrder(targetId){
    const visited = new Set();
    const order = [];
    const GEN_TYPES = canvasRunTypes();
    function dfs(id){
        if(visited.has(id)) return;
        visited.add(id);
        const node = nodes.find(n => n.id === id);
        if(!node) return;
        // 找该节点的上游
        connections.filter(c => c.to === id).forEach(c => {
            const from = nodes.find(n => n.id === c.from);
            if(!from) return;
            if(GEN_TYPES.includes(from.type)){
                dfs(from.id);
            } else if(from.type === 'output'){
                // output 节点的上游是生成器
                connections.filter(cc => cc.to === from.id).forEach(cc => {
                    const ff = nodes.find(n => n.id === cc.from);
                    if(ff && GEN_TYPES.includes(ff.type)) dfs(ff.id);
                });
            }
        });
        if(GEN_TYPES.includes(node.type)) order.push(id);
    }
    dfs(targetId);
    return order;
}
function upstreamNodeIds(targetId){
    const found = new Set();
    const walk = id => {
        connections.filter(c => c.to === id).forEach(c => {
            if(found.has(c.from)) return;
            found.add(c.from);
            walk(c.from);
        });
    };
    walk(targetId);
    return found;
}
function resolveCascadeLoop(targetId){
    const upstream = upstreamNodeIds(targetId);
    const loops = nodes.filter(n => n.type === 'loop' && upstream.has(n.id));
    if(!loops.length) return null;
    const loop = loops[loops.length - 1];
    return {node:loop, count:loopCount(loop), mode:loop.mode === 'parallel' ? 'parallel' : 'serial'};
}
function cascadeUiNodeIds(targetId, order=null){
    const ids = new Set([targetId, ...(order || computeCascadeOrder(targetId))]);
    const loop = resolveCascadeLoop(targetId);
    if(loop?.node?.id) ids.add(loop.node.id);
    return [...ids].filter(Boolean);
}
function requestCascadeStop(targetId){
    if(!targetId) return;
    cascadeStopIds.add(targetId);
    refreshNodes(cascadeUiNodeIds(targetId));
}
async function runNodeCascade(nodeId){
    const target = nodes.find(n => n.id === nodeId);
    if(!target) return;
    if(target.running){ alert('当前节点正在运行'); return; }
    cascadeRunningIds.add(nodeId);
    const order = computeCascadeOrder(nodeId);
    refreshNodes(cascadeUiNodeIds(nodeId, order));
    if(!order.length){ alert('没有可运行的生成节点'); return; }
    const loop = resolveCascadeLoop(nodeId);
    const totalRounds = loop?.count || 1;
    const startIdx = Math.max(1, Number(loop?.node?.loopStart) || 1);
    const loopBatchSize = loop?.node?.imageInput ? Math.max(1, Math.min(100, Number(loop?.node?.imageBatchSize) || 1)) : 1;
    const endIdx = startIdx + (totalRounds - 1) * loopBatchSize;
    order.forEach(id => {
        const n = nodes.find(x => x.id === id);
        if(n) n.generatedOutputs = [];
    });
    if(loop?.mode === 'parallel' && totalRounds > 1){
        cascadeSerialIds.add(nodeId);
        order.forEach(id => {
            const n = nodes.find(x => x.id === id);
            if(n){ n.runStatus = 'queued'; n.runError = ''; n._cascadeFailed = false; n._cascadeIdx = `0/${totalRounds}`; }
        });
        refreshNodes(cascadeUiNodeIds(nodeId, order));
        let done = 0;
        const rounds = Array.from({length:totalRounds}, (_, idx) => ({idx, index:startIdx + idx * loopBatchSize}));
        const limit = cascadeParallelLimit(order, totalRounds);
        const results = await runLimitedCascadeRounds(rounds, limit, async ({index}) => {
            if(cascadeStopIds.has(nodeId)) return;
            const ctx = {index, total:endIdx, nodeId:loop.node.id};
            for(let i = 0; i < order.length; i++){
                if(cascadeStopIds.has(nodeId)) return;
                const id = order[i];
                const node = nodes.find(n => n.id === id);
                if(!node) continue;
                node.runStatus = 'running';
                node._cascadeIdx = `${order.indexOf(id)+1}/${order.length} · ${index}/${endIdx}`;
                refreshNodes([id]);
                await runCascadeNodeWithLoopContext(node, ctx);
                node.runStatus = 'done';
                refreshNodes([id]);
            }
            done += 1;
            order.forEach(id => {
                const n = nodes.find(x => x.id === id);
                if(n) n._cascadeIdx = `${done}/${totalRounds}`;
            });
            refreshNodes(order);
        });
        loopContext = null;
        cascadeRunningIds.delete(nodeId);
        cascadeStopIds.delete(nodeId);
        cascadeSerialIds.delete(nodeId);
        refreshNodes(cascadeUiNodeIds(nodeId, order));
        const failed = results.find(r => r.status === 'rejected');
        if(failed){
            const err = failed.reason || new Error('parallel loop failed');
            const node = nodes.find(n => n.id === nodeId) || target;
            node.runStatus = 'failed';
            node.runError = err.message || String(err);
            node._cascadeFailed = true;
            refreshNodes(cascadeUiNodeIds(nodeId, order));
            return;
        }
        setTimeout(() => {
            order.forEach(id => {
                const n = nodes.find(x => x.id === id);
                if(n && n.runStatus === 'done'){ n.runStatus = ''; n._cascadeIdx = ''; }
            });
            refreshNodes(cascadeUiNodeIds(nodeId, order));
        }, 3000);
        return;
    }
    cascadeSerialIds.add(nodeId);
    refreshNodes(cascadeUiNodeIds(nodeId, order));
    for(let round = 1; round <= totalRounds; round++){
        if(cascadeStopIds.has(nodeId)){
            cascadeStopIds.delete(nodeId);
            cascadeRunningIds.delete(nodeId);
            cascadeSerialIds.delete(nodeId);
            loopContext = null;
            order.forEach(id => { const n = nodes.find(x=>x.id===id); if(n){ n.runStatus=''; n._cascadeIdx=''; } });
            refreshNodes(cascadeUiNodeIds(nodeId, order));
            return;
        }
        const loopIndex = startIdx + (round - 1) * loopBatchSize;
        loopContext = loop ? {index:loopIndex, total:endIdx, nodeId:loop.node.id} : null;
        order.forEach(id => {
            const n = nodes.find(x => x.id === id);
            if(n){ n.runStatus = 'queued'; n.runError = ''; n._cascadeFailed = false; n._cascadeIdx = `${order.indexOf(id)+1}/${order.length}${totalRounds > 1 ? ` · ${loopIndex}/${endIdx}` : ''}`; }
        });
        refreshNodes(cascadeUiNodeIds(nodeId, order));
        for(let i = 0; i < order.length; i++){
            const id = order[i];
            const node = nodes.find(n => n.id === id);
            if(!node) continue;
            node.runStatus = 'running';
            refreshNodes([id]);
            try {
                await runCascadeNodeWithLoopContext(node, loopContext);
                node.runStatus = 'done';
                refreshNodes([id]);
            } catch(err){
                loopContext = null;
                cascadeRunningIds.delete(nodeId);
                cascadeStopIds.delete(nodeId);
                cascadeSerialIds.delete(nodeId);
                node.runStatus = 'failed';
                node.runError = `${totalRounds > 1 ? `${tr('canvas.loopRound')} ${round}/${totalRounds}: ` : ''}${err.message || String(err)}`;
                node._cascadeFailed = true;
                for(let j = i + 1; j < order.length; j++){
                    const n2 = nodes.find(x => x.id === order[j]);
                    if(n2){ n2.runStatus = ''; n2._cascadeIdx = ''; }
                }
                refreshNodes(cascadeUiNodeIds(nodeId, order.slice(i)));
                return;
            }
        }
    }
    loopContext = null;
    cascadeRunningIds.delete(nodeId);
    cascadeStopIds.delete(nodeId);
    cascadeSerialIds.delete(nodeId);
    refreshNodes(cascadeUiNodeIds(nodeId, order));
    // 全部完成：3 秒后清除状态徽章
    setTimeout(() => {
        order.forEach(id => {
            const n = nodes.find(x => x.id === id);
            if(n && n.runStatus === 'done'){ n.runStatus = ''; n._cascadeIdx = ''; }
        });
        refreshNodes(cascadeUiNodeIds(nodeId, order));
    }, 3000);
}
async function runOneCascadePass(order, options={}){
    order.forEach(id => {
        const n = nodes.find(x => x.id === id);
        if(n){ n.runStatus = 'queued'; n.runError = ''; n._cascadeFailed = false; n._cascadeIdx = ''; }
    });
    refreshNodes(order);
    for(let i = 0; i < order.length; i++){
        const id = order[i];
        const node = nodes.find(n => n.id === id);
        if(!node) continue;
        node.runStatus = 'running';
        refreshNodes([id]);
        try {
            if(node.type === 'generator') await runGenerator(id, {cascade:true});
            else if(node.type === 'llm') await runLLMNode(id, {cascade:true});
            else if(node.type === 'video') await runVideoNode(id, {cascade:true});
            node.runStatus = 'done';
            refreshNodes([id]);
        } catch(err) {
            node.runStatus = 'failed';
            node.runError = err.message || String(err);
            node._cascadeFailed = true;
            throw err;
        }
    }
}
// 失败重试：从该节点继续往下游跑
async function retryNodeAndDownstream(nodeId){
    const target = nodes.find(n => n.id === nodeId);
    if(!target) return;
    const order = computeCascadeOrder(nodeId);
    // 只重跑从该节点开始的剩余链
    const idx = order.indexOf(nodeId);
    const remain = idx >= 0 ? order.slice(idx) : [nodeId];
    try { await runOneCascadePass(remain); }
    catch(err) { refreshNodes(remain); return; }
    setTimeout(() => {
        remain.forEach(id => {
            const n = nodes.find(x => x.id === id);
            if(n && n.runStatus === 'done'){ n.runStatus = ''; n._cascadeIdx = ''; }
        });
        refreshNodes(remain);
    }, 3000);
}
function cancelCascade(nodeId){
    // 简单实现：把当前节点和上游 queued/failed 状态清掉（不能 abort 已发出的请求）
    const order = computeCascadeOrder(nodeId);
    order.forEach(id => {
        const n = nodes.find(x => x.id === id);
        if(n && (n.runStatus === 'queued' || n.runStatus === 'failed')){
            n.runStatus = ''; n._cascadeIdx = ''; n.runError = ''; n._cascadeFailed = false;
        }
    });
    refreshNodes(order);
}

async function runLLMChat(nodeId){
    const node = nodes.find(n => n.id === nodeId);
    if(!node || node.running) return;
    const message = (node.chatInput || '').trim();
    if(!message) return;
    node.messages = node.messages || [];
    const history = node.messages.slice();
    node.messages.push({role:'user', content:message});
    node.chatInput = '';
    node.running = true;
    refreshNodes([node.id]);
    try {
        const text = await callCanvasLLM(node, message, history);
        node.messages.push({role:'assistant', content:text});
        node.outputText = text;
        node.running = false;
        refreshNodes([node.id]);
        scheduleSave();
    } catch(err) {
        node.running = false;
        refreshNodes([node.id]);
        alert(err.message || 'LLM 运行失败');
    }
}

function deleteNode(id, event){
    event.stopPropagation();
    pushUndo();
    nodes = nodes.filter(n => n.id !== id);
    connections = connections.filter(c => c.from !== id && c.to !== id);
    selected.delete(id);
    render();
    scheduleSave();
}
function deleteConnection(id, event){
    event?.preventDefault();
    event?.stopPropagation();
    pushUndo();
    connections = connections.filter(c => c.id !== id);
    if(hoveredConnectionId === id) hoveredConnectionId = '';
    syncGeneratorInputs();
    render();
    renderLinks();
    scheduleSave();
}
function outputDownloadName(url){
    const clean = (url || '').split('?')[0];
    const ext = clean.includes('.') ? clean.split('.').pop() : 'png';
    return `canvas-output-${Date.now()}.${ext || 'png'}`;
}
function isVideoUrl(url){
    const clean = (url || '').split('?')[0].toLowerCase();
    return /\.(mp4|webm|mov|m4v)$/.test(clean);
}
function formatRunDuration(ms){
    const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}
function nowMs(){ return Date.now(); }
function outputUrlValue(item){
    return typeof item === 'string' ? item : item?.url || '';
}
function isMissingAssetUrl(url){
    return Boolean(url && missingAssetUrls.has(url));
}
function missingAssetHtml(url, compact=false){
    return `<div class="missing-asset ${compact ? 'compact' : ''}" title="${escapeAttr(url || '')}"><i data-lucide="image-off" class="${compact ? 'w-4 h-4' : 'w-6 h-6'}"></i><span>文件缺失</span></div>`;
}
function outputMetaFor(url, out){
    const item = (out?.images || []).find(x => outputUrlValue(x) === url);
    return item && typeof item === 'object' ? item : {};
}
function runSnapshot(node, prompt, refs=[]){
    const clone = JSON.parse(JSON.stringify(node || {}));
    delete clone.running;
    delete clone.runStatus;
    delete clone.runError;
    delete clone.inputs;
    return {
        nodeType: node?.type || '',
        node: clone,
        prompt: prompt || '',
        refs: (refs || []).map(ref => ({url:ref.url, name:ref.name || 'image'})).filter(ref => ref.url),
    };
}
function runTaskLabel(run){
    const node = run?.node || {};
    if(run?.taskLabel) return run.taskLabel;
    if(run?.nodeType === 'generator') return node.model || 'API Image';
    if(run?.nodeType === 'video') return node.model || 'Video';
    return run?.nodeType || 'Generate';
}
function requestMetaFromResult(result={}){
    return {
        task_id: result.task_id || result.raw?.task_id || result.raw?.data?.task_id || (Array.isArray(result.raw?.data) ? result.raw.data[0]?.task_id : '') || '',
        request_id: result.request_id || result.id || result.raw?.id || '',
        provider_id: result.provider_id || result.params?.provider_id || '',
        backend: result.backend || '',
        prompt_id: result.prompt_id || '',
        workflow_json: result.workflow_json || '',
        seed: result.seed || '',
    };
}
function runPlatformLabel(run){
    const node = run?.node || {};
    if(run?.nodeType === 'generator') return providerById(node.apiProvider || 'comfly')?.name || node.apiProvider || 'API';
    if(run?.nodeType === 'video') return providerById(node.apiProvider || 'comfly')?.name || node.apiProvider || 'Video';
    return run?.nodeType || 'Generate';
}
function logTaskLabel(log){
    return log?.model || '-';
}
function addGenerationLog({run, outputs=[], runMs=0, error=''}) {
    if(!canvas) return;
    canvas.logs = canvas.logs || [];
    const entry = {
        id:uid('log'),
        createdAt:Date.now(),
        status:error ? 'failed' : 'success',
        platform:runPlatformLabel(run),
        nodeType:run?.nodeType || '',
        model:run?.taskLabel || runTaskLabel(run),
        request:run?.request || {},
        prompt:run?.prompt || '',
        outputs:(outputs || []).filter(Boolean),
        refs:run?.refs || [],
        runMs:Number(runMs || 0),
        error:error ? String(error) : '',
        // 保存完整 run 快照，供「再次运行」从日志还原节点
        run: run ? {nodeType:run.nodeType, node:run.node, prompt:run.prompt, refs:run.refs, taskLabel:run.taskLabel} : null,
    };
    canvas.logs = [entry, ...canvas.logs].slice(0, 500);
}
function renderCanvasLog(){
    const logs = canvas?.logs || [];
    logList.innerHTML = logs.length ? logs.map((log, i) => {
        const thumbs = (log.outputs || []).slice(0, 8).map(url => {
            const safe = escapeAttr(url);
            if(isMissingAssetUrl(url)) return `<div class="missing-asset compact" data-url="${safe}"><i data-lucide="image-off" class="w-4 h-4"></i></div>`;
            return isVideoUrl(url) ? `<video src="${safe}" data-url="${safe}" muted playsinline></video>` : `<img src="${safe}" data-url="${safe}" alt="output">`;
        }).join('') || (log.status === 'failed' ? `<div class="log-thumb-placeholder log-thumb-error" title="${escapeAttr(log.error || '')}"><i data-lucide="alert-triangle" class="w-5 h-5"></i><span>${escapeHtml(log.error || tr('canvas.unknownError'))}</span></div>` : `<div class="log-thumb-placeholder"><i data-lucide="image-off" class="w-5 h-5"></i></div>`);
        const date = new Date(log.createdAt || Date.now()).toLocaleString('zh-CN');
        const req = log.request || {};
        const taskId = req.task_id || req.taskId || req.prompt_id || req.promptId || '';
        const requestId = req.request_id || req.requestId || req.id || '';
        const backend = req.backend || req.provider_id || req.providerId || '';
        const workflow = req.workflow_json || req.workflow || '';
        const taskLabel = logTaskLabel(log);
        const idText = taskId || requestId || '';
        const backendText = workflow || backend || '';
        const subParts = [
            date,
            `输出 ${(log.outputs || []).length}`,
        ].filter(Boolean);
        return `<div class="log-item ${log.status === 'failed' ? 'failed' : ''} ${logBatchMode ? 'batch-mode' : ''}" data-log-index="${i}">
            <div class="log-main">
                <div class="log-meta">
                    <span class="log-chip ${log.status === 'failed' ? 'status-failed' : 'status-ok'}">${escapeHtml(log.status === 'failed' ? tr('canvas.failed') : tr('canvas.success'))}</span>
                    <span class="log-chip">${escapeHtml(log.platform || '-')}</span>
                    ${taskLabel ? `<span class="log-chip">${escapeHtml(taskLabel)}</span>` : ''}
                    ${log.runMs ? `<span class="log-chip">${escapeHtml(formatRunDuration(log.runMs))}</span>` : ''}
                    <button class="log-delete-btn" data-index="${i}" title="删除此记录" aria-label="删除此记录"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                </div>
                <div class="log-subline">${subParts.map(part => `<span title="${escapeAttr(part)}">${escapeHtml(part)}</span>`).join('')}</div>
                ${log.error ? `<div class="log-error" title="${escapeAttr(log.error)}">${escapeHtml(log.error)}</div>` : ''}
                <div class="log-prompt" title="${escapeAttr(log.prompt || tr('canvas.noPromptMeta'))}" data-prompt="${escapeAttr(log.prompt || '')}">${escapeHtml(log.prompt || tr('canvas.noPromptMeta'))}</div>
            </div>
            <div class="log-thumbs">${thumbs}
                <label class="log-select-cb" style="display:${logBatchMode ? 'flex' : 'none'};">
                    <input type="checkbox" class="log-cb" data-idx="${i}">
                </label>
            </div>
        </div>`;
    }).join('') : `<div class="log-empty">${tr('canvas.noLogs')}</div>`;
    logList.querySelectorAll('[data-url]').forEach(el => {
        el.onclick = e => {
            if(logBatchMode) return; // 批量模式下不打开图片，让整行点击生效
            e.stopPropagation();
            openOutputLightbox(el.dataset.url, null);
        };
        // 批量模式下阻止图片默认拖拽行为，使框选能从图片区域开始
        el.onmousedown = e => {
            if(!logBatchMode) return;
            e.preventDefault();
        };
        el.ondragstart = e => {
            if(logBatchMode) e.preventDefault();
        };
        // 彻底禁止浏览器对图片的默认拖拽
        if(logBatchMode) el.setAttribute('draggable', 'false');
        else el.removeAttribute('draggable');
    });
    logList.querySelectorAll('[data-prompt]').forEach(el => {
        el.onclick = e => {
            e.stopPropagation();
            const text = el.dataset.prompt || '';
            if(text) navigator.clipboard?.writeText(text).catch(() => {});
            const oldText = el.textContent;
            el.textContent = tr('canvas.copied');
            el.classList.add('copied');
            setTimeout(() => {
                el.textContent = oldText;
                el.classList.remove('copied');
            }, 900);
        };
    });
    logList.querySelectorAll('.log-delete-btn').forEach(el => {
        el.onclick = e => {
            e.stopPropagation();
            const idx = parseInt(el.dataset.index, 10);
            if(isNaN(idx) || idx < 0 || idx >= canvas.logs.length) return;
            if(!confirm('确定要删除这条生成记录吗？')) return;
            canvas.logs.splice(idx, 1);
            scheduleSave();
            renderCanvasLog();
        };
    });
    refreshIcons();
    // 重新插入框选矩形（innerHTML 会清掉它）
    let rectEl = document.getElementById('logSelectRect');
    if(!rectEl){
        rectEl = document.createElement('div');
        rectEl.className = 'log-batch-select-rect';
        rectEl.id = 'logSelectRect';
    }
    if(!logList.contains(rectEl)) logList.appendChild(rectEl);
    // 整行点击切换选中
    logList.querySelectorAll('.log-item.batch-mode').forEach(item => {
        item.onclick = e => {
            if(logJustDragged) return;
            if(e.target.closest('.log-select-cb')) return;
            const cb = item.querySelector('.log-cb');
            if(!cb) return;
            cb.checked = !cb.checked;
            item.classList.toggle('batch-selected', cb.checked);
        };
    });
    initLogBatchSelection();
    // 同步复选框高亮
    logList.querySelectorAll('.log-cb').forEach(cb => {
        cb.onchange = () => {
            const item = cb.closest('.log-item');
            if(item) item.classList.toggle('batch-selected', cb.checked);
        };
    });
}
// 框选功能
let logBatchDrag = null;
function initLogBatchSelection(){
    if(logBatchDrag && logBatchDrag.initialized) return;
    const rectEl = document.getElementById('logSelectRect');
    if(!rectEl) return;
    let dragging = false, startX = 0, startY = 0, startScrollTop = 0;
    logList.onmousedown = function onDown(e){
        if(!logBatchMode) return;
        if(e.button !== 0) return;
        if(e.target.closest('.log-select-cb')) return;
        if(e.target.closest('.log-delete-btn')) return;
        if(e.target.closest('.log-batch-bar')) return;
        startX = e.clientX;
        startY = e.clientY;
        startScrollTop = logList.scrollTop;
        dragging = false;
        const onMove = ev => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if(!dragging && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            ev.preventDefault();
            dragging = true;
            const rect = logList.getBoundingClientRect();
            const sx = Math.min(startX, ev.clientX);
            const sy = Math.min(startY, ev.clientY);
            rectEl.style.left = (sx - rect.left + logList.scrollLeft) + 'px';
            rectEl.style.top = (sy - rect.top + logList.scrollTop) + 'px';
            rectEl.style.width = Math.abs(dx) + 'px';
            rectEl.style.height = Math.abs(dy) + 'px';
            rectEl.style.display = 'block';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if(dragging){
                const selRect = rectEl.getBoundingClientRect();
                const isCtrl = e.ctrlKey || e.metaKey;
                logList.querySelectorAll('.log-item.batch-mode').forEach(item => {
                    const ir = item.getBoundingClientRect();
                    if(ir.right > selRect.left && ir.left < selRect.right && ir.bottom > selRect.top && ir.top < selRect.bottom){
                        const cb = item.querySelector('.log-cb');
                        if(!cb) return;
                        if(isCtrl){
                            // Ctrl+框选：只取消已选中的，不选中未选中的
                            if(cb.checked){
                                cb.checked = false;
                                item.classList.remove('batch-selected');
                            }
                        } else {
                            // 非Ctrl：正常选中
                            cb.checked = true;
                            item.classList.add('batch-selected');
                        }
                    }
                });
                logJustDragged = true;
                window.logJustDragged = true;
                setTimeout(() => { logJustDragged = false; window.logJustDragged = false; }, 50);
            }
            rectEl.style.display = 'none';
            dragging = false;
        };
        document.addEventListener('mousemove', onMove, {passive:false});
        document.addEventListener('mouseup', onUp);
    };
    logBatchDrag = {initialized:true};
}
let logBatchMode = false;
let logJustDragged = false;
function toggleLogBatch(){
    logBatchMode = !logBatchMode;
    // 进入批量模式时重置初始化标记，确保 onmousedown 重新绑定
    if(logBatchMode) logBatchDrag = null;
    const bar = document.getElementById('logBatchBar');
    const btn = document.getElementById('logBatchBtn');
    bar.style.display = logBatchMode ? 'flex' : 'none';
    btn.style.background = logBatchMode ? 'var(--line)' : '';
    if(!logBatchMode) document.getElementById('logSelectAll').checked = false;
    renderCanvasLog();
}
function toggleSelectAllLogs(checked){
    document.querySelectorAll('.log-cb').forEach(cb => cb.checked = checked);
}
function getSelectedLogIndices(){
    return [...document.querySelectorAll('.log-cb:checked')].map(cb => parseInt(cb.dataset.idx, 10)).filter(i => !isNaN(i));
}
function batchDeleteLogs(){
    const indices = getSelectedLogIndices();
    if(!indices.length) return alert('请先选择要删除的记录');
    if(!confirm(`确定要删除选中的 ${indices.length} 条记录吗？`)) return;
    const toRemove = new Set(indices);
    canvas.logs = canvas.logs.filter((_, i) => !toRemove.has(i));
    scheduleSave();
    toggleSelectAllLogs(false);
    renderCanvasLog();
}
function deleteFailedLogs(){
    const failedIndices = canvas.logs.map((log, i) => log.status === 'failed' ? i : -1).filter(i => i !== -1);
    if(!failedIndices.length) return alert('没有失败记录');
    if(!confirm(`确定要删除 ${failedIndices.length} 条失败记录吗？`)) return;
    const toRemove = new Set(failedIndices);
    canvas.logs = canvas.logs.filter((_, i) => !toRemove.has(i));
    scheduleSave();
    renderCanvasLog();
}
function batchDownloadLogs(){
    const indices = getSelectedLogIndices();
    if(!indices.length) return alert('请先选择要下载的记录');
    const urls = [];
    indices.forEach(i => {
        (canvas.logs[i]?.outputs || []).forEach(url => {
            if(isMissingAssetUrl(url)) return;
            if(!urls.includes(url)) urls.push(url);
        });
    });
    if(!urls.length) return alert('没有可下载的文件');
    const btn = document.getElementById('logBatchDownloadBtn');
    if(btn) { btn.disabled = true; btn.textContent = '打包中…'; }
    fetch('/api/canvas-assets/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urls, filename: 'canvas-outputs.zip' })
    }).then(resp => {
        if(!resp.ok) return resp.json().then(e => { throw new Error(e.detail || '下载失败'); });
        return resp.blob();
    }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'canvas-outputs.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }).catch(e => {
        alert('打包下载失败：' + (e.message || e));
    }).finally(() => {
        if(btn) { btn.disabled = false; btn.textContent = '批量下载'; }
    });
}
function openCanvasLog(){
    if(!ensureCanvas()) return;
    logBatchMode = false;
    document.getElementById('logBatchBar').style.display = 'none';
    document.getElementById('logBatchBtn').style.background = '';
    renderCanvasLog();
    logModal.classList.add('open');
}
function closeCanvasLog(){
    logModal.classList.remove('open');
}
function toggleHelpModal(){
    helpModal.classList.toggle('open');
}
function closeHelpModal(){
    helpModal.classList.remove('open');
}
function toggleSettingsModal(){
    settingsModal.classList.toggle('open');
}
function closeSettingsModal(){
    settingsModal.classList.remove('open');
}
function onShowGenTimeChange(checked){
    showGenTime = checked;
    localStorage.setItem('canvas_showGenTime', checked ? '1' : '0');
    render();
}
function onSwapCtrlShiftChange(checked){
    swapCtrlShift = checked;
    localStorage.setItem('canvas_swapCtrlShift', checked ? '1' : '0');
}
function onEnableXDeleteChange(checked){
    enableXDelete = checked;
    localStorage.setItem('canvas_enableXDelete', checked ? '1' : '0');
}
function onPreserveConnectionsChange(checked){
    preserveConnections = checked;
    localStorage.setItem('canvas_preserveConnections', checked ? '1' : '0');
}
function toggleMinimap(){
    const el = document.getElementById('minimap');
    if(!el) return;
    el.style.display = el.style.display === 'none' ? '' : 'none';
}
function resetZoomTo100(){
    if(!canvas) return;
    const rect = board.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const before = screenToWorld(rect.left + cx, rect.top + cy);
    viewport.scale = 1;
    viewport.x = cx - before.x * viewport.scale;
    viewport.y = cy - before.y * viewport.scale;
    applyViewport(); renderLinks(); renderSelectionHub();
}
function makePending(id, run, task={}){
    return {id, startedAt:nowMs(), run, ...task};
}
function mergeGeneratedOutputs(node, outputs, append=false){
    if(!node) return;
    const clean = (outputs || []).filter(url => url && !isVideoUrl(url));
    if(!append){
        node.generatedOutputs = clean;
        return;
    }
    const seen = new Set(node.generatedOutputs || []);
    node.generatedOutputs = [...(node.generatedOutputs || []), ...clean.filter(url => !seen.has(url) && seen.add(url))];
}
function pendingById(out, id){
    return (out?._pending || []).find(p => p.id === id) || null;
}
function collectRunMetas(out, ids){
    return (ids || []).map(id => pendingById(out, id)).filter(Boolean).map(p => ({
        runMs: nowMs() - Number(p.startedAt || nowMs()),
        run: p.run || {},
    }));
}
function collectRunMeta(out, id){
    return collectRunMetas(out, [id])[0] || {runMs:0, run:{}};
}
function findOutputByPendingId(pendingId){
    return nodes.find(n => n.type === 'output' && (n._pending || []).some(p => p.id === pendingId));
}
function findPendingTask(taskId){
    for(const out of nodes.filter(n => n.type === 'output')){
        const pending = (out._pending || []).find(p => p.canvasTaskId === taskId);
        if(pending) return {out, pending};
    }
    return null;
}
async function createCanvasImageTask(payload){
    const res = await fetch('/api/canvas-image-tasks', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(await responseErrorMessage(res, tr('canvas.generationFailed')));
    return res.json();
}
function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
async function pollCanvasImageTask(taskId){
    if(!taskId) return 'failed';
    if(activeCanvasTaskPolls.has(taskId)) return 'running';
    activeCanvasTaskPolls.add(taskId);
    try {
        while(true){
            const found = findPendingTask(taskId);
            if(!found) return 'missing';
            const res = await fetch(`/api/canvas-image-tasks/${encodeURIComponent(taskId)}`);
            if(!res.ok) throw new Error(await responseErrorMessage(res, tr('canvas.generationFailed')));
            const data = await res.json();
            if(data.status === 'succeeded'){
                completeCanvasImageTask(taskId, data.result || {});
                return 'succeeded';
            }
            if(data.status === 'failed'){
                failCanvasImageTask(taskId, data.error || tr('canvas.generationFailed'));
                return 'failed';
            }
            await sleep(1800);
        }
    } catch(err) {
        failCanvasImageTask(taskId, err.message || String(err));
        return 'failed';
    } finally {
        activeCanvasTaskPolls.delete(taskId);
    }
}
function completeCanvasImageTask(taskId, result){
    const found = findPendingTask(taskId);
    if(!found) return;
    const {out, pending} = found;
    const meta = {
        runMs: nowMs() - Number(pending.startedAt || nowMs()),
        run: pending.run || {},
    };
    meta.run.request = requestMetaFromResult(result);
    const images = result.images || [];
    out._pending = (out._pending || []).filter(p => p.id !== pending.id);
    appendOutputImages(out, images, meta.run?.refs?.[0], [meta]);
    const gen = nodes.find(n => n.id === meta.run?.node?.id);
    if(gen){
        mergeGeneratedOutputs(gen, images, Boolean(pending.appendGenerated));
        gen.runStatus = 'done';
        gen.runError = '';
        gen.running = false;
    }
    addGenerationLog({run:meta.run, outputs:images, runMs:meta.runMs || 0});
    refreshRunNodes(gen, out);
    scheduleSave();
}
function failCanvasImageTask(taskId, message){
    const found = findPendingTask(taskId);
    if(!found) return;
    const {out, pending} = found;
    const run = pending.run || {};
    const runMs = nowMs() - Number(pending.startedAt || nowMs());
    out._pending = (out._pending || []).filter(p => p.id !== pending.id);
    const gen = nodes.find(n => n.id === run?.node?.id);
    if(gen){
        gen.runStatus = 'failed';
        gen.runError = message || tr('canvas.generationFailed');
        gen.running = false;
    }
    addGenerationLog({run, outputs:[], runMs, error:message || tr('canvas.generationFailed')});
    refreshRunNodes(gen, out);
    scheduleSave();
}
function resumeCanvasImageTasks(){
    nodes.filter(n => n.type === 'output').forEach(out => {
        (out._pending || []).forEach(p => {
            if(p.canvasTaskType === 'online-image' && p.canvasTaskId) pollCanvasImageTask(p.canvasTaskId);
        });
    });
}
function renderOutputMedia(item, useGridLayout=false){
    const url = outputUrlValue(item);
    const safe = escapeAttr(url);
    const meta = item && typeof item === 'object' ? item : {};
    const grid = useGridLayout ? (meta.grid || null) : null;
    const gridStyle = grid ? ` style="grid-row:${Number(grid.row || 0) + 1};grid-column:${Number(grid.col || 0) + 1};aspect-ratio:${Math.max(1, Number(grid.w || 1))}/${Math.max(1, Number(grid.h || 1))}"` : '';
    const timePill = (showGenTime && meta.runMs) ? `<span class="output-time-pill">${formatRunDuration(meta.runMs)}</span>` : '';
    if(isMissingAssetUrl(url)){
        return `<div class="output-img-wrap" data-output-url="${safe}" data-missing-url="${safe}"${gridStyle}>${missingAssetHtml(url, true)}${timePill}<button class="output-del" title="${tr('common.delete')}">×</button></div>`;
    }
    if(isVideoUrl(url)){
        return `<div class="output-img-wrap" data-output-url="${safe}"${gridStyle}><video src="${safe}" data-url="${safe}" preload="metadata" muted playsinline></video>${timePill}<div class="output-video-badge"><i data-lucide="play" class="w-3 h-3"></i>VIDEO</div><button class="output-del" title="${tr('common.delete')}">×</button></div>`;
    }
    return `<div class="output-img-wrap" data-output-url="${safe}"${gridStyle}><img src="${safe}" data-url="${safe}" alt="generated output">${timePill}<button class="output-del" title="${tr('common.delete')}">×</button></div>`;
}
function outputGridLayout(node){
    const images = node?.images || [];
    if(!images.length || node?._pending?.length) return null;
    const layout = node.outputLayout;
    if(!layout || layout.type !== 'grid-split' || !layout.groupId) return null;
    const allMatch = images.every(item => item && typeof item === 'object' && item.grid?.groupId === layout.groupId);
    return allMatch ? layout : null;
}
function renderOutputGrid(node, pendingHtml=''){
    const layout = outputGridLayout(node);
    const gridClass = layout ? 'output-grid grid-layout' : 'output-grid';
    const style = layout ? ` style="--grid-cols:${Math.max(1, Number(layout.cols || 1))}"` : '';
    return `<div class="${gridClass}"${style}>${(node.images || []).map(item => renderOutputMedia(item, !!layout)).join('')}${pendingHtml}</div>`;
}
function outputImageName(url){
    const clean = (url || '').split('?')[0];
    const name = clean.split('/').filter(Boolean).pop();
    return name ? decodeURIComponent(name) : 'output image';
}
function setOutputDragPreview(event, img){
    if(!event.dataTransfer || !img) return;
    const wrap = document.createElement('div');
    wrap.className = 'output-drag-preview';
    wrap.style.position = 'fixed';
    wrap.style.left = '-9999px';
    const clone = img.cloneNode();
    clone.removeAttribute('id');
    clone.style.maxWidth = '200px';
    clone.style.maxHeight = '200px';
    clone.style.objectFit = 'contain';
    wrap.appendChild(clone);
    document.body.appendChild(wrap);
    const rect = img.getBoundingClientRect();
    event.dataTransfer.setDragImage(wrap, Math.min(rect.width / 2, 120), Math.min(rect.height / 2, 120));
    setTimeout(() => wrap.remove(), 0);
}
function appendOutputImages(out, images, compareRef, metas=[], layout=null){
    const list = (images || []).filter(Boolean);
    if(!out || !list.length) return;
    if(layout?.type === 'grid-split'){
        out.images = [];
        out.outputLayout = layout;
    } else if(out.outputLayout) {
        delete out.outputLayout;
    }
    out.images = [...(out.images || []), ...list.map((url, i) => {
        const meta = metas[i] || metas[0] || {};
        const item = {url, viewed:false, runMs:meta.runMs || 0, run:meta.run || null};
        if(meta.grid) item.grid = meta.grid;
        return item;
    })];
    if(compareRef?.url){
        out.imageComparisons = out.imageComparisons || {};
        list.forEach(url => {
            out.imageComparisons[url] = {url:compareRef.url, name:compareRef.name || 'input image'};
        });
    }
}
function outputCompareUrlFor(url, out){
    const source = out?.imageComparisons?.[url];
    if(typeof source === 'string' && source) return source;
    if(source?.url) return source.url;
    const meta = outputMetaFor(url, out);
    return meta?.run?.refs?.find(ref => ref?.url)?.url || '';
}
function markOutputViewed(out, url){
    if(!out || !url || !(out.images || []).length) return;
    let changed = false;
    out.images = out.images.map(item => {
        if(typeof item === 'string') return item;
        if(item?.url === url && !item.viewed){
            changed = true;
            return {...item, viewed:true};
        }
        return item;
    });
    if(changed){
        render();
        scheduleSave();
    }
}
function outputLightboxItems(out=null){
    const normalize = (item, sourceOut=null) => {
        const url = outputUrlValue(item);
        if(!url || isVideoUrl(url)) return null;
        return {url, outId:sourceOut?.id || ''};
    };
    // 从日志记录打开时，返回所有日志的 outputs（保持记录中的顺序）
    if(currentOutputFromLog){
        const allItems = [];
        (canvas?.logs || []).forEach(log => {
            (log.outputs || []).forEach(url => {
                const normalized = normalize(url, null);
                if(normalized) allItems.push(normalized);
            });
        });
        return allItems;
    }
    const sourceOut = out?.id ? nodes.find(n => n.id === out.id) || out : null;
    if(sourceOut){
        return (sourceOut.images || []).map(item => normalize(item, sourceOut)).filter(Boolean);
    }
    const outputNodeItems = nodes
        .filter(n => n.type === 'output')
        .flatMap(n => (n.images || []).map(item => normalize(item, n)).filter(Boolean));
    if(outputNodeItems.length) return outputNodeItems;
    return (canvas?.logs || [])
        .flatMap(log => (log.outputs || []).map(url => normalize(url, null)).filter(Boolean));
}
function navigateOutputLightbox(direction){
    if(!outputLightbox.classList.contains('open') || !currentOutputLightboxUrl) return false;
    let items = [];
    if(currentOutputFromLog){
        // 从日志打开时，使用所有日志的 outputs（与 outputLightboxItems 一致）
        items = outputLightboxItems(null);
    } else {
        const out = currentOutputLightboxOutId ? nodes.find(n => n.id === currentOutputLightboxOutId) : null;
        items = outputLightboxItems(out);
    }
    if(items.length < 2) return false;
    let idx = items.findIndex(item => item.url === currentOutputLightboxUrl);
    if(idx < 0) idx = 0;
    const next = items[(idx + direction + items.length) % items.length];
    const nextOut = next.outId ? nodes.find(n => n.id === next.outId) : null;
    openOutputLightbox(next.url, nextOut);
    return true;
}
function createImageCardFromOutput(url, point){
    if(!ensureCanvas() || !url) return;
    if(isVideoUrl(url)) return;
    const p = point || defaultPoint(0, 0);
    nodes.push({id:uid('img'), type:'image', x:p.x, y:p.y, url, name:outputImageName(url)});
    render();
    scheduleSave();
}
async function downloadUrl(url, filename){
    const res = await fetch(url);
    if(!res.ok) throw new Error('下载失败');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function setOutputCompareMode(active){
    outputPreview.classList.toggle('compare-mode', active);
    if(active){
        outputCompareOriginalWrap.style.clipPath = 'inset(0 50% 0 0)';
        outputCompareSlider.style.left = '50%';
    }
}
function outputResolutionText(text, meta=null, log=null){
    const parts = [text || '--'];
    // 比例
    if(meta?.run?.node?.width && meta?.run?.node?.height){
        const w = meta.run.node.width, h = meta.run.node.height;
        const gcd = (a,b) => b ? gcd(b, a%b) : a;
        const g = gcd(w,h);
        parts.push(`≈${w/g}:${h/g}`);
    }
    if(meta?.runMs || log?.runMs) parts.push(formatRunDuration(meta?.runMs || log?.runMs));
    outputResolution.innerHTML = parts.map((p,i) => i > 0 ? `<span style="opacity:.38">|</span>${p}` : p).join('');
}
function findLogForOutputUrl(url){
    return (canvas?.logs || []).find(log => (log.outputs || []).includes(url)) || null;
}
function setupLightboxInfoPanel(meta, log){
    currentOutputMeta = meta || null;
    currentOutputLog = log;
    const prompt = meta?.run?.prompt || log?.prompt || '';
    // 提示词
    outputPromptText.textContent = prompt || '无提示词';
    outputPromptText.classList.remove('expanded');
    // 判断提示词是否超过 8 行（每行约 46 个中文字符，按实际渲染判断）
    const lineCount = prompt ? Math.ceil(prompt.length / 46) : 0;
    outputPromptExpandBtn.style.display = lineCount > 8 ? 'block' : 'none';
    outputPromptExpandBtn.textContent = '展开';
    outputPromptExpandBtn.onclick = e => {
        e.stopPropagation();
        const expanded = outputPromptText.classList.toggle('expanded');
        outputPromptExpandBtn.textContent = expanded ? '收起' : '展开';
    };
    // 复制提示词
    outputCopyPromptBtn.onclick = e => {
        e.stopPropagation();
        if(!prompt) return;
        copyTextToClipboard(prompt);
        outputCopyPromptBtn.classList.add('copied');
        clearTimeout(outputCopyPromptBtn._copyTimer);
        outputCopyPromptBtn._copyTimer = setTimeout(() => outputCopyPromptBtn.classList.remove('copied'), 1200);
        // 显示复制成功提示
        outputCopyToast.style.display = '';
        outputCopyToast.textContent = '已复制';
        clearTimeout(outputCopyToast._timer);
        outputCopyToast._timer = setTimeout(() => { outputCopyToast.style.display = 'none'; }, 1500);
    };
    // 参考图
    const refs = meta?.run?.refs || log?.refs || [];
    if(refs.length){
        outputRefsSection.style.display = '';
        outputRefsList.innerHTML = refs.filter(r => r.url).map(r =>
            `<img src="${escapeAttr(r.url)}" alt="${escapeAttr(r.name || 'ref')}" title="${escapeAttr(r.name || '')}">`
        ).join('');
    } else {
        outputRefsSection.style.display = 'none';
        outputRefsList.innerHTML = '';
    }
    // 参数配置
    const node = meta?.run?.node || {};
    const platform = log?.platform || runPlatformLabel(meta?.run) || '';
    const model = log?.model || runTaskLabel(meta?.run) || '';
    const w = node.width || node.size?.split?.('x')?.[0] || '';
    const h = node.height || node.size?.split?.('x')?.[1] || '';
    const sizeStr = (w && h) ? `${w}×${h}` : '';
    const ratioMap = {square:'1:1', portrait:'2:3', landscape:'3:2', portrait43:'3:4', landscape43:'4:3', story:'9:16', wide:'16:9'};
    let ratioLabel = '';
    if(node.ratio && node.ratio !== 'source' && node.ratio !== 'custom') {
        ratioLabel = ratioMap[node.ratio] || node.ratio;
    } else if(node.ratio === 'custom' && node.customRatio) {
        ratioLabel = node.customRatio;
    }
    // source / 无 ratio / custom 无值 → 等图片加载后从实际尺寸推断
    const quality = node.quality || '';
    const format = node.format || 'png';
    const createdStr = log?.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '';
    const runStr = (meta?.runMs || log?.runMs) ? formatRunDuration(meta?.runMs || log?.runMs) : '';
    const params = [
        platform && {label:'平台', value:platform},
        model && {label:'模型', value:model},
        ratioLabel && {label:'比例', value:ratioLabel},
        {label:'尺寸', value:sizeStr || '—'},
        quality && {label:'质量', value:quality},
        format && {label:'格式', value:format},
    ].filter(Boolean);
    outputParamsGrid.innerHTML = params.map(p =>
        `<div class="info-param-item"${p.label === '尺寸' ? ' data-param="size"' : p.label === '比例' ? ' data-param="ratio"' : ''}><span class="info-param-label">${p.label}</span><span class="info-param-value">${escapeHtml(p.value)}</span></div>`
    ).join('');
    // 创建时间 + 耗时
    if(createdStr || runStr){
        const timeText = [createdStr && `创建于 ${createdStr}`, runStr && `耗时 ${runStr}`].filter(Boolean).join(' · ');
        outputParamsGrid.innerHTML += `<div class="info-param-item" style="grid-column:1/-1"><span class="info-param-value" style="font-weight:400;color:var(--faint);font-size:11px">${escapeHtml(timeText)}</span></div>`;
    }
    // 再次运行（有 run 数据或日志中有 model 信息时显示）
    const hasRunData = !!(meta?.run?.nodeType || log?.run?.nodeType || log?.model);
    outputRerunBtn.style.display = hasRunData ? '' : 'none';
    outputRerunBtn.onclick = e => {
        e.stopPropagation();
        rerunFromOutputMeta(currentOutputMeta);
    };
    // 发送到画布
    outputSendToCanvasBtn.onclick = e => {
        e.stopPropagation();
        const url = currentOutputLightboxUrl;
        if(url) sendOutputToCanvas(url);
    };
    outputI2IBtn.style.display = isVideoUrl(currentOutputLightboxUrl) ? 'none' : '';
    outputI2IBtn.onclick = e => {
        e.stopPropagation();
        const url = currentOutputLightboxUrl;
        if(url) sendOutputToImageToImage(url);
    };
    // 删除记录（仅从日志打开时显示）
    outputDeleteBtn.style.display = currentOutputFromLog ? '' : 'none';
    outputDeleteBtn.onclick = e => {
        e.stopPropagation();
        deleteOutputFromLightbox();
    };
}
function sendOutputToCanvas(url){
    if(!ensureCanvas()){
        alert('需要先打开一个画布才能发送图片');
        return;
    }
    if(!url) return;
    const img = new Image();
    img.onload = () => {
        const w = Math.min(img.naturalWidth, 512);
        const h = Math.min(img.naturalHeight, 512);
        const p = findEmptyPoint(w, h);
        const node = {
            id:uid('image'), type:'image', x:p.x, y:p.y,
            w, h, url, inputs:[]
        };
        nodes.push(node);
        render();
        scheduleSave();
        closeOutputLightbox();
        closeCanvasLog();
        // 聚焦到新节点，缩放设为 100%
        viewport.scale = 1;
        const rect = board.getBoundingClientRect();
        viewport.x = rect.width / 2 - (p.x + w / 2) * viewport.scale;
        viewport.y = rect.height / 2 - (p.y + h / 2) * viewport.scale;
        applyViewport();
    };
    img.src = url;
}
function getOutputI2IPromptText(meta, log){
    return meta?.run?.prompt || log?.prompt || '';
}
function spawnOutputI2IChain(url, meta, log){
    if(!ensureCanvas()){
        alert('需要先打开一个画布才能发送图片');
        return;
    }
    if(!url) return;
    const img = new Image();
    img.onload = () => {
        const promptText = getOutputI2IPromptText(meta, log);
        const providerId = imageApiProviders()[0]?.id || '';
        const model = allImageModels(providerId)[0] || '';
        const chain = window.StudioOutputI2I?.buildOutputI2IChain?.({
            imageUrl: url,
            imageName: outputImageName(url),
            promptText,
            point: findEmptyPoint(900, 260),
            uid,
            providerId,
            model
        });
        if(!chain) return;
        pushUndo();
        nodes.push(...chain.nodes);
        connections.push(...chain.connections);
        syncGeneratorInputs();
        render();
        scheduleSave();
        closeOutputLightbox();
        closeCanvasLog();
        const generator = nodes.find(n => n.id === chain.generatorNodeId);
        if(generator){
            viewport.scale = 1;
            const rect = board.getBoundingClientRect();
            viewport.x = rect.width / 2 - (generator.x + (generator.w || defaultNodeSize(generator.type).w || 380) / 2) * viewport.scale;
            viewport.y = rect.height / 2 - (generator.y + (generator.h || defaultNodeSize(generator.type).h || 160) / 2) * viewport.scale;
            applyViewport();
        }
    };
    img.src = url;
}
function deleteOutputFromLightbox(){
    const url = currentOutputLightboxUrl;
    const log = currentOutputLog;
    if(!url) return;
    if(!confirm('确定要删除这条记录吗？')) return;
    // 从 log 中移除
    if(log){
        log.outputs = (log.outputs || []).filter(u => u !== url);
        if(!log.outputs.length){
            canvas.logs = canvas.logs.filter(l => l.id !== log.id);
        }
    }
    // 从 output 节点中移除
    if(canvas){
        canvas.outputs = (canvas.outputs || []).filter(o => o.url !== url);
    }
    scheduleSave();
    closeOutputLightbox();
    renderCanvasLog();
}
function setupOutputPromptPanel(meta, log){
    setupLightboxInfoPanel(meta, log);
}
function outputI2IBaseNode(meta, log){
    const base = JSON.parse(JSON.stringify(meta?.run?.node || log?.run?.node || {}));
    if(base && Object.keys(base).length) return base;
    if(log?.model){
        const inferredType = log.nodeType || 'generator';
        const req = log.request || {};
        return {
            type: inferredType,
            model: log.model || '',
            apiProvider: log.platform || '',
            prompt: log.prompt || '',
            ratio: req.ratio || req.aspect_ratio || '',
            resolution: req.resolution || req.size || '',
            width: req.width || '',
            height: req.height || '',
            quality: req.quality || '',
            format: req.format || 'png',
            customRatio: req.customRatio || '',
            customSize: req.customSize || '',
            customRatioWidth: req.customRatioWidth || '',
            customRatioHeight: req.customRatioHeight || '',
            customWidth: req.customWidth || '',
            customHeight: req.customHeight || '',
        };
    }
    const providerId = imageApiProviders()[0]?.id || '';
    return {
        type: 'generator',
        apiProvider: providerId,
        model: allImageModels(providerId)[0] || '',
        ratio: 'square',
        resolution: '1k',
        customRatio: '',
        customSize: '',
        customRatioWidth: '',
        customRatioHeight: '',
        customWidth: '',
        customHeight: '',
    };
}
function outputI2IChainFootprint(baseNode){
    const promptSize = {w:310, h:180};
    const imageSize = {w:260, h:336};
    const generatorSize = {
        w:Number(baseNode?.w || defaultNodeSize('generator').w || 380),
        h:Number(baseNode?.h || defaultNodeSize('generator').h || 160)
    };
    const columnGap = 220;
    const rowGap = 80;
    const leftColumnW = Math.max(promptSize.w, imageSize.w);
    const leftColumnH = promptSize.h + rowGap + imageSize.h;
    return {
        w:leftColumnW + columnGap + generatorSize.w,
        h:Math.max(leftColumnH, generatorSize.h)
    };
}
function sendOutputToImageToImage(url){
    if(!ensureCanvas()){
        alert('需要先打开一个画布才能发送图片');
        return;
    }
    if(!url) return;
    const meta = currentOutputMeta || null;
    const log = currentOutputLog || null;
    const promptText = String(meta?.run?.prompt || log?.prompt || '');
    const baseNode = outputI2IBaseNode(meta, log);
    const footprint = outputI2IChainFootprint(baseNode);
    const point = findEmptyPoint(footprint.w, footprint.h);
    const helper = window.StudioOutputI2I?.buildOutputI2IChain;
    if(typeof helper !== 'function'){
        alert('图生图功能未加载完成');
        return;
    }
    pushUndo();
    const chain = helper({
        imageUrl: url,
        imageName: outputImageName(url),
        promptText,
        point,
        generatorBase: baseNode,
        uid: kind => uid(kind),
    });
    chain.nodes.forEach(node => nodes.push(node));
    chain.connections.forEach(conn => connections.push(conn));
    syncGeneratorInputs();
    refreshGeneratorInputViews();
    render();
    scheduleSave();
    closeOutputLightbox();
    closeCanvasLog();
    selected.clear();
    if(chain.focusId) selected.add(chain.focusId);
    viewport.scale = 1;
    const rect = board.getBoundingClientRect();
    const focusRect = chain.focusRect || {x:point.x, y:point.y, w:footprint.w, h:footprint.h};
    viewport.x = rect.width / 2 - (focusRect.x + (focusRect.w || 0) / 2) * viewport.scale;
    viewport.y = rect.height / 2 - (focusRect.y + (focusRect.h || 0) / 2) * viewport.scale;
    applyViewport();
}
function spawnOutputI2IChain(url, meta, log){
    currentOutputMeta = meta || currentOutputMeta;
    currentOutputLog = log || currentOutputLog;
    sendOutputToImageToImage(url);
}
function spawnImageNodeI2IChain(sourceNodeId){
    if(!ensureCanvas()){
        alert('需要先打开一个画布才能发送图片');
        return;
    }
    const sourceNode = nodes.find(n => n.id === sourceNodeId && n.type === 'image');
    if(!sourceNode || !sourceNode.url) return;
    const helper = window.StudioOutputI2I?.buildImageNodeI2IChain;
    if(typeof helper !== 'function'){
        alert('图生图功能未加载完成');
        return;
    }
    const sourceRect = nodeRect(sourceNode);
    const providerId = imageApiProviders()[0]?.id || '';
    const generatorBase = {
        ...outputI2IBaseNode(null, null),
        apiProvider: providerId,
        model: allImageModels(providerId)[0] || ''
    };
    pushUndo();
    const chain = helper({
        sourceNodeId,
        sourceRect,
        promptText: '',
        generatorBase,
        uid: kind => uid(kind)
    });
    if(!chain) return;
    chain.nodes.forEach(node => nodes.push(node));
    chain.connections.forEach(conn => connections.push(conn));
    syncGeneratorInputs();
    refreshGeneratorInputViews();
    render();
    scheduleSave();
    selected.clear();
    if(chain.generatorNodeId) selected.add(chain.generatorNodeId);
    viewport.scale = 1;
    const rect = board.getBoundingClientRect();
    const focusRect = chain.focusRect || sourceRect;
    viewport.x = rect.width / 2 - (focusRect.x + (focusRect.w || 0) / 2) * viewport.scale;
    viewport.y = rect.height / 2 - (focusRect.y + (focusRect.h || 0) / 2) * viewport.scale;
    applyViewport();
}
function rerunFromOutputMeta(meta){
    const log = currentOutputLog;
    if(!meta?.run?.nodeType && log?.run?.nodeType) meta = {run: log.run};
    // 从日志构造最小 run 对象（兼容旧数据或 nodeType 缺失的情况）
    if(!meta?.run?.nodeType && log?.model) {
        const inferredType = log.nodeType || 'generator';
        const req = log.request || {};
        meta = {run: {
            nodeType: inferredType,
            node: {
                type: inferredType,
                model: log.model,
                apiProvider: log.platform || '',
                prompt: log.prompt || '',
                ratio: req.ratio || req.aspect_ratio || '',
                resolution: req.resolution || req.size || '',
                width: req.width || '',
                height: req.height || '',
                quality: req.quality || '',
                format: req.format || 'png',
                customRatio: req.customRatio || '',
                customSize: req.customSize || '',
                customRatioWidth: req.customRatioWidth || '',
                customRatioHeight: req.customRatioHeight || '',
                customWidth: req.customWidth || '',
                customHeight: req.customHeight || '',
            },
            prompt: log.prompt || '',
            refs: log.refs || [],
            taskLabel: log.model,
        }};
    }
    if(!ensureCanvas() || !meta?.run?.nodeType) return;
    const base = JSON.parse(JSON.stringify(meta.run.node || {}));
    const mainW = (base.w || defaultNodeSize(meta.run.nodeType).w || 200);
    const mainH = (base.h || defaultNodeSize(meta.run.nodeType).h || 160);
    const p = findEmptyPoint(mainW, mainH);
    const node = {...base, id:uid(base.type || meta.run.nodeType), type:meta.run.nodeType, x:p.x, y:p.y, inputs:[], running:false};
    nodes.push(node);
    const prompt = meta.run.prompt || '';
    if(prompt){
        const promptNode = {id:uid('pr'), type:'prompt', x:p.x - 340, y:p.y, text:prompt};
        nodes.push(promptNode);
        connections.push({id:uid('c'), from:promptNode.id, to:node.id});
    }
    (meta.run.refs || []).slice(0, 8).forEach((ref, i) => {
        const imgNode = {id:uid('img'), type:'image', x:p.x - 340, y:p.y + 110 + i * 86, url:ref.url, name:ref.name || 'image'};
        nodes.push(imgNode);
        connections.push({id:uid('c'), from:imgNode.id, to:node.id});
    });
    closeOutputLightbox();
    closeCanvasLog();
    render();
    scheduleSave();
    // 聚焦到主节点，缩放设为 100%
    viewport.scale = 1;
    const rect = board.getBoundingClientRect();
    viewport.x = rect.width / 2 - (p.x + mainW / 2) * viewport.scale;
    viewport.y = rect.height / 2 - (p.y + mainH / 2) * viewport.scale;
    applyViewport();
}
function updateOutputCompareSlider(clientX){
    const rect = outputCompareContainer.getBoundingClientRect();
    if(!rect.width) return;
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    outputCompareOriginalWrap.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
    outputCompareSlider.style.left = `${percent}%`;
}
function applyOutputPreviewZoom(){
    const transform = `translate(${outputPreviewPan.x}px, ${outputPreviewPan.y}px) scale(${outputPreviewZoom})`;
    [outputLightboxImg, outputCompareResult, outputCompareOriginal].forEach(img => {
        img.style.transform = transform;
        img.style.transformOrigin = '0 0';
    });
    outputPreview.classList.toggle('zoomed', outputPreviewZoom > 1.001);
}
function resetOutputPreviewZoom(){
    outputPreviewZoom = 1;
    outputPreviewPan = {x: 0, y: 0};
    outputPreviewPanDrag = null;
    outputPreview.classList.remove('panning');
    applyOutputPreviewZoom();
}
function initOutputPreviewZoomEvents(){
    outputPreview.addEventListener('wheel', e => {
        if(outputLightboxVideo.style.display === 'block') return;
        e.preventDefault();
        e.stopPropagation();
        const rect = outputPreview.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const before = {
            x:(localX - outputPreviewPan.x) / outputPreviewZoom,
            y:(localY - outputPreviewPan.y) / outputPreviewZoom
        };
        const factor = e.deltaY > 0 ? .9 : 1.1;
        const nextZoom = Math.max(0.25, Math.min(6, outputPreviewZoom * factor));
        outputPreviewZoom = nextZoom;
        outputPreviewPan = {
            x:localX - before.x * nextZoom,
            y:localY - before.y * nextZoom
        };
        applyOutputPreviewZoom();
    }, {passive:false});
    outputPreview.addEventListener('mousedown', e => {
        if(outputLightboxVideo.style.display === 'block') return;
        if(e.button !== 0) return;
        if(e.target.closest('.output-preview-actions, .output-resolution, .output-compare-slider')) return;
        outputPreviewPanDrag = {
            sx:e.clientX,
            sy:e.clientY,
            ox:outputPreviewPan.x,
            oy:outputPreviewPan.y
        };
        outputPreview.classList.add('panning');
        e.preventDefault();
        e.stopPropagation();
    });
    window.addEventListener('mousemove', e => {
        if(!outputPreviewPanDrag) return;
        outputPreviewPan = {
            x:outputPreviewPanDrag.ox + e.clientX - outputPreviewPanDrag.sx,
            y:outputPreviewPanDrag.oy + e.clientY - outputPreviewPanDrag.sy
        };
        applyOutputPreviewZoom();
    });
    window.addEventListener('mouseup', () => {
        outputPreviewPanDrag = null;
        outputPreview.classList.remove('panning');
    });
}
function initOutputCompareEvents(){
    outputCompareContainer.addEventListener('mousedown', e => {
        outputCompareDrag = true;
        updateOutputCompareSlider(e.clientX);
        e.preventDefault();
        e.stopPropagation();
    });
    outputCompareSlider.addEventListener('mousedown', e => {
        outputCompareDrag = true;
        e.preventDefault();
        e.stopPropagation();
    });
    window.addEventListener('mousemove', e => {
        if(outputCompareDrag) updateOutputCompareSlider(e.clientX);
    });
    window.addEventListener('mouseup', () => { outputCompareDrag = false; });
    outputCompareContainer.addEventListener('touchstart', e => {
        outputCompareDrag = true;
        updateOutputCompareSlider(e.touches[0].clientX);
        e.preventDefault();
        e.stopPropagation();
    }, {passive:false});
    window.addEventListener('touchmove', e => {
        if(outputCompareDrag) {
            updateOutputCompareSlider(e.touches[0].clientX);
            e.preventDefault();
        }
    }, {passive:false});
    window.addEventListener('touchend', () => { outputCompareDrag = false; });
}
function openOutputLightbox(url, out){
    if(!url) return;
    resetOutputPreviewZoom();
    currentOutputLightboxOutId = out?.id || '';
    currentOutputLightboxUrl = url;
    currentOutputFromLog = !out; // 没有 out 参数说明是从日志打开的
    const meta = outputMetaFor(url, out);
    const log = findLogForOutputUrl(url);
    markOutputViewed(out, url);
    setupOutputPromptPanel(meta, log);
    outputResolutionText('--', meta, log);
    currentOutputCompareUrl = outputCompareUrlFor(url, out);
    setOutputCompareMode(false);
    const videoMode = isVideoUrl(url);
    outputLightboxImg.style.display = videoMode ? 'none' : 'block';
    outputLightboxVideo.style.display = videoMode ? 'block' : 'none';
    outputCompareResult.style.display = videoMode ? 'none' : 'block';
    outputCompareOriginal.style.display = videoMode ? 'none' : 'block';
    if(videoMode){
        outputLightboxImg.src = '';
        outputCompareResult.src = '';
        outputCompareOriginal.src = '';
        outputLightboxVideo.onloadedmetadata = () => {
            const actualSize = outputLightboxVideo.videoWidth && outputLightboxVideo.videoHeight
                ? `${outputLightboxVideo.videoWidth} x ${outputLightboxVideo.videoHeight}`
                : 'Video';
            outputResolutionText(actualSize, meta, log);
            // 同时更新右侧参数配置区域的尺寸（如果存在）
            const sizeItem = outputParamsGrid.querySelector('.info-param-item[data-param="size"]');
            if(sizeItem){
                const valueSpan = sizeItem.querySelector('.info-param-value');
                if(valueSpan) valueSpan.textContent = actualSize;
            }
        };
        outputLightboxVideo.src = url;
        outputPreview.ondblclick = null;
        outputDownloadBtn.onclick = e => {
            e.stopPropagation();
            downloadUrl(url, outputDownloadName(url)).catch(err => alert(err.message || '下载失败'));
        };
        outputLightbox.classList.add('open');
        refreshIcons();
        return;
    }
    outputLightboxVideo.pause();
    outputLightboxVideo.src = '';
    outputLightboxImg.draggable = false;
    outputCompareResult.draggable = false;
    outputCompareOriginal.draggable = false;
    outputLightboxImg.onload = () => {
        const actualW = outputLightboxImg.naturalWidth;
        const actualH = outputLightboxImg.naturalHeight;
        const actualSize = `${actualW} x ${actualH}`;
        outputResolutionText(actualSize, meta, log);
        // 同时更新右侧参数配置区域的尺寸（如果存在）
        const sizeItem = outputParamsGrid.querySelector('.info-param-item[data-param="size"]');
        if(sizeItem){
            const valueSpan = sizeItem.querySelector('.info-param-value');
            if(valueSpan) valueSpan.textContent = actualSize;
        }
        // 从实际尺寸推断比例并插入/更新比例行
        if(actualW && actualH){
            const parts = ratioPartsFromDimensions(actualW, actualH);
            if(parts){
                let ratioItem = outputParamsGrid.querySelector('.info-param-item[data-param="ratio"]');
                if(!ratioItem){
                    ratioItem = document.createElement('div');
                    ratioItem.className = 'info-param-item';
                    ratioItem.dataset.param = 'ratio';
                    ratioItem.innerHTML = '<span class="info-param-label">比例</span><span class="info-param-value"></span>';
                    if(sizeItem) sizeItem.before(ratioItem);
                    else outputParamsGrid.appendChild(ratioItem);
                }
                const ratioValue = ratioItem.querySelector('.info-param-value');
                if(ratioValue) ratioValue.textContent = `${parts.width}:${parts.height}`;
            }
        }
    };
    outputLightboxImg.src = url;
    outputCompareResult.src = url;
    outputCompareOriginal.src = currentOutputCompareUrl || '';
    outputPreview.ondblclick = e => {
        e.stopPropagation();
        if(!currentOutputCompareUrl) return;
        setOutputCompareMode(!outputPreview.classList.contains('compare-mode'));
    };
    outputDownloadBtn.onclick = e => {
        e.stopPropagation();
        downloadUrl(url, outputDownloadName(url)).catch(err => alert(err.message || '下载失败'));
    };
    outputLightbox.classList.add('open');
    refreshIcons();
}
function closeOutputLightbox(){
    outputLightbox.classList.remove('open');
    setOutputCompareMode(false);
    outputLightboxImg.src = '';
    outputLightboxVideo.pause();
    outputLightboxVideo.src = '';
    outputLightboxVideo.style.display = 'none';
    outputLightboxImg.style.display = 'block';
    outputCompareResult.style.display = 'block';
    outputCompareOriginal.style.display = 'block';
    outputCompareResult.src = '';
    outputCompareOriginal.src = '';
    outputPreview.ondblclick = null;
    resetOutputPreviewZoom();
    currentOutputCompareUrl = '';
    currentOutputMeta = null;
    currentOutputLog = null;
    currentOutputLightboxOutId = '';
    currentOutputLightboxUrl = '';
    currentOutputFromLog = false;
    outputPromptText.classList.remove('expanded');
    outputCopyToast.style.display = 'none';
    outputRefsList.innerHTML = '';
    outputParamsGrid.innerHTML = '';
    setupOutputPromptPanel(null);
}
function groupSelectedImages(){
    if(!ensureCanvas()) return;
    const targets = [...selected].map(id => nodes.find(n => n.id === id)).filter(n => n?.type === 'image' || n?.type === 'prompt');
    let group;
    pushUndo();
    if(targets.length){
        const box = nodeBounds(targets.map(n => n.id));
        group = {id:uid('grp'), type:'group', x:box.x - 24, y:box.y - 58, w:box.w + 48, h:box.h + 90, items:targets.map(n => n.id)};
    } else {
        const p = defaultPoint(0, 0);
        group = {id:uid('grp'), type:'group', x:p.x, y:p.y, w:300, h:220, items:[]};
    }
    nodes.push(group);
    if(targets.length) handoffExistingInputsToGroup(group, targets);
    selected.clear();
    selected.add(group.id);
    syncGeneratorInputs();
    refreshGeneratorInputViews();
    render();
    scheduleSave();
}
function nodeBounds(ids){
    const rects = ids.map(id => {
        const n = nodes.find(item => item.id === id);
        const el = nodesEl.querySelector(`.node[data-id="${id}"]`);
        if(!n) return null;
        return {x:n.x, y:n.y, w:el?.offsetWidth || n.w || 260, h:el?.offsetHeight || n.h || 220};
    }).filter(Boolean);
    const x1 = Math.min(...rects.map(r => r.x));
    const y1 = Math.min(...rects.map(r => r.y));
    const x2 = Math.max(...rects.map(r => r.x + r.w));
    const y2 = Math.max(...rects.map(r => r.y + r.h));
    return {x:x1, y:y1, w:x2 - x1, h:y2 - y1};
}

function startSelection(e){
    e.preventDefault();
    e.stopPropagation();
    if(document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    selectDrag = {sx:e.clientX, sy:e.clientY, x:e.clientX, y:e.clientY};
    document.body.classList.add('canvas-selecting');
    selectionBox.style.display = 'block';
    updateSelectionBox(e.clientX, e.clientY);
    window.onmousemove = e2 => updateSelectionBox(e2.clientX, e2.clientY);
    window.onmouseup = finishSelection;
}
function updateSelectionBox(x, y){
    if(!selectDrag) return;
    selectDrag.x = x; selectDrag.y = y;
    const left = Math.min(selectDrag.sx, x);
    const top = Math.min(selectDrag.sy, y);
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${Math.abs(x - selectDrag.sx)}px`;
    selectionBox.style.height = `${Math.abs(y - selectDrag.sy)}px`;
}
function finishSelection(){
    if(!selectDrag) return;
    const rect = selectionBox.getBoundingClientRect();
    selectionBox.style.display = 'none';
    selected.clear();
    nodesEl.querySelectorAll('.node').forEach(el => {
        const r = el.getBoundingClientRect();
        const overlaps = r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top;
        if(overlaps) selected.add(el.dataset.id);
    });
    selectDrag = null;
    document.body.classList.remove('canvas-selecting');
    window.onmousemove = null;
    window.onmouseup = null;
    render();
}
function renderSelectionHub(){
    selectionHub.innerHTML = '';
    selectionHub.classList.remove('open');
}
function startSelectionLink(e, kind){
    e.preventDefault();
    e.stopPropagation();
    const p = screenToWorld(e.clientX, e.clientY);
    tempLink = {from:`selection:${kind}`, x1:p.x, y1:p.y, x2:p.x, y2:p.y};
    window.onmousemove = e2 => { const next = screenToWorld(e2.clientX, e2.clientY); tempLink.x2 = next.x; tempLink.y2 = next.y; renderLinks(); };
    window.onmouseup = e2 => {
        const targetPort = nearestPort(e2.clientX, e2.clientY, 'in');
        const target = targetPort?.closest('.generator-node');
        if(target) connectSelectionToGenerator(kind, target.dataset.id);
        tempLink = null;
        window.onmousemove = null;
        window.onmouseup = null;
        render();
        scheduleSave();
    };
}
function connectSelectionToGenerator(kind, genId){
    const ids = [...selected];
    let source = null;
    if(kind === 'images'){
        const imgs = ids.map(id => nodes.find(n => n.id === id)).filter(n => n?.type === 'image' && n.url);
        if(!imgs.length) return;
        const box = nodeBounds(imgs.map(n => n.id));
        source = {id:uid('grp'), type:'group', x:box.x - 24, y:box.y - 58, w:box.w + 48, h:box.h + 90, items:imgs.map(n => n.id)};
    } else {
        const prompts = ids.map(id => nodes.find(n => n.id === id)).filter(n => n?.type === 'prompt');
        if(!prompts.length) return;
        const box = nodeBounds(prompts.map(n => n.id));
        source = {id:uid('pg'), type:'promptGroup', x:box.x - 24, y:box.y - 58, w:box.w + 48, h:box.h + 90, items:prompts.map(n => n.id)};
    }
    nodes.push(source);
    connections.push({id:uid('c'), from:source.id, to:genId});
    selected.clear();
    selected.add(source.id);
    syncGeneratorInputs();
}

function pushUndo(){
    if(!canvas) return;
    undoStack.push({nodes:JSON.parse(JSON.stringify(nodes)), connections:JSON.parse(JSON.stringify(connections))});
    if(undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack = [];
}
function performUndo(){
    if(!canvas || !undoStack.length) return;
    redoStack.push({nodes:JSON.parse(JSON.stringify(nodes)), connections:JSON.parse(JSON.stringify(connections))});
    const state = undoStack.pop();
    nodes = state.nodes;
    connections = state.connections;
    selected.clear();
    render();
    scheduleSave();
}
function performRedo(){
    if(!canvas || !redoStack.length) return;
    undoStack.push({nodes:JSON.parse(JSON.stringify(nodes)), connections:JSON.parse(JSON.stringify(connections))});
    const state = redoStack.pop();
    nodes = state.nodes;
    connections = state.connections;
    selected.clear();
    render();
    scheduleSave();
}
function cloneNode(n, dx, dy){
    const copy = JSON.parse(JSON.stringify(n));
    copy.id = uid(n.type);
    copy.x = n.x + dx;
    copy.y = n.y + dy;
    copy.running = false;
    return copy;
}
function copySelectedNodes(){
    if(!canvas || !selected.size) return;
    const el = document.activeElement;
    if(el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
    const toCopy = [...selected].map(id => nodes.find(n => n.id === id)).filter(Boolean);
    if(!toCopy.length) return;
    clipboard.nodes = JSON.parse(JSON.stringify(toCopy));
    // 保存所有与选中节点相关的连接（含内部连接和与外部节点的输入/输出）
    if(preserveConnections){
        const selSet = new Set([...selected]);
        clipboard.connections = connections
            .filter(c => selSet.has(c.from) || selSet.has(c.to))
            .map(c => ({...c}));
    } else {
        clipboard.connections = [];
    }
}
function pasteNodes(){
    if(!canvas || !clipboard?.nodes?.length) return;
    pushUndo();
    const xs = clipboard.nodes.map(n => n.x), ys = clipboard.nodes.map(n => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const dx = lastMouseBoard.x - cx;
    const dy = lastMouseBoard.y - cy;
    const idMap = new Map();
    const copies = clipboard.nodes.map(n => { const c = cloneNode(n, dx, dy); idMap.set(n.id, c.id); return c; });
    copies.forEach(c => {
        if((c.type === 'group' || c.type === 'promptGroup') && c.items)
            c.items = c.items.map(id => idMap.get(id) || id);
    });
    // 复制 clipboard 节点之间的连接（使用复制时的快照）
    const pasteConns = (clipboard.connections || [])
        .map(c => ({
            ...c,
            id: uid('c'),
            from: idMap.get(c.from) || c.from,
            to: idMap.get(c.to) || c.to
        }));
    connections.push(...pasteConns);
    nodes.push(...copies);
    selected.clear();
    copies.forEach(c => selected.add(c.id));
    render();
    scheduleSave();
}
function startNodeDrag(e, node){
    if(e.button !== 0) return;
    if(startKnifeDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    pushUndo();
    let dragTarget = node;
    if(e.altKey){
        // 如果拖动的节点在多选里，则克隆所有选中节点
        if(selected.has(node.id) && selected.size > 1){
            const idMap = new Map();
            const copies = [...selected].map(id => nodes.find(n => n.id === id)).filter(Boolean).map(n => {
                const c = cloneNode(n, 0, 0);
                idMap.set(n.id, c.id);
                return c;
            });
            // 处理 group/promptGroup 的 items 映射
            copies.forEach(c => {
                if((c.type === 'group' || c.type === 'promptGroup') && c.items){
                    c.items = c.items.map(id => idMap.get(id) || id);
                }
            });
            // 复制与选中节点相关的所有连接（含与外部节点的输入/输出）
            if(preserveConnections){
                const selSet = new Set([...selected]);
                const newConns = connections
                    .filter(c => selSet.has(c.from) || selSet.has(c.to))
                    .map(c => ({...c, id:uid('c'), from:idMap.get(c.from) || c.from, to:idMap.get(c.to) || c.to}));
                connections.push(...newConns);
            }
            nodes.push(...copies);
            selected.clear();
            copies.forEach(c => selected.add(c.id));
            dragTarget = copies.find(c => c.id === idMap.get(node.id)) || copies[0];
            render();
        } else {
            // 单选或拖动的节点未选中：只克隆当前节点
            const copy = cloneNode(node, 0, 0);
            const isGroup = node.type === 'group' || node.type === 'promptGroup';
            if(isGroup && node.items?.length){
                const idMap = new Map();
                const childCopies = node.items
                    .map(id => nodes.find(n => n.id === id)).filter(Boolean)
                    .map(child => { const cc = cloneNode(child, 0, 0); idMap.set(child.id, cc.id); return cc; });
                copy.items = copy.items.map(id => idMap.get(id) || id);
                nodes.push(...childCopies, copy);
            } else {
                nodes.push(copy);
            }
            // 复制与原节点相关的所有连接（含与未复制节点的连接）
            if(preserveConnections){
                const idMapSingle = new Map([[node.id, copy.id]]);
                connections.forEach(c => {
                    if(c.from === node.id || c.to === node.id){
                        connections.push({
                            ...c,
                            id: uid('c'),
                            from: idMapSingle.get(c.from) || c.from,
                            to: idMapSingle.get(c.to) || c.to
                        });
                    }
                });
            }
            selected.clear();
            selected.add(copy.id);
            dragTarget = copy;
            render();
        }
    }
    const isGroup = dragTarget.type === 'group' || dragTarget.type === 'promptGroup';
    const collected = new Map();
    const collect = n => {
        if(!n || collected.has(n.id) || n.id === dragTarget.id) return;
        collected.set(n.id, {node:n, ox:n.x, oy:n.y});
        if(n.type === 'group' || n.type === 'promptGroup'){
            (n.items || []).map(id => nodes.find(x => x.id === id)).forEach(collect);
        }
    };
    if(isGroup){
        (dragTarget.items || []).map(id => nodes.find(n => n.id === id)).forEach(collect);
    }
    // 如果被拖节点在多选里，所有其他选中节点（含其组成员）一起移动
    if(selected.has(dragTarget.id) && selected.size > 1){
        [...selected].forEach(id => collect(nodes.find(n => n.id === id)));
    }
    const children = [...collected.values()];
    dragNode = {node: dragTarget, children, sx:e.clientX, sy:e.clientY, ox:dragTarget.x, oy:dragTarget.y};
    document.body.classList.add('canvas-node-drag');
    window.onmousemove = onNodeDrag;
    window.onmouseup = endDrag;
}
function onNodeDrag(e){
    if(!dragNode) return;
    const dx = (e.clientX - dragNode.sx) / viewport.scale;
    const dy = (e.clientY - dragNode.sy) / viewport.scale;
    dragNode.node.x = dragNode.ox + dx;
    dragNode.node.y = dragNode.oy + dy;
    const el = nodesEl.querySelector(`.node[data-id="${dragNode.node.id}"]`);
    if(el){
        el.style.left = `${dragNode.node.x}px`;
        el.style.top = `${dragNode.node.y}px`;
    }
    (dragNode.children || []).forEach(childDrag => {
        childDrag.node.x = childDrag.ox + dx;
        childDrag.node.y = childDrag.oy + dy;
        const childEl = nodesEl.querySelector(`.node[data-id="${childDrag.node.id}"]`);
        if(childEl){
            childEl.style.left = `${childDrag.node.x}px`;
            childEl.style.top = `${childDrag.node.y}px`;
        }
    });
    renderLinks();
    renderSelectionHub();
    scheduleMinimapRender();
}
function startNodeResize(e, node){
    e.preventDefault();
    e.stopPropagation();
    const el = nodesEl.querySelector(`.node[data-id="${node.id}"]`);
    const rect = el?.getBoundingClientRect();
    resizeNode = {
        node,
        sx:e.clientX,
        sy:e.clientY,
        sw:(rect?.width ? rect.width / viewport.scale : node.w || defaultNodeSize(node.type).w),
        sh:(rect?.height ? rect.height / viewport.scale : node.h || defaultNodeSize(node.type).h || 160)
    };
    document.body.classList.add('canvas-node-resize');
    window.onmousemove = onNodeResize;
    window.onmouseup = endDrag;
}
function onNodeResize(e){
    if(!resizeNode) return;
    const min = defaultNodeSize(resizeNode.node.type);
    const nextW = Math.max(Math.min(min.w, 220), resizeNode.sw + (e.clientX - resizeNode.sx) / viewport.scale);
    const nextH = Math.max(96, resizeNode.sh + (e.clientY - resizeNode.sy) / viewport.scale);
    resizeNode.node.w = Math.round(nextW);
    resizeNode.node.h = Math.round(nextH);
    const el = nodesEl.querySelector(`.node[data-id="${resizeNode.node.id}"]`);
    if(el){
        el.classList.add('sized');
        el.style.width = `${resizeNode.node.w}px`;
        el.style.height = `${resizeNode.node.h}px`;
    }
    renderLinks();
    renderSelectionHub();
    scheduleMinimapRender();
}
function startLink(e, originId, originKind){
    e.stopPropagation();
    originKind = originKind || 'out';
    const src = portPoint(originId, originKind);
    const source = nodes.find(n => n.id === originId);
    tempLink = {from:originId, originKind, x1:src.x, y1:src.y, x2:src.x, y2:src.y};
    window.onmousemove = e2 => {
        const p = screenToWorld(e2.clientX, e2.clientY);
        tempLink.x2 = p.x;
        tempLink.y2 = p.y;
        renderLinks();
    };
    window.onmouseup = e2 => {
        const targetKind = originKind === 'out' ? 'in' : 'out';
        const targetPort = nearestPort(e2.clientX, e2.clientY, targetKind);
        const target = targetPort?.closest('.node');
        if(target){
            const targetId = target.dataset.id;
            const fromId = originKind === 'out' ? originId : targetId;
            const toId = originKind === 'out' ? targetId : originId;
            if(canConnect(fromId, toId)){
                if(!connections.some(c => c.from === fromId && c.to === toId)){ pushUndo(); connections.push({id:uid('c'), from:fromId, to:toId}); }
                syncGeneratorInputs();
                scheduleSave();
                render();
            }
        } else if(originKind === 'out'){
            if(source && CANVAS_GENERATOR_TYPES.includes(source.type)){
                const p = screenToWorld(e2.clientX, e2.clientY);
                pushUndo();
                const out = {id:uid('out'), type:'output', x:p.x, y:p.y - 63, images:[]};
                nodes.push(out);
                connections.push({id:uid('c'), from:source.id, to:out.id});
                syncGeneratorInputs();
                scheduleSave();
                render();
            } else {
                openLinkCreateMenu(originId, originKind, e2.clientX, e2.clientY);
            }
        } else if(originKind === 'in'){
            openLinkCreateMenu(originId, originKind, e2.clientX, e2.clientY);
        }
        tempLink = null;
        window.onmousemove = null;
        window.onmouseup = null;
        renderLinks();
    };
}
function nearestPort(clientX, clientY, kind){
    const selector = `.port.${kind}`;
    const direct = document.elementFromPoint(clientX, clientY)?.closest(selector);
    if(direct) return direct;
    let best = null;
    let bestDistance = Infinity;
    nodesEl.querySelectorAll(selector).forEach(port => {
        const r = port.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(clientX - cx, clientY - cy);
        if(d < bestDistance){
            bestDistance = d;
            best = port;
        }
    });
    return bestDistance <= 48 ? best : null;
}
function wouldCreateGeneratorCycle(fromId, toId){
    const seen = new Set();
    const walk = id => {
        if(id === fromId) return true;
        if(seen.has(id)) return false;
        seen.add(id);
        for(const c of connections.filter(x => x.from === id)){
            if(walk(c.to)) return true;
            const next = nodes.find(n => n.id === c.to);
            if(next?.type === 'output'){
                for(const cc of connections.filter(x => x.from === next.id)){
                    if(walk(cc.to)) return true;
                }
            }
        }
        return false;
    };
    return walk(toId);
}
function canConnect(fromId, toId){
    if(!fromId || !toId || fromId === toId) return false;
    const from = nodes.find(n => n.id === fromId);
    const to = nodes.find(n => n.id === toId);
    if(!from || !to) return false;
    if(CANVAS_GENERATOR_TYPES.includes(from.type)){
        if(to.type === 'output') return true;
        if(CANVAS_IMAGE_OUTPUT_TYPES.includes(from.type) && CANVAS_GENERATOR_TYPES.includes(to.type)){
            return !wouldCreateGeneratorCycle(fromId, toId);
        }
        return false;
    }
    if(to.type === 'loop'){
        const allowImage = Boolean(to.imageInput) && ['image','group','output'].includes(from.type);
        const allowPrompt = Boolean(to.showPrompt) && ['prompt','promptGroup','loop','llm'].includes(from.type);
        return allowImage || allowPrompt;
    }
    if(to.type === 'llm') return ['prompt','loop','promptGroup','llm','image','group','output'].includes(from.type);
    if(from.type === 'llm') return CANVAS_GENERATOR_TYPES.includes(to.type);
    return CANVAS_GENERATOR_TYPES.includes(to.type) && ['image','prompt','loop','group','promptGroup','output','llm'].includes(from.type);
}
function sanitizeConnections(){
    connections = (connections || []).filter(c => canConnect(c.from, c.to));
}
function endDrag(event=null){
    if(dragNode){
        const moved = [dragNode.node, ...(dragNode.children || []).map(c => c.node)].filter(Boolean);
        // 拖动 group/promptGroup 自身时不重新评估（成员跟着一起走，包含关系不变）
        const draggedGroup = moved.some(n => n.type === 'group' || n.type === 'promptGroup');
        if(!draggedGroup) updateGroupMembership(moved);
    }
    dragNode = null;
    dragBoard = null;
    resizeNode = null;
    llmPaneDrag = null;
    knifeActive = false;
    knifePoint = null;
    knifeTrail = [];
    if(knifeTrailEl){ knifeTrailEl.remove(); knifeTrailEl = null; }
    const shouldRenderKnife = knifeNeedsRender;
    knifeChanged = false;
    knifeNeedsRender = false;
    if(!isKnifeKey(event)) setKnifeMode(false);
    if(textSelectionGuard) textSelectionGuard.active = false;
    document.body.classList.remove('canvas-node-drag', 'canvas-node-resize', 'canvas-selecting', 'canvas-board-pan');
    window.onmousemove = null;
    window.onmouseup = null;
    if(shouldRenderKnife) render();
    scheduleMinimapRender();
    scheduleSave();
}
function nodeRect(n){
    const el = nodesEl.querySelector(`.node[data-id="${n.id}"]`);
    const w = el?.offsetWidth || n.w || 260;
    const h = el?.offsetHeight || n.h || 200;
    return {x:n.x, y:n.y, w, h, cx:n.x + w/2, cy:n.y + h/2};
}
function handoffExistingInputsToGroup(group, children){
    if(!group || group.type !== 'group') return false;
    const childIds = new Set((children || []).filter(n => ['image','prompt'].includes(n?.type)).map(n => n.id));
    if(!childIds.size) return false;
    const targetIds = new Set();
    connections.forEach(c => {
        if(!childIds.has(c.from)) return;
        const target = nodes.find(n => n.id === c.to);
        if(target && CANVAS_GENERATOR_TYPES.includes(target.type)) targetIds.add(target.id);
    });
    if(!targetIds.size) return false;
    connections = connections.filter(c => !(childIds.has(c.from) && targetIds.has(c.to)));
    targetIds.forEach(targetId => {
        if(!connections.some(c => c.from === group.id && c.to === targetId) && canConnect(group.id, targetId)){
            connections.push({id:uid('c'), from:group.id, to:targetId});
        }
    });
    return true;
}
function updateGroupMembership(movedNodes){
    const pairs = [
        {childType:'image', groupType:'group'},
        {childType:'prompt', groupType:'group'},
        {childType:'prompt', groupType:'promptGroup'}
    ];
    let changed = false;
    const handoffGroupConnections = (group, child) => {
        if(!group || group.type !== 'group' || !['image','prompt'].includes(child?.type)) return;
        const directTargets = connections
            .filter(c => c.from === child.id)
            .map(c => nodes.find(n => n.id === c.to))
            .filter(n => n && CANVAS_GENERATOR_TYPES.includes(n.type));
        const groupTargets = connections
            .filter(c => c.from === group.id)
            .map(c => nodes.find(n => n.id === c.to))
            .filter(n => n && CANVAS_GENERATOR_TYPES.includes(n.type));
        const targets = new Map([...directTargets, ...groupTargets].map(n => [n.id, n]));
        targets.forEach(target => {
            const before = connections.length;
            connections = connections.filter(c => !(c.from === child.id && c.to === target.id));
            if(connections.length !== before) changed = true;
            if(!connections.some(c => c.from === group.id && c.to === target.id) && canConnect(group.id, target.id)){
                connections.push({id:uid('c'), from:group.id, to:target.id});
                changed = true;
            }
        });
    };
    pairs.forEach(({childType, groupType}) => {
        const groups = nodes.filter(n => n.type === groupType);
        const children = movedNodes.filter(n => n?.type === childType);
        if(!children.length || !groups.length) return;
        children.forEach(child => {
            const cr = nodeRect(child);
            const containing = groups.find(g => {
                const gr = nodeRect(g);
                return cr.cx >= gr.x && cr.cx <= gr.x + gr.w && cr.cy >= gr.y && cr.cy <= gr.y + gr.h;
            });
            groups.forEach(g => {
                if(g === containing) return;
                const idx = (g.items || []).indexOf(child.id);
                if(idx >= 0){ g.items.splice(idx, 1); changed = true; }
            });
            if(containing){
                containing.items = containing.items || [];
                if(!containing.items.includes(child.id)){ containing.items.push(child.id); changed = true; }
                handoffGroupConnections(containing, child);
            }
        });
    });
    if(changed){
        syncGeneratorInputs();
        refreshGeneratorInputViews();
        render();
        scheduleSave();
    }
}

function portPoint(id, kind){
    const n = nodes.find(x => x.id === id);
    const el = nodesEl.querySelector(`.node[data-id="${id}"]`);
    if(!n || !el) return {x:0,y:0};
    const port = el.querySelector(`.port.${kind}`);
    if(port){
        const r = port.getBoundingClientRect();
        return screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
    }
    const w = el.offsetWidth || n.w || 260, h = el.offsetHeight || n.h || 160;
    return kind === 'out' ? {x:n.x + w, y:n.y + h / 2} : {x:n.x, y:n.y + h / 2};
}
function renderLinks(){
    linksEl.innerHTML = '';
    linkControlsEl.innerHTML = '';
    connections.forEach(c => {
        const a = portPoint(c.from, 'out'), b = portPoint(c.to, 'in');
        linksEl.appendChild(pathEl(a.x, a.y, b.x, b.y, 'link'));
        const btn = linkDeleteButton(c, a, b);
        linkControlsEl.appendChild(btn);
        linksEl.appendChild(linkHitEl(a.x, a.y, b.x, b.y, c.id));
    });
    if(tempLink){
        linksEl.appendChild(pathEl(tempLink.x1, tempLink.y1, tempLink.x2, tempLink.y2, 'link temp'));
    }
}
function renderKnifeTrail(){
    if(!knifeActive || knifeTrail.length < 2) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', smoothKnifePath(knifeTrail));
    path.setAttribute('class', 'link knife-trail');
    knifeTrailSvg.appendChild(path);
    knifeTrailEl = path;
}
function renderKnifeTrailOnly(){
    if(!knifeActive || knifeTrail.length < 2){ if(knifeTrailEl){ knifeTrailEl.remove(); knifeTrailEl = null; } return; }
    if(!knifeTrailEl){
        knifeTrailEl = document.createElementNS('http://www.w3.org/2000/svg','path');
        knifeTrailEl.setAttribute('class', 'link knife-trail');
        knifeTrailSvg.appendChild(knifeTrailEl);
    }
    knifeTrailEl.setAttribute('d', smoothKnifePath(knifeTrail));
}
function smoothKnifePath(pts){
    if(pts.length < 2) return '';
    if(pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for(let i = 1; i < pts.length - 1; i++){
        const prev = pts[i - 1], cur = pts[i], next = pts[i + 1];
        const cx = (prev.x + next.x) / 2, cy = (prev.y + next.y) / 2;
        d += ` Q${cur.x},${cur.y} ${cx},${cy}`;
    }
    const last = pts[pts.length - 1];
    d += ` L${last.x},${last.y}`;
    return d;
}
function linkDeleteButton(connection, a, b){
    const btn = document.createElement('button');
    btn.className = `link-delete ${isConnectionSelected(connection) ? 'visible' : ''} ${hoveredConnectionId === connection.id ? 'hover' : ''}`;
    btn.type = 'button';
    btn.title = tr('canvas.deleteLink');
    btn.setAttribute('aria-label', tr('canvas.deleteLink'));
    btn.dataset.connectionId = connection.id;
    btn.style.left = `${(a.x + b.x) / 2}px`;
    btn.style.top = `${(a.y + b.y) / 2}px`;
    btn.textContent = '×';
    btn.onmousedown = e => { e.stopPropagation(); };
    btn.onclick = e => { e.stopPropagation(); deleteConnection(connection.id, e); };
    return btn;
}
function linkHitEl(x1,y1,x2,y2,id){
    const p = pathEl(x1, y1, x2, y2, 'link-hit');
    p.dataset.connectionId = id;
    p.ondblclick = e => {
        e.preventDefault();
        e.stopPropagation();
        deleteConnection(id, e);
    };
    return p;
}
function setHoveredConnection(id){
    if(hoveredConnectionId === id) return;
    const oldId = hoveredConnectionId;
    hoveredConnectionId = id || '';
    if(oldId){
        const oldBtn = linkControlsEl.querySelector(`[data-connection-id="${CSS.escape(oldId)}"]`);
        if(oldBtn) oldBtn.classList.remove('hover');
    }
    if(hoveredConnectionId){
        const btn = linkControlsEl.querySelector(`[data-connection-id="${CSS.escape(hoveredConnectionId)}"]`);
        if(btn) btn.classList.add('hover');
    }
}
function connectionDistanceToPoint(connection, point){
    const from = portPoint(connection.from, 'out');
    const to = portPoint(connection.to, 'in');
    let min = Infinity;
    let prev = cubicPoint(from, to, 0);
    for(let i = 1; i <= 28; i++){
        const cur = cubicPoint(from, to, i / 28);
        min = Math.min(min, pointSegmentDistance(point, prev, cur));
        prev = cur;
    }
    return min;
}
function updateConnectionHoverFromMouse(e){
    if(!canvas || tempLink || dragNode || dragBoard || resizeNode || knifeActive){
        setHoveredConnection('');
        return;
    }
    const button = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.link-delete');
    if(button?.dataset.connectionId){
        setHoveredConnection(button.dataset.connectionId);
        return;
    }
    const point = screenToWorld(e.clientX, e.clientY);
    const threshold = Math.max(12, 16 / viewport.scale);
    let bestId = '';
    let best = Infinity;
    connections.forEach(c => {
        const d = connectionDistanceToPoint(c, point);
        if(d < best){ best = d; bestId = c.id; }
    });
    setHoveredConnection(best <= threshold ? bestId : '');
}
function isConnectionSelected(connection){
    return selected.has(connection.from) || selected.has(connection.to);
}
function refreshSelectionVisuals(){
    nodesEl.querySelectorAll('.node').forEach(el => {
        el.classList.toggle('selected', selected.has(el.dataset.id));
    });
    renderLinks();
    renderSelectionHub();
    scheduleMinimapRender();
}
function pathEl(x1,y1,x2,y2,cls){
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    const dx = Math.max(80, Math.abs(x2 - x1) * .45);
    p.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    p.setAttribute('class', cls);
    return p;
}
function pointSegmentDistance(p, a, b){
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if(!len2) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
function segmentsIntersect(a, b, c, d){
    const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const onSeg = (p, q, r) => Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) && Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
    const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
    if(o1 === 0 && onSeg(a, c, b)) return true;
    if(o2 === 0 && onSeg(a, d, b)) return true;
    if(o3 === 0 && onSeg(c, a, d)) return true;
    if(o4 === 0 && onSeg(c, b, d)) return true;
    return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}
function segmentIntersectsRect(a, b, r){
    if(a.x >= r.x && a.x <= r.x + r.w && a.y >= r.y && a.y <= r.y + r.h) return true;
    if(b.x >= r.x && b.x <= r.x + r.w && b.y >= r.y && b.y <= r.y + r.h) return true;
    const p1 = {x:r.x, y:r.y}, p2 = {x:r.x + r.w, y:r.y}, p3 = {x:r.x + r.w, y:r.y + r.h}, p4 = {x:r.x, y:r.y + r.h};
    return segmentsIntersect(a, b, p1, p2) || segmentsIntersect(a, b, p2, p3) || segmentsIntersect(a, b, p3, p4) || segmentsIntersect(a, b, p4, p1);
}
function cubicPoint(a, b, t){
    const dx = Math.max(80, Math.abs(b.x - a.x) * .45);
    const p1 = {x:a.x + dx, y:a.y};
    const p2 = {x:b.x - dx, y:b.y};
    const u = 1 - t;
    return {
        x:u*u*u*a.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*b.x,
        y:u*u*u*a.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*b.y
    };
}
function knifeHitsConnection(a, b, connection){
    const from = portPoint(connection.from, 'out');
    const to = portPoint(connection.to, 'in');
    const threshold = Math.max(8, 12 / viewport.scale);
    let prev = cubicPoint(from, to, 0);
    for(let i = 1; i <= 28; i++){
        const cur = cubicPoint(from, to, i / 28);
        if(segmentsIntersect(a, b, prev, cur) || pointSegmentDistance(prev, a, b) <= threshold || pointSegmentDistance(cur, a, b) <= threshold) return true;
        prev = cur;
    }
    return false;
}
function applyKnifeCut(from, to){
    if(!canvas || !connections.length || !from || !to) return;
    const nodeHits = new Set();
    nodes.forEach(n => {
        const el = nodesEl.querySelector(`.node[data-id="${n.id}"]`);
        if(!el) return;
        const r = nodeRect(n);
        if(segmentIntersectsRect(from, to, r)) nodeHits.add(n.id);
    });
    const next = connections.filter(c => !nodeHits.has(c.from) && !nodeHits.has(c.to) && !knifeHitsConnection(from, to, c));
    if(next.length === connections.length) return;
    if(!knifeChanged) pushUndo();
    knifeChanged = true;
    connections = next;
    syncGeneratorInputs();
    refreshGeneratorInputViews();
    knifeNeedsRender = true;
    renderLinks();
    renderSelectionHub();
    scheduleSave();
}
function setKnifeMode(active){
    document.body.classList.toggle('canvas-knife', Boolean(active && canvas));
    if(!active){
        knifeActive = false;
        knifePoint = null;
        knifeTrail = [];
        knifeChanged = false;
        knifeNeedsRender = false;
        if(knifeTrailEl){ knifeTrailEl.remove(); knifeTrailEl = null; }
        renderLinks();
    }
}
function startKnifeDrag(e){
    if(!canvas || e.button !== 0 || !isKnifeKey(e) || isEditableTarget(e.target)) return false;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    closeCreateMenu();
    setKnifeMode(true);
    knifeActive = true;
    knifeChanged = false;
    knifeNeedsRender = false;
    knifePoint = screenToWorld(e.clientX, e.clientY);
    knifeTrail = [knifePoint];
    renderKnifeTrail();
    window.onmousemove = continueKnifeDrag;
    window.onmouseup = endDrag;
    return true;
}
function continueKnifeDrag(e){
    if(!canvas || !knifeActive) return;
    if(!isKnifeKey(e)){
        setKnifeMode(false);
        return;
    }
    const point = screenToWorld(e.clientX, e.clientY);
    if(knifePoint) applyKnifeCut(knifePoint, point);
    // 快速移动时在两点之间插值补点，避免曲线采样不足
    if(knifeTrail.length > 0){
        const last = knifeTrail[knifeTrail.length - 1];
        const dx = point.x - last.x, dy = point.y - last.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = 12; // 每 12px 插一个点
        if(dist > step){
            const count = Math.floor(dist / step);
            for(let i = 1; i <= count; i++){
                const t = i / (count + 1);
                knifeTrail.push({x: last.x + dx * t, y: last.y + dy * t});
            }
        }
    }
    knifePoint = point;
    knifeTrail.push(point);
    if(knifeTrail.length > 300) knifeTrail = knifeTrail.slice(-300);
    renderKnifeTrailOnly();
}
function isEditableTarget(target){
    const tag = target?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable || target?.closest?.('select, option');
}
minimap?.addEventListener('mousedown', e => {
    if(!canvas || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    minimapDrag = true;
    centerViewportOnWorldPoint(minimapEventToWorld(e));
    window.onmousemove = e2 => {
        if(minimapDrag) centerViewportOnWorldPoint(minimapEventToWorld(e2));
    };
    window.onmouseup = () => {
        minimapDrag = false;
        window.onmousemove = null;
        window.onmouseup = null;
        scheduleSave();
    };
});
function startBoardPan(e){
    if(!canvas) return false;
    if(isEditableTarget(e.target) || e.target.closest?.('#createMenu, #linkCreateMenu, #nodeInputMenu, #nodeOutputMenu, #imageNodeMenu, .minimap')) return false;
    e.preventDefault();
    e.stopPropagation();
    closeCreateMenu();
    if(document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    dragBoard = {sx:e.clientX, sy:e.clientY, ox:viewport.x, oy:viewport.y};
    document.body.classList.add('canvas-board-pan');
    window.onmousemove = e2 => {
        viewport.x = dragBoard.ox + e2.clientX - dragBoard.sx;
        viewport.y = dragBoard.oy + e2.clientY - dragBoard.sy;
        applyViewport();
    };
    window.onmouseup = endDrag;
    return true;
}

board.onmousedown = e => {
    if(!canvas) return;
    // 空格按住时，强制走平移，无视其他逻辑（含中键）
    if(spacePan){ startBoardPan(e); return; }
    if(e.button === 1){
        startBoardPan(e);
        return;
    }
    if(e.button !== 0) return;
    if(startKnifeDrag(e)) return;
    // Dismiss any open native select dropdown
    if(document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if(e.target !== board && e.target !== world && e.target !== nodesEl && e.target !== linksEl) return;
    closeCreateMenu();
    if(isMultiSelectKey(e)){
        e.preventDefault();
        startSelection(e);
        return;
    }
    if(selected.size){
        selected.clear();
        refreshSelectionVisuals();
    }
    startBoardPan(e);
};
board.addEventListener('mousemove', e => {
    const point = screenToWorld(e.clientX, e.clientY);
    lastMouseBoard = point;
    updateConnectionHoverFromMouse(e);
    if(canvas && knifeActive && !isEditableTarget(e.target) && !dragNode && !dragBoard && !resizeNode && !tempLink){
        continueKnifeDrag(e);
    } else if(!isKnifeKey(e)) {
        setKnifeMode(false);
    }
});
board.addEventListener('mouseleave', () => setHoveredConnection(''));
board.ondblclick = e => {
    if(!canvas) return;
    if(e.target !== board && e.target !== world && e.target !== nodesEl && e.target !== linksEl) return;
    e.preventDefault();
    openCreateMenu(e.clientX, e.clientY);
};
board.oncontextmenu = e => {
    if(!canvas) return;
    if(e.target !== board && e.target !== world && e.target !== nodesEl && e.target !== linksEl) return;
    e.preventDefault();
    e.stopPropagation();
    openCreateMenu(e.clientX, e.clientY);
};
board.addEventListener('mousedown', e => {
    if(e.target.closest?.('#createMenu, #linkCreateMenu, #nodeInputMenu, #nodeOutputMenu, #imageNodeMenu')) return;
    closeCreateMenu();
});
// 画布滚轮缩放逻辑（供 board.onwheel 和全局拦截共同调用）
function applyWheelZoom(e){
    if(!canvas) return;
    const before = screenToWorld(e.clientX, e.clientY);
    viewport.scale = viewport.scale * (e.deltaY > 0 ? .92 : 1.08);
    const rect = board.getBoundingClientRect();
    viewport.x = e.clientX - rect.left - before.x * viewport.scale;
    viewport.y = e.clientY - rect.top - before.y * viewport.scale;
    applyViewport();
    renderLinks();
    renderSelectionHub();
    scheduleSave();
}
board.onwheel = e => {
    if(!canvas) return;
    // Shift 按住 → 不缩放（切割模式）；其他所有情况都缩放
    if(e.shiftKey) return;
    e.preventDefault();
    applyWheelZoom(e);
};
board.addEventListener('dragover', e => {
    if(e.target.closest?.('.image-node')){
        dropOverlay.classList.remove('active');
        return;
    }
    if(hasImageDropData(e.dataTransfer) || hasOutputImageDrag(e.dataTransfer)){
        e.preventDefault();
        e.dataTransfer.dropEffect = hasOutputImageDrag(e.dataTransfer) ? 'copy' : 'move';
        dropOverlay.classList.add('active');
    }
});
board.addEventListener('dragleave', e => {
    if(e.target === board || !board.contains(e.relatedTarget)) dropOverlay.classList.remove('active');
});
board.addEventListener('drop', e => {
    e.preventDefault();
    dropOverlay.classList.remove('active');
    if(e.target.closest?.('.image-node')) return;
    if(hasOutputImageDrag(e.dataTransfer)) {
        createImageCardFromOutput(e.dataTransfer.getData('application/x-canvas-output-image'), screenToWorld(e.clientX, e.clientY));
        return;
    }
    if(internalDrag || e.dataTransfer?.types?.includes('application/x-canvas-input')) {
        internalDrag = false;
        return;
    }
    if(hasImageFiles(e.dataTransfer?.items)){
        uploadImages(e.dataTransfer.files, screenToWorld(e.clientX, e.clientY));
        return;
    }
    const droppedUrl = imageUrlFromDataTransfer(e.dataTransfer);
    if(droppedUrl) createImageCardFromUrl(droppedUrl, screenToWorld(e.clientX, e.clientY), outputImageName(droppedUrl));
});
window.addEventListener('dragend', () => dropOverlay.classList.remove('active'));
window.addEventListener('drop', () => dropOverlay.classList.remove('active'));
window.addEventListener('paste', e => {
    if(!canvas) return;
    const files = [...(e.clipboardData?.items || [])].filter(x => x.kind === 'file' && x.type.startsWith('image/')).map(x => x.getAsFile());
    if(!files.length) return;
    e.preventDefault();
    lastImagePasteAt = Date.now();
    const blank = [...selected].map(id => nodes.find(n => n.id === id)).find(n => n?.type === 'image' && !n.url);
    if(blank) fillImageNode(blank.id, files);
    else uploadImages(files);
});
// 捕获阶段：只拦截浏览器缩放，不执行画布缩放
// 画布缩放由 board.onwheel 和节点 wheel 处理函数负责
window.addEventListener('wheel', e => {
    const tag = e.target.tagName;
    const isEditable = e.target.isContentEditable || tag === 'TEXTAREA' || tag === 'INPUT';
    // 任何修饰键按住时，都阻止浏览器默认缩放
    if(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey){
        if(!isEditable){
            e.preventDefault();
            e.returnValue = false;
        }
    }
}, { capture: true, passive: false });
// 保留 document 层作为双重保险
// 同时覆盖 window 捕获阶段和 document 层，兼容性更强
function preventBrowserZoom(e){
    if((e.ctrlKey || e.metaKey) && !e.altKey){
        if(e.key === '=' || e.key === '+' || e.key === 'Equal' ||
           e.key === '-' || e.key === 'Minus' ||
           e.key === '0' || e.key === 'Digit0'){
            e.preventDefault();
            e.returnValue = false;
            e.stopImmediatePropagation();
        }
    }
}
window.addEventListener('keydown', preventBrowserZoom, true);
document.addEventListener('keydown', preventBrowserZoom, true);

// ESC 键关闭弹窗（按层级：先关闭最上层弹窗）
document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
        if(outputLightbox?.classList.contains('open')) closeOutputLightbox();
        else if(logModal?.classList.contains('open')) closeCanvasLog();
        else if(settingsModal?.classList.contains('open')) closeSettingsModal();
        else if(helpModal?.classList.contains('open')) closeHelpModal();
        else if(errorModal?.classList.contains('open')) closeErrorModal();
    }
}, true);

function focusOnSelectedOrAll(){
    if(!canvas) return;
    const targetIds = [...selected];
    let targetNodes;
    const hasSelection = targetIds.length > 0;
    if(hasSelection){
        targetNodes = nodes.filter(n => targetIds.includes(n.id));
    } else {
        targetNodes = nodes;
    }
    if(!targetNodes.length) return;
    const rect = board.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targetNodes.forEach(n => {
        const r = estimatedNodeRect(n);
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w);
        maxY = Math.max(maxY, r.y + r.h);
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    if(hasSelection){
        // 选中节点：缩放至100%并居中
        viewport.scale = 1;
    } else {
        // 无选中：适配所有节点
        const bw = Math.max(1, maxX - minX);
        const bh = Math.max(1, maxY - minY);
        const pad = 80;
        const scaleX = (rect.width - pad * 2) / bw;
        const scaleY = (rect.height - pad * 2) / bh;
        viewport.scale = Math.min(scaleX, scaleY, 3);
    }
    viewport.x = rect.width / 2 - cx * viewport.scale;
    viewport.y = rect.height / 2 - cy * viewport.scale;
    applyViewport();
    renderLinks();
    renderSelectionHub();
}
window.addEventListener('keydown', e => {
    if(!canvas) return;
    // Ctrl/Cmd + 加号/减号/0 控制画布缩放（屏蔽浏览器缩放）
    if((e.ctrlKey || e.metaKey) && !e.altKey){
        const tag = document.activeElement?.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        if(e.key === '=' || e.key === '+'){
            e.preventDefault();
            const rect = board.getBoundingClientRect();
            const cx = rect.width / 2, cy = rect.height / 2;
            const before = screenToWorld(rect.left + cx, rect.top + cy);
            viewport.scale = Math.min(viewport.scale * 1.08, 10);
            viewport.x = cx - before.x * viewport.scale;
            viewport.y = cy - before.y * viewport.scale;
            applyViewport(); renderLinks(); renderSelectionHub();
            return;
        }
        if(e.key === '-'){
            e.preventDefault();
            const rect = board.getBoundingClientRect();
            const cx = rect.width / 2, cy = rect.height / 2;
            const before = screenToWorld(rect.left + cx, rect.top + cy);
            viewport.scale = Math.max(viewport.scale * 0.92, 0.05);
            viewport.x = cx - before.x * viewport.scale;
            viewport.y = cy - before.y * viewport.scale;
            applyViewport(); renderLinks(); renderSelectionHub();
            return;
        }
        if(e.key === '0'){
            e.preventDefault();
            const rect = board.getBoundingClientRect();
            const cx = rect.width / 2, cy = rect.height / 2;
            const before = screenToWorld(rect.left + cx, rect.top + cy);
            viewport.scale = 1;
            viewport.x = cx - before.x * viewport.scale;
            viewport.y = cy - before.y * viewport.scale;
            applyViewport(); renderLinks(); renderSelectionHub();
            return;
        }
    }
    if(e.key === 'f' || e.key === 'F'){
        const tag = document.activeElement?.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        if(e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        focusOnSelectedOrAll();
        return;
    }
    if(isKnifeKey(e) && !isEditableTarget(document.activeElement)) setKnifeMode(true);
    if(e.key === 'Escape' && document.getElementById('imageEditModal').classList.contains('open')) { closeImageEditor(); return; }
    if((e.key === '[' || e.key === ']') && document.getElementById('imageEditModal').classList.contains('open') && (imageEditMode === 'mask' || imageEditMode === 'brush')){
        const tag = document.activeElement?.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        e.preventDefault();
        const sliderId = imageEditMode === 'mask' ? 'maskBrushSize' : 'paintBrushSize';
        const slider = document.getElementById(sliderId);
        if(slider){
            const min = Number(slider.min), max = Number(slider.max);
            const step = Math.max(1, Math.round((max - min) / 30));
            const val = Number(slider.value) + (e.key === ']' ? step : -step);
            slider.value = Math.max(min, Math.min(max, val));
            slider.dispatchEvent(new Event('input', {bubbles:true}));
            _refreshBrushCursorSize();
        }
        return;
    }
    if(outputLightbox.classList.contains('open') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')){
        if(navigateOutputLightbox(e.key === 'ArrowRight' ? 1 : -1)){
            e.preventDefault();
            e.stopPropagation();
        }
        return;
    }
    if(e.key === 'Escape' && outputLightbox.classList.contains('open')) { closeOutputLightbox(); return; }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); groupSelectedImages(); }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        // 在输入框/可编辑元素里时，让浏览器原生 Ctrl+C 工作
        const tag = document.activeElement?.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        // 用户在页面任意位置选中了文本时，也不要拦截
        const sel = window.getSelection && window.getSelection();
        if(sel && sel.toString().length > 0) return;
        e.preventDefault();
        copySelectedNodes();
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        const tag = document.activeElement?.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        if(clipboard?.nodes?.length) {
            const pasteRequestedAt = Date.now();
            setTimeout(() => {
                if(!canvas) return;
                if(lastImagePasteAt >= pasteRequestedAt) return;
                pasteNodes();
            }, 90);
        }
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const tag = document.activeElement?.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        e.preventDefault();
        if(document.getElementById('imageEditModal')?.classList.contains('open')){
            if(imageEditMode === 'mask' || imageEditMode === 'brush') undoEditDrawing();
            else if(imageEditMode === 'grid') undoGridCustomLine();
        } else { performUndo(); }
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        const tag = document.activeElement?.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        e.preventDefault();
        if(document.getElementById('imageEditModal')?.classList.contains('open')){
            if(imageEditMode === 'mask' || imageEditMode === 'brush') redoEditDrawing();
        } else { performRedo(); }
    }
    if(e.key === 'Delete' || e.key === 'Backspace') {
        const tag = document.activeElement?.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        if(selected.size === 0) return;
        e.preventDefault();
        deleteSelectedNodes();
    }
    if(e.key === 'x' || e.key === 'X') {
        if(!enableXDelete) return;
        const tag = document.activeElement?.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        if(e.ctrlKey || e.metaKey) return;
        if(e.isComposing) return;
        if(selected.size === 0) return;
        e.preventDefault();
        deleteSelectedNodes();
    }
});
window.addEventListener('keyup', e => {
    if(!isKnifeKey(e)) setKnifeMode(false);
});
// 空格键：按住=平移模式，松开=恢复；文本编辑时忽略；阻止浏览器默认滚动
window.addEventListener('keydown', e => {
    if(e.repeat) return;
    if(e.code === 'Space' || e.key === ' '){
        const tag = document.activeElement?.tagName;
        const isEditable = document.activeElement?.isContentEditable || tag === 'TEXTAREA' || tag === 'INPUT';
        if(isEditable) return;
        if(spacePan) return;
        e.preventDefault(); // 阻止浏览器默认滚动（空格=向下翻页）
        spacePan = true;
        document.body.classList.add('space-pan');
    }
});
window.addEventListener('keyup', e => {
    if(e.code === 'Space' || e.key === ' '){
        spacePan = false;
        document.body.classList.remove('space-pan');
        if(_previewPanDrag){
            _previewPanDrag = null;
            document.querySelector('#imageEditStage .crop-canvas')?.classList.remove('dragging');
        }
    }
});
window.addEventListener('blur', () => {
    spacePan = false;
    document.body.classList.remove('space-pan');
    if(_previewPanDrag){
        _previewPanDrag = null;
        document.querySelector('#imageEditStage .crop-canvas')?.classList.remove('dragging');
    }
});
// 捕获阶段：空格按住时，所有 mousedown 一律走平移，阻断其他交互
// 同时记录鼠标位置，用于后续阻止误触 click
function startImageEditPan(e){
    const modal = document.getElementById('imageEditModal');
    if(!modal?.classList.contains('open')) return false;
    const stage = document.getElementById('imageEditStage');
    if(!stage) return false;
    _previewPanDrag = { startX: e.clientX, startY: e.clientY, origX: _previewPanX, origY: _previewPanY };
    return true;
}
document.addEventListener('mousedown', e => {
    if(spacePan && e.button === 0){
        spacePanDownPos = {x:e.clientX, y:e.clientY};
        e.preventDefault();
        e.stopPropagation();
        if(!startImageEditPan(e)) startBoardPan(e);
    }
}, true);
// 捕获阶段：空格平移后阻止误触 click（只要空格按下时点击，一律阻止）
document.addEventListener('click', e => {
    if(spacePanDownPos){
        spacePanDownPos = null;
        e.preventDefault();
        e.stopPropagation();
    }
}, true);
window.addEventListener('blur', () => setKnifeMode(false));
window.addEventListener('blur', () => {
    if(selectDrag){
        selectionBox.style.display = 'none';
        selectDrag = null;
        document.body.classList.remove('canvas-selecting');
        window.onmousemove = null;
        window.onmouseup = null;
    }
});
function deleteSelectedNodes(){
    if(!canvas || selected.size === 0) return;
    pushUndo();
    // 收集所有需要删除的 id（含 group 的 items 一并删除）
    const toDelete = new Set();
    const collect = id => {
        if(toDelete.has(id)) return;
        toDelete.add(id);
        const n = nodes.find(x => x.id === id);
        if(n && (n.type === 'group' || n.type === 'promptGroup')){
            (n.items || []).forEach(collect);
        }
    };
    selected.forEach(collect);
    nodes = nodes.filter(n => !toDelete.has(n.id));
    connections = connections.filter(c => !toDelete.has(c.from) && !toDelete.has(c.to));
    selected.clear();
    render();
    scheduleSave();
}
function hasImageFiles(items){ return [...(items || [])].some(item => item.kind === 'file' && item.type.startsWith('image/')); }
function hasImageDropData(dataTransfer){
    if(!dataTransfer) return false;
    if(hasImageFiles(dataTransfer.items)) return true;
    const types = [...(dataTransfer.types || [])];
    return types.includes('text/uri-list') || types.includes('text/html') || types.includes('text/plain');
}
function hasOutputImageDrag(dataTransfer){ return [...(dataTransfer?.types || [])].includes('application/x-canvas-output-image'); }
function escapeHtml(str){ return String(str == null ? '' : str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
function escapeAttr(str){ return escapeHtml(str); }

window.onload = async () => {
    // 等待 StudioI18n 就绪（i18n.js 异步加载可能需要时间，最多等 3 秒）
    if(!window.StudioI18n){
        let waited = 0;
        while(!window.StudioI18n && waited < 3000){
            await new Promise(r => setTimeout(r, 50));
            waited += 50;
        }
        if(!window.StudioI18n) console.warn('StudioI18n not loaded after 3s, continuing anyway');
    }
    applyTheme(localStorage.getItem('studio_theme') || localStorage.getItem(CANVAS_THEME_KEY) || 'light');
    applyQuickToolbarState();
    if(window.StudioI18n) StudioI18n.apply();
    document.title = tr('canvas.title');
    initOutputCompareEvents();
    initOutputPreviewZoomEvents();
    applyViewport();
    await loadConfig();
    await loadCanvasList(false);
    const lastId = localStorage.getItem(LAST_CANVAS_ID_KEY);
    if(lastId && !canvas) {
        const exists = canvases.some(c => String(c.id) === String(lastId));
        if(exists) await openCanvas(lastId);
        else setCanvasMode(false);
    } else if(!canvas) {
        setCanvasMode(false);
    }
    document.documentElement.classList.remove('canvas-booting');
};
