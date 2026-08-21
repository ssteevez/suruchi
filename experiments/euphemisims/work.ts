import { getAdjacentWorks, getWorkEntry } from './registry.js';

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('thumb')) {
  document.body.classList.add('is-thumbnail');
}

const stage = document.getElementById('work-stage');
const nextLink = document.getElementById('work-next');

if (!stage || !nextLink) {
  throw new Error('Euphemisims work shell: required DOM missing');
}

const workHref = (slug: string): string =>
  `./work.html?slug=${encodeURIComponent(slug)}`;

const applyAdjacentNav = (currentSlug: string): void => {
  const { next } = getAdjacentWorks(currentSlug);

  if (next) {
    nextLink.hidden = false;
    nextLink.href = workHref(next.slug);
    nextLink.textContent = `NEXT`;
    nextLink.setAttribute('aria-label', `Next work: ${next.title}`);
  } else {
    nextLink.hidden = true;
    nextLink.removeAttribute('href');
  }
};

const slug = new URLSearchParams(location.search).get('slug');
if (!slug) {
  stage.innerHTML = '<p class="work-error">No work selected.</p>';
} else {
  const entry = getWorkEntry(slug);
  if (!entry) {
    stage.innerHTML = '<p class="work-error">Work not found.</p>';
  } else {
    document.title = `${entry.title} — Archive of Unthought Knowns`;
    applyAdjacentNav(slug);

    window.addEventListener('pageshow', (event) => {
      if (event.persisted) applyAdjacentNav(slug);
    });

    void entry.load().then((mod) => {
      const dispose = mod.default.mount(stage);
      window.addEventListener('beforeunload', () => dispose());
    });
  }
}
