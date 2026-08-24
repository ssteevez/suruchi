const fs = require('fs');
const path = require('path');

const svg_snippet = `
    <a href="/" class="global-home-btn" aria-label="Home">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </a>
`;

const css_snippet = `
    <style>
      .global-home-btn {
        position: fixed;
        top: 36px;
        left: 36px;
        width: 32px;
        height: 32px;
        color: rgba(245, 245, 245, 0.6);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 180ms ease, opacity 180ms ease, transform 180ms ease;
      }
      .global-home-btn:hover {
        color: white;
        opacity: 1;
        transform: scale(1.05);
      }
      .global-home-btn svg {
        width: 20px;
        height: 20px;
      }
    </style>
`;

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (!dirPath.includes('node_modules') && !dirPath.includes('dist') && !dirPath.includes('.git')) {
        walkDir(dirPath, callback);
      }
    } else {
      callback(path.join(dir, f));
    }
  });
}

walkDir('.', function(filePath) {
  if (filePath.endsWith('.html') && filePath !== 'index.html' && !filePath.includes('suruchi-admin')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('global-home-btn')) {
      return;
    }

    content = content.replace(/<a[^>]*href="\/"[^>]*class="back-btn"[^>]*>\s*HOME\s*<\/a>/g, '');
    content = content.replace(/<a[^>]*class="back-btn"[^>]*href="\/"[^>]*>\s*HOME\s*<\/a>/g, '');
    
    content = content.replace('</head>', css_snippet + '</head>');
    content = content.replace('<body>', '<body>\n' + svg_snippet);
    
    fs.writeFileSync(filePath, content);
    console.log('Updated: ' + filePath);
  }
});
console.log('Done');
