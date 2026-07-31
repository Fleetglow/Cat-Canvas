## [LRN-20260731-002] correction

**Logged**: 2026-07-31
**Priority**: high
**Status**: pending
**Area**: desktop

### Summary
桌面安装包构建完成不代表已验证其静态资源与网页版一致。

### Details
用户反馈同版本桌面构建包看起来缺少网页版已修复的卡顿和其他 UI 改动。后续必须比对源码、PyInstaller sidecar 的 `_internal/static`、安装目录实际执行文件和当前运行进程，不能仅以构建成功判断。

### Suggested Action
构建后校验静态资源哈希；同版本覆盖安装时明确确认安装器已替换实际运行的安装目录。

### Metadata
- Source: user_feedback
- Related Files: desktop/backend-dist, desktop/src-tauri/target
- Tags: desktop, packaging, static-assets

---
