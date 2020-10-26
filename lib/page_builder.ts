import { promises, existsSync, writeFile, exists } from 'fs';
import frontMatter, { FrontMatterResult } from 'front-matter';
import smap from 'source-map-support';
import { basename as pathBasename, dirname as pathDirname, extname as pathExtname } from 'path';

smap.install();



interface MDFormat {
  title: string;
  author: string;
  date?: string;
}

interface Page extends MDFormat {
  content: string;
}




export class PageBuilder {

  private _dirs;
  /** Promisified File System */
  private _pfs     = promises;
  private _dateNow = Date.now();

  private _pageData    : Map<string, Page[]> = new Map();
  private _oldPageData : Map<string, Page[]> = new Map();


  get fileData() { return this._pageData; }


  constructor(dirs: string[], onReady: (err: Error|null) => void) {
    try {
      this._dirs = dirs;
      this._validateDirs();
      this._loadMDFiles(onReady);
    }
    catch (err) { onReady(err); }
    finally { this._dirs = dirs; } // shut the linter up
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

}