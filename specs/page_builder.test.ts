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

tape('PageBuilder{}', t => {

  t.test('constructor() logs to console when env variable is not set to "is-testing"', t => {
    const stdoutStr = getLastStdout();
    t.plan(3); new PageBuilder([`${mockFolder}/test_valid_directory`], (err) => {
      t.is(err, null, 'no errors occur');
      const initMsg = JSON.parse(stdoutStr[0]).msg;
      t.is(initMsg, 'initializing', 'log matches expected value')
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
  t.test('constructor() populates internal map with valid Pages.', t => {
    const testFolder = `${mockFolder}/test_valid_directory`;
    t.plan(2); const pb = new PageBuilder([testFolder], (err) => {
      t.is(err, null, 'error should be null');
      const values = Array.from(pb.pagesMap.values())[0].map(val => val.title);
      t.same(values, ['testing the files', 'what is a love', 'what is a silence']);
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
    t.plan(3); const pb = new PageBuilder([`${mockFolder}/test_add_page`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}/test_add_page.json`;
      const oldPages = await getPages(filePath);
      const oldPage  = oldPages.find(page => page.title == 'test adding this page');
      await pb.updatePages();
      const updPages     = await getPages(filePath);
      const addedPage    = updPages.find(page => page.title == 'test adding this page');
      const pagesFromMap = pb.pagesMap.get(pb.dirs[0])
      ;
      t.is(     oldPage,    undefined, 'page does not already exist');
      t.isNot(addedPage,    undefined, 'page is saved after update');
      t.same(  updPages, pagesFromMap, 'JSON file matches internal page map')
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
      const oldPage  = oldPages.find(page => page.title == 'test to delete this page');
      await pb.updatePages(); // file does not exist in directory
      const updPages     = await getPages(filePath);
      const deletedPage  = updPages.find(page => page.title == 'test to delete this page');
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
    t.plan(3); const pb = new PageBuilder([`${mockFolder}/test_change_page`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}/test_change_page.json`;
      const oldPages = await getPages(filePath);
      const oldPage  = oldPages.find(page => page.title == 'page that changes');
      await pb.updatePages(); // file is changed in directory
      const updPages     = await getPages(filePath);
      const updPage      = updPages.find(page => page.title == 'page that changes');
      const pagesFromMap = pb.pagesMap.get(pb.dirs[0]);
      const changedStr   = 'This content is now changed.'
      ;
      t.isNot(      oldPage,    undefined, 'page exists to change');
      t.is(updPage?.content,   changedStr, 'page content is changed after update');
      t.same(      updPages, pagesFromMap, 'JSON file matches internal page map')
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

});