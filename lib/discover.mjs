/**
 * MCP 配置发现内核（dsh-mcp-guard / dsh-mcp-inventory 共用，各自内嵌副本）
 *
 * 已知客户端配置位置（macOS 为主，Windows/Linux 路径存在则一并扫）：
 *   Claude Code   ~/.claude.json（顶层 mcpServers 与 projects.*.mcpServers）
 *   Claude Desktop ~/Library/Application Support/Claude/claude_desktop_config.json
 *   Cursor        ~/.cursor/mcp.json
 *   Windsurf      ~/.codeium/windsurf/mcp_config.json
 *   任意目录      root 下任意层级的 mcp.json / mcp_config.json / claude_desktop_config.json
 */
import { homedir, platform } from 'node:os';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const CLIENT_CONFIGS = () => {
  const h = homedir();
  const list = [
    { client: 'claude-code', label: 'Claude Code', path: join(h, '.claude.json'), parse: 'claude-code' },
    { client: 'claude-desktop', label: 'Claude Desktop', path: join(h, 'Library/Application Support/Claude/claude_desktop_config.json'), parse: 'flat' },
    { client: 'cursor', label: 'Cursor', path: join(h, '.cursor', 'mcp.json'), parse: 'flat' },
    { client: 'windsurf', label: 'Windsurf', path: join(h, '.codeium', 'windsurf', 'mcp_config.json'), parse: 'flat' },
  ];
  if (platform() === 'win32') {
    const app = process.env.APPDATA || join(h, 'AppData', 'Roaming');
    list[1].path = join(app, 'Claude', 'claude_desktop_config.json');
    list[2].path = join(h, '.cursor', 'mcp.json');
  } else if (platform() === 'linux') {
    list[1].path = join(h, '.config', 'Claude', 'claude_desktop_config.json');
  }
  return list.filter((c) => existsSync(c.path));
};

/** 在目录树里找疑似 MCP 配置文件 */
export function findProjectConfigs(root) {
  const NAMES = new Set(['mcp.json', 'mcp_config.json', 'claude_desktop_config.json', '.mcp.json']);
  const out = [];
  (function rec(dir, depth) {
    if (depth > 6) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.mcp.json') continue;
      if (['node_modules', '.git', 'dist', 'build'].includes(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) rec(full, depth + 1);
      else if (NAMES.has(e.name.toLowerCase())) out.push(full);
    }
  })(root, 0);
  return out;
}

/** 读一个配置文件 → [{ server, client, file, kind, spec }] */
export function readConfigFile(file, client) {
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf-8')); } catch { return []; }
  const servers = [];
  const push = (name, spec) => {
    if (spec && typeof spec === 'object') servers.push({ server: name, client, file, kind: spec.url ? 'remote' : 'stdio', spec });
  };
  if (Array.isArray(json.mcpServers)) json.mcpServers.forEach((s) => s && push(s.name || s.id, s));
  else if (json.mcpServers && typeof json.mcpServers === 'object') {
    for (const [name, spec] of Object.entries(json.mcpServers)) push(name, spec);
  } else {
    // claude-code 的 projects.*.mcpServers；其余顶层同名结构
    for (const [k, v] of Object.entries(json || {})) {
      if (k === 'projects' && v && typeof v === 'object') {
        for (const [proj, pv] of Object.entries(v)) {
          if (pv && pv.mcpServers) {
            for (const [name, spec] of Object.entries(pv.mcpServers)) push(name, { ...spec, __project: proj });
          }
        }
      } else if (v && (v.command || v.url) && !/^\d+$/.test(k)) {
        push(k, v);
      }
    }
  }
  return servers;
}

/** 汇总所有来源 */
export function discover({ root } = {}) {
  const found = [];
  for (const c of CLIENT_CONFIGS()) {
    for (const s of readConfigFile(c.path, c.label)) found.push(s);
  }
  if (root) for (const f of findProjectConfigs(root)) {
    for (const s of readConfigFile(f, '(项目内)')) found.push(s);
  }
  return found;
}

export { statSync };
