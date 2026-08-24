import os
import glob
import re

svg_snippet = """
    <a href="/" class="global-home-btn" aria-label="Home">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </a>
"""

css_snippet = """
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
"""

html_files = glob.glob('*.html')

for filepath in html_files:
    with open(filepath, 'r') as f:
        content = f.read()

    if 'global-home-btn' in content:
        continue

    content = re.sub(r'<a[^>]*href="/"[^>]*class="back-btn"[^>]*>\s*HOME\s*</a>', '', content)
    content = re.sub(r'<a[^>]*class="back-btn"[^>]*href="/"[^>]*>\s*HOME\s*</a>', '', content)

    content = content.replace('</head>', css_snippet + '</head>')
    content = content.replace('<body>', '<body>\n' + svg_snippet)

    with open(filepath, 'w') as f:
        f.write(content)

print("Done")
