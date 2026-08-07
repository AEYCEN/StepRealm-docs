/* Step Realm – Roadmap page behavior.
   Loaded synchronously in <head>: the js class must be on <html> before the
   first paint, or the reveal start states would flash. Everything else waits
   for DOMContentLoaded. Counts and progress are derived from the DOM, so
   editing a milestone's done/open class in the HTML is the only maintenance.

   The timeline is its own native horizontal scroller; the page scrolls
   vertically as usual. JS centers the strip on the last completed milestone
   once at load and, while the pointer is over the strip, maps the mouse
   wheel to sideways scrolling — the wheel is only captured when the strip
   can still move in that direction, so page scrolling stays available. */

document.documentElement.classList.add("js");

(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /* "Stand" = last modification of the page file, formatted German. */
  function updateStand() {
    var stand = document.getElementById("stand");
    var modified = new Date(document.lastModified);
    if (stand && !isNaN(modified.getTime())) {
      stand.textContent =
        "Stand: " +
        pad(modified.getDate()) + "." +
        pad(modified.getMonth() + 1) + "." +
        modified.getFullYear();
    }
  }

  function countUp(el, target, duration) {
    if (REDUCED) {
      el.textContent = String(target);
      return;
    }
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Overall progress bar + label, derived from the milestone list. */
  function updateProgress() {
    var milestones = document.querySelectorAll(".milestone");
    var done = document.querySelectorAll(".milestone.done").length;
    var total = milestones.length;
    var totalEl = document.getElementById("progress-total");
    var doneEl = document.getElementById("progress-done");
    var fill = document.getElementById("progress-fill");
    if (totalEl) totalEl.textContent = String(total);
    if (doneEl) countUp(doneEl, done, 1400);
    if (fill && total > 0) {
      var percent = (100 * done) / total;
      // next frame, so the width transition starts from 0
      requestAnimationFrame(function () {
        fill.style.width = percent + "%";
      });
    }
  }

  /* Per-section done/total counters in the section pills. */
  function updateSectionCounts() {
    var labels = document.querySelectorAll(".section-label");
    labels.forEach(function (label) {
      var done = 0;
      var total = 0;
      var el = label.nextElementSibling;
      while (el && !el.classList.contains("section-label")) {
        if (el.classList.contains("milestone")) {
          total += 1;
          if (el.classList.contains("done")) done += 1;
        }
        el = el.nextElementSibling;
      }
      var count = label.querySelector(".count");
      if (count) count.textContent = done + " / " + total;
    });
  }

  /* Reveal for timeline entries as the track carries them into view.
     IntersectionObserver works on painted (transformed) positions, so it
     fires while the track slides sideways. */
  function setupReveal() {
    var targets = document.querySelectorAll(".milestone, .section-label");
    if (REDUCED || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("revealed"); });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    targets.forEach(function (el) { observer.observe(el); });
  }

  /* Grow the strip when the tallest card would not fit into one half —
     cards hang off the center line, so the strip needs
     2 × (card gap + tallest card) plus a little breathing room. */
  function setupStripFit() {
    var viewport = document.getElementById("viewport");
    if (!viewport) return;

    function fit() {
      viewport.style.height = "";
      var gap = window.matchMedia("(max-width: 720px)").matches ? 42 : 52;
      var tallest = 0;
      viewport.querySelectorAll(".card").forEach(function (card) {
        if (card.offsetHeight > tallest) tallest = card.offsetHeight;
      });
      var needed = 2 * (tallest + gap) + 28;
      if (needed > viewport.clientHeight) viewport.style.height = needed + "px";
    }

    fit();
    window.addEventListener("resize", fit);
  }

  /* The timeline strip: start position + wheel mapping. */
  function setupTimelineScroller() {
    var viewport = document.getElementById("viewport");
    if (!viewport) return;

    // open the strip centered on the newest completed milestone
    var done = document.querySelectorAll(".milestone.done");
    if (done.length) {
      var last = done[done.length - 1];
      var nodeCenter = last.offsetLeft + last.offsetWidth / 2;
      viewport.scrollLeft = nodeCenter - viewport.clientWidth / 2;
    }

    // wheel over the strip scrolls it sideways; once the strip cannot move
    // any further in that direction, the event bubbles and the page scrolls
    viewport.addEventListener(
      "wheel",
      function (event) {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        var delta = event.deltaY;
        if (event.deltaMode === 1) delta *= 33; // line mode → approx. pixels
        var maxLeft = viewport.scrollWidth - viewport.clientWidth;
        var canMove =
          delta > 0 ? viewport.scrollLeft < maxLeft - 1 : viewport.scrollLeft > 1;
        if (!canMove) return;
        event.preventDefault();
        viewport.scrollLeft += delta;
      },
      { passive: false }
    );
  }

  /* Pulsing dot on the line, midway between the newest completed milestone
     and the one after it. */
  function setupHereMarker() {
    var track = document.getElementById("track");
    if (!track) return;
    var all = Array.prototype.slice.call(track.querySelectorAll(".milestone"));
    var done = all.filter(function (m) { return m.classList.contains("done"); });
    if (!done.length) return;

    var marker = document.createElement("div");
    marker.className = "here-marker";
    track.appendChild(marker);

    function position() {
      var last = done[done.length - 1];
      var lastCenter = last.offsetLeft + last.offsetWidth / 2;
      var index = all.indexOf(last);
      var x;
      if (index + 1 < all.length) {
        var next = all[index + 1];
        x = (lastCenter + next.offsetLeft + next.offsetWidth / 2) / 2;
      } else {
        x = lastCenter + 90;
      }
      marker.style.left = x + "px";
    }

    position();
    window.addEventListener("resize", position);
  }

  /* Drifting gold dust on a fixed background canvas. */
  function setupDust() {
    if (REDUCED) return;
    var canvas = document.getElementById("dust");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var particles = [];
    var width = 0;
    var height = 0;
    var running = true;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.min(70, Math.floor((width * height) / 24000));
      while (particles.length < count) particles.push(spawn(true));
      particles.length = count;
    }

    function spawn(anywhere) {
      var gold = Math.random() < 0.65;
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : height + 6,
        radius: 0.8 + Math.random() * 1.6,
        speed: 0.08 + Math.random() * 0.22,          // upward drift
        swayAmp: 8 + Math.random() * 22,
        swaySpeed: 0.0004 + Math.random() * 0.0008,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.12 + Math.random() * 0.3,
        twinkle: 0.001 + Math.random() * 0.002,
        color: gold ? "227, 194, 126" : "126, 196, 182"
      };
    }

    function frame(ts) {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.y -= p.speed;
        if (p.y < -8) particles[i] = p = spawn(false);
        var x = p.x + Math.sin(ts * p.swaySpeed + p.phase) * p.swayAmp;
        var a = p.alpha * (0.65 + 0.35 * Math.sin(ts * p.twinkle + p.phase));
        ctx.beginPath();
        ctx.arc(x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + p.color + ", " + a.toFixed(3) + ")";
        ctx.shadowColor = "rgba(" + p.color + ", 0.8)";
        ctx.shadowBlur = p.radius * 5;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(frame);
    }

    document.addEventListener("visibilitychange", function () {
      var visible = document.visibilityState === "visible";
      if (visible && !running) {
        running = true;
        requestAnimationFrame(frame);
      } else if (!visible) {
        running = false;
      }
    });

    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateStand();
    updateProgress();
    updateSectionCounts();
    setupStripFit();
    setupTimelineScroller();
    setupHereMarker();
    setupReveal();
    setupDust();
  });
})();
