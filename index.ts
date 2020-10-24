import * as path from 'path';
import * as bluebird from 'bluebird';
import { writeFileSync, access } from 'fs';
import * as bunyan from 'bunyan';

// It's less ambiguous to use promises instead of callbacks
let readFile = bluebird.promisify(require('fs').readFile) as any
  , readDir = bluebird.promisify(require('fs').readdir) as any
  , readStats = bluebird.promisify(require('fs').stat) as any
  , log = bunyan.createLogger({name: 'Builder'})
;

interface IPage {
  title: string;
  date: string;
  content: string;
  author: string;
  /** If dates should be updated automatically when file changes */
  dateUpdates: boolean;
}


interface IWorkingFile {
  path: string;
  name: string;
}


class MarkdownBuilder {

  public filePaths = [
    '../web_client/src/views/home',
    '../web_client/src/views/faq',
    '../web_client/src/views/changelog'
  ];

  private _workingFiles: IWorkingFile[] = [];

  private _addCount = 0;
  private _changeCount = 0;



  constructor() {
    this.filePaths.forEach(p => {
      let fullpath = path.join(__dirname, p);
      this._workingFiles.push(
        {
          path: fullpath,
          name: `${path.basename(fullpath)}.json`
        }
      );
    });
    log.info('...File Processing Started...');
    this.readDir();
  }




  async readDir() {

    this._workingFiles.forEach(async fileInfo => {
      let files = await readDir(fileInfo.path) as string[]
        , oldPages: IPage[] = []
      ;

      try {
        let fileConfig = await readFile(
          fileInfo.path
          + '\\' +
          fileInfo.name
        );
        oldPages = JSON.parse(fileConfig);
      } catch {}

      // Get only Markdown files
      files = files.filter(v => { return path.extname(v) == '.md'; });

      this._updateFiles(files, oldPages, fileInfo);
    });

  }


  private _updateFiles(mdFiles: string[], oldPages: IPage[], fileInfo: IWorkingFile) {

    let fileCount = 0
      , pages: IPage[] = []
    ;

    mdFiles.forEach(async f => {
      let filePath = path.join(fileInfo.path, f)
        , fileContent = await readFile(filePath, 'utf8') as string
        // Each file should have a 3 line header at the top
        , header = fileContent.split('\n', 3).map(v => v.trim())
      ;

      if (!this._isValidHeader(header, f)) {
        return false;
      }

      let page = this._toPage(header, fileContent);

      if (!page.dateUpdates) {
        let date = header[2].split(':');
        date.shift();
        page.date = new Date(date.join(':').trim()).toISOString();
      }
      else {
        let fileStats = await readStats(filePath);
        page.date = fileStats.mtime;
      }

      let [updated, changes] = this._checkIntegrity(oldPages, page);

      if (updated) {
        log.info(
          `Updated: [${page.title}] :: ` +
          `${changes > 0 ? '+' : ''}${changes} char(s)`
        );
        ++this._changeCount;
      }
      else if (!updated && changes) {
        log.info(`Added::: [${page.title}]`);
        ++this._addCount;
      }

      // Update date for changed file
      if ((updated || changes) && page.dateUpdates)  {
        page.date = new Date().toISOString();
      }

      pages.push(page);
      ++fileCount;

      if (fileCount == mdFiles.length)
        this._completeBuild(
          oldPages,
          fileInfo.path + '\\' + fileInfo.name,
          pages
        );

    });
  }



  /**
   * Converts the raw header and content of a markdown file
   * into a page object.
   *
   * @param header The header list
   * @param content The raw file content
   */
  private _toPage(header: string[], content: string) {
    let title = header[0].split('title: ')[1]
      , author = header[1].split('author: ')[1]
    ;

    return {
      title,
      author,
      content: content
                .replace(header[0], '')
                .replace(header[1], '')
                .replace(header[2], '')
                .trim(),
      // True when 'date:' is NOT present
      dateUpdates: !~header[2].indexOf('date:'),

    } as IPage;
  }



  private _isValidHeader(header: string[], filename: string) {

    if (header.length < 3) {
      log.warn(`[${filename}]::Header length too short`);
      return false;
    }

    if (!~header[0].indexOf('title:')) {
      log.warn(`[${filename}]::Missing TITLE in header`);
      return false;
    }

    if (!~header[1].indexOf('author:')) {
      log.warn(`[${filename}]::Missing AUTHOR in header`);
      return false;
    }

    return true;
  }


  private _checkIntegrity(old: IPage[], current: IPage): [boolean, number] {
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


  private _completeBuild(oldPages: IPage[], filePath: string, pages: IPage[]) {
    let deleted: string[] = [];

    for (let o of oldPages) {
      if (pages.find(p => p.title == o.title)) continue;
      deleted.push(o.title);
    }

    if (this._changeCount || this._addCount || deleted.length) {
      writeFileSync(filePath, JSON.stringify(pages, null, 2));
      if (deleted.length) {
        for (let d of deleted) {
          log.info(`Deleted: [${d}]`);
        }
      }
    }
    else {
      log.warn('(No Changes or Additions)');
    }

  }
}
new MarkdownBuilder();
