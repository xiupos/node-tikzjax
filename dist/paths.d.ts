/**
 * Set the root directory of the package assets (`tex/` and `css/`).
 *
 * By default the assets are resolved relative to the location of this module,
 * which breaks when the library is bundled (e.g. with esbuild into a VSCode extension).
 * Call this before the first render to point the library at a copy of the assets.
 *
 * Note that the TeX files are loaded only once, so changing the root after
 * `load()` has completed has no effect on them.
 *
 * @example
 * ```js
 * setAssetRoot(context.asAbsolutePath('assets/node-tikzjax'));
 * ```
 */
export declare function setAssetRoot(dir: string): void;
/**
 * Get the root directory of the package assets.
 */
export declare function getAssetRoot(): string;
/**
 * The directory containing `core.dump.gz`, `tex.wasm.gz` and `tex_files.tar.gz`.
 */
export declare function texDir(): string;
/**
 * The directory containing the BaKoMa TTF fonts.
 */
export declare function fontDir(): string;
