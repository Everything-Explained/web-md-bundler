import { promises, existsSync } from 'fs';
import fm from 'front-matter';




export class PageBuilder {

  private _paths;
  /** Promisified File System */
  private _pfs = promises;

  get arePathsValid() {
    for (const p of this._paths) {
      if (!existsSync(p)) return false;
    }
    return true;
  }


  constructor(paths: string[]) {
    this._paths = paths;
    if (!this._paths.length) throw Error('Path configuration is EMPTY.');
    if (!this.arePathsValid) throw Error('One or more paths do NOT exist.');
   }

}