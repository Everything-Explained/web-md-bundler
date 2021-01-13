import MDPageBundler, { PageMap } from "./core/md_page_bundler";
import MDPageCreator from "./core/md_page_creator";

const log = console;

type Directory = string;

const bundleIt = (function<T>(inType: 'file'|'maps') {
  return async function bundle(pages: T[], outType: 'plain'|'html') {
    try {
      const pb = new MDPageBundler();
      if (inType == 'file') await pb.initPagesFromDirs(pages as []);
      if (inType == 'maps') await pb.initPagesFromMaps(pages as []);
      await pb.processPages(outType);
    }
    catch (err) { log.error(err); }
  };
});

export default {
  bundleMDFiles: bundleIt<Directory>('file'),
  bundlePageMaps: bundleIt<PageMap>('maps'),
  MDPageBundler,
  MDPageCreator
};