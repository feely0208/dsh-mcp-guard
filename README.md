# @deepwhale-cn/dsh-mcp-guard

> **技能型插件 · 无面板**：安装后由 DSH 智能体按 skill 说明调用 CLI；无独立面板界面。

安装到 DSH：

```bash
dsh plugin --profile web add @deepwhale-cn/dsh-mcp-guard
```

MCP 配置安检：审计本机各客户端（Claude Code / Claude Desktop / Cursor / Windsurf）的 MCP server 配置——未锁版本、明文端点、自动批准开关、env 明文凭据、sudo 启动。只读、不联网、不启动任何 server。

```bash
npx @deepwhale-cn/dsh-mcp-guard [--root 项目目录] [--json] [--html r.html]
```

规则 5 条；退出码：有 high 命中 → 1（可作 CI/pre-commit 门禁）。
