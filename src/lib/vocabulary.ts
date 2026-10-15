import dataset from "@/data/vocabulary.json";
import type { CefrLevel, VocabularyDataset, VocabularyEntry } from "@/lib/types";

const DATA = dataset as VocabularyDataset;

export const ALL_ENTRIES: VocabularyEntry[] = DATA.entries;

export const SUPPORTED_LEVELS: CefrLevel[] = DATA.levels;

/**
 * Future levels (B1-C2) are already part of the type system; adding entries to
 * vocabulary.json is enough for them to be picked up.
 */
export function levelsAvailable(): CefrLevel[] {
  const present = new Set(ALL_ENTRIES.map((e) => e.cefrLevel));
  return SUPPORTED_LEVELS.filter((l) => present.has(l));
}

export function entriesForLevels(levels: CefrLevel[]): VocabularyEntry[] {
  const list = levels.length ? ALL_ENTRIES.filter((e) => levels.includes(e.cefrLevel)) : ALL_ENTRIES;
  return list;
}

/**
 * Lesson order: follows the dataset order (groups are already curated per
 * category and level), so the first word is stable across reloads.
 */
export function buildLesson(levels: CefrLevel[]): VocabularyEntry[] {
  return entriesForLevels(levels);
}

export function entryById(id: string): VocabularyEntry | undefined {
  return ALL_ENTRIES.find((e) => e.id === id);
}
