import fs from 'fs';
import path from 'path';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/bg-white text-slate-900/g, 'bg-slate-50 text-slate-950');
  content = content.replace(/bg-white text-slate-950/g, 'bg-slate-50 text-slate-950');
  content = content.replace(/bg-white transition-transform/g, 'bg-slate-50 transition-transform');
  content = content.replace(/bg-white border-indigo-500/g, 'bg-slate-50 border-indigo-500');
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
