import { promises, existsSync } from 'fs';
import frontMatter from 'front-matter';
import smap from 'source-map-support';
import {
  basename as pathBasename,
  extname as pathExtname,
  resolve as pathResolve,
  join    as pathJoin,
  sep as pathSep } from 'path';
import bunyan from 'bunyan';
import importFresh from 'import-fresh';

smap.install();

const log = bunyan.createLogger({
  name: 'builder'
});


type ISODateString = string;

interface MDFormat {
  title: string;
  author: string;
  /** Can be either a `dateCreated` or `dateEdited` property */
  date?: ISODateString;
}

export interface Page extends MDFormat {
  content: string;
}




export class PageBuilder {

  /** Promisified File System */
  private _pfs     = promises;
  private _dateNow = new Date();

  private _dirs        : string[] = [];
  private _pageData    : Map<string, Page[]> = new Map();
  private _oldPageData : Map<string, Page[]> = new Map();


  get dirs()      { return this._dirs; }
  get shortDirs() { return this._dirs.map(this._shortenPath); }
  get pagesMap()  { return this._pageData; }
  get isTesting() { return process.env.testState == 'is-testing'; }


  constructor(dirs: string[], callback: (err: Error|null) => void) {
    this._log('Initializing');
    try {
      this._dirs = dirs.map(dir => pathResolve(dir));
      this._validateDirs();
      this._loadAllPages(callback);
    }
    catch (err) { callback(err); }
  }


  public async updatePages() {
    for (const dir of this._dirs) {
      this._log(`[processing: ${this._shortenPath(dir)}]`);
      const oldPages = this._oldPageData.get(dir)!;
      const curPages = this._pageData.get(dir)!
      ;
      const hasChanged = this._isUpdatingPages(curPages, oldPages);
      const hasDeleted = this._isDeletingPages(curPages, oldPages)
      ;
      if (hasChanged || hasDeleted) {
        this._aggregatePageDates(dir);
        await this._savePages(dir); continue;
      }
      this._log('Pages are up to date!');
    }
  }

  private _validateDirs() {
    if (!this._dirs.length)
      throw Error('Path configuration is EMPTY.')
    ;
    if (!this._dirs.every(dir => existsSync(dir)))
      throw Error('One or more paths do NOT exist.')
    ;
  }

  private async _loadAllPages(callback: (err: Error|null) => void) {
    try {
      await this._loadOldPages();
      await this._loadLatestPages();
      callback(null);
    }
    catch (err) { callback(err); }
  }

  private async _loadOldPages() {
    for (const dir of this._dirs) {
      const filePath = `${dir}${pathSep}${pathBasename(dir)}.json`;
      if (!existsSync(filePath)) {
        this._oldPageData.set(dir, []);
        continue;
      }
      const pages = (await importFresh(filePath)) as Page[];
      this._oldPageData.set(dir, pages);
    }
  }

  private async _loadLatestPages() {
    for (const dir of this._dirs) {
      const fileNames   = await this._pfs.readdir(dir);
      const mdFilePaths = this._filterMDFilePaths(dir, fileNames);
      const pages       = await this._getPagesFromFiles(mdFilePaths);
      this._pageData.set(dir, pages);
    }
  }

  private _aggregatePageDates(dir: string) {
    const curPages = this._pageData.get(dir)!;
    const oldPages = this._oldPageData.get(dir)!
    ;
    curPages.forEach(curPage => {
      if (curPage.date) return;
      const oldPage = this._findPageInPages(curPage, oldPages);
      curPage.date = oldPage ? oldPage.date : curPage.date;
    });
  }

  private _filterMDFilePaths(dir: string, fileNames: string[]) {
    const mdFilePaths = fileNames
      .filter(name => pathExtname(name) == '.md')
      .map(name => `${dir}${pathSep}${name}`)
    ;
    if (!mdFilePaths.length)
      throw Error(`No .md files found @${this._shortenPath(dir)}`)
    ;
    return mdFilePaths;
  }

  private async _getPagesFromFiles(filePaths: string[]) {
    const files = await this._readAllFiles(filePaths);
    return files.map((file, i) => {
      return this._fileToPage(filePaths[i], file);
    });
  }

  private async _readAllFiles(filePaths: string[]) {
    const fileData: string[] = [];
    for (const path of filePaths) {
      const data = (await this._pfs.readFile(path)).toString('utf-8');
      fileData.push(data);
    }
    return fileData;
  }

  private _fileToPage(filePath: string, file: string) {
    const shortFilePath = this._shortenPath(filePath);
    if (!frontMatter.test(file))
      throw Error(`Invalid or Missing front matter: "${shortFilePath}"`)
    ;
    const fileObj = frontMatter<MDFormat>(file);
    const {title, author, date} = fileObj.attributes;
    if (!title)
      throw Error(`File is missing a title: "${shortFilePath}"`)
    ;
    if (!author)
      throw Error(`Missing Author: "${shortFilePath}"`)
    ;
    if (date) { // only capture static dates
      if (!Date.parse(date || ''))
        throw Error(`Invalid Date for page: "${shortFilePath}"`)
      ;
      fileObj.attributes.date = new Date(date).toISOString();
    }
    if (!fileObj.body.trim())
      throw Error(`Missing file content: "${shortFilePath}"`)
    ;
    return { ...fileObj.attributes, content: fileObj.body} as Page;
  }

  private _isUpdatingPages(curPages: Page[], oldPages: Page[]) {
    let hasUpdatedPages = false;
    curPages.forEach(curPage => {
      const oldPage = this._findPageInPages(curPage, oldPages);
      if (curPage.content != oldPage?.content) {
        curPage.date = this._normalizeDate(curPage.date);
        this._log(`[${!oldPage ? 'ADD' : 'CHG'}]: ${curPage.title}.md`);
        hasUpdatedPages = true;
      }
    });
    return hasUpdatedPages;
  }

  private _normalizeDate(date: string|undefined) {
    return (
      date
        ? new Date(date).toISOString()
        : this._dateNow.toISOString()
    );
  }

  private _isDeletingPages(curPages: Page[], oldPages: Page[]) {
    let hasDeleted = false
    ;
    for (const oldPage of oldPages) {
      const curPage = this._findPageInPages(oldPage, curPages);
      if (curPage) continue;
      this._log(`[deleted]: ${oldPage.title}`);
      hasDeleted = true;
    }
    return hasDeleted;
  }

  private _findPageInPages(page: Page, pages: Page[]) {
    return pages.find(p => p.title == page.title);
  }

  private _savePages(dir: string) {
    const pages = this._pageData.get(dir)!;
    return this._pfs.writeFile(`${dir}/${pathBasename(dir)}.json`, JSON.stringify(pages, null, 2));
  }

  private _shortenPath(dir: string) {
    const splitPath = dir.split(pathSep);
    const splitPathLen = splitPath.length;
    return `${splitPath[splitPathLen - 2]}/${splitPath[splitPathLen - 1]}`;
  }

  private _log(msg: string) {
    if (!this.isTesting) log.info(msg);
  }

}