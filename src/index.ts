import { TeXOptions, load, tex } from './bootstrap';
import { SvgOptions, dvi2svg } from './dvi2svg';

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
async function tex2svg(input: string, options?: TeXOptions & SvgOptions) {
  await load();

  const dvi = await tex(input, options);
  const svg = await dvi2svg(dvi, options);
  return svg;
}

export default tex2svg;
