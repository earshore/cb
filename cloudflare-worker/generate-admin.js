const fs = require('fs');
const html = fs.readFileSync('D:/Users/Administrator/Documents/GitHub/cb/frontend/admin.html', 'utf8');
// Escape backslashes first, then backticks and dollar signs
const escaped = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
const output = `/**
 * 管理界面 HTML
 * 从原始 admin.html 文件导出
 */
export const adminHTML = \`${escaped}\`
`;
fs.writeFileSync('src/routes/admin-html.ts', output);
console.log('Generated admin-html.ts successfully');
