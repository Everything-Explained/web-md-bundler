import { promises, existsSync } from 'fs';
import frontMatter, { FrontMatterResult } from 'front-matter';



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
        const fileNames = await this._pfs.readdir(dir);
        const filePaths = fileNames.map(name => `${dir}/${name}`);
        const filesData = await this.parseFiles(filePaths);
        this._fileData.set(dir, filesData);
      }
      this.onReady(null);
    }
    catch (err) { this.onReady(err); }
  }

  async parseFiles(filePaths: string[]) {
    const fileStrings = await this._readAllFiles(filePaths);
    return fileStrings.map(data => {
      if (!frontMatter.test(data))
        throw Error(
          `Invalid or Missing front matter \nContents: "${data.substr(0, 30)}"`
      );
      return frontMatter<MDFormat>(data);
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

}