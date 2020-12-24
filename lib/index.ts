import MDPageBundler, { PageMap } from "./core/md_page_bundler";
import MDPageCreator from "./core/md_page_creator";

const log = console;

const bundleMDFiles = (async function(dirs: string[], outType: 'plain'|'html') {
  try {
    const pb = new MDPageBundler();
    await pb.initPagesFromFiles(dirs);
    await pb.processPages(outType);
  }
  catch (err) { log.error(err); }
});

const bundlePageMaps = (async function(pageMaps: PageMap[], outType: 'plain'|'html') {
  try {
    const pb = new MDPageBundler();
    await pb.initPagesFromMaps(pageMaps);
    await pb.processPages(outType);
  }
  catch(err) { log.error(err); }
});

export default {
  bundleMDFiles,
  bundlePageMaps,
  MDPageBundler,
  MDPageCreator
};