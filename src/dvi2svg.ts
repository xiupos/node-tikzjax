import { dvi2html } from '@prinsss/dvi2html';
import { JSDOM } from 'jsdom';

export type SvgOptions = {
  /**
   * Whether to embed the font CSS file in the SVG.
   *
   * Default: `false`
   */
  embedFontCss?: boolean;

  /**
   * The URL of the font CSS file to embed.
   *
   * Default: `https://tikzjax.com/v1/fonts.css`
   */
  fontCssUrl?: string;
};

export async function dvi2svg(dvi: Buffer, options: SvgOptions = {}) {
  let html = '';

  const dom = new JSDOM(`<!DOCTYPE html>`);
  const document = dom.window.document;

  async function* streamBuffer() {
    yield Buffer.from(dvi);
    return;
  }

  await dvi2html(streamBuffer(), {
    write(chunk: string) {
      html = html + chunk.toString();
    },
  });

  // Patch: Fixes symbols stored in the SOFT HYPHEN character (e.g. \Omega, \otimes) not being rendered
  // Replaces soft hyphens with ¬
  html = html.replaceAll('&#173;', '&#172;');

  // Fix errors in the generated HTML.
  const container = document.createRange().createContextualFragment(html);
  const svg = container.querySelector('svg')!;

  if (options.embedFontCss) {
    const defs = document.createElement('defs');
    const style = document.createElement('style');

    const fontCssUrl = options.fontCssUrl ?? 'https://tikzjax.com/v1/fonts.css';
    style.textContent = `@import url('${fontCssUrl}');`;
    defs.appendChild(style);
    svg.prepend(defs);
  }

  return svg.outerHTML;
}
