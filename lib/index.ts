import { MDPageBundler } from "./core/md_page_bundler";
import bunyan from 'bunyan';

const log = bunyan.createLogger({
  name: 'entry'
});


export default (function(dirs: string[], outType: 'plain'|'html') {
  const pb = new MDPageBundler(dirs, async (err) => {
    if (err) {
      log.error(err);
      process.exit(); // All errors are fatal
    }
    try         { await pb.processPages(outType); }
    catch (err) { log.error(err); }
  });
});