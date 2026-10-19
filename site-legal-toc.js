(function () {
  var toc = document.querySelector('.legal-toc');
  if (!toc) return;

  var toggle = toc.querySelector('.legal-toc-toggle');
  var panel = toc.querySelector('.legal-toc-panel');
  var mqDesktop = window.matchMedia('(min-width: 768px)');

  function setTocOpen(open) {
    toc.classList.toggle('is-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function syncTocLayout() {
    if (mqDesktop.matches) {
      setTocOpen(true);
    } else if (!toc.classList.contains('is-open')) {
      setTocOpen(false);
    }
  }

  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      if (mqDesktop.matches) return;
      setTocOpen(!toc.classList.contains('is-open'));
    });
    mqDesktop.addEventListener('change', syncTocLayout);
    syncTocLayout();
  }

  document.querySelectorAll('.legal-toc a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href').slice(1);
      var target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', '#' + id);
      else location.hash = id;
    });
  });

  var topBtn = document.getElementById('legal-top');
  if (topBtn) {
    var showAfter = 320;
    function onScroll() {
      var show = window.scrollY > showAfter;
      topBtn.hidden = !show;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    topBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var top = document.getElementById('top');
      if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
      if (history.replaceState) history.replaceState(null, '', ' ');
    });
  }
})();
