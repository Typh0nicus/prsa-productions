(() => {
  const layer = document.getElementById('routeTransition');
  const image = document.getElementById('routeTransitionImage');
  const title = document.getElementById('routeTransitionTitle');
  const meta = document.getElementById('routeTransitionMeta');
  if (!layer || !image || !title || !meta) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let leaving = false;
  let navigationTimer = 0;

  const reset = () => {
    // The receiving-cover system owns the layer during a covered arrival.
    if (document.documentElement.classList.contains('route-arrived')) return;
    window.clearTimeout(navigationTimer);
    leaving = false;
    document.body.classList.remove('route-leaving');
    layer.classList.add('is-resetting');
    layer.classList.remove('is-active', 'has-no-media', 'route-transition--portrait');
    window.requestAnimationFrame(() => {
      image.removeAttribute('src');
      window.requestAnimationFrame(() => layer.classList.remove('is-resetting'));
    });
  };

  window.addEventListener('pageshow', reset);
  window.addEventListener('pagehide', () => window.clearTimeout(navigationTimer));

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-project-transition]');
    if (!link || leaving || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduceMotion.matches) return;
    if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return;

    const destination = link.href;
    if (!destination) return;

    event.preventDefault();
    leaving = true;
    title.textContent = link.dataset.projectTitle || 'Selected work';
    meta.textContent = 'Prša Productions';

    const fallback = link.dataset.projectFallback || '';
    layer.classList.remove('has-no-media', 'is-resetting');
    layer.classList.toggle('route-transition--portrait', link.dataset.projectFormat === 'portrait');
    image.onerror = () => {
      if (fallback && image.getAttribute('src') !== fallback) {
        image.src = fallback;
        return;
      }
      layer.classList.add('has-no-media');
    };
    const selectedImage = link.dataset.projectThumb || link.querySelector('img')?.currentSrc || link.querySelector('img')?.src || fallback;
    if (selectedImage) image.src = selectedImage;
    else layer.classList.add('has-no-media');

    document.body.classList.add('route-leaving');
    // Hand the cover to the destination page so arrival continues the same scene.
    try {
      sessionStorage.setItem('prsa-route', JSON.stringify({
        title: link.dataset.projectTitle || '',
        thumb: selectedImage || '',
        format: link.dataset.projectFormat || 'landscape'
      }));
    } catch (error) {}
    window.requestAnimationFrame(() => layer.classList.add('is-active'));
    navigationTimer = window.setTimeout(() => window.location.assign(destination), 760);
  });
})();
