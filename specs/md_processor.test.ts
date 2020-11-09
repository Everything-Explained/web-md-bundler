import tape from 'tape';
import smap from 'source-map-support';
import md from '../lib/md_processor';

smap.install();



tape('Markdown Processor', t => {
  t.test('render() should render markdown.', async t => {
    const simpleMarkdown = '**bold** *italic*';
    const html = md.render(simpleMarkdown);

    t.is(html, '<p><strong>bold</strong> <em>italic</em></p>\n');
  });
  t.test('render() renders external links with blank target.', async t => {
    const linkMarkdown = '[hello](http://google.com)';
    const html = md.render(linkMarkdown);

    t.is(html, '<p><a href="http://google.com" target="_blank">hello</a></p>\n');
  });
  t.test('render() renders internal links without a target.', async t => {
    const linkMarkdown = '[hello](/welcome/to/a/test)';
    const html = md.render(linkMarkdown);

    t.is(html, '<p><a href="/welcome/to/a/test">hello</a></p>\n');
  });
});