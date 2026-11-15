#!/usr/bin/env node
/**
 * dsh-mcp-guard —— MCP 配置安检（离线，只读本机配置文件）
 * 用法：
 *   dsh-mcp-guard                       # 检查已知的用户级客户端配置
 *   dsh-mcp-guard --root <项目目录>      # 同时扫项目里的 mcp 配置
 *   dsh-mcp-guard --json | --html r.html
 * 退出码：有 high 命中 → 1
 */
import { writeFileSync } from 'node:fs';
import { scanMcp } from '../lib/index.js';

const args = process.argv.slice(2);
const has = (k) => args.includes('--' + k);
const val = (k, d = '') => {
  const i = args.indexOf('--' + k);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

if (has('help')) {
  console.log(`dsh-mcp-guard —— MCP 配置安检

用法：dsh-mcp-guard [--root 项目目录] [--json] [--html out.html]
检查范围：Claude Code / Claude Desktop / Cursor / Windsurf 的用户级配置 + 指定目录内的 mcp 配置文件。
5 条判据：未锁版本包执行器 / 明文 http 端点 / 自动批准开关 / env 明文凭据 / sudo 启动。`);
  process.exit(0);
}

const { servers, findings, stats } = scanMcp({ root: has('root') ? val('root') : undefined });

if (has('json')) {
  console.log(JSON.stringify({ stats, findings, servers }, null, 2));
} else {
  const line = '─'.repeat(66);
  console.log(`\n  深鲸守护 · MCP 配置安检\n  ${line}`);
  console.log(`  扫描范围   用户级客户端配置${has('root') ? ' + 项目目录 ' + val('root') : ''}`);
  console.log(`  覆盖       ${stats.configsClients} 个客户端 · ${stats.serverCount} 个 MCP server`);
  if (!servers.length) {
    console.log('\n  ❌ 没有发现任何 MCP server 配置。');
    console.log('     本工具只认已知客户端的标准位置与 mcp.json 类文件 —— 如果你确有配置，请把配置路径报给 --root。');
    process.exit(2);
  }
  console.log(`  命中       ${findings.length} 条\n`);
  for (const f of findings) {
    console.log(`  【${f.severity === 'high' ? '高' : f.severity === 'medium' ? '中' : '低'}】${f.id} · ${f.server}（${f.client}）`);
    console.log(`      证据  ${f.evidence}`);
    console.log(`      依据  ${f.source}`);
    console.log(`      建议  ${f.advice}`);
    console.log(`      位置  ${f.file}\n`);
  }
  if (!findings.length) console.log('  未命中已知风险模式（不等于绝对安全：本工具只做配置层静态检查）。\n');
}

if (has('html')) {
  const rows = findings.map((f) => `<tr><td>${f.severity}</td><td>${f.id}</td><td>${esc(f.server)}<br><small>${esc(f.client)} · ${esc(f.file)}</small></td><td>${esc(f.evidence)}</td><td>${esc(f.advice)}</td></tr>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><title>MCP 配置安检报告</title>
<style>body{font:14px/1.6 -apple-system,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:top}th{background:#f5f5f5}.high{color:#dc2626;font-weight:600}.medium{color:#ca8a04}</style>
<h1>MCP 配置安检报告</h1><p>${stats.configsClients} 个客户端 · ${stats.serverCount} 个 server · ${findings.length} 条命中</p>
<table><tr><th>级别</th><th>规则</th><th>Server</th><th>证据</th><th>建议</th></tr>${rows.join('')}</table>`;
  writeFileSync(val('html'), html, 'utf-8');
  console.log(`HTML 报告已写入：${val('html')}`);
}
process.exit(findings.some((f) => f.severity === 'high') ? 1 : 0);

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
