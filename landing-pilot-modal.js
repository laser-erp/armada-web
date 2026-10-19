/* landing.html — модальное окно «Пилотный проект» (#pilot), a11y + CSP */
(function () {
  var HASH_OPEN = ['#pilot', '#pilot-project'];
  var FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var modal = null;
  var panel = null;
  var lastFocus = null;
  var open = false;

  function isPilotHash(hash) {
    var h = String(hash || '').toLowerCase();
    return HASH_OPEN.indexOf(h) !== -1;
  }

  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function setHashPilot() {
    var base = location.pathname + location.search;
    if (location.hash !== '#pilot') history.pushState(null, '', base + '#pilot');
  }

  function clearHashPilot() {
    if (!isPilotHash(location.hash)) return;
    var base = location.pathname + location.search;
    history.replaceState(null, '', base);
  }

  function trapTab(ev) {
    if (!open || ev.key !== 'Tab' || !panel) return;
    var list = focusables(panel);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function onKeyDown(ev) {
    if (!open) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      closeModal();
    }
    trapTab(ev);
  }

  function openModal(trigger) {
    if (!modal || open) return;
    open = true;
    lastFocus = trigger && trigger.focus ? trigger : document.activeElement;
    modal.hidden = false;
    document.body.classList.add('pilot-modal-open');
    setHashPilot();
    var closeBtn = modal.querySelector('.pilot-modal-close');
    var nameInput = document.getElementById('landing-pilot-name');
    if (closeBtn) closeBtn.focus();
    else if (nameInput) nameInput.focus();
  }

  function closeModal() {
    if (!modal || !open) return;
    open = false;
    modal.hidden = true;
    document.body.classList.remove('pilot-modal-open');
    clearHashPilot();
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try {
        lastFocus.focus();
      } catch (e) {
        /* ignore */
      }
    }
    lastFocus = null;
  }

  function onHashChange() {
    if (isPilotHash(location.hash)) openModal(null);
    else if (open) closeModal();
  }

  function onOpenClick(ev) {
    var t = ev.currentTarget;
    if (t && t.tagName === 'A') ev.preventDefault();
    openModal(t);
  }

  function wire() {
    modal = document.getElementById('pilot');
    if (!modal) return;
    panel = modal.querySelector('.pilot-modal-panel');

    modal.querySelectorAll('[data-pilot-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeModal();
      });
    });

    document.querySelectorAll('[data-pilot-open], a[href="#pilot"], a[href="#pilot-project"]').forEach(function (el) {
      el.addEventListener('click', onOpenClick);
    });

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('hashchange', onHashChange);

    if (isPilotHash(location.hash)) {
      requestAnimationFrame(function () {
        openModal(null);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
