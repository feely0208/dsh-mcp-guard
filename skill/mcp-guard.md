# MCP 配置安检（dsh-mcp-guard）

**什么时候用**：装新 MCP server 之后、定期体检、换机器迁移前。
用户会说：「我这个 mcp.json 安全吗」「AI 一键批准要不要开」「key 直接写在配置里行不行」。

## 怎么用

```bash
<cli 路径>                       # 查用户级客户端配置（Claude Code/Desktop、Cursor、Windsurf）
<cli 路径> --root <项目目录>      # 同时扫项目里的 mcp.json
<cli 路径> --json | --html r.html
```

## 它查什么（5 条）

| 规则 | 查什么 | 级别 |
|---|---|---|
| `MCPG-UNPINNED` | npx/uvx 等装包即执行入口未锁版本 | high |
| `MCPG-AUTOAPPROVE` | 自动批准/跳过权限类开关 | high |
| `MCPG-HTTP-PLAINTEXT` | 远程端点明文 http（localhost 除外） | high |
| `MCPG-SUDO` | 用 sudo 提权启动 server | high |
| `MCPG-ENV-SECRET` | env 里明文凭据（值打码展示） | medium |

## 怎么读结果

- 只做**配置层静态检查**，不会去启动任何 server、不联网
- 「未锁版本」是供应链风险不是已发生事故；修复=锁版本或本地化安装
- 本机没找到任何 MCP 配置时会明确说「没发现」并给出 --root 用法，不会假绿
