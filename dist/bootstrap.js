"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dumpMemfs = exports.getTexPreamble = exports.tex = exports.serialize = exports.TeXError = exports.load = void 0;
const zlib_1 = require("zlib");
const fs_1 = require("fs");
const tar_fs_1 = require("tar-fs");
const memfs_1 = require("memfs");
const path_1 = require("path");
const library = __importStar(require("./library"));
const paths_1 = require("./paths");
const unicode_1 = require("./unicode");
// The cached unzipped data of file `core.dump.gz`.
let coredump;
// The cached unzipped data of file `tex.wasm.gz`.
let bytecode;
// The memory filesystem that stores the TeX files extracted from `tex_files.tar.gz`.
let memfs;
// The directory in the memory filesystem where `tex_files.tar.gz` is extracted.
const TEX_FILES_EXTRACTED_PATH = (0, path_1.join)('/', 'tex_files');
// The pending or completed loading of the TeX files, shared by concurrent callers.
let loading;
/**
 * Load necessary files into memory.
 *
 * The TeX files are read from the `tex` directory under the asset root (see `setAssetRoot`).
 * Concurrent calls share a single load.
 */
function load() {
    loading ??= loadFiles().catch((e) => {
        // Allow retrying after a failure (e.g. a wrong asset root).
        loading = undefined;
        throw e;
    });
    return loading;
}
exports.load = load;
async function loadFiles() {
    const dir = (0, paths_1.texDir)();
    if (!coredump) {
        const stream = (0, fs_1.createReadStream)((0, path_1.join)(dir, 'core.dump.gz')).pipe((0, zlib_1.createGunzip)());
        coredump = await stream2buffer(stream);
    }
    if (!bytecode) {
        const stream = (0, fs_1.createReadStream)((0, path_1.join)(dir, 'tex.wasm.gz')).pipe((0, zlib_1.createGunzip)());
        bytecode = await stream2buffer(stream);
    }
    if (!memfs) {
        memfs = await extractTexFilesToMemory((0, path_1.join)(dir, 'tex_files.tar.gz'));
    }
}
/**
 * Error thrown when the TeX engine fails to produce a DVI file.
 * The `log` property contains the content of the TeX log file (`input.log`), if any.
 */
class TeXError extends Error {
    log;
    constructor(log) {
        super('TeX engine render failed. See `error.log` or set `options.showConsole` to `true` to see logs.');
        this.log = log;
        this.name = 'TeXError';
    }
}
exports.TeXError = TeXError;
// The TeX engine (`library.js`) keeps its state in module-level variables,
// so only one compilation can run at a time. Runs are chained on this promise.
let queue = Promise.resolve();
/**
 * Run `fn` after all previously queued runs have settled.
 */
function serialize(fn) {
    const result = queue.then(fn, fn);
    queue = result.catch(() => { });
    return result;
}
exports.serialize = serialize;
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
function tex(input, options = {}) {
    return serialize(() => runTex(input, options));
}
exports.tex = tex;
async function runTex(input, options) {
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
    }
    catch (e) {
        let log = '';
        try {
            log = Buffer.from(library.readFileSync('input.log')).toString();
        }
        catch {
            // No log file was written.
        }
        throw new TeXError(log);
    }
    finally {
        // Clean up the library for the next run.
        library.deleteEverything();
    }
}
/**
 * Get preamble of the TeX input file.
 */
function getTexPreamble(options = {}, input = '') {
    let texPackages = options.texPackages ?? {};
    const unicodePreamble = (0, unicode_1.generateUnicodePreamble)(input + (options.addToPreamble || ''), options.unicodeMap);
    const mathRobustPreamble = options.mathCompat === false
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
    const preamble = unicodePreamble +
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
exports.getTexPreamble = getTexPreamble;
/**
 * Dump the memory filesystem for debug.
 *
 * @example
 * ```js
 * import { toTreeSync } from 'memfs/lib/print';
 * console.log(toTreeSync(dumpMemfs()));
 * ```
 */
function dumpMemfs() {
    return memfs;
}
exports.dumpMemfs = dumpMemfs;
/**
 * Extract files from `tex_files.tar.gz` into a memory filesystem.
 * The tarball contains files needed by the TeX engine, such as `pgfplots.code.tex`.
 */
async function extractTexFilesToMemory(tarballPath) {
    const volume = new memfs_1.Volume();
    const fs = (0, memfs_1.createFsFromVolume)(volume);
    fs.mkdirSync('/lib');
    const stream = (0, fs_1.createReadStream)(tarballPath).pipe((0, zlib_1.createGunzip)()).pipe((0, tar_fs_1.extract)(TEX_FILES_EXTRACTED_PATH, {
        fs,
    }));
    await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
    });
    return fs;
}
/**
 * Read a file from the memory filesystem.
 */
async function readTexFileFromMemory(name) {
    const buffer = memfs.readFileSync(name);
    return buffer;
}
/**
 * Convert a stream to a buffer.
 */
async function stream2buffer(stream) {
    return new Promise((resolve, reject) => {
        const buf = [];
        stream.on('data', (chunk) => buf.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(buf)));
        stream.on('error', (err) => reject(err));
    });
}
