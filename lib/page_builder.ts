import { promises, existsSync, writeFile, exists, readFile } from 'fs';
import frontMatter, { FrontMatterResult } from 'front-matter';
import smap from 'source-map-support';
import { basename as pathBasename, extname as pathExtname } from 'path';
import bunyan from 'bunyan';

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

interface Page extends MDFormat {
  content: string;
}




export class PageBuilder {

  private _dirs;
  /** Promisified File System */
  private _pfs = promises;

  private _dateNow     : ISODateString = new Date().toISOString();
  private _pageData    : Map<string, Page[]> = new Map();
  private _oldPageData : Map<string, Page[]> = new Map();


  get pages()       { return this._pageData; }
  get oldPages()    { return this._oldPageData; }
  get isDebugging() { return process.env.debugState == 'is-debugging'; }


  constructor(dirs: string[], onReady: (err: Error|null) => void) {
    if (!this.isDebugging) log.info('initializing');
    try {
      this._dirs = dirs;
      this._validateDirs();
      this._loadOldPages();
      this._loadMDFiles(onReady);
    }
    catch (err) { onReady(err); }
    finally { this._dirs = dirs; } // shut the lang service up
  }


  public async updatePages() {
    for (const dir of this._dirs) {
      const oldPages = this._oldPageData.get(dir)!;
      const curPages = this._pageData.get(dir)!
      ;
      const hasChanged = this._updChangedPages(curPages, oldPages);
      const hasDeleted = this._hasDeletedPages(curPages, oldPages)
      ;
      if (hasChanged || hasDeleted) {
        await this._savePages(dir); continue;
      }
      if(!this.isDebugging) log.info('No Pages to Update');
    }
  }


  private _savePages(dir: string) {
    const pages = this._pageData.get(dir)!;
    return this._pfs.writeFile(`${dir}/${pathBasename(dir)}.json`, JSON.stringify(pages, null, 2));
  }

  private _updChangedPages(curPages: Page[], oldPages: Page[]) {
    let hasModifiedPages = false
    ;
    for (const curPage of curPages) {
      const oldPage = this._findPageInPages(curPage, oldPages);
      hasModifiedPages = this._updatePageDate(curPage, oldPage);
      if (!oldPage) {
        if (!this.isDebugging)
          log.info(`[added]: ${curPage.title}`)
        ;
        continue;
      }
      if (oldPage.content != curPage.content) {
        if (!this.isDebugging)
          log.info(`[modified]: ${curPage.title}`)
        ;
      }
    }
    return hasModifiedPages;
  }

  private _updatePageDate(curPage: Page, oldPage: Page|undefined) {
    const pageAddedOrChanged = !oldPage || oldPage.content != curPage.content;
    if (pageAddedOrChanged) {
      // Preserve dateCreated or dateEdited use-case
      const updatedDate = curPage.date
        ? new Date(curPage.date).toISOString()
        : this._dateNow
      ;
      curPage.date = updatedDate;
      return true;
    }
    return false;
  }

  private _hasDeletedPages(curPages: Page[], oldPages: Page[]) {
    let hasDeleted = false
    ;
    for (const oldPage of oldPages) {
      const curPage = this._findPageInPages(oldPage, curPages);
      if (curPage) continue;
      log.info(`[deleted]: ${oldPage.title}`);
      hasDeleted = true;
    }
    return hasDeleted;
  }


  private _findPageInPages(page: Page, pages: Page[]) {
    return pages.find(p => p.title == page.title);
  }

  private async _loadOldPages() {
    for (const dir of this._dirs) {
      const filePath = `${dir}/${pathBasename(dir)}.json`;
      if (!existsSync(filePath)) {
        this._oldPageData.set(dir, []);
        continue;
      }
      const file = (await this._pfs.readFile(filePath)).toString('utf-8');
      this._oldPageData.set(dir, JSON.parse(file));
    }
  }

  private async _loadMDFiles(callback: (err: Error|null) => void) {
    try {
      for (const dir of this._dirs) {
        const fileNames   = await this._pfs.readdir(dir);
        const mdFilePaths = this._filterMDFilePaths(dir, fileNames);
        const pages       = await this._getPagesFromFiles(mdFilePaths);
        this._pageData.set(dir, pages);
      }
      callback(null);
    }
    catch (err) { callback(err); }
  }

  private async _getPagesFromFiles(filePaths: string[]) {
    const files = await this._readAllFiles(filePaths);
    return files.map((file, i) => {
      return this._fileToPage(filePaths[i], file);
    });
  }

  private _filterMDFilePaths(dir: string, fileNames: string[]) {
    const mdFilePaths = fileNames
      .filter(name => pathExtname(name) == '.md')
      .map(name => `${dir}/${name}`)
    ;
    if (!mdFilePaths.length)
      throw Error(`No .md files found @${dir}`)
    ;
    return mdFilePaths;
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
    if (!frontMatter.test(file))
      throw Error(`Invalid or Missing front matter: ${filePath}`)
    ;
    const fileObj = frontMatter<MDFormat>(file);
    if (!fileObj.attributes.title)
      throw Error(`File is missing a title: ${filePath}`)
    ;
    if (fileObj.attributes.title != pathBasename(filePath, '.md'))
      throw Error(`Title does not match file name: ${filePath}`)
    ;
    if (!fileObj.attributes.author)
      throw Error(`Missing Author: ${filePath}`)
    ;
    if (!fileObj.body.trim())
      throw Error(`Missing file content: ${filePath}`)
    ;
    return { ...fileObj.attributes, content: fileObj.body} as Page;
  }

  private _validateDirs() {
    if (!this._dirs.length)
      throw Error('Directory configuration is EMPTY.')
    ;
    if (!this._dirs.every(dir => existsSync(dir)))
      throw Error('One or more paths do NOT exist.')
    ;
  }

}