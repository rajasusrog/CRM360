const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(TOKEN, (_, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function templateTokens(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(TOKEN)) found.add(match[1]);
  return [...found];
}
