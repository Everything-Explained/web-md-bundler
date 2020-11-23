import Markdown from 'markdown-it';


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
md.use(require('markdown-it-video'), { youtube: { width: 640, height: 480 }});


/** Set all external links to `target="_blank"` */
function setLinkTargetBlank() {
  const defaultLinkRenderer =
    md.renderer.rules.link_open ||
    function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const link = tokens[idx]!.attrGet('href')!.toLowerCase();
    if (~link.indexOf('http')) {
      tokens[idx].attrPush(['target', '_blank']); // Add new attribute
    }
    return defaultLinkRenderer(tokens, idx, options, env, self);
  };
}

setLinkTargetBlank();
export default md;