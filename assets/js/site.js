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

  /* --- Contact form -------------------------------------------------------
     Posts normally to FormSubmit rather than over fetch. The AJAX endpoint
     cannot present a captcha, which is why the captcha had been turned off —
     and with it off, bots were POSTing straight to the endpoint scraped from
     this page's source, never touching the form at all. No client-side trick
     helps against that; only the service can reject it.

     The cost is a round trip instead of an inline reply, so FormSubmit sends
     the visitor back here with ?sent=1 and the confirmation is shown below. */
  var cForm = document.getElementById('contactForm');
  var cStatus = document.getElementById('contactStatus');

  if (cStatus && /[?&]sent=1/.test(window.location.search)) {
    cStatus.className = 'form-status is-ok';
    cStatus.textContent = 'Thanks — your message is on its way. We reply within 24 hours.';
    // Drop the flag so a refresh does not re-congratulate them.
    if (window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    cStatus.scrollIntoView({ block: 'center' });
  }

  if (cForm) {
    var cBtn = document.getElementById('contactSubmit');
    cForm.addEventListener('submit', function () {
      // Kept as a second filter. It only catches bots that render the form;
      // the captcha is what stops the ones that do not.
      var honey = cForm.querySelector('[name="_honey"]');
      if (honey && honey.value) return;
      if (cBtn) { cBtn.disabled = true; cBtn.textContent = 'Sending…'; }
    });
  }

  /* --- Founders spots remaining -----------------------------------------
     Driven by /founders.json so the number can be updated by editing one file
     on github.com — no rebuild. The counter stays hidden unless that file
     holds a real whole number within range, so a missing, malformed or stale
     file shows nothing rather than something wrong. */

  var counters = document.querySelectorAll('[data-founders-count]');
  if (counters.length) {
    fetch('founders.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var left = data.remaining;
        // Reject anything that is not a plain whole number.
        if (typeof left !== 'number' || !isFinite(left) || Math.floor(left) !== left) return;

        counters.forEach(function (el) {
          var total = parseInt(el.getAttribute('data-founders-total'), 10);
          if (!total || left < 0 || left > total) return;   // out of range: stay hidden
          el.textContent = left === 0
            ? 'All ' + total + ' founding spots are claimed'
            : left + ' of ' + total + ' spots remaining';
          el.hidden = false;
        });
      })
      .catch(function () { /* offline or missing: the counter simply never appears */ });
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

  /* ── ProTee VX rotator ──────────────────────────────────────────────────
     Coverflow rotation of the data-point cards. Auto-advances, pauses on
     hover, focus and when scrolled out of view, and stops entirely if the
     visitor has asked for reduced motion. Arrow keys work when focused. */
  document.querySelectorAll('[data-rotator]').forEach(function (root) {
    var stage  = root.querySelector('[data-rotator-stage]');
    var dotBox = root.querySelector('[data-rotator-dots]');
    if (!stage) return;

    var slides = Array.prototype.slice.call(stage.children);
    var count  = slides.length;
    if (count < 2) return;

    var index  = 0;
    var timer  = null;
    var paused = false;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DELAY  = 4200;

    // Dots are built here rather than in the template: their number always
    // matches the slides, so the two cannot fall out of step.
    var dots = [];
    if (dotBox) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Show data point ' + (i + 1));
        b.addEventListener('click', function () { go(i); restart(); });
        dotBox.appendChild(b);
        dots.push(b);
      });
      dotBox.removeAttribute('aria-hidden');
    }

    function go(next) {
      index = (next + count) % count;
      slides.forEach(function (slide, i) {
        // Shortest signed distance around the ring, so wrapping does not
        // send a card sliding the long way across the stage.
        var d = i - index;
        if (d >  count / 2) d -= count;
        if (d < -count / 2) d += count;
        if (d >= -2 && d <= 2) slide.setAttribute('data-pos', String(d));
        else slide.removeAttribute('data-pos');
        slide.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      });
      dots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === index); });
    }

    function tick()    { if (!paused) go(index + 1); }
    function start()   { if (!reduce && !timer) timer = setInterval(tick, DELAY); }
    function stop()    { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); start(); }

    root.addEventListener('mouseenter', function () { paused = true; });
    root.addEventListener('mouseleave', function () { paused = false; });
    root.addEventListener('focusin',    function () { paused = true; });
    root.addEventListener('focusout',   function () { paused = false; });

    var prev = root.querySelector('[data-rotator-prev]');
    var next = root.querySelector('[data-rotator-next]');
    if (prev) prev.addEventListener('click', function () { go(index - 1); restart(); });
    if (next) next.addEventListener('click', function () { go(index + 1); restart(); });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { go(index - 1); restart(); }
      if (e.key === 'ArrowRight') { go(index + 1); restart(); }
    });

    // Don't burn cycles rotating a carousel nobody is looking at.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { entry.isIntersecting ? start() : stop(); });
      }, { threshold: 0.25 }).observe(root);
    } else {
      start();
    }

    go(0);
  });

  /* --- Photo rail --------------------------------------------------------
     Arrows page the On Tour gallery one viewport at a time and hide when
     there is nothing further that way, so they never sit there doing
     nothing. Touch swipe and keyboard scrolling are native. */
  document.querySelectorAll('[data-rail]').forEach(function (rail) {
    var wrap = rail.parentElement;
    var prev = wrap.querySelector('[data-rail-prev]');
    var next = wrap.querySelector('[data-rail-next]');
    if (!prev || !next) return;

    function sync() {
      var max = rail.scrollWidth - rail.clientWidth;
      // 2px of slack: sub-pixel layout leaves scrollLeft a hair short of max.
      prev.hidden = rail.scrollLeft <= 2;
      next.hidden = rail.scrollLeft >= max - 2;
    }

    function page(dir) {
      rail.scrollBy({ left: dir * rail.clientWidth * 0.9, behavior: 'smooth' });
    }

    prev.addEventListener('click', function () { page(-1); });
    next.addEventListener('click', function () { page(1); });

    var ticking = false;
    rail.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { sync(); ticking = false; });
    });

    if ('ResizeObserver' in window) new ResizeObserver(sync).observe(rail);
    window.addEventListener('load', sync);
    sync();
  });

  /* --- Waitlist form intent ----------------------------------------------
     One form, one Mailchimp audience. "Reserve a Founders Spot" and "Reserve
     this tier" both land here, so they say which one they meant rather than
     dropping the visitor into a generic signup with the context lost.

     The fields are visible and the visitor can change them — this only sets a
     starting value. Without JS the form still works; they pick it themselves. */
  var interestField = document.querySelector('[data-interest]');
  var tierField     = document.querySelector('select[name="TIER"]');

  function preselect(link) {
    var interest = link.getAttribute('data-preselect-interest');
    var tier     = link.getAttribute('data-preselect-tier');
    if (interest && interestField) interestField.value = interest;
    if (tier && tierField) {
      // Only if the tier is actually an option — names could drift.
      for (var i = 0; i < tierField.options.length; i++) {
        if (tierField.options[i].value === tier) { tierField.value = tier; break; }
      }
    }
  }

  document.querySelectorAll('[data-preselect-interest], [data-preselect-tier]')
    .forEach(function (link) {
      link.addEventListener('click', function () { preselect(link); syncSubmitLabel(); });
    });

  /* The button said "Join the Waitlist" even with Founders Club chosen directly
     above it, which read as though the choice had been ignored. */
  var submitBtn = document.querySelector('[data-submit-label]');
  var defaultLabel = submitBtn ? submitBtn.textContent : '';

  function syncSubmitLabel() {
    if (!submitBtn || !interestField) return;
    submitBtn.textContent = interestField.value === 'Founders Club'
      ? 'Reserve My Founders Spot'
      : defaultLabel;
  }

  if (interestField) interestField.addEventListener('change', syncSubmitLabel);

  /* Arriving from another page. A founders CTA on the homepage links to
     membership.html#founders, and without this the visitor would land on the
     right section with the wrong option selected and have to set it by hand —
     which is the second click this whole change exists to remove. */
  if (interestField && window.location.hash === '#founders') {
    interestField.value = 'Founders Club';
  }

  syncSubmitLabel();

})();
