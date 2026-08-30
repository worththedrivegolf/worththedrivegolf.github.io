/* Worth the Drive — shared behaviour.
   Small and dependency-free. Nothing here is required to read the site:
   content is visible without JS (see .no-js rules in the stylesheet). */

(function () {
  'use strict';

  /* --- Mobile menu ------------------------------------------------------ */

  var menu = document.getElementById('mobileMenu');
  var openBtn = document.getElementById('menuBtn');
  var closeBtn = document.getElementById('menuClose');

  function setMenu(open) {
    if (!menu || !openBtn) return;
    menu.setAttribute('data-open', open ? 'true' : 'false');
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    openBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.setAttribute('data-menu-open', open ? 'true' : 'false');
    if (open) {
      var first = menu.querySelector('a');
      if (first) first.focus();
    } else {
      openBtn.focus();
    }
  }

  if (openBtn) openBtn.addEventListener('click', function () {
    setMenu(menu.getAttribute('data-open') !== 'true');
  });
  if (closeBtn) closeBtn.addEventListener('click', function () { setMenu(false); });
  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu && menu.getAttribute('data-open') === 'true') setMenu(false);
  });
  // Close the panel if the viewport grows past the nav breakpoint.
  var wide = window.matchMedia('(min-width: 1024px)');
  var onWide = function (m) { if (m.matches) setMenu(false); };
  if (wide.addEventListener) wide.addEventListener('change', onWide);

  /* --- Scroll reveal ----------------------------------------------------
     One entrance pattern only: fade + 12px rise, once. Reduced motion and
     missing IntersectionObserver both fall back to "everything visible". */

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('.reveal');

  if (reduce || !('IntersectionObserver' in window)) {
    for (var i = 0; i < targets.length; i++) targets[i].classList.add('is-visible');
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* --- Scrollspy sub-nav (long Studio page) ----------------------------- */

  var subnav = document.querySelector('[data-scrollspy]');
  if (subnav && 'IntersectionObserver' in window) {
    var links = [].slice.call(subnav.querySelectorAll('a[href^="#"]'));
    var sections = links
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    var mark = function (id) {
      links.forEach(function (a) {
        a.classList.toggle('is-current', a.getAttribute('href') === '#' + id);
      });
    };

    var spy = new IntersectionObserver(function (entries) {
      // Pick the entry nearest the top of the reading area.
      var visible = entries.filter(function (e) { return e.isIntersecting; });
      if (!visible.length) return;
      visible.sort(function (x, y) { return x.boundingClientRect.top - y.boundingClientRect.top; });
      mark(visible[0].target.id);
    }, { rootMargin: '-30% 0px -60%', threshold: 0 });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* --- Contact form -----------------------------------------------------
     Submits over fetch and inspects the response. Success is only ever shown
     when the service confirms it; every failure path surfaces a real error
     plus a fallback that always works (phone + a pre-filled mail draft).
     A message must never be silently dropped. */

  var cForm = document.getElementById('contactForm');
  if (cForm) {
    var cBtn = document.getElementById('contactSubmit');
    var cStatus = document.getElementById('contactStatus');

    var setStatus = function (kind, html) {
      cStatus.className = 'form-status is-' + kind;
      cStatus.innerHTML = html;
    };

    var mailtoFallback = function (data) {
      var to = (cForm.getAttribute('action') || '').split('/').pop();
      var subject = 'Website enquiry' + (data.topic ? ' — ' + data.topic : '');
      var body = 'Name: ' + (data.name || '') + '\n' +
                 'Email: ' + (data.email || '') + '\n' +
                 'Phone: ' + (data.phone || '') + '\n\n' +
                 (data.message || '');
      return 'mailto:' + to + '?subject=' + encodeURIComponent(subject) +
             '&body=' + encodeURIComponent(body);
    };

    cForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // Native validity first, so required fields and email format are caught
      // before anything leaves the page.
      if (!cForm.checkValidity()) {
        cForm.reportValidity();
        return;
      }

      var fd = new FormData(cForm);
      if (fd.get('_honey')) return;                 // bot trap: silently stop
      var data = {};
      fd.forEach(function (v, k) { data[k] = v; });

      cBtn.disabled = true;
      var original = cBtn.textContent;
      cBtn.textContent = 'Sending…';
      setStatus('pending', 'Sending your message…');

      var done = function (ok, msg) {
        cBtn.disabled = false;
        cBtn.textContent = original;
        if (ok) {
          cForm.reset();
          setStatus('ok', msg);
        } else {
          setStatus('error', msg +
            ' <a href="' + mailtoFallback(data) + '">Email us directly</a> or call ' +
            '<a href="tel:8444653983">(844) 465-3983</a>.');
        }
      };

      fetch(cForm.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) {
          return r.json().catch(function () { return { success: 'false' }; });
        })
        .then(function (res) {
          // FormSubmit reports success as the string "true".
          var ok = res && (res.success === true || res.success === 'true');
          if (ok) {
            done(true, 'Thanks — your message is on its way. We reply within 24 hours.');
          } else {
            // The service's own reason goes to the console for whoever is
            // debugging — e.g. "This form needs Activation" — never to the
            // visitor, who just needs a route that works.
            if (res && res.message) console.warn('[contact] ' + res.message);
            done(false, 'We could not send that message.');
          }
        })
        .catch(function () {
          done(false, 'We could not reach the server.');
        });
    });
  }

  /* --- Swipe dots for the mobile tier row ------------------------------- */

  document.querySelectorAll('[data-swipe]').forEach(function (row) {
    var dots = document.querySelector('[data-swipe-dots="' + row.getAttribute('data-swipe') + '"]');
    if (!dots) return;
    var cards = row.children;
    var marks = dots.children;

    function sync() {
      var mid = row.scrollLeft + row.clientWidth / 2;
      var best = 0, bestDist = Infinity;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var center = c.offsetLeft + c.offsetWidth / 2;
        var d = Math.abs(center - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      for (var j = 0; j < marks.length; j++) {
        marks[j].classList.toggle('is-active', j === best);
      }
    }

    var ticking = false;
    row.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { sync(); ticking = false; });
    }, { passive: true });
    sync();
  });
})();
