import { en, type MessageKey } from "./en";
import { ta } from "./ta";

export type Locale = "en" | "ta";

const dictionaries = { en, ta };

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "ta";
}

export function translate(locale: Locale, key: MessageKey): string {
  return dictionaries[locale][key] ?? en[key];
}
