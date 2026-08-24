const fs = require('fs');

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

walk('experiments', function(err, results) {
  if (err) throw err;
  const htmlFiles = results.filter(f => f.endsWith('.html') && !f.includes('scratch') && !f.includes('node_modules'));
  
  for (const filepath of htmlFiles) {
    let content = fs.readFileSync(filepath, 'utf8');
    
    if (!content.includes('global-back-btn')) continue;
    
    console.log(`Reverting ${filepath}...`);
    
    content = content.replace(/(\.global-home-btn\s*\{[^}]*)left:\s*88px;/g, '$1left: 36px;');
    content = content.replace(/(\.global-home-btn\s*\{[^}]*)left:\s*76px;/g, '$1left: 36px;');
    content = content.replace(/(\.global-home-btn\s*\{[^}]*)left:\s*90px;/g, '$1left: 36px;');
    content = content.replace(/(\.global-home-btn\s*\{[^}]*)left:\s*84px;/g, '$1left: 36px;');
    
    content = content.replace(/([ \t]*)\.global-back-btn\s*\{[\s\S]*?\}\s*\.global-home-btn\s*\{/, '$1.global-home-btn {');
    
    content = content.replace(/[ \t]*<a href="javascript:history\.back\(\)" class="global-back-btn"[\s\S]*?<\/a>\s*<a href="\/" class="global-home-btn"/, '<a href="/" class="global-home-btn"');
    
    fs.writeFileSync(filepath, content);
  }
});
