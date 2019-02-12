import * as path from 'path';
import * as bluebird from 'bluebird';
import { writeFileSync, access } from 'fs';
import * as bunyan from 'bunyan';

let readFile = bluebird.promisify(require('fs').readFile) as any
  , readDir = bluebird.promisify(require('fs').readdir) as any
  , accessFile = bluebird.promisify(access) as any
  , log = bunyan.createLogger({name: 'Builder'})
  , faqPath = '../au/src/components/home/pages/faq'
  , logPath = '../au/src/components/changelog'
  , workingPath = logPath
;

interface IConfig {
  title: string;
  date: string;
  content: string;
  author: string;
  dateUpdates: boolean;
}


class MarkdownBuilder {

  private _filesPath = path.join(__dirname, workingPath);
  private _configFile = path.join(this._filesPath, `${path.basename(this._filesPath)}.json`);

  private _config: IConfig[] = [];
  private _configTitles: string[] = [];

  private _added = 0;
  private _changes = 0;

  constructor() {
    log.info('...File Processing Started...');
    this.readDir();
  }

  async readDir() {
    let files = await readDir(this._filesPath) as string[]
      , oldConfig: IConfig[] = []
    ;

    try {
      let file = await readFile(this._configFile);
      oldConfig = JSON.parse(file);
    } catch {}

    // Get only MarkDown files
    files = files.filter(v => { return path.extname(v) == '.md'; });
    let count = 0
      , deleted: string[] = []
    ;


    for (let f in oldConfig) {
      if (files.includes(`${f}.md`)) continue;
      deleted.push(f);
    }

    files.forEach(async f => {
      let filePath = path.join(this._filesPath, f)
        , fileData = await readFile(filePath, 'utf8') as string
        , header = fileData.split('\n', 1)[0].trim()
        , validHead = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
        , filename = f.split('.', 1)[0]
      ;


      if (!validHead.test(header)) {
        log.warn(`[${filename}] ::: Missing or Invalid Header!`);
        return;
      }


      // Remove header
      fileData = fileData.replace(`${header}\r\n`, '');

      let details = JSON.parse(Buffer.from(header, 'base64'). toString('utf8')) as IConfig;

      // Store titles for deletion test
      this._configTitles.push(details.title);

      details.content = fileData;
      let [updated, changes] = this._checkIntegrity(oldConfig, details);

      if (updated) {
        log.info(`Updated: [${details.title}] :: ${changes > 0 ? '+' : ''}${changes} char(s)`);
        ++this._changes;
      }
      else if (!updated && changes) {
        log.info(`Added:::[${details.title}]`);
        ++this._added;
      }

      // Update date for changed file
      if ((updated || changes) && details.dateUpdates)  {
        details.date = new Date().toISOString();
      }

      this._config.push(details);
      ++count;

      if (count == files.length) this._completeBuild(oldConfig);

    });

  }

  private _checkIntegrity(old: IConfig[], current: IConfig): [boolean, number] {
    for (let o of old) {
      if (o.title == current.title) {
        if (o.content != current.content) {
          return [true, current.content.length - o.content.length];
        }
        return [false, 0];
      }
    }
    return [false, current.content.length];
  }


  private _completeBuild(old: IConfig[]) {

    let deleted: string[] = [];

    for (let o of old) {
      if (this._configTitles.includes(o.title)) continue;
      deleted.push(o.title);
    }

    if (this._changes || this._added || deleted.length) {
      writeFileSync(this._configFile, JSON.stringify(this._config, null, 2));
      if (deleted.length) {
        for (let d of deleted) {
          log.info(`Deleted:::[${d}]`);
        }
      }
    }
    else {
      log.warn('(No Changes or Additions)');
    }
    log.info('...File Processing Finished...');

  }
}
new MarkdownBuilder();

// let details = {
//   title: 'α48 : unreleased',
//   author: 'Aedaeum',
//   date: '2019-01-01T00:00:00.000Z',
//   dateUpdates: false
// };

// console.log(
//   Buffer.from(JSON.stringify(details)).toString('base64')
// );