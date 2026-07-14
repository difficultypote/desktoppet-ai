// ============================================================
// fix-build-paths.js — 构建后修复 HTML 文件路径
// vite 默认保留源码目录结构，导致 HTML 在 dist/renderer/src/renderer/ 下
// 此脚本将它们复制到主进程期望的 dist/renderer/pet/ 和 dist/renderer/config/
// 同时修正 HTML 内部的资源引用路径
// ============================================================

const fs = require('fs');
const path = require('path');

const rendererDir = path.join(__dirname, '..', 'dist', 'renderer');

// 源路径（vite 默认输出位置） -> 目标路径
const moves = [
  {
    from: path.join(rendererDir, 'src', 'renderer', 'pet', 'index.html'),
    to: path.join(rendererDir, 'pet', 'index.html'),
  },
  {
    from: path.join(rendererDir, 'src', 'renderer', 'config', 'index.html'),
    to: path.join(rendererDir, 'config', 'index.html'),
  },
];

for (const { from, to } of moves) {
  if (fs.existsSync(from)) {
    // 确保目标目录存在
    fs.mkdirSync(path.dirname(to), { recursive: true });

    // 读取 HTML 内容，修正资源路径
    let content = fs.readFileSync(from, 'utf8');
    // 原始路径 ../../../assets/ -> 修正为 ../assets/
    // 因为 HTML 从 src/renderer/pet/ 移到了 pet/，少了两层目录
    content = content.split('../../../').join('../');

    fs.writeFileSync(to, content, 'utf8');
    console.log(`[fix-build-paths] Fixed & copied: ${path.relative(rendererDir, from)} -> ${path.relative(rendererDir, to)}`);
  } else {
    console.warn(`[fix-build-paths] Not found: ${from}`);
  }
}

// 清理多余的 src 目录
const srcDir = path.join(rendererDir, 'src');
if (fs.existsSync(srcDir)) {
  fs.rmSync(srcDir, { recursive: true, force: true });
  console.log('[fix-build-paths] Cleaned: src/');
}

console.log('[fix-build-paths] Done');
