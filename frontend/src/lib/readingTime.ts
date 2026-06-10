import type { Issue, Item } from "./types";

const WPM = 220;

function words(text?: string | null): number {
  return text ? text.trim().split(/\s+/).length : 0;
}

function skimWords(item: Item): number {
  return words(item.headline) + words(item.why_it_matters);
}

function fullWords(item: Item): number {
  const termWords = (item.terms ?? []).reduce(
    (n, t) => n + words(t.term) + words(t.definition),
    0,
  );
  return skimWords(item) + words(item.summary) + termWords;
}

// Skim = the always-visible layer (Brief + collapsed cards).
// Full = everything, including expanded summaries and term glossaries.
export function readingTime(issue: Issue): { skimMin: number; fullMin: number } {
  const sectionItems = issue.sections.flatMap((s) => s.items);
  const skim =
    issue.brief.reduce((n, it) => n + skimWords(it), 0) +
    sectionItems.reduce((n, it) => n + skimWords(it), 0);
  const full =
    issue.brief.reduce((n, it) => n + skimWords(it), 0) +
    sectionItems.reduce((n, it) => n + fullWords(it), 0);

  return {
    skimMin: Math.max(1, Math.round(skim / WPM)),
    fullMin: Math.max(1, Math.round(full / WPM)),
  };
}
