import MDPageBundler from "./core/md_page_bundler";
import bunyan from 'bunyan';
import MDPageCreator from "./core/md_page_creator";

const log = bunyan.createLogger({
  name: 'entry'
});


const bundleMDFiles = (async function(dirs: string[], outType: 'plain'|'html') {
  try {
    const pb = new MDPageBundler();
    await pb.initPagesFromFiles(dirs);
    await pb.processPages(outType);
  }
  catch (err) { log.error(err); }
});

export default {
  bundleMDFiles,
  MDPageBundler,
  MDPageCreator
};