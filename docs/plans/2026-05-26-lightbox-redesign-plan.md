# Lightbox 重新设计 - 实施计划

## 第一步：重构 HTML 结构（canvas.html）

修改 `#outputLightbox` 内部结构：

```html
<div id="outputLightbox" class="output-lightbox" onclick="closeOutputLightbox()">
  <div class="output-lightbox-shell" onclick="event.stopPropagation()">
    <!-- 顶部信息栏 -->
    <div class="lightbox-topbar">
      <div id="outputResolution" class="output-resolution">--</div>
      <div class="lightbox-topbar-actions">
        <button id="outputDownloadBtn" class="preview-icon-btn">下载</button>
        <button class="preview-icon-btn" onclick="closeOutputLightbox()">关闭</button>
      </div>
    </div>
    <!-- 主体：左图 + 右信息面板 -->
    <div class="lightbox-body">
      <div id="outputPreview" class="output-preview">
        <!-- 图片/视频/对比 沿用现有结构 -->
      </div>
      <div class="lightbox-info-panel">
        <!-- 提示词 -->
        <div class="info-section">
          <div class="info-section-title">提示词 <button id="outputCopyPromptBtn">📋</button></div>
          <div id="outputPromptText" class="info-prompt-text"></div>
          <button id="outputPromptExpandBtn" class="info-expand-btn">展开</button>
        </div>
        <!-- 参考图 -->
        <div id="outputRefsSection" class="info-section" style="display:none">
          <div class="info-section-title">参考图</div>
          <div id="outputRefsList" class="info-refs-list"></div>
        </div>
        <!-- 参数配置 -->
        <div class="info-section">
          <div class="info-section-title">参数配置</div>
          <div id="outputParamsGrid" class="info-params-grid"></div>
        </div>
      </div>
    </div>
    <!-- 底部操作栏 -->
    <div class="lightbox-bottombar">
      <button id="outputRerunBtn" class="lightbox-action-btn">再次运行</button>
      <button id="outputSendToCanvasBtn" class="lightbox-action-btn">发送到画布</button>
      <button id="outputDeleteBtn" class="lightbox-action-btn danger">删除记录</button>
    </div>
  </div>
</div>
```

## 第二步：添加 CSS 样式（canvas.css）

新增/修改以下 CSS：

```css
/* Lightbox 整体布局 */
.output-lightbox { /* 全屏遮罩 */ }
.output-lightbox-shell { /* 弹窗容器 */ }

/* 顶部栏 */
.lightbox-topbar { display:flex; justify-content:space-between; align-items:center; padding:12px 20px; }

/* 主体左右分栏 */
.lightbox-body { display:grid; grid-template-columns:1fr 380px; gap:0; flex:1; overflow:hidden; }

/* 左侧图片预览 */
.output-preview { /* 沿用现有样式 */ }

/* 右侧信息面板 */
.lightbox-info-panel { overflow-y:auto; padding:20px; border-left:1px solid var(--line); }

/* 信息区块 */
.info-section { margin-bottom:20px; }
.info-section-title { font-size:13px; font-weight:700; color:var(--text); margin-bottom:8px; display:flex; align-items:center; gap:6px; }

/* 提示词文本 */
.info-prompt-text { font-size:12px; color:var(--muted); line-height:1.6; max-height:120px; overflow:hidden; }
.info-prompt-text.expanded { max-height:none; }
.info-expand-btn { font-size:11px; color:var(--strong); background:none; border:none; cursor:pointer; }

/* 参考图缩略图 */
.info-refs-list { display:flex; gap:8px; flex-wrap:wrap; }
.info-refs-list img { width:64px; height:64px; object-fit:cover; border-radius:8px; border:1px solid var(--line); }

/* 参数配置网格 */
.info-params-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.info-param-item { font-size:12px; }
.info-param-label { color:var(--faint); }
.info-param-value { color:var(--text); font-weight:500; }

/* 底部操作栏 */
.lightbox-bottombar { display:flex; justify-content:center; gap:12px; padding:12px 20px; border-top:1px solid var(--line); }
```

## 第三步：更新 JS 逻辑（canvas.js）

### 3.1 修改 `openOutputLightbox`

- 传递 `log` 对象到 lightbox（从 `canvas.logs` 中查找匹配的 log）
- 调用新的 `setupLightboxInfoPanel(meta, log)` 函数

### 3.2 新增 `setupLightboxInfoPanel(meta, log)`

```javascript
function setupLightboxInfoPanel(meta, log) {
    // 1. 提示词
    const prompt = meta?.run?.prompt || log?.prompt || '';
    outputPromptText.textContent = prompt;
    // 控制展开按钮显隐

    // 2. 参考图
    const refs = meta?.run?.refs || log?.refs || [];
    // 渲染缩略图

    // 3. 参数配置
    // 从 log/meta 中提取 平台、模型、尺寸、质量、格式
    // 渲染到 grid

    // 4. 创建时间 + 耗时
}
```

### 3.3 新增 `sendOutputToCanvas(url)`

将图片作为 image 节点添加到画布。

### 3.4 新增 `deleteOutputFromLightbox(url, logId)`

删除当前输出记录并关闭 lightbox。

### 3.5 修改 `outputResolutionText`

顶部信息栏显示：`尺寸 | 比例 | 耗时`

## 第四步：修改 log 查找逻辑

`openOutputLightbox` 需要知道当前打开的图片属于哪个 log，以便获取完整元数据。

方案：在 `canvas.logs` 中查找包含该 URL 的 log 条目。

```javascript
function findLogForOutputUrl(url) {
    return canvas.logs.find(log => (log.outputs || []).includes(url)) || null;
}
```

## 实施顺序

1. HTML 结构重构
2. CSS 样式添加
3. JS 函数更新
4. 测试验证

## 验证清单

- [ ] 图片预览正常（缩放/平移）
- [ ] 提示词正确显示
- [ ] 参考图正确显示
- [ ] 参数配置正确显示
- [ ] 再次运行功能正常
- [ ] 发送到画布功能正常
- [ ] 删除记录功能正常
- [ ] 下载功能正常
- [ ] 视频播放正常
- [ ] 对比模式正常
- [ ] 响应式布局正常
