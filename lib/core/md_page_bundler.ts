import { promises, existsSync } from 'fs';
import frontMatter from 'front-matter';
import smap from 'source-map-support';
import {
  basename as pathBasename,
  extname as pathExtname,
  resolve as pathResolve,
  sep as pathSep } from 'path';
import bunyan from 'bunyan';
import importFresh from 'import-fresh';
import markdown from './md_processor';

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
  [key: string]: string|undefined;
}




export default class MDPageBundler {

  /** Promisified File System */
  private _pfs     = promises;
  private _dateNow = new Date();

  private _dirs        : string[] = [];
  private _newPageData : Map<string, Page[]> = new Map();
  private _oldPageData : Map<string, Page[]> = new Map();

  get dirs()        { return this._dirs; }
  get shortDirs()   { return this._dirs.map(this._shortenPath); }
  get newPagesMap() { return this._newPageData; }
  get isLogging()   { return process.env.logState != 'silent'; }


  constructor() {
    this._log('Initializing');
  }

  public async initPagesFromFiles(dirs: string[]) {
    this._log('Initializing');
    this._dirs = dirs.map(dir => pathResolve(dir));
    this._validateDirs();
    await this._loadAllPages();
  }


  public async processPages(renderType: 'plain'|'html') {
    for (const dir of this._dirs) {
      this._log(`[processing: ${this._shortenPath(dir)}]`);
      const oldPages = this._oldPageData.get(dir)!;
      const newPages = this._newPageData.get(dir)!
      ;
      if (renderType == 'html')
        this._renderMarkdown(newPages)
      ;
      const hasUpdated = this._updatePages(newPages, oldPages);
      const hasDeleted = this._deletePages(newPages, oldPages)
      ;
      if (hasUpdated || hasDeleted) {
        this._aggregatePageDates(dir);
        this._setPagesURI(newPages);
        await this._savePages(dir); continue;
      }
      this._log('Pages are up to date!');
    }
  }

  public static renderMDStr(md: string) {
    return markdown.render(md);
  }

  private _validateDirs() {
    if (!this._dirs.length)
      throw Error('Path configuration is empty.')
    ;
    if (!this._dirs.every(dir => existsSync(dir)))
      throw Error('One or more paths do not exist.')
    ;
  }

  private async _loadAllPages() {
    await this._loadOldPages();
    await this._loadLatestPages();
  }

  private async _loadOldPages() {
    for (const dir of this._dirs) {
      const bundleFilePath = `${dir}${pathSep}${pathBasename(dir)}.json`;
      if (!existsSync(bundleFilePath)) {
        this._oldPageData.set(dir, []);
        continue;
      }
      const pages = (await importFresh(bundleFilePath)) as Page[];
      this._oldPageData.set(dir, pages);
    }
  }

  private async _loadLatestPages() {
    for (const dir of this._dirs) {
      const fileNames   = await this._pfs.readdir(dir);
      const mdFilePaths = this._filterMDFilePaths(dir, fileNames);
      const newPages    = await this._getPagesFromFiles(mdFilePaths);
      this._newPageData.set(dir, newPages);
    }
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
      const shortFilePath = this._shortenPath(filePaths[i]);
      try { return this._fileToPage(file); }
      catch (err) {
        // Easier to locate errors with a file name
        throw Error(`${err.message} @ "${shortFilePath}"`);
      }
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

  private _fileToPage(file: string) {
    if (!frontMatter.test(file))
      throw Error(`Invalid or Missing front matter`)
    ;
    const fileObj               = frontMatter<MDFormat>(file);
    const {title, author, date} = fileObj.attributes;
    const isInvalidDate         = !!(date && !Date.parse(date));
    const isEmptyContent        = !fileObj.body.trim()
    ;
    if (!title)         throw Error(`File is missing a title`);
    if (!author)        throw Error(`Missing Author`);
    if (isInvalidDate)  throw Error(`Invalid Date for page`);
    if (isEmptyContent) throw Error(`Empty file content`)
    ;
    if (date) { // capture static dates
      fileObj.attributes.date = new Date(date).toISOString();
    }
    return { ...fileObj.attributes, content: fileObj.body} as Page;
  }

  private _renderMarkdown(pages: Page[]) {
    return pages.map(page => {
      page.content = markdown.render(page.content);
    });
  }

  private _updatePages(newPages: Page[], oldPages: Page[]) {
    let hasUpdatedPages = false;
    newPages.forEach(newPage => {
      const oldPage = this._findPageInPages(newPage, oldPages);
      if (newPage.content != oldPage?.content) {
        newPage.date = this._normalizeDate(newPage.date);
        this._log(`[${!oldPage ? 'ADD' : 'CHG'}]: ${newPage.title}`);
        hasUpdatedPages = true;
      }
    });
    return hasUpdatedPages;
  }

  private _normalizeDate(date: string|undefined): ISODateString {
    return (
      date
        ? new Date(date).toISOString()
        : this._dateNow.toISOString()
    );
  }

  private _deletePages(newPages: Page[], oldPages: Page[]) {
    let hasDeleted = false;
    oldPages.forEach(oldPage => {
      const newPage = this._findPageInPages(oldPage, newPages);
      if (!newPage) {
        this._log(`[DEL]: ${oldPage.title}`);
        hasDeleted = true;
      }
    });
    return hasDeleted;
  }

  private _aggregatePageDates(dir: string) {
    const newPages = this._newPageData.get(dir)!;
    const oldPages = this._oldPageData.get(dir)!
    ;
    newPages.forEach(newPage => {
      // static and updated dates are maintained
      if (newPage.date) return;
      const oldPage = this._findPageInPages(newPage, oldPages);
      newPage.date = oldPage ? oldPage.date : newPage.date;
    });
  }

  private _findPageInPages(page: Page, pages: Page[]) {
    return pages.find(p => p.title == page.title);
  }

  private _setPagesURI(pages: Page[]) {
    pages.map(page => {
      page.uri = slugify(page.title, { lower: true, strict: true });
    });
  }

  private _savePages(dir: string) {
    return this._pfs.writeFile(
      `${dir}/${pathBasename(dir)}.json`,
      JSON.stringify(this._newPageData.get(dir), null, 2)
    );
  }

  private _shortenPath(dir: string) {
    const splitPath = dir.split(pathSep);
    const splitPathLen = splitPath.length;
    return `${splitPath[splitPathLen - 2]}/${splitPath[splitPathLen - 1]}`;
  }

  private _log(msg: string) { if (this.isLogging) log.info(msg); }

}