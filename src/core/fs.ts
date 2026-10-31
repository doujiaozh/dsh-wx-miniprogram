/**
 * 文件系统工具：所有插件落盘都走这里，统一 POSIX 路径风格。
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileSpec } from './types';

/** 将 Windows 路径分隔符转为 POSIX 风格 */
export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

/** 递归创建目录（已存在则跳过） */
export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 把 FileSpec 列表批量写入项目根目录，返回已写入的相对路径列表 */
export function writeFiles(root: string, files: FileSpec[]): string[] {
  ensureDir(root);
  const written: string[] = [];
  for (const f of files) {
    const abs = path.join(root, toPosix(f.path));
    ensureDir(path.dirname(abs));
    fs.writeFileSync(abs, f.content, 'utf8');
    written.push(toPosix(f.path));
  }
  return written;
}

/** 写 JSON 文件（2 空格缩进，尾部换行） */
export function writeJson(file: string, obj: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

/** 读 JSON 文件 */
export function readJson<T = any>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** 文件是否存在 */
export function exists(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/** 复制单个文件（自动创建父目录） */
export function copyFile(from: string, to: string): void {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}
