import { useEffect, useRef, useState } from "react";
import type { Issue, IndexEntry } from "./lib/types";
import { readingTime } from "./lib/readingTime";
import { parseHash, viewToHash, type View } from "./lib/view";
import { withViewTransition } from "./lib/transition";
import * as lastVisited from "./lib/lastVisited";
import { Brief } from "./components/Brief";
import { Section } from "./components/Section";
import { GlanceGrid } from "./components/GlanceGrid";
import { ArchiveSwitcher } from "./components/ArchiveSwitcher";

// Base-aware so it works locally and under a sub-path (e.g. GitHub Pages) alike.
const BASE = import.meta.env.BASE_URL;
const issueUrl = (id: string) => `${BASE}issues/${id}.json`;
const indexUrl = `${BASE}issues/index.json`;

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
}

export default function App() {
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [issue, setIssue] = useState<Issue | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );
  const [view, setView] = useState<View>({ mode: "glance" });

  const glanceHeading = useRef<HTMLHeadingElement | null>(null);
  const sectionHeading = useRef<HTMLHeadingElement | null>(null);
  const briefHeading = useRef<HTMLHeadingElement | null>(null);
  const prevView = useRef<View>({ mode: "glance" });

  // Load the index once; default to the latest issue.
  useEffect(() => {
    fetch(indexUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((entries: IndexEntry[]) => {
        if (!entries.length) {
          setStatus("empty");
          return;
        }
        setIndex(entries);
        setCurrentId(entries[0].id);
      })
      .catch(() => setStatus("empty"));
  }, []);

  // Load the selected issue whenever it changes; derive the view from the URL
  // hash once the data is in (so a refreshed "#tools" lands on Tools).
  useEffect(() => {
    if (!currentId) return;
    fetch(issueUrl(currentId))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Issue) => {
        setIssue(data);
        setView(parseHash(window.location.hash, data));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [currentId]);

  // The hash is the single source of truth for the view. Tile clicks, the
  // back affordance, AND browser back/forward all funnel through here, so
  // every path gets the same animated morph.
  useEffect(() => {
    const onHashChange = () => {
      const next = parseHash(window.location.hash, issue);
      withViewTransition(() => setView(next));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [issue]);

  // After a view change: remember section visits, reset scroll, move focus to
  // the new surface's heading. Focus only moves when the view ACTUALLY changed
  // — the initial load and issue switches re-set an identical view and must
  // not paint a focus ring on a fresh page.
  useEffect(() => {
    if (view.mode === "section" && issue) {
      lastVisited.save(issue.id, view.sectionId);
    }
    const prev = prevView.current;
    prevView.current = view;
    const unchanged =
      prev.mode === view.mode &&
      (view.mode !== "section" ||
        (prev.mode === "section" && prev.sectionId === view.sectionId));
    if (unchanged) return;
    window.scrollTo(0, 0);
    const target =
      view.mode === "glance"
        ? glanceHeading.current
        : view.mode === "section"
          ? sectionHeading.current
          : briefHeading.current;
    target?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const navigate = (next: View) => {
    window.location.hash = viewToHash(next);
  };

  const selectIssue = (id: string) => {
    // Wholesale content swap: no morph, no stale deep-link. Strip the hash
    // without adding a history entry and land on the new issue's glance.
    history.replaceState(null, "", window.location.pathname + window.location.search);
    setView({ mode: "glance" });
    setStatus("loading");
    setCurrentId(id);
  };

  const readTime = issue ? readingTime(issue) : null;
  const currentSection =
    view.mode === "section" && issue
      ? (issue.sections.find((s) => s.id === view.sectionId) ?? null)
      : null;

  const backToGlance = (
    <button
      type="button"
      className="back-link"
      onClick={() => navigate({ mode: "glance" })}
    >
      ← Today at a glance
    </button>
  );

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-row">
          <h1>{issue?.title ?? "AI Marketing Pulse"}</h1>
          <ArchiveSwitcher
            entries={index}
            currentId={currentId}
            onSelect={selectIssue}
          />
        </div>
        {issue && (
          <p className="masthead-date">{formatDate(issue.generated_at)}</p>
        )}
        {status === "ready" && readTime && (
          <p className="masthead-read">
            {readTime.skimMin} min skim · {readTime.fullMin} min full read
          </p>
        )}
      </header>

      <main>
        {status === "loading" && <p className="state">Loading…</p>}
        {status === "empty" && (
          <p className="state">
            No issues yet. Run <code>python backend/pipeline.py</code> to generate one.
          </p>
        )}
        {status === "error" && <p className="state">Couldn't load this issue.</p>}

        {status === "ready" && issue && view.mode === "glance" && (
          <GlanceGrid
            issue={issue}
            headingRef={glanceHeading}
            onOpenSection={(sectionId) => navigate({ mode: "section", sectionId })}
            onOpenFeed={() => navigate({ mode: "feed" })}
          />
        )}

        {status === "ready" && issue && view.mode === "section" && currentSection && (
          <>
            {backToGlance}
            <Section
              section={currentSection}
              vtName={`pulse-sec-${currentSection.id}`}
              headingRef={sectionHeading}
            />
            <button
              type="button"
              className="feed-link"
              onClick={() => navigate({ mode: "feed" })}
            >
              Read everything instead
            </button>
          </>
        )}

        {status === "ready" && issue && view.mode === "feed" && (
          <>
            {backToGlance}
            <Brief items={issue.brief} headingRef={briefHeading} />
            {issue.sections.map((section) => (
              <Section key={section.id} section={section} />
            ))}
          </>
        )}
      </main>

      <footer className="foot">Private feed · generated, then reviewed.</footer>
    </div>
  );
}
