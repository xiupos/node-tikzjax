/// <reference types="node" />
export type SvgOptions = {
    /**
     * Whether to embed the font CSS in the SVG.
     * - `false`: Don't embed font CSS (default)
     * - `true` or `'base64'` or `'inline'`: Embed base64 font data for fonts used in the SVG (self-contained, works completely offline)
     * - `'link'`: Embed `<style>@import url('...');</style>` pointing to `fontCssUrl`
     */
    embedFontCss?: boolean | 'base64' | 'inline' | 'link';
    /**
     * The URL of the font CSS file to embed when `embedFontCss` is `'link'`.
     * Default: `https://cdn.jsdelivr.net/npm/node-tikzjax@latest/css/fonts.css`
     */
    fontCssUrl?: string;
    /**
     * Don't use SVGO to optimize the SVG. Default: `false`
     */
    disableOptimize?: boolean;
    /**
     * Don't use JSDOM to sanitize the SVG. Always return the raw SVG. Default: `false`
     * When turned on, the `embedFontCss` and `disableOptimize` options will be ignored.
     */
    disableSanitize?: boolean;
};
/**
 * Converts a DVI file to an SVG string.
 *
 * @param dvi The buffer containing the DVI file.
 * @param options The options.
 * @returns The SVG string.
 */
export declare function dvi2svg(dvi: Buffer, options?: SvgOptions): Promise<string>;
/**
 * A helper function to generate a unique ID for each SVG element.
 *
 * @param str The string to hash.
 * @returns The hash of the string.
 */
export declare function hashCode(str: string): string;
