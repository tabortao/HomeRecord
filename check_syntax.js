const fs = require('fs');

// 读取app.js文件内容
const appJsContent = fs.readFileSync('frontend/js/app.js', 'utf8');

// 移除import语句
const contentWithoutImports = appJsContent
  .replace(/^import .*$/gm, '')
  .replace(/^\/\/ 导入.*$/gm, '');

// 尝试解析修改后的内容
try {
  new Function(contentWithoutImports);
  console.log('PARSE_OK: 除import语句外的代码语法正确');
} catch (error) {
  console.error('语法错误:', error.message);
  // 尝试定位错误位置
  const errorLine = error.stack.split('\n')[0].match(/<anonymous>:(\d+):(\d+)/);
  if (errorLine) {
    const lineNum = parseInt(errorLine[1]);
    const lines = contentWithoutImports.split('\n');
    console.log(`错误大约在第${lineNum}行附近:`);
    // 显示错误行附近的代码
    for (let i = Math.max(0, lineNum - 5); i < Math.min(lines.length, lineNum + 5); i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
}