import { Page } from "./md_page_bundler";
import { promises as fsPromises } from 'fs';
import { sep as pathSep} from 'path';



type MDPage = [title: string, content: string];




export default class MDPageCreator {

  constructor(private _dir: string) {/***/}


  public createPages(pages: Page[]): void {
    const mdPages = pages.map(this.createMDPage);
    this._savePages(mdPages);
  }


  private createMDPage(page: Page): MDPage {
    return (
[page.title,
`---
title: ${page.title}
author: ${page.author}
date: ${page.date}
---
${page.content}`]
    );
  }

  private async _savePages(pages: MDPage[]) {
    for (const p of pages) {
      await fsPromises.writeFile(
        `${this._dir}${pathSep}${p[0]}.md`, p[1], 'utf8'
      );
    }
  }
}