// Palette-fusion lab: renders the real latest issue with the product's own
// classes (so the product stylesheet applies), plus the pixel vocabulary each
// direction styles. Before/After toggles html.after.

window.page = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const strip = (s) => s.replace(/^[^\p{L}\p{N}]+\s*/u, "");
  const SIG = { tools: ["#6e530e", "#f5ecd6"], news: ["#8f4524", "#f7e8df"], case_studies: ["#1f6e5c", "#e4efe9"], people: ["#3a5a78", "#e6edf2"] };
  const PAL = {
    tools: ["#ffd24a", "#f6b53d", "#e8a33a", "#ffc24a", "#d99a2e"],
    news: ["#e9744a", "#f0905c", "#d6552f", "#ef9b6a", "#c9572f"],
    case_studies: ["#3fae6b", "#2bb6a6", "#7ed957", "#36c98a", "#1f9e6e"],
    people: ["#5b8fd6", "#7fb0e0", "#a05ec9", "#3a7bd5", "#b98ad9"],
  };
  // 3x3 marks reduced from the four faces in lib/buddy.ts
  const GLYPH = {
    tools: [[1, 0, 1], [0, 0, 0], [1, 1, 1]], // eager: eyes, wide smile
    news: [[1, 1, 1], [1, 0, 1], [1, 1, 1]], // surprised: the O
    case_studies: [[1, 1, 1], [0, 0, 0], [0, 1, 0]], // shades + easy smile
    people: [[1, 0, 1], [0, 0, 0], [1, 0, 1]], // proud grin corners
  };
  const SIGNAL = { trending: "Trending", new: "New", shift: "Big shift" };
  const PORTRAIT = "/frontend/public/robobuddy.png";

  function glyph(id) {
    const g = GLYPH[id] ?? GLYPH.tools, pal = PAL[id] ?? PAL.tools;
    let k = 0, cells = "";
    g.forEach((row, r) => row.forEach((on, c) => { if (on) { cells += `<rect x="${c * 5}" y="${r * 5}" width="4" height="4" rx="0.6" fill="${pal[k % 5]}"/>`; k += 1; } }));
    return `<span class="px-glyph" aria-hidden="true"><svg viewBox="0 0 14 14">${cells}</svg></span>`;
  }

  function tile(section, wide) {
    const [acc, tint] = SIG[section.id] ?? SIG.tools; const top = section.items[0];
    return `<button type="button" class="tile tile-sig${wide ? " tile-wide" : ""}" style="--sig:${acc};--sig-bg:${tint}">
      <span class="tile-label">${glyph(section.id)}<span>${esc(strip(section.label))}</span></span>
      <span class="tile-headline">${esc(top.headline)}</span>
      ${section.items.length > 1 ? '<span class="tile-more">…and more inside</span>' : ""}
    </button>`;
  }

  function card(item) {
    return `<article class="card">
      <span class="card-kicker tag-${item.signal_tag}">${SIGNAL[item.signal_tag] ?? "New"}</span>
      <a class="card-headline" href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.headline)}</a>
      <p class="card-why">${esc(item.why_it_matters)}</p>
      <div class="card-meta"><span class="card-source">${esc(item.source_name)}<span class="card-date"> · Oct 20</span></span>
        <div class="card-actions"><button type="button" class="card-toggle">Details <svg class="chev" aria-hidden="true" width="12" height="8" viewBox="0 0 12 8"><path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div></div>
    </article>`;
  }

  function section(sec, n) {
    return `<div class="section-rule" aria-hidden="true"></div><section class="section">
      <h2 class="section-label">${glyph(sec.id)}<span>${esc(strip(sec.label))}</span></h2>
      <div class="section-items">${sec.items.slice(0, n).map(card).join("")}</div></section>`;
  }

  async function mount(label, dir) {
    document.documentElement.classList.add(dir, "after");
    const index = await (await fetch("/frontend/public/issues/index.json")).json();
    const latest = index.find((e) => e.engine === "gemini") ?? index[0];
    const issue = await (await fetch(`/frontend/public/issues/${latest.id}.json`)).json();
    const secs = issue.sections; const n = secs.length;
    const wide = (i) => i === 0 || ((n - 1) % 2 === 1 && i === n - 1);
    const tools = secs.find((s) => s.id === "tools") ?? secs[0];
    const [tAcc, tTint] = SIG[tools.id];

    document.body.insertAdjacentHTML("beforeend", `
      <div class="app app-glance">
        <header class="masthead">
          <div class="topbar"><div class="archive"><label for="a">Issue</label><select id="a"><option>Oct 20, 2026 (latest)</option></select></div></div>
          <h1>Buddy-System</h1>
          <div class="buddy-dialog">
            <span class="bd-portrait"><img class="bd-portrait-img" src="${PORTRAIT}" alt="" width="418" height="597"></span>
            <div class="bd-box"><span class="bd-nameplate">ROBOBUDDY</span>
              <p class="bd-text"><span>Evening, Kajol — here's today's pulse.</span></p>
              <p class="bd-meta">Tuesday, October 20, 2026 · 9 min skim · 23 min full read</p></div>
          </div>
        </header>
        <main>
          <div class="glance">
            <h2 class="glance-heading">At a glance</h2>
            <section class="brief"><h2 class="brief-label">The Brief</h2><p class="brief-sub">If you read nothing else today.</p>
              <ol class="brief-list">${issue.brief.slice(0, 3).map((it) => `<li><a href="${esc(it.url)}" target="_blank" rel="noreferrer">${esc(it.headline)}</a><span class="brief-why"> — ${esc(it.why_it_matters)}</span></li>`).join("")}</ol></section>
            <div class="glance-bento">${secs.map((s, i) => tile(s, wide(i))).join("")}
              <button type="button" class="tile tile-feed"><span class="tile-label"><span>Read everything</span></span><span class="tile-headline">the full feed, every section in one scroll</span></button></div>
          </div>

          <p class="lab-h">Section takeover, as it would open from the ${esc(strip(tools.label))} tile</p>
          <div class="takeover" style="--sig:${tAcc};--sig-bg:${tTint}"><div class="takeover-inner">
            <button type="button" class="back-link">← At a glance</button>
            ${section(tools, 2).replace('<div class="section-rule" aria-hidden="true"></div>', "")}
          </div></div>

          <p class="lab-h">Feed, two sections meeting</p>
          <div class="feed-sample" style="max-width:var(--maxw);margin:0 auto">${section(secs[1], 1)}${section(secs[2], 1)}</div>
        </main>
        <footer class="foot">Private feed · generated, then reviewed.</footer>
      </div>
      <div class="lab"><a href="./index.html">← Lab</a><button type="button" id="tog" aria-pressed="true">After</button><span class="tag">${label}</span></div>`);

    const tog = document.getElementById("tog");
    tog.addEventListener("click", () => {
      const on = !document.documentElement.classList.contains("after");
      document.documentElement.classList.toggle("after", on);
      tog.setAttribute("aria-pressed", String(on)); tog.textContent = on ? "After" : "Before";
    });
  }
  return { mount };
})();
