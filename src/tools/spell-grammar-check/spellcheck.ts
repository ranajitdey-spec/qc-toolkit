import nspell from "nspell";
import enAff from "dictionary-en/index.aff?raw";

import enDic from "dictionary-en/index.dic?raw";

let speller: ReturnType<typeof nspell> | null = null;

function getSpeller() {
  if (!speller) speller = nspell(enAff, enDic);
  return speller;
}

export interface SpellingIssue {
  word: string;
  suggestions: string[];
  offset: number;
  length: number;
}

const WORD_RE = /[A-Za-z']+/g;

export function checkSpelling(text: string): SpellingIssue[] {
  const spell = getSpeller();
  const issues: SpellingIssue[] = [];

  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    if (!spell.correct(word)) {
      issues.push({ word, suggestions: spell.suggest(word).slice(0, 5), offset: match.index ?? 0, length: word.length });
    }
  }

  return issues;
}