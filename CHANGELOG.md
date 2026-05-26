# 猫猫画布 更新日志

## [未发布] - 2026-05-25

### ✨ 新增功能
- **日志面板网格视图**：删除列表视图，只保留网格视图；缩略图改为 16:9 比例；一行展示 5 条记录；复选框移至缩略图右上角
- **批量下载打包**：批量下载改为调用后端接口，所有文件打包为单个 zip 一次性下载
- **RunningHub 静态配置支持**：支持从 `static/runninghub/api_providers.json` 加载系统级 RunningHub 配置，支持 `hidden` 标记隐藏预设工作流/App
- **LTX Director 节点**：新增 LTX Director 节点，配套时间线编辑器
- **本地图片批量导入**：新增本地图片批量导入接口（`LocalImageImportRequest`）
- **上传接口本地回退**：ComfyUI 不可用时，`/api/upload` 自动将文件保存到本地 `assets/input/` 目录
- **Lightbox 预览窗口重新设计**：左右分栏布局（左侧大图 + 右侧信息面板）；信息面板包含提示词（可展开）、参考图、参数配置；底部操作栏（再次运行、发送到画布、删除记录）

### 🎨 优化
- **API 设置页**：`.wrap` 最大宽度 1100→1200px；`.layout` gap 36→16px；侧边栏宽度 260→280px
- **日志面板批量按钮**：从右上角图标改为左侧文字按钮；新增"删除失败记录"按钮
- **复制保持连线设置项**：在画布设置面板添加开关，默认开启，可在设置中切换
- **RunningHub 配置合并**：系统配置与用户配置智能合并，支持 `hidden` 标记移除预设项
- **日志面板选中状态**：选中状态加强（边框加粗 + box-shadow 发光效果）
- **合并上游更新**：保留拖拽排序（`sort_order` 字段），合入 RunningHub 静态配置、LTX Director、本地图片导入等新功能
- **Lightbox 预览铺满全屏**：`.output-lightbox` padding 20px→0；`.output-lightbox-shell` 宽高改为 100vw/100vh，border-radius 改为 0，去掉 box-shadow

### 🐛 修复
- **输出节点图片拖拽预览过大**：`setOutputDragPreview` 克隆图片未限制尺寸，ghost 图像按原图大小显示，改为 `max-width:200px; max-height:200px`
- **输出节点图片无法拖动**：修复日志面板 CSS `[data-url] { -webkit-user-drag:none }` 选择器范围过大，影响输出节点图片拖拽，改为限定在 `.log-item` 和 `.log-thumbs` 内
- **API 设置页拖拽排序**：修复 `toIndex` 为 `const` 导致 `TypeError`；修复 `splice` 后索引偏移；修复 `window.justDragged` 永远为 `undefined`；修复后端 `ApiProviderPayload` 缺少 `sort_order` 字段；修复 `normalize_provider` 返回值缺少 `sort_order`
- **日志网格视图缩略图消失**：修复 `.log-item` 两条 CSS 规则互相覆盖（`display:grid` 覆盖 `display:flex`），导致缩略图区域宽度为 0
- **缩略图不显示**：修复 CSS 缺少 `display:block`，导致图片为 inline 元素，`aspect-ratio:16/9` 高度为 0
- **Ctrl+框选逻辑错误**：修复 Ctrl+框选时会错误选中未选中项，改为 Ctrl 时只取消已选中项，不选中未选中项
- **批量模式图片点击**：修复进入批量模式后点击图片仍打开灯箱，改为选中整行
- **批量模式框选无法从缩略图区域开始**：修复 `onDown` 拦截了 `.log-item` 内的 mousedown，改为只排除 checkbox 和删除按钮
- **图片默认拖拽行为**：修复批量模式下在图片上拖动会触发浏览器图片拖拽，彻底禁止图片默认拖拽行为（`-webkit-user-drag:none` + `draggable="false"`）
- **批量模式文字选中**：修复框选时会选中文字，添加 `user-select:none`
- **复选框位置错误**：删除重复的 `.log-select-cb` CSS 规则，确保 `position:absolute` 生效
- **画布底部提示文字**：删除画布底部操作提示文字
- **`.stage` 样式被上游覆盖**：恢复 `margin:0; border-radius:0`
- **`api-settings.css` 被上游覆盖**：恢复 wrap 1200px、layout gap 16px、侧边栏 280px、拖拽样式 `.drag-over`/`.dragging`
- **角度控制页面上传失败**：ComfyUI 不可用时改为保存到本地 `assets/input/` 目录，不再返回 500 错误
- **Lightbox 预览缺失生图耗时**：`setupLightboxInfoPanel` 中耗时只读取 `meta?.runMs`，从日志打开时 `log.runMs` 未被使用，修复为 `(meta?.runMs || log?.runMs)`
- **日志预览键盘导航失效**：`outputLightboxItems()` 在日志模式下只返回当前日志条目的 `outputs`，导致只有一张图片时键盘导航完全失效；修复为返回所有日志记录的 `outputs`，确保可以在所有日志记录间切换

### ⚡ 性能
- F 键聚焦选中节点功能上线
- Alt+滚轮新增为画布缩放触发方式（与 Ctrl+滚轮并列）

---

## [1.2.0] - 2026-05-XX

### ✨ 新增功能
- **节点分组**：支持将多个节点打包为分组，统一移动和缩放
- **节点收纳（Collapse）**：节点支持折叠/展开，画布更整洁
- **暗色模式 Logo**：适配暗色主题的 Logo 展示

### 🎨 优化
- **画布交互**：改进缩放和平移的手感
- **节点样式**：优化选中态、悬浮态的视觉反馈

### 🐛 修复
- 分组节点在某些情况下错误吸收外部节点
- 缩放后节点选中区域偏移问题
- 收纳节点虚线边框在缩放时变形问题

---

## [1.1.0] - 2026-04-XX

### ✨ 新增功能
- **输出节点**：支持图片生成结果的展示和时间标记
- **快捷键 F**：聚焦到选中节点，快速定位

### 🎨 优化
- 节点连线样式优化
- 画布性能优化（大画布场景）

---

## [1.0.0] - 2026-03-XX

### ✨ 首次发布
- 无限画布基础功能
- 节点创建、编辑、删除
- 节点连线
- 导入/导出画布数据
- 暗色/亮色主题切换

---

*猫猫画布 · 让创意自由流淌*
