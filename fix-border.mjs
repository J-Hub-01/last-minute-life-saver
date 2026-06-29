import fs from 'fs';
import path from 'path';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/border-\[\#1E293B\]/g, 'border-slate-800');
  fs.writeFileSync(filePath, content);
}

function walkDir(dir) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) walkDir(dirPath);
    else if (dirPath.endsWith('.tsx')) replaceInFile(dirPath);
  });
}

walkDir('./src');
