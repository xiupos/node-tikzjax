/**
 * Unicode support for node-tikzjax.
 *
 * Provides automatic translation and placeholder handling for Unicode characters
 * (including CJK, Greek, mathematical symbols, Cyrillic, emojis, etc.) so that
 * the WebAssembly TeX engine and DVI-to-SVG conversion can render them properly
 * without TeX `Package inputenc Error` or font metric errors.
 */
export declare function isFullWidth(codePoint: number): boolean;
/**
 * Standard LaTeX math commands for common Unicode mathematical and Greek symbols.
 */
export declare const DEFAULT_UNICODE_MAP: Record<number, string>;
/**
 * Scan input for Unicode characters and generate preamble definitions using `\DeclareUnicodeCharacter`.
 */
export declare function generateUnicodePreamble(text: string, customMap?: Record<string, string>): string;
/**
 * Character mapping from TeX CMSY font encoding to Unicode characters.
 */
export declare const CMSY_TO_UNICODE: Record<number, string>;
/**
 * Character mapping from TeX CMMI font encoding to Unicode characters (Greek letters).
 */
export declare const CMMI_TO_UNICODE: Record<number, string>;
/**
 * SVG path outline of Knuth's TeX radical glyph from CMSY font (char 112).
 * Units per em = 2048.
 */
export declare const CMSY_RADICAL_PATH = "M719 -1954 311 -1057 190 -1149Q184 -1155 176 -1155Q167 -1155 157.0 -1146.0Q147 -1137 147 -1126Q147 -1116 156 -1110L399 -926Q405 -920 414 -920Q427 -920 434 -934L801 -1741L1671 63Q1681 82 1706 82Q1723 82 1735.0 70.0Q1747 58 1747 41Q1747 31 1745 27L793 -1948Q780 -1966 760 -1966H737Q727 -1966 719 -1954Z";
/**
 * SVG path outlines of Knuth's TeX radical glyphs from CMEX font (chars 112..118).
 * Units per em = 2048.
 */
export declare const CMEX_RADICAL_PATHS: Record<string, string>;
import { CMEX_PATHS_BY_CODE } from './cmex_paths';
export { CMEX_PATHS_BY_CODE };
/**
 * Replace TeX math radical glyph text elements with vector SVG paths.
 * In TeX, radical symbols are designed to connect with sub-pixel precision to horizontal rules.
 * Standard Unicode fonts do not have matching baseline metrics (sitting above rather than below baseline),
 * which causes radicals to detach and float far above the radicand in browsers without BaKoMa fonts.
 */
export declare function replaceRadicalsWithPaths(svg: string): string;
/**
 * Restore Unicode characters and translate TeX math font symbols in the generated SVG.
 */
export declare function restoreUnicodeInSvg(svg: string): string;
