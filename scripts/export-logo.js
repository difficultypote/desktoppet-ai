// 将选中的 SVG Logo 导出为各种尺寸的 PNG
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'resources', 'logos', 'logo-02-rounded-pet.svg');
const svgBuffer = fs.readFileSync(svgPath);

const resourcesDir = path.join(__dirname, '..', 'resources');

async function exportAll() {
  // 512x512 应用图标
  await sharp(svgBuffer, { density: 512 })
    .resize(512, 512)
    .png()
    .toFile(path.join(resourcesDir, 'icon.png'));
  console.log('Exported: icon.png (512x512)');

  // 256x256 备用图标
  await sharp(svgBuffer, { density: 256 })
    .resize(256, 256)
    .png()
    .toFile(path.join(resourcesDir, 'icon-256.png'));
  console.log('Exported: icon-256.png (256x256)');

  // 32x32 托盘图标
  await sharp(svgBuffer, { density: 128 })
    .resize(32, 32)
    .png()
    .toFile(path.join(resourcesDir, 'tray-icon.png'));
  console.log('Exported: tray-icon.png (32x32)');

  // 16x16 小尺寸托盘图标
  await sharp(svgBuffer, { density: 64 })
    .resize(16, 16)
    .png()
    .toFile(path.join(resourcesDir, 'tray-icon-16.png'));
  console.log('Exported: tray-icon-16.png (16x16)');

  // 64x64 中等尺寸
  await sharp(svgBuffer, { density: 256 })
    .resize(64, 64)
    .png()
    .toFile(path.join(resourcesDir, 'icon-64.png'));
  console.log('Exported: icon-64.png (64x64)');

  console.log('\nAll icons exported successfully!');
}

exportAll().catch(console.error);
