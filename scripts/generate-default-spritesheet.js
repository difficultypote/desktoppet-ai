// ============================================================
// generate-default-spritesheet.js
// 生成默认宠物的 spritesheet 占位图
// 1536x1872, 8列x9行, 每帧192x208
// 使用 sharp 库绘制简单图形占位
// ============================================================

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const FRAME_W = 192;
const FRAME_H = 208;
const COLS = 8;
const ROWS = 9;
const SHEET_W = COLS * FRAME_W; // 1536
const SHEET_H = ROWS * FRAME_H; // 1872

// 9 种状态对应的颜色
const STATE_COLORS = [
  '#4CAF50', // idle - 绿色
  '#2196F3', // running-right - 蓝色
  '#03A9F4', // running-left - 浅蓝
  '#FF9800', // waving - 橙色
  '#9C27B0', // jumping - 紫色
  '#F44336', // failed - 红色
  '#FFC107', // waiting - 黄色
  '#00BCD4', // running - 青色
  '#795548', // review - 棕色
];

const STATE_LABELS = [
  'IDLE', 'R-RUN', 'L-RUN', 'WAVE', 'JUMP',
  'FAIL', 'WAIT', 'RUN', 'THINK'
];

async function generateFrame(row, col) {
  const color = STATE_COLORS[row];
  const label = STATE_LABELS[row];
  const frameNum = col;

  // 创建 SVG 帧
  const svg = `
  <svg width="${FRAME_W}" height="${FRAME_H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${FRAME_W}" height="${FRAME_H}" fill="transparent"/>
    <!-- 身体 -->
    <ellipse cx="${FRAME_W / 2}" cy="${FRAME_H / 2 + 20}" rx="60" ry="70" fill="${color}" opacity="0.85"/>
    <!-- 头部 -->
    <circle cx="${FRAME_W / 2}" cy="${FRAME_H / 2 - 40}" r="40" fill="${color}"/>
    <!-- 眼睛 -->
    <circle cx="${FRAME_W / 2 - 15}" cy="${FRAME_H / 2 - 45}" r="6" fill="white"/>
    <circle cx="${FRAME_W / 2 + 15}" cy="${FRAME_H / 2 - 45}" r="6" fill="white"/>
    <circle cx="${FRAME_W / 2 - 15}" cy="${FRAME_H / 2 - 45}" r="3" fill="black"/>
    <circle cx="${FRAME_W / 2 + 15}" cy="${FRAME_H / 2 - 45}" r="3" fill="black"/>
    <!-- 嘴巴（随帧变化） -->
    ${col % 4 === 0
      ? `<path d="M ${FRAME_W / 2 - 10} ${FRAME_H / 2 - 25} Q ${FRAME_W / 2} ${FRAME_H / 2 - 15} ${FRAME_W / 2 + 10} ${FRAME_H / 2 - 25}" stroke="black" stroke-width="2" fill="none"/>`
      : `<circle cx="${FRAME_W / 2}" cy="${FRAME_H / 2 - 22}" r="4" fill="black"/>`
    }
    <!-- 帧编号 -->
    <text x="10" y="20" font-family="monospace" font-size="12" fill="${color}" opacity="0.6">${label} ${frameNum}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(FRAME_W, FRAME_H)
    .png()
    .toBuffer();
}

async function generateSpritesheet() {
  console.log('Generating default spritesheet...');

  // 创建透明底图
  const composites = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const frameBuffer = await generateFrame(row, col);
      composites.push({
        input: frameBuffer,
        left: col * FRAME_W,
        top: row * FRAME_H,
      });
    }
  }

  const outputPath = path.join(__dirname, '..', 'resources', 'default-pets', 'spritesheet.png');

  // 确保目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  console.log(`Default spritesheet generated: ${outputPath}`);
  console.log(`Size: ${SHEET_W}x${SHEET_H}`);
}

// 生成托盘图标
async function generateTrayIcon() {
  const svg = `
  <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="7" fill="#4CAF50"/>
    <circle cx="6" cy="6" r="2" fill="white"/>
    <circle cx="10" cy="6" r="2" fill="white"/>
    <circle cx="6" cy="6" r="1" fill="black"/>
    <circle cx="10" cy="6" r="1" fill="black"/>
    <path d="M 5 10 Q 8 12 11 10" stroke="black" stroke-width="1" fill="none"/>
  </svg>`;

  const outputPath = path.join(__dirname, '..', 'resources', 'tray-icon.png');
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  console.log(`Tray icon generated: ${outputPath}`);
}

// 主函数
(async () => {
  try {
    await generateSpritesheet();
    await generateTrayIcon();
    console.log('All resources generated successfully!');
  } catch (err) {
    console.error('Error generating resources:', err);
    process.exit(1);
  }
})();
