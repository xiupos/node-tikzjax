import { createGunzip } from 'zlib';
import { createReadStream } from 'fs';
import { extract } from 'tar-fs';
import { IFs, Volume, createFsFromVolume } from 'memfs';
import { join } from 'path';
import { Readable } from 'stream';
import * as library from './library';
import { texDir } from './paths';

import { generateUnicodePreamble } from './unicode';

declare module 'tar-fs' {
  interface ExtractOptions {
    fs?: IFs;
  }
}

// The cached unzipped data of file `core.dump.gz`.
let coredump: Uint8Array;

// The cached unzipped data of file `tex.wasm.gz`.
let bytecode: Uint8Array;

// The memory filesystem that stores the TeX files extracted from `tex_files.tar.gz`.
let memfs: IFs;

// The directory in the memory filesystem where `tex_files.tar.gz` is extracted.
const TEX_FILES_EXTRACTED_PATH = join('/', 'tex_files');

// The pending or completed loading of the TeX files, shared by concurrent callers.
let loading: Promise<void> | undefined;

/**
 * Load necessary files into memory.
 *
 * The TeX files are read from the `tex` directory under the asset root (see `setAssetRoot`).
 * Concurrent calls share a single load.
 */
export function load() {
  loading ??= loadFiles().catch((e) => {
    // Allow retrying after a failure (e.g. a wrong asset root).
    loading = undefined;
    throw e;
  });
  return loading;
}

async function loadFiles() {
  const dir = texDir();

  if (!coredump) {
    const stream = createReadStream(join(dir, 'core.dump.gz')).pipe(createGunzip());
    coredump = await stream2buffer(stream);
  }

  if (!bytecode) {
    const stream = createReadStream(join(dir, 'tex.wasm.gz')).pipe(createGunzip());
    bytecode = await stream2buffer(stream);
  }

  if (!memfs) {
    memfs = await extractTexFilesToMemory(join(dir, 'tex_files.tar.gz'));
  }
}

/**
 * Error thrown when the TeX engine fails to produce a DVI file.
 * The `log` property contains the content of the TeX log file (`input.log`), if any.
 */
export class TeXError extends Error {
  constructor(public log: string) {
    super('TeX engine render failed. See `error.log` or set `options.showConsole` to `true` to see logs.');
    this.name = 'TeXError';
  }
}

// The TeX engine (`library.js`) keeps its state in module-level variables,
// so only one compilation can run at a time. Runs are chained on this promise.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` after all previously queued runs have settled.
 */
export function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.catch(() => {});
  return result;
}

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
export function tex(input: string, options: TeXOptions = {}) {
  return serialize(() => runTex(input, options));
}

async function runTex(input: string, options: TeXOptions) {
  // Set up the tex input file.
  const preamble = getTexPreamble(options, input);
  input = preamble + input;

  if (options.showConsole) {
    library.setShowConsole();

    console.log('TikZJax: Rendering input:');
    console.log(input);
  }

  // Write the tex input file into the memory filesystem.
  library.writeFileSync('input.tex', Buffer.from(input));

  // Copy the coredump into the memory.
  const memory = new WebAssembly.Memory({ initial: library.pages, maximum: library.pages });
  const buffer = new Uint8Array(memory.buffer, 0, library.pages * 65536);
  buffer.set(coredump.slice(0));

  library.setMemory(memory.buffer);
  library.setInput(' input.tex \n\\end\n');

  // Set the file loader to read files from the memory filesystem.
  library.setFileLoader(readTexFileFromMemory);

  // Set up the WebAssembly TeX engine.
  const wasm = await WebAssembly.instantiate(bytecode, {
    library: library,
    env: { memory: memory },
  });

  try {
    // Execute TeX and extract the generated DVI file.
    await library.executeAsync(wasm.instance.exports);
    return Buffer.from(library.readFileSync('input.dvi'));
  } catch (e) {
    let log = '';
    try {
      log = Buffer.from(library.readFileSync('input.log')).toString();
    } catch {
      // No log file was written.
    }
    throw new TeXError(log);
  } finally {
    // Clean up the library for the next run.
    library.deleteEverything();
  }
}

/**
 * Get preamble of the TeX input file.
 */
