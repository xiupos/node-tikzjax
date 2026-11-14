/// <reference types="node" />
import { IFs } from 'memfs';
declare module 'tar-fs' {
    interface ExtractOptions {
        fs?: IFs;
    }
}
/**
 * Load necessary files into memory.
 *
 * The TeX files are read from the `tex` directory under the asset root (see `setAssetRoot`).
 * Concurrent calls share a single load.
 */
export declare function load(): Promise<void>;
/**
 * Error thrown when the TeX engine fails to produce a DVI file.
 * The `log` property contains the content of the TeX log file (`input.log`), if any.
 */
export declare class TeXError extends Error {
    log: string;
    constructor(log: string);
}
/**
 * Run `fn` after all previously queued runs have settled.
 */
export declare function serialize<T>(fn: () => Promise<T>): Promise<T>;
export type TeXOptions = {
    /**
     * Print log of TeX engine to console. Default: `false`
     */
    showConsole?: boolean;
    /**
     * Additional TeX packages to load. Default: `{}`
     *
     * @example
     * ```js
     * // => \usepackage{pgfplots}\usepackage[intlimits]{amsmath}
     * texPackages: { pgfplots: '', amsmath: 'intlimits' },
     * ```
     */
    texPackages?: Record<string, string>;
    /**
     * Additional TikZ libraries to load. Default: `''`
     *
     * @example
     * ```js
     * // => \usetikzlibrary{arrows.meta,calc}
     * tikzLibraries: 'arrows.meta,calc',
     * ```
     */
    tikzLibraries?: string;
    /**
     * Additional options to pass to the TikZ package. Default: `''`
     */
    tikzOptions?: string;
    /**
     * Additional source code to add to the preamble of input. Default: `''`
     */
    addToPreamble?: string;
    /**
     * Add compatibility definitions to the preamble, which make math commands such as
     * `\in`, `\subseteq` and `\sqrt` usable outside math mode and provide simple
     * `\tfrac`, `\dfrac` and `\binom` when they are not defined. Default: `true`
     *
     * Set to `false` to rule them out when a package (e.g. tikz-cd, pgfplots) behaves unexpectedly.
     */
    mathCompat?: boolean;
    /**
     * Custom mapping of Unicode characters to TeX commands.
     *
     * @example
     * ```js
     * unicodeMap: { '❤': '\\ensuremath{\\heartsuit}' }
     * ```
     */
    unicodeMap?: Record<string, string>;
};
/**
 * Run the TeX engine to compile TeX source code.
 *
 * Calls are serialized, so it is safe to call this concurrently.
 * `load()` must have been called before.
 *
 * @param input The TeX source code.
 * @returns The generated DVI file.
 * @throws {TeXError} When TeX fails to produce a DVI file.
 */
export declare function tex(input: string, options?: TeXOptions): Promise<Buffer>;
/**
 * Get preamble of the TeX input file.
 */
export declare function getTexPreamble(options?: TeXOptions, input?: string): string;
/**
 * Dump the memory filesystem for debug.
 *
 * @example
 * ```js
 * import { toTreeSync } from 'memfs/lib/print';
 * console.log(toTreeSync(dumpMemfs()));
 * ```
 */
export declare function dumpMemfs(): IFs;
