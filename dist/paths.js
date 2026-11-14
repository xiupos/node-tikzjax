"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fontDir = exports.texDir = exports.getAssetRoot = exports.setAssetRoot = void 0;
const path_1 = require("path");
// The root directory that contains the `tex` and `css` directories of this package.
let assetRoot = (0, path_1.join)(__dirname, '..');
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
function setAssetRoot(dir) {
    assetRoot = dir;
}
exports.setAssetRoot = setAssetRoot;
/**
 * Get the root directory of the package assets.
 */
function getAssetRoot() {
    return assetRoot;
}
exports.getAssetRoot = getAssetRoot;
/**
 * The directory containing `core.dump.gz`, `tex.wasm.gz` and `tex_files.tar.gz`.
 */
function texDir() {
    return (0, path_1.join)(assetRoot, 'tex');
}
exports.texDir = texDir;
/**
 * The directory containing the BaKoMa TTF fonts.
 */
function fontDir() {
    return (0, path_1.join)(assetRoot, 'css/bakoma/ttf');
}
exports.fontDir = fontDir;
