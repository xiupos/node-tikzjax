import { TeXOptions } from './bootstrap';
import { SvgOptions } from './dvi2svg';
export * from './bootstrap';
export * from './dvi2svg';
export * from './paths';
export * from './unicode';
export * from './version';
/**
 * Compiles TeX source code to SVG image.
 *
 * Safe to call concurrently: TeX runs are serialized internally.
 *
 * @throws {TeXError} When TeX fails to produce a DVI file.
 */
declare function tex2svg(input: string, options?: TeXOptions & SvgOptions): Promise<string>;
export default tex2svg;
