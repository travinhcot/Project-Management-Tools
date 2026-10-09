/**
 * Spreadsheet apps run a cell as a formula when it starts with = + - @ (or a tab/CR/LF, or the
 * fullwidth forms some apps fold to ASCII). Imports reject such cells; exports prefix them.
 */
const FORMULA_START = /^(?:[\t\r\n]|\s*[=+\-@＝＋－＠])/;

export function startsWithFormula(text: string): boolean {
  return FORMULA_START.test(text);
}

/** Keeps the cell text: a leading apostrophe makes spreadsheets treat it as plain text. */
export function neutralizeFormula(text: string): string {
  return startsWithFormula(text) ? `'${text}` : text;
}