export function getTexPreamble(options: TeXOptions = {}, input: string = '') {
  let texPackages = options.texPackages ?? {};

  const unicodePreamble = generateUnicodePreamble(
    input + (options.addToPreamble || ''),
    options.unicodeMap
  );

  const mathRobustPreamble =
    options.mathCompat === false
      ? ''
      : '\\providecommand{\\oldsubseteq}{}\\let\\oldsubseteq\\subseteq\\protected\\def\\subseteq{\\ensuremath{\\oldsubseteq}}\n' +
    '\\providecommand{\\oldsupseteq}{}\\let\\oldsupseteq\\supseteq\\protected\\def\\supseteq{\\ensuremath{\\oldsupseteq}}\n' +
    '\\providecommand{\\oldcap}{}\\let\\oldcap\\cap\\protected\\def\\cap{\\ensuremath{\\oldcap}}\n' +
    '\\providecommand{\\oldcup}{}\\let\\oldcup\\cup\\protected\\def\\cup{\\ensuremath{\\oldcup}}\n' +
    '\\providecommand{\\oldemptyset}{}\\let\\oldemptyset\\emptyset\\protected\\def\\emptyset{\\ensuremath{\\oldemptyset}}\n' +
    '\\providecommand{\\oldsubset}{}\\let\\oldsubset\\subset\\protected\\def\\subset{\\ensuremath{\\oldsubset}}\n' +
    '\\providecommand{\\oldsupset}{}\\let\\oldsupset\\supset\\protected\\def\\supset{\\ensuremath{\\oldsupset}}\n' +
    '\\providecommand{\\oldin}{}\\let\\oldin\\in\\protected\\def\\in{\\ensuremath{\\oldin}}\n' +
    '\\providecommand{\\oldnotin}{}\\let\\oldnotin\\notin\\protected\\def\\notin{\\ensuremath{\\oldnotin}}\n' +
    '\\makeatletter\n' +
    '\\providecommand{\\oldsqrt}{}\\let\\oldsqrt\\sqrt\n' +
    '\\protected\\def\\sqrt{\\relax\\ifmmode\\expandafter\\oldsqrt\\else\\expandafter\\text@sqrt\\fi}\n' +
    '\\def\\text@sqrt{\\@ifnextchar[{\\@text@sqrt}{\\@@text@sqrt}}\n' +
    '\\def\\@text@sqrt[#1]#2{\\ensuremath{\\oldsqrt[#1]{#2}}}\n' +
    '\\def\\@@text@sqrt#1{\\ensuremath{\\oldsqrt{#1}}}\n' +
    '\\makeatother\n' +
    '\\providecommand{\\tfrac}[2]{{\\textstyle\\frac{#1}{#2}}}\n' +
    '\\providecommand{\\dfrac}[2]{{\\displaystyle\\frac{#1}{#2}}}\n' +
    '\\providecommand{\\binom}[2]{{\\textstyle\\left(\\begin{array}{c}#1\\\\#2\\end{array}\\right)}}\n' +
    '\\providecommand{\\dbinom}[2]{{\\displaystyle\\left(\\begin{array}{c}#1\\\\#2\\end{array}\\right)}}\n' +
    '\\providecommand{\\tbinom}[2]{{\\textstyle\\left(\\begin{array}{c}#1\\\\#2\\end{array}\\right)}}\n';

  const preamble =
    unicodePreamble +
    Object.entries(texPackages).reduce((usePackageString, thisPackage) => {
      usePackageString +=
        '\\usepackage' + (thisPackage[1] ? `[${thisPackage[1]}]` : '') + `{${thisPackage[0]}}`;
      return usePackageString;
    }, '') +
    mathRobustPreamble +
    (options.tikzLibraries ? `\\usetikzlibrary{${options.tikzLibraries}}` : '') +
    (options.addToPreamble || '') +
    (options.tikzOptions ? `[${options.tikzOptions}]` : '') +
    '\n';

  return preamble;
}

/**
 * Dump the memory filesystem for debug.
 *
 * @example
 * ```js
 * import { toTreeSync } from 'memfs/lib/print';
 * console.log(toTreeSync(dumpMemfs()));
 * ```
 */
export function dumpMemfs() {
  return memfs;
}

/**
 * Extract files from `tex_files.tar.gz` into a memory filesystem.
 * The tarball contains files needed by the TeX engine, such as `pgfplots.code.tex`.
 */
async function extractTexFilesToMemory(tarballPath: string) {
  const volume = new Volume();
  const fs = createFsFromVolume(volume);

  fs.mkdirSync('/lib');

  const stream = createReadStream(tarballPath).pipe(createGunzip()).pipe(
    extract(TEX_FILES_EXTRACTED_PATH, {
      fs,
    })
  );

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return fs;
}

/**
 * Read a file from the memory filesystem.
 */
async function readTexFileFromMemory(name: string) {
  const buffer = memfs.readFileSync(name) as Buffer;
  return buffer;
}

/**
 * Convert a stream to a buffer.
 */
async function stream2buffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const buf: Buffer[] = [];

    stream.on('data', (chunk) => buf.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(buf)));
    stream.on('error', (err) => reject(err));
  });
}
