/* Site behaviour: the evidence explorer (hero), reading progress and the contents rail.
   Every number comes from window.REVIEWS (built by build/review_aggregates.py); nothing is typed here. */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (iso) => { const [y, m, d] = iso.split("-"); return `${months[+m - 1]} ${+d}, ${y}`; };
  const one = (v) => (Math.round(v * 10) / 10).toString();

  /* ---------- Evidence explorer ---------- */
  function explorer(root, R) {
    const g = R.ios_comparison.gaia, o = R.ios_comparison.onx_offroad, D = R.derived, W = R.cmp_window;
    const P = R.android_comparison.excl_burst.derived;
    const views = [
      { tab: "Long-time users", short: "Long-timers", unit: "Long-time users, per 100 people who left a 1 or 2-star App Store review",
        a: g.loyal_share_of_low * 100, b: o.loyal_share_of_low * 100,
        claim: "Gaia\u2019s unhappy reviewers are <em>far more often long-time users.</em>",
        note: `Google Play shows the same split: ${Math.round(R.android_comparison.excl_burst.gaia.loyal_share_of_low * 100)}% against ${Math.round(R.android_comparison.excl_burst.onx_offroad.loyal_share_of_low * 100)}%. Matched on phrases such as \u201cfor years\u201d and \u201cused to love\u201d.` },
      { tab: "Didn\u2019t work", unit: "Say the app didn\u2019t work, per 100 people who left a 1 or 2-star App Store review",
        a: g.reliability_share_of_low * 100, b: o.reliability_share_of_low * 100,
        claim: `On the App Store, Gaia\u2019s unhappy reviewers say it failed <em>${D.reliability_share_ratio.ratio}× as often.</em>`,
        note: `Likely range ${D.reliability_share_ratio.lo}× to ${D.reliability_share_ratio.hi}×. On Google Play the gap is small: ${P.reliability_share_ratio.ratio}×.` },
      { tab: "Price", unit: "Mention price or the paywall, per 100 people who left a 1 or 2-star App Store review",
        a: g.pay_share_of_low * 100, b: o.pay_share_of_low * 100,
        claim: "Price is <em>a complaint at both apps.</em>",
        note: `On Google Play, Gaia\u2019s unhappy reviewers raise it ${P.pay_share_ratio.ratio}× as often as onX\u2019s.` },
    ];
    root.innerHTML = `
      <div class="ex-head">
        <div class="ex-tabs" role="tablist" aria-label="Compare Gaia GPS and onX Offroad on">
          ${views.map((v, i) => `<button type="button" role="tab" id="ex-tab-${i}" aria-controls="ex-panel" aria-selected="false" tabindex="-1"><span class="t-full">${v.tab}</span><span class="t-short" aria-hidden="true">${v.short || v.tab}</span></button>`).join("")}
        </div>
        <p class="ex-unit" id="ex-unit"></p>
      </div>
      <div id="ex-panel" role="tabpanel" class="ex-body">
        <div class="ex-grids">
          ${["gaia", "onx"].map((k) => `
            <div class="ex-app ${k}">
              <span class="name">${k === "gaia" ? "Gaia GPS" : "onX Offroad"}</span>
              <div class="dots" role="img">${"<i></i>".repeat(100)}</div>
              <span class="ex-val" data-v="${k}"></span>
            </div>`).join("")}
        </div>
      </div>
      <div class="ex-read" aria-live="polite">
        <p class="claim"></p>
        <p class="src"></p>
      </div>`;
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const grids = [...root.querySelectorAll(".dots")];
    const vals = [...root.querySelectorAll(".ex-val")];
    const unit = root.querySelector(".ex-unit"), claim = root.querySelector(".claim"), src = root.querySelector(".src");
    const base = `App Store, ${day(W.since)} to ${day(W.until)}: ${g.n_low} Gaia and ${o.n_low} onX 1 and 2-star reviews. One dot is one in 100, rounded.`;
    let cur = -1;
    function show(i, focus) {
      if (i === cur) return; cur = i;
      const v = views[i];
      tabs.forEach((t, j) => { const on = j === i; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; });
      root.querySelector("#ex-panel").setAttribute("aria-labelledby", tabs[i].id);
      if (focus) tabs[i].focus();
      unit.textContent = v.unit;
      [v.a, v.b].forEach((val, k) => {
        const n = Math.round(val);
        grids[k].setAttribute("aria-label", `${k ? "onX Offroad" : "Gaia GPS"}: ${one(val)} in 100`);
        [...grids[k].children].forEach((dot, j) => {
          dot.style.transitionDelay = reduce ? "0ms" : `${Math.min(j, 60) * 7}ms`;
          dot.classList.toggle("on", j < n);
        });
        vals[k].textContent = one(val);
      });
      claim.innerHTML = v.claim;
      src.textContent = `${v.note} ${base}`;
    }
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => show(i));
      t.addEventListener("keydown", (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1, Home: "home", End: "end" }[e.key];
        if (k === undefined) return;
        e.preventDefault();
        const n = k === "home" ? 0 : k === "end" ? tabs.length - 1 : (cur + k + tabs.length) % tabs.length;
        show(n, true);
      });
    });
    // One orchestrated moment: the grids fill once the panel is on screen.
    if (reduce || !("IntersectionObserver" in window)) { show(0); return; }
    tabs[0].setAttribute("aria-selected", "true"); tabs[0].tabIndex = 0;
    unit.textContent = views[0].unit;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); requestAnimationFrame(() => show(0)); } }, { threshold: 0.35 });
    io.observe(root);
  }

  /* ---------- Reading progress and contents rail ---------- */
  function reading() {
    const bar = document.querySelector(".progress span");
    const links = [...document.querySelectorAll(".toc a[href^='#']")];
    const targets = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
    let ticking = false;
    function update() {
      ticking = false;
      const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, h.scrollTop / max) : 0})`;
      if (!targets.length) return;
      const line = window.innerHeight * 0.3;
      let idx = -1;
      targets.forEach((t, i) => { if (t.getBoundingClientRect().top - line <= 0) idx = i; });
      if (max - h.scrollTop < 4) idx = targets.length - 1;
      links.forEach((a, i) => { a.classList.toggle("active", i === idx); if (i === idx) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    }
    const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener("scroll", req, { passive: true });
    addEventListener("resize", req);
    update();
  }

  /* Contents: always open as a rail on wide screens, a collapsed bar on narrow ones */
  const tocBox = document.querySelector(".toc details");
  if (tocBox) {
    const wide = matchMedia("(min-width: 1081px)");
    const sync = () => { tocBox.open = wide.matches; };
    wide.addEventListener("change", sync); sync();
    tocBox.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { if (!wide.matches) tocBox.open = false; }));
  }

  document.querySelectorAll("[data-explorer]").forEach((el) => window.REVIEWS && explorer(el, window.REVIEWS));
  reading();
})();
