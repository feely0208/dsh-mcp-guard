/**
 * dsh-mcp-guard —— MCP 配置安检 · 检查内核
 * 5 条判据；每条 finding：{id, severity, source, advice, client, file, server, evidence}
 */
import { discover } from './discover.mjs';

const AUTO_APPROVE_FLAGS = ['--dangerously-skip-permissions', '--yolo', '--auto-approve', '--autoapprove', '--no-verify', '--insecure', '--force'];
const SECRET_KEY_RE = /(api[_-]?key|token|secret|password|passwd|credential|private[_-]?key)/i;
const PKG_EXEC = /^(npx|uvx|uv\s*run|dpx|bunx|pnpm\s+dlx|yarn\s+dlx)\b/;

function mask(v) {
  const s = String(v);
  if (s.length <= 6) return '***';
  return s.slice(0, 3) + '***' + s.slice(-3);
}

export function checkServers(servers) {
  const out = [];
  for (const s of servers) {
    const { server, client, file, spec } = s;
    const args = Array.isArray(spec.args) ? spec.args.map(String) : [];
    const argText = args.join(' ');
    const env = spec.env && typeof spec.env === 'object' ? spec.env : {};
    const cmd = String(spec.command || '').trim();

    // 1. 未锁版本的包执行器（装包即执行，包随时可被替换）
    if (cmd && PKG_EXEC.test(cmd)) {
      const pkgArg = args.find((a) => !a.startsWith('-')) || '';
      const pinned = /@[\w.\-]+-?\d|@\d/.test(pkgArg) || /@[\d][\w.\-]*$/.test(pkgArg) || /==\d/.test(pkgArg) || /@sha/.test(argText);
      if (pkgArg && !pinned) {
        out.push({
          id: 'MCPG-UNPINNED', severity: 'high', client, file, server,
          source: 'MCP 安全最佳实践（modelcontextprotocol.io）+ npm 供应链投毒案例：装包即执行的入口必须锁版本',
          advice: `把 ${pkgArg} 锁到明确版本（如 ${pkgArg}@1.2.3），或改为本地安装后用绝对路径启动。浮动 latest 意味着作者账号一被盗，你的 agent 就在跑别人的代码。`,
          evidence: `${cmd} ${args.join(' ')}`.slice(0, 120),
        });
      }
    }

    // 2. 明文 http 远程端点（localhost 除外）
    if (spec.url && /^http:\/\//i.test(String(spec.url))) {
      const u = String(spec.url);
      const local = /https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/.test(u);
      if (!local) {
        out.push({
          id: 'MCPG-HTTP-PLAINTEXT', severity: 'high', client, file, server,
          source: '传输安全基线：明文 HTTP 上的会话内容与凭据可被链路窃听',
          advice: '远程 MCP 服务端点改用 https；本地调试的 http://127.0.0.1 可保留但不要出本机。',
          evidence: u.slice(0, 120),
        });
      }
    }

    // 3. 自动批准/跳过权限类开关
    const badFlag = args.find((a) => AUTO_APPROVE_FLAGS.some((f) => a === f || a.startsWith(f + '=')));
    if (badFlag || AUTO_APPROVE_FLAGS.some((f) => argText.includes(f))) {
      out.push({
        id: 'MCPG-AUTOAPPROVE', severity: 'high', client, file, server,
        source: '人机协同基线：跳过审批=把工具的破坏半径交给模型自动决定',
        advice: '移除自动批准开关；确有自动化诉求时用 allowlist 精确到「哪些命令免批」，而不是全量放行。',
        evidence: args.join(' ').slice(0, 120),
      });
    }

    // 4. env 里的明文凭据
    for (const [k, v] of Object.entries(env)) {
      if (SECRET_KEY_RE.test(k) && v && String(v).length > 6) {
        out.push({
          id: 'MCPG-ENV-SECRET', severity: 'medium', client, file, server,
          source: '凭据管理基线：客户端配置文件明文存凭据 = 一份会同步/备份/被读的密钥副本',
          advice: `env「${k}」的值看起来是凭据（已打码 ${mask(v)}）。改用系统钥匙串/登录 shell 注入，配置里只留变量名。`,
          evidence: `${k}=${mask(v)}`,
        });
      }
    }

    // 5. sudo 提权启动
    if (/\bsudo\b/.test(cmd + ' ' + argText)) {
      out.push({
        id: 'MCPG-SUDO', severity: 'high', client, file, server,
        source: '最小权限原则：MCP server 不应以 root 身份常驻',
        advice: '去掉 sudo，把需要的端口/文件权限单独授给普通用户；root 常驻的 server 被打穿即整机失守。',
        evidence: `${cmd} ${args.join(' ')}`.slice(0, 120),
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2, info: 3 };
  out.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return out;
}

export function scanMcp({ root } = {}) {
  const servers = discover({ root });
  const findings = checkServers(servers);
  return {
    servers,
    findings,
    stats: { configsClients: new Set(servers.map((s) => s.client)).size, serverCount: servers.length, findings: findings.length },
  };
}

// ── DSH 插件接入（方案 A 薄壳：注册 skill 与 CLI 入口；业务逻辑仍在 lib/bin，不在此处）──
import { createPlugin, pkgRootFrom } from '@deepwhale-cn/dsh-guard-core/plugin';

export const { name, inject, apply } = createPlugin({
  name: 'mcp-guard',
  pkgRoot: pkgRootFrom(import.meta.url),
  skillFile: 'skill/mcp-guard.md',
  binFile: 'bin/cli.mjs',
  description: "审计本机各客户端的 MCP server 配置：未锁版本、明文端点、自动批准危险开关、环境变量里的明文密钥",
  whenToUse: "装机新 MCP server 后或定期体检本机 MCP 配置安全。用户会说：我的 mcp.json 安全吗、有没有危险配置。",
});
