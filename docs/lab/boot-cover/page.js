// Shared lab plumbing: the page beneath the cover, and the exit morph.
// Each direction calls page.mount(), runs its own choreography, then page.exit(names).

window.page = (() => {
  const PORTRAIT = "/frontend/public/robobuddy.png";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mount(label) {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="app" id="app">
        <div class="topbar" id="topbar">
          <span class="tabs"><span class="tab">Claude</span><span class="tab on">Gemini</span></span>
          <span>Issue</span><span class="sel">Oct 20, 2026 (latest) ⌄</span>
        </div>
        <header class="masthead">
          <h1 id="h1">Buddy-System</h1>
          <div class="buddy-dialog" id="dialog">
            <span class="bd-portrait" id="portrait"><img src="${PORTRAIT}" alt="" width="418" height="597"></span>
            <div class="bd-box" id="box">
              <span class="bd-nameplate">ROBOBUDDY</span>
              <p class="bd-text" id="greet"></p>
              <p class="bd-meta">Tuesday, October 20, 2026 · 9 min skim · 23 min full read</p>
            </div>
          </div>
        </header>
        <p class="kicker">At a glance</p>
        <div class="glance">
          <div class="tile brief"><h2>The Brief</h2><p>If you read nothing else today.</p></div>
          <div class="tile"><span class="sig"></span><h2>Tools</h2><p>Copilot vs Claude for Business: which AI fits your needs in 2026</p></div>
          <div class="tile"><span class="sig" style="background:#8f4524"></span><h2>News</h2><p>US orders federal agencies to remove China's DeepSeek AI</p></div>
        </div>
      </div>
      <div class="grain"></div>
      <div class="lab"><a href="./index.html">← Lab</a><button onclick="location.reload()">Replay</button><span class="tag">${label}</span></div>`);
    if (reduce) typeGreeting(true);
  }

  function typeGreeting(instant) {
    const full = "Evening, Kajol — here's today's pulse.";
    const el = document.getElementById("greet");
    if (instant) { el.textContent = full; return; }
    let i = 0;
    const id = setInterval(() => { i += 1; el.textContent = full.slice(0, i); if (i >= full.length) clearInterval(id); }, 30);
  }

  // The exit: one clean move. The cover lifts off the top of the screen like a
  // sheet being raised (720ms, settle easing); the finished dashboard is
  // already beneath it, still. Nothing travels, nothing builds. The greeting
  // types once the sheet has cleared.
  function exit() {
    const cover = document.getElementById("cover");
    if (reduce || !cover) { cover?.remove(); typeGreeting(true); return; }
    const done = () => { cover.remove(); typeGreeting(false); };
    cover.addEventListener("transitionend", done, { once: true });
    requestAnimationFrame(() => cover.classList.add("lift"));
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  return { mount, exit, wait, ease, reduce, PORTRAIT };
})();
