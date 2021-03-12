import Markdown from 'markdown-it';
import Token from 'markdown-it/lib/token';


const md = new Markdown({
  xhtmlOut: true,
  breaks: true,
  typographer: true,
  quotes: '“”‘’',
  linkify: true,
});
// eslint-disable-next-line @typescript-eslint/no-var-requires
md.use(require('markdown-it-deflist'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
md.use(require('../deps/markdown-it-video'), {
  youtube: {
    width: 'auto',
    height: 'auto',
    nocookie: true,
    parameters: {
      rel: 0,
    }
  }
});

/** Convert all external links to `<a target="_blank">` */
function applyLinkTargetBlank(tokens: Token[], idx: number, link: string) {
  if (~link.indexOf('http')) {
    tokens[idx].attrPush(['target', '_blank']); // Add new attribute
    return true;
  }
  return false;
}

/** Convert all internal links to link with custom onclick handler */
function applyVueRouterLinks(tokens: Token[], idx: number, link: string) {
  const linkOpen = tokens[idx];
  linkOpen.attrSet('onclick', `event.preventDefault(); window.app.$router.push('${link}')`);
}



function applyCustomLinks() {
  const defaultLinkRenderer =
    md.renderer.rules.link_open ||
    function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const link = tokens[idx]!.attrGet('href')!.toLowerCase();
    applyLinkTargetBlank(tokens, idx, link) || applyVueRouterLinks(tokens, idx, link);
    return defaultLinkRenderer(tokens, idx, options, env, self);
  };
}



applyCustomLinks();
export default md;