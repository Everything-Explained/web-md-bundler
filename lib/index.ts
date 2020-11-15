import { MDPageBundler } from "./core/md_page_bundler";
import config from './config.json';
import bunyan from 'bunyan';

const log = bunyan.createLogger({
  name: 'entry'
});

const pb = new MDPageBundler(config.paths, async (err) => {
  if (err) {
    log.error(err);
    process.exit(); // All errors are fatal
  }
  try         { await pb.processPages('html'); }
  catch (err) { log.error(err);         }
});