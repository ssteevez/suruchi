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
  
  // Make the thumbnail background stark white for letterboxing/pillarboxing
  frameWrap.style.backgroundColor = '#ffffff';

  const img = document.createElement('img');
  img.src = `/images/poet/thumbnails/${work.slug}.jpg`;
  img.className = 'thumbnail-video'; // We can reuse the class for now
  img.style.width = '100%';
  img.style.height = '100%';
  
  // Specific override: "The Thing To Do" was perfectly cropped before, retain that
  if (work.slug === 'the-thing-to-do') {
    img.style.objectFit = 'cover';
  } else {
    img.style.objectFit = 'contain';
  }
  
  img.style.transform = 'none'; // Overriding the scale(0.5) from iframe CSS
  img.alt = work.title;
  
  // Fallback to a grey square if the image isn't uploaded yet
  img.onerror = () => {
    img.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23222%22%20%2F%3E%3C%2Fsvg%3E';
  };

  frameWrap.appendChild(img);
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
