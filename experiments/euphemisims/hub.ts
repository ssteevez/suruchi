import { WORKS } from './registry.js';

const list = document.getElementById('work-grid');
if (!list) {
  throw new Error('Euphemisims hub: #work-grid not found');
}

for (const work of WORKS) {
  const card = document.createElement('a');
  card.href = `./work.html?slug=${encodeURIComponent(work.slug)}`;
  card.className = 'thumbnail-card';

  const frameWrap = document.createElement('div');
  frameWrap.className = 'thumbnail-video-wrap';
  
  const iframe = document.createElement('iframe');
  iframe.src = `./work.html?slug=${encodeURIComponent(work.slug)}&thumb=1`;
  iframe.className = 'thumbnail-video';
  iframe.tabIndex = -1;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('loading', 'lazy');

  frameWrap.appendChild(iframe);
  card.appendChild(frameWrap);

  const title = document.createElement('span');
  title.className = 'thumbnail-title';
  title.textContent = work.title;
  title.style.marginTop = '16px';
  title.style.fontSize = '14px';
  title.style.letterSpacing = '0.08em';
  title.style.textTransform = 'uppercase';
  
  card.appendChild(title);
  list.appendChild(card);
}
