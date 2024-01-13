# Node-TikZJax

A port of [TikZJax](https://tikzjax.com) runs on pure Node.js and WebAssembly.

Node-TikZJax lets you render LaTeX and TikZ diagrams to SVG images without the need to install LaTeX toolchain to the environment. You can render graphs, figures, circuits, chemical diagrams, commutative diagrams, and more.

## Installation

```bash
npm install node-tikzjax
```

## Examples

See the [demo](demo) folder for some example TikZ diagrams.

![screenshot](https://github.com/prinsss/node-tikzjax/raw/main/demo/screenshot.png)

## Usage

Basic usage:

```typescript
import tex2svg from 'node-tikzjax';

const source = `\\begin{document}
\\begin{tikzpicture}
\\draw (0,0) circle (1in);
\\end{tikzpicture}
\\end{document}`;

const svg = await tex2svg(source);
```

Which generates the following SVG:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="193.253" height="193.253" viewBox="-72 -72 144.94 144.94"><path fill="none" stroke="#000" stroke-miterlimit="10" stroke-width=".4" d="M72.47.2c0-39.914-32.356-72.27-72.27-72.27S-72.07-39.714-72.07.2-39.714 72.47.2 72.47 72.47 40.114 72.47.2ZM.2.2"/></svg>
```

The input TeX source is rendered to DVI, then rendered to SVG.

- Remember to load any packages you need with `\usepackage{}`, and include `\begin{document}` and `\end{document}`.
- The standalone document class is used (`\documentclass{standalone}`).

The following packages are available in `\usepackage{}`:

- chemfig
- tikz-cd
- circuitikz
- pgfplots
- array
- amsmath
- amstext
- amsfonts
- amssymb
- tikz-3dplot

## Advanced Usage

You can also separate the TeX rendering and DVI to SVG conversion steps:

```typescript
import { load, tex, dvi2svg } from 'node-tikzjax';

// Load the WebAssembly module and necessary files.
await load();

// Read TeX source from a file.
const input = readFileSync('sample.tex', 'utf8');

// Render TeX source to DVI.
const dvi = await tex(input);

// Output generated DVI to a file.
writeFileSync('sample.dvi', dvi);

// Render DVI to SVG.
const svg = await dvi2svg(dvi, {
  showConsole: true,
  texPackages: { pgfplots: '', amsmath: 'intlimits' },
  tikzLibraries: 'arrows.meta,calc',
  addToPreamble: '% comment',
  embedFontCss: true,
  fontCssUrl: 'https://tikzjax.com/v1/fonts.css',
  disableOptimize: false,
});

// Output generated SVG to a file.
writeFileSync('sample.svg', svg);
```

## Acknowledgements

This project is greatly inspired by [obsidian-tikzjax](https://github.com/artisticat1/obsidian-tikzjax).

This port would not be possible without the original [tikzjax](https://github.com/kisonecat/tikzjax) project.

Prebuilt WebAssembly binaries and supporting files are downloaded from [artisticat1/tikzjax#ww-modifications](https://github.com/artisticat1/tikzjax/tree/ww-modifications).

A fork of [artisticat1/dvi2html#ww-modifications](https://github.com/artisticat1/dvi2html/tree/ww-modifications) is used to convert DVI to SVG.

Thanks to all the authors for their great work!

## License

[LaTeX Project Public License v1.3c](LICENSE)