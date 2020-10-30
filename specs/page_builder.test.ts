import tape from 'tape';
import { Page, PageBuilder } from '../lib/page_builder';
import smap from 'source-map-support';
import { writeFile } from 'fs';
import importFresh from 'import-fresh';
import testAddPages from './mocks/test_add_page/test_add_page.json';
import { sep as pathSep, basename as pathBasename } from 'path';
import fs from 'fs';

smap.install();


const mockFolder = './specs/mocks';

const getPages = (path: string) => (
  importFresh(path) as Promise<typeof testAddPages>
);

const resetFileChanges = (path: string, pages: Page[]) => {
  writeFile(path, JSON.stringify(pages, null, 2), () => {return;});
};

const getLastStdout = () => {
  const lastStr: string[] = [];
  process.stdout.write = (function(write) {
    return function(str: any) {
      lastStr.push(str);
      write.apply(process.stdout, [str]);
      // we only want to execute this function once
      process.stdout.write = write;
      return true;
    };
  })(process.stdout.write);
  return lastStr;
};

const getOldPageStates = async (dirs: string[]) => {
  const vars: [string, Page[], Page, Page][] = [];
  for (const dir of dirs) {
    const filePath    = `${dir}/${pathBasename(dir)}.json`;
    const oldPages    = await getPages(filePath);
    const oldPage     = oldPages.find(page => page.title == 'page to change')!;
    const staticPage = oldPages.find(page => page.title == 'existing page')!;
    vars.push([filePath, oldPages, oldPage, staticPage]);
  }
  return vars;
};

tape('PageBuilder{}', t => {

  t.test('constructor() logs to console when env variable is not set to "is-testing"', t => {
    const stdoutStr = getLastStdout();
    t.plan(3); new PageBuilder([`${mockFolder}/test_valid_directory`], (err) => {
      t.is(err, null, 'no errors occur');
      const initMsg = JSON.parse(stdoutStr[0]).msg;
      t.is(initMsg, 'Initializing', 'log matches expected value')
      ;
      console.log('custom stdout function should not execute this');
      t.is(stdoutStr.length, 1, 'write method reset')
      ;
      // Prevent logging for rest of tests
      process.env.testState = 'is-testing';
    });
  });
  t.test('constructor() throws an error with empty directory array.', t => {
    t.plan(1); new PageBuilder([], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error with invalid directories.', t => {
    t.plan(1); new PageBuilder(['../invalid/path'], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error with invalid front matter.', t => {
    const testFolder = `${mockFolder}/test_invalid_file`;
    t.plan(1); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error when directory missing .md files.', t => {
    const testFolder = `${mockFolder}/test_no_md_files`;
    t.plan(2); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error, 'no .md files present');
    });
    new PageBuilder([`${mockFolder}/test_empty_dir`], (err) => {
      t.ok(err instanceof Error, 'empty directory');
    });
  });
  t.test('constructor() throws an error when loaded file has invalid title.', t => {
    const testFolder = `${mockFolder}/test_inconsistent_title`;
    t.plan(1); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error when loaded file has missing title.', t => {
    const testFolder = `${mockFolder}/test_missing_title`;
    t.plan(1); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error when loaded file has missing author.', t => {
    const testFolder = `${mockFolder}/test_missing_author`;
    t.plan(1); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error when loaded file has missing content.', t => {
    const testFolder = `${mockFolder}/test_missing_content`;
    t.plan(1); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() aggregates page dates during load operation.', t => {
    t.plan(1); const pb = new PageBuilder([`${mockFolder}/test_valid_directory`], (err) => {
      const filePath = pb.dirs[0];
      const pages = pb.pagesMap.get(filePath)!;
      const pagesHaveDates = pages.every(p => !!p.date);
      t.ok(pagesHaveDates);
    });
  });
  t.test('constructor() populates internal map with valid Pages.', t => {
    const testFolder = `${mockFolder}/test_valid_directory`;
    t.plan(2); const pb = new PageBuilder([testFolder], (err) => {
      t.is(err, null, 'error should be null');
      const values = Array.from(pb.pagesMap.values())[0].map(val => val.title);
      t.same(values, ['page 1', 'page 2', 'page 3']);
    });
  });

  t.test('get dirs: return absolute paths of internal directories.', t => {
    const rootDir = `${mockFolder}/test_multiple_directories`;
    const testFolders = [
      `${rootDir}/one`,
      `${rootDir}/two`,
      `${rootDir}/three`
    ];
    t.plan(1); const pb = new PageBuilder(testFolders, async (err) => {
      const isAbsPath = (dir: string) => (!!~dir.indexOf(`:${pathSep}`));
      t.ok(pb.dirs.every(isAbsPath), 'contains root file directory');
    });
  });

  t.test('get shortDirs: return short paths of internal directories.', t => {
    const rootDir = `${mockFolder}/test_multiple_directories`;
    const testFolders = [
      `${rootDir}/one`,
      `${rootDir}/two`,
      `${rootDir}/three`
    ];
    t.plan(1); const pb = new PageBuilder(testFolders, async (err) => {
      const isShortPath =
        (dir: string) => (dir == `test_multiple_directories/${pathBasename(dir)}`)
      ;
      t.ok(pb.shortDirs.every(isShortPath));
    });
  });

  t.test('updatePages() does not overwrite existing JSON file if there are no changes.', t => {
    t.plan(3); const pb = new PageBuilder([`${mockFolder}/test_valid_directory`], async (err) => {
      t.is(err, null, 'error should be null')
      ;
      const filePath = `${pb.dirs[0]}${pathSep}test_valid_directory.json`;
      const oldPages = await getPages(filePath);
      const oldModTime = (await fs.promises.stat(filePath)).mtimeMs;
      await pb.updatePages();
      const updPages = await getPages(filePath);
      const updModTime = (await fs.promises.stat(filePath)).mtimeMs
      ;
      t.is(oldModTime, updModTime, 'same modified time');
      t.same(updPages, oldPages, 'JSON file has not changed');
    });
  });
  t.test('updatePages() adds pages if they do not exist in JSON file.', t => {
    t.plan(4); const pb = new PageBuilder([`${mockFolder}/test_add_page`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}/test_add_page.json`;
      const oldPages = await getPages(filePath);
      const oldPage  = oldPages.find(page => page.title == 'test adding this page');
      await pb.updatePages();
      const updPages     = await getPages(filePath);
      const addedPage    = updPages.find(page => page.title == 'test adding this page');
      const pagesFromMap = pb.pagesMap.get(pb.dirs[0])!;
      const pageHasDate  = !!addedPage?.date
      ;
      t.is   (oldPage,     undefined,    'page does not already exist');
      t.isNot(addedPage,   undefined,    'page is saved after update');
      t.same (updPages,    pagesFromMap, 'JSON file matches internal page map');
      t.ok   (pageHasDate,               'added page has a date')
      ;
      // Cleanup
      resetFileChanges(filePath, oldPages);
    });
  });
  t.test('updatePages() deletes pages if they do not exist in JSON file.', t => {
    t.plan(3); const pb = new PageBuilder([`${mockFolder}/test_delete_page`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}/test_delete_page.json`;
      const oldPages = await getPages(filePath);
      const oldPage  = oldPages.find(page => page.title == 'page to delete');
      await pb.updatePages(); // file does not exist in directory
      const updPages     = await getPages(filePath);
      const deletedPage  = updPages.find(page => page.title == 'page to delete');
      const pagesFromMap = pb.pagesMap.get(pb.dirs[0])
      ;
      t.isNot( oldPage,    undefined, 'page exists to delete');
      t.is(deletedPage,    undefined, 'page is deleted after update');
      t.same( updPages, pagesFromMap, 'JSON file matches internal page map')
      ;
      // Cleanup
      resetFileChanges(filePath, oldPages);
    });
  });
  t.test('updatePages() update pages if their content has changed.', t => {
    t.plan(5); const pb = new PageBuilder([`${mockFolder}/test_change_page`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}/test_change_page.json`;
      const oldPages = await getPages(filePath);
      const oldPage  = oldPages.find(page => page.title == 'page that changes');
      await pb.updatePages(); // file is changed in directory
      const updPages     = await getPages(filePath);
      const updPage      = updPages.find(page => page.title == 'page that changes');
      const pagesFromMap = pb.pagesMap.get(pb.dirs[0]);
      const changedStr   = 'This content has changed.';
      const pageHasDate  = !!updPage?.date;
      const dateIsValid  = new Date(oldPage!.date) < new Date(updPage!.date)
      ;
      t.isNot(oldPage,          undefined,    'page exists to change');
      t.is   (updPage?.content, changedStr,   'page content is changed after update');
      t.same (updPages,         pagesFromMap, 'JSON file matches internal page map');
      t.ok   (pageHasDate,                    'updated page has a date');
      t.ok   (dateIsValid,                    'updated page has valid date')
      ;
      // Cleanup
      resetFileChanges(filePath, oldPages);
    });
  });
  t.test('updatePages() throws an error if an invalid date exists in a page.', t => {
    t.plan(1); const pb = new PageBuilder([`${mockFolder}/test_invalid_date`], async (err) => {
      if (err) throw err;
      try {
        await pb.updatePages();
        t.fail('should throw');
      }
      catch (err) { t.throws(() => { throw err; }); }
    });
  });
  t.test('updatePages() updates all pages in all specified directories.', t => {
    const rootPath = `${mockFolder}/test_multi_dir_changes`;
    const dirs = [
      `${rootPath}${pathSep}one`,
      `${rootPath}${pathSep}two`,
      `${rootPath}${pathSep}three`,
    ];
    t.plan(12); const pb = new PageBuilder(dirs, async (err) => {
      if (err) throw err;
      const states = await getOldPageStates(pb.dirs);
      await pb.updatePages();
      for (const state of states) {
        const [filePath, oldPages, oldPage, oldStaticPage] = state;
        const updPages    = await getPages(filePath);
        const addedPage   = updPages.find(page => page.title == 'page to add')!;
        const chgPage     = updPages.find(page => page.title == 'page to change')!;
        const staticPage2 = updPages.find(page => page.title == 'existing page')
        ;
        t.is(chgPage.content, 'is changed',                    'page was changed');
        t.ok(new Date(oldPage.date!) < new Date(chgPage.date), 'date updated');
        t.is(addedPage.content, 'page added',                  'page was added');
        t.same(oldStaticPage, staticPage2,                     'existing page untouched');
        // Cleanup
        resetFileChanges(filePath, oldPages);
      }
    });
  });
});