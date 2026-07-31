## [ERR-20260731-001] subagent reviewer startup

**Logged**: 2026-07-31
**Priority**: low
**Status**: pending
**Area**: tooling

### Summary
Reviewer subagent failed before review because the MCP extension could not start.

### Error
```
Failed to load extension "C:\\Users\\Administrator\\.pi\\agent\\extensions\\mcp.ts": MCP server exited with code 1
```

### Context
- Read-only reviewer requested for canvas persistence changes.
- No review output was produced.

### Suggested Fix
Investigate the Pi MCP extension startup separately; use manual review meanwhile.

### Metadata
- Reproducible: unknown
- Related Files: .pi-subagents/artifacts/1f171407_reviewer_0_output.md

---

## [ERR-20260731-002] desktop sidecar rebuild while running

**Logged**: 2026-07-31
**Priority**: low
**Status**: resolved
**Area**: desktop

### Summary
默认 target 下运行的桌面端锁定 backend 文件，阻止 sidecar 清理重建。

### Error
```
Remove-Item ... target\\x86_64-pc-windows-msvc\\release\\backend\\...: Access denied
```

### Suggested Fix
构建仍在运行的桌面端时，使用独立 `CARGO_TARGET_DIR`；不要强制终止用户当前桌面端。

---
