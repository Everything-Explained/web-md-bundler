import { PageBuilder } from "./lib/page_builder";
import config from './config.json';
import bunyan from 'bunyan';

const log = bunyan.createLogger({
  name: 'entry'
});

const pb = new PageBuilder(config.paths, async (err) => {
  if (err) {
    log.error(err);
    process.exit(); // All errors are fatal
  }
  try         { await pb.updatePages(); }
  catch (err) { log.error(err);         }
});