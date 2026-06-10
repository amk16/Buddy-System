import { useEffect, useState } from "react";
import type { Issue, IndexEntry } from "./lib/types";
import { readingTime } from "./lib/readingTime";
import { Brief } from "./components/Brief";
import { Section } from "./components/Section";
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

  // Load the selected issue whenever it changes. The status reset to "loading"
  // happens in selectIssue (the event), not here — effects only report results.
  useEffect(() => {
    if (!currentId) return;
    fetch(issueUrl(currentId))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Issue) => {
        setIssue(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [currentId]);

  const selectIssue = (id: string) => {
    setStatus("loading");
    setCurrentId(id);
  };

  const readTime = issue ? readingTime(issue) : null;

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
        {status === "ready" && issue && (
          <>
            <Brief items={issue.brief} />
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
