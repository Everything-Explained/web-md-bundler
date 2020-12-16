import { Page } from "./md_page_bundler";
import { promises as fsPromises } from 'fs';
import { sep as pathSep} from 'path';



type MDPage = [title: string, content: string];
type FrontMatterObj = { [key: string]: string|undefined };




export default class MDPageCreator {

  constructor(private _dir: string) {/***/}


  public createPages(pages: Page[]) {
    const mdPages = pages.map(page => this.createMDPage(page));
    return this._savePages(mdPages);
  }


  private createMDPage(page: Page): MDPage {
    const {title, author, date, content, ...custom } = page;
    const fmStr = this.createFrontMatter({ title, author, date, ...custom });
    return [page.title, `${fmStr}\n${content}`];
  }


  private createFrontMatter(fm: FrontMatterObj) {
    const fence = '---';
    let fmStr = fence
    ;
    for (const key in fm) fmStr += `\n${key}: ${fm[key]}`;
    fmStr += `\n${fence}`;
    return fmStr;
  }


  private async _savePages(pages: MDPage[]) {
    for (const page of pages) {
      await fsPromises.writeFile(
        `${this._dir}${pathSep}${page[0]}.md`, page[1], 'utf8'
      );
    }
  }
}