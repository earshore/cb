const fs = require('fs');
const path = require('path');

// 读取原始 HTML 文件
const htmlPath = path.join(__dirname, '..', 'frontend', 'admin.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// 转义模板字符串中的特殊字符
const escapedHtml = html
  .replace(/\\/g, '\\\\')  // 转义反斜杠
  .replace(/`/g, '\\`')    // 转义反引号
  .replace(/\${/g, '\\${'); // 转义模板字符串语法

// 生成 TypeScript 文件
const tsContent = `/**
 * 管理界面 HTML
 * 从原始 admin.html 文件导出
 */
export const adminHTML = \`${escapedHtml}\`
`;

// 写入文件
const outputPath = path.join(__dirname, 'src', 'routes', 'admin-html.ts');
fs.writeFileSync(outputPath, tsContent, 'utf-8');

console.log('✅ admin-html.ts 生成成功！');
