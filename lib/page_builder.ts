import { promises, existsSync } from 'fs';
import frontMatter, { FrontMatterResult } from 'front-matter';
import smap from 'source-map-support';
import { basename as pathBasename, extname as pathExtname } from 'path';

smap.install();


interface MDFormat {
  title: string;
  author: string;
  date?: string;
}


export class PageBuilder {

  private _dirs;
  /** Promisified File System */
  private _pfs = promises;
  private _fileData: Map<string, FrontMatterResult<MDFormat>[]> = new Map();
  private _oldFileData: Map<string, MDFormat[]> = new Map();

  get areDirsValid() {
    for (const p of this._dirs) {
      if (!existsSync(p)) return false;
    }
    return true;
  }


  constructor(dirs: string[], public onReady: (err: Error|null) => void) {
    this._dirs = dirs;
    this._loadFiles();
   }

  async _loadFiles() {
    try {
      if (!this._dirs.length) throw Error('Directory configuration is EMPTY.');
      if (!this.areDirsValid) throw Error('One or more paths do NOT exist.')
      ;
      for (const dir of this._dirs) {
        const fileNames   = await this._pfs.readdir(dir);
        const mdFilePaths = this._filterMDFilePaths(dir, fileNames);
        const mdFileData = await this._getFilesFrontMatter(mdFilePaths);
        this._fileData.set(dir, mdFileData);
      }
      this.onReady(null);
    }
    catch (err) { this.onReady(err); }
  }

  private async _getFilesFrontMatter(filePaths: string[]) {
    const filesContent = await this._readAllFiles(filePaths);
    return filesContent.map((data, i) => {
      return this._getFileFrontMatter(filePaths[i], data);
    });
  }

  private _filterMDFilePaths(dir: string, fileNames: string[]) {
    if (fileNames.length == 0)
      throw Error(`No files to parse @${dir}`)
    ;
    const filePaths = fileNames
      .filter(name => pathExtname(name) == '.md')
      .map(name => `${dir}/${name}`)
    ;
    if (!filePaths.length)
      throw Error(`No .md files found @${dir}`)
    ;
    return filePaths;
  }

  private async _readAllFiles(filePaths: string[]) {
    const fileData: string[] = [];
    for (const path of filePaths) {
      const data = (await this._pfs.readFile(path)).toString('utf-8');
      fileData.push(data);
    }
    return fileData;
  }

  /**
   * Validates expected properties from a files front matter
   * and returns it if no errors are found.
   */
  private _getFileFrontMatter(path: string, file: string) {
    if (!frontMatter.test(file))
      throw Error(`Invalid or Missing front matter: ${path}`)
    ;
    const fileObj = frontMatter<MDFormat>(file);
    if (!fileObj.attributes.title)
      throw Error(`File is missing a title: ${path}`)
    ;
    if (fileObj.attributes.title != pathBasename(path, '.md'))
      throw Error(`Title does not match file name: ${path}`)
    ;
    if (!fileObj.attributes.author)
      throw Error(`Missing Author: ${path}`)
    ;
    return fileObj;
  }

}