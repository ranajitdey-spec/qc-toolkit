declare module "nspell" {
  export interface NSpellInstance {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }
  export default function nspell(aff: string, dic?: string): NSpellInstance;
}