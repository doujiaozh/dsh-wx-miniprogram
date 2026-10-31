/**
 * 零依赖微型模板引擎（mp 全家桶共用）。
 *
 * 语法：
 *   {{var}}                     变量插值（支持点路径 {{a.b.c}}）
 *   {{#if expr}}...{{else}}...{{/if}}   条件块，expr 支持 == != > < >= <= 与字面量
 *   {{#each list as item}}...{{/each}}  循环块，作用域内可用 item / index / this，支持 {{../x}} 回溯父级
 *   {{!-- 注释 --}}             注释
 *
 * 数据中的 null/undefined 渲染为空字符串，不抛错——面向代码生成场景的宽松策略。
 */

export type TemplateData = Record<string, any>;

type Token =
  | { t: 'text'; v: string }
  | { t: 'var'; v: string }
  | { t: 'if'; v: string }
  | { t: 'else' }
  | { t: 'each'; v: string }
  | { t: 'end' };

type AstNode =
  | { kind: 'text'; v: string }
  | { kind: 'var'; expr: string }
  | { kind: 'if'; expr: string; thenChildren: AstNode[]; elseChildren: AstNode[] }
  | { kind: 'each'; expr: string; alias: string; children: AstNode[] };

type Frame =
  | { kind: 'if'; expr: string; thenChildren: AstNode[]; elseChildren: AstNode[]; inElse: boolean }
  | { kind: 'each'; expr: string; alias: string; children: AstNode[] };

const TAG_RE = /\{\{([\s\S]*?)\}\}/g;

function tokenize(tpl: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(tpl)) !== null) {
    if (m.index > last) tokens.push({ t: 'text', v: tpl.slice(last, m.index) });
    const raw = m[1].trim();
    if (raw.startsWith('#if ')) tokens.push({ t: 'if', v: raw.slice(4).trim() });
    else if (raw === 'else') tokens.push({ t: 'else' });
    else if (raw.startsWith('#each ')) tokens.push({ t: 'each', v: raw.slice(6).trim() });
    else if (raw === '/if' || raw === '/each') tokens.push({ t: 'end' });
    else if (raw.startsWith('!--')) {
      /* 注释，直接丢弃 */
    } else tokens.push({ t: 'var', v: raw });
    last = TAG_RE.lastIndex;
  }
  if (last < tpl.length) tokens.push({ t: 'text', v: tpl.slice(last) });
  return tokens;
}

function parse(tpl: string): AstNode[] {
  const root: AstNode[] = [];
  const frames: Frame[] = [];
  const pushNode = (node: AstNode): void => {
    const f = frames[frames.length - 1];
    if (!f) {
      root.push(node);
      return;
    }
    if (f.kind === 'if') (f.inElse ? f.elseChildren : f.thenChildren).push(node);
    else f.children.push(node);
  };

  for (const tok of tokenize(tpl)) {
    switch (tok.t) {
      case 'text':
        pushNode({ kind: 'text', v: tok.v });
        break;
      case 'var':
        pushNode({ kind: 'var', expr: tok.v });
        break;
      case 'if':
        frames.push({ kind: 'if', expr: tok.v, thenChildren: [], elseChildren: [], inElse: false });
        break;
      case 'each': {
        const m = /^(.+?)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(tok.v);
        frames.push({ kind: 'each', expr: (m ? m[1] : tok.v).trim(), alias: m ? m[2] : 'item', children: [] });
        break;
      }
      case 'else': {
        const f = frames[frames.length - 1];
        if (f && f.kind === 'if') f.inElse = true;
        break;
      }
      case 'end': {
        const f = frames.pop();
        if (!f) break;
        if (f.kind === 'if') {
          pushNode({ kind: 'if', expr: f.expr, thenChildren: f.thenChildren, elseChildren: f.elseChildren });
        } else {
          pushNode({ kind: 'each', expr: f.expr, alias: f.alias, children: f.children });
        }
        break;
      }
      default:
        break;
    }
  }
  return root;
}

/** 从作用域栈中解析点路径表达式，支持 `..` 回溯与 `this`；逐层向外回退查找 */
function resolve(expr: string, scopes: any[]): any {
  const parts = expr.split('.');
  let depth = scopes.length;
  let i = 0;
  while (parts[i] === '..' && depth > 1) {
    depth--;
    i++;
  }
  for (let s = depth - 1; s >= 0; s--) {
    let cur: any = scopes[s];
    let j = i;
    if (parts[j] === 'this') j++;
    let ok = true;
    for (; j < parts.length; j++) {
      if (cur == null) {
        ok = false;
        break;
      }
      const p = parts[j];
      if (p === 'length' && Array.isArray(cur)) cur = cur.length;
      else cur = cur[p];
    }
    if (ok && cur !== undefined) return cur;
  }
  return undefined;
}

/** 表达式求值：字面量 / 比较 / 路径 */
function evalExpr(expr: string, scopes: any[]): any {
  const e = expr.trim();
  if (/^(['"])([\s\S]*)\1$/.test(e)) return e.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  if (e === 'true') return true;
  if (e === 'false') return false;
  if (e === 'null') return null;
  const m = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(e);
  if (m) {
    const a = evalExpr(m[1], scopes);
    const b = evalExpr(m[3], scopes);
    switch (m[2]) {
      case '==':
        return a == b;
      case '!=':
        return a != b;
      case '>=':
        return a >= b;
      case '<=':
        return a <= b;
      case '>':
        return a > b;
      default:
        return a < b;
    }
  }
  return resolve(e, scopes);
}

function renderAst(nodes: AstNode[], scopes: any[]): string {
  let out = '';
  for (const n of nodes) {
    switch (n.kind) {
      case 'text':
        out += n.v;
        break;
      case 'var': {
        const v = evalExpr(n.expr, scopes);
        out += v == null ? '' : String(v);
        break;
      }
      case 'if':
        out += evalExpr(n.expr, scopes)
          ? renderAst(n.thenChildren, scopes)
          : renderAst(n.elseChildren, scopes);
        break;
      case 'each': {
        const arr = evalExpr(n.expr, scopes);
        if (Array.isArray(arr)) {
          for (let idx = 0; idx < arr.length; idx++) {
            const scope: TemplateData = {
              [n.alias]: arr[idx],
              index: idx,
              this: arr[idx],
            };
            out += renderAst(n.children, scopes.concat([scope]));
          }
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** 渲染模板字符串 */
export function render(template: string, data: TemplateData): string {
  return renderAst(parse(template), [data || {}]);
}
