import tape from 'tape';
import { Page, MDPageBundler } from '../lib/core/md_page_bundler';
import smap from 'source-map-support';
import { writeFile } from 'fs';
import importFresh from 'import-fresh';
import testAddPages from './mocks/test_add_page/test_add_page.json';
import { sep as pathSep, basename as pathBasename } from 'path';
import fs from 'fs';
import del from 'del';

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
    const filePath   = `${dir}/${pathBasename(dir)}.json`;
    const oldPages   = await getPages(filePath);
    const oldPage    = oldPages.find(page => page.title == 'page to change')!;
    const staticPage = oldPages.find(page => page.title == 'existing page')!;
    vars.push([filePath, oldPages, oldPage, staticPage]);
  }
  return vars;
};

tape('PageBuilder{}', t => {

  t.test('constructor() logs to console when env variable is not set to "silent"', t => {
    const stdoutStr = getLastStdout();
    t.plan(3); new MDPageBundler([`${mockFolder}/test_valid_directory`], (err) => {
      t.is(err, null, 'no errors occur');
      const initMsg = JSON.parse(stdoutStr[0]).msg;
      t.is(initMsg, 'Initializing', 'log matches expected value')
      ;
      console.log('custom stdout function should not execute this');
      t.is(stdoutStr.length, 1, 'write method reset')
      ;
      // Prevent logging for rest of tests
      process.env.logState = 'silent';
    });
  });
  t.test('constructor() throws an error with empty directory array.', t => {
    t.plan(1); new MDPageBundler([], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error with invalid directories.', t => {
    t.plan(1); new MDPageBundler(['../invalid/path'], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error with invalid front matter.', t => {
    const testFolder = `${mockFolder}/test_invalid_file`;
    t.plan(1); new MDPageBundler([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error when directory missing .md files.', t => {
    const testFolder = `${mockFolder}/test_no_md_files`;
    t.plan(2); new MDPageBundler([testFolder], (err) => {
      t.ok(err instanceof Error, 'no .md files present');
    });
    new MDPageBundler([`${mockFolder}/test_empty_dir`], (err) => {
      t.ok(err instanceof Error, 'empty directory');
    });
  });

  t.test('constructor() throws an error when loaded file has missing title.', t => {
    const testFolder = `${mockFolder}/test_missing_title`;
    t.plan(1); new MDPageBundler([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error when loaded file has missing author.', t => {
    const testFolder = `${mockFolder}/test_missing_author`;
    t.plan(1); new MDPageBundler([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error when loaded file has missing content.', t => {
    const testFolder = `${mockFolder}/test_missing_content`;
    t.plan(1); new MDPageBundler([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('constructor() throws an error when loaded file has invalid static date.', t => {
    const testFolder = `${mockFolder}/test_invalid_date`;
    t.plan(1); new MDPageBundler([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });

  t.test('constructor() populates internal map with valid Pages.', t => {
    const testFolder = `${mockFolder}/test_valid_directory`;
    t.plan(2); const pb = new MDPageBundler([testFolder], (err) => {
      t.is(err, null, 'error should be null');
      const values = Array.from(pb.newPagesMap.values())[0].map(val => val.title);
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
    t.plan(1); const pb = new MDPageBundler(testFolders, async (err) => {
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
    t.plan(1); const pb = new MDPageBundler(testFolders, async (err) => {
      const isShortPath =
        (dir: string) => (dir == `test_multiple_directories/${pathBasename(dir)}`)
      ;
      t.ok(pb.shortDirs.every(isShortPath));
    });
  });

  t.test('processPages() does not overwrite existing JSON file if there are no changes.', t => {
    t.plan(3); const pb = new MDPageBundler([`${mockFolder}/test_valid_directory`], async (err) => {
      t.is(err, null, 'error should be null')
      ;
      const filePath = `${pb.dirs[0]}${pathSep}test_valid_directory.json`;
      const oldPages = await getPages(filePath);
      const oldModTime = (await fs.promises.stat(filePath)).mtimeMs;
      await pb.processPages('plain');
      const updPages = await getPages(filePath);
      const updModTime = (await fs.promises.stat(filePath)).mtimeMs
      ;
      t.is(oldModTime, updModTime, 'same modified time');
      t.same(updPages, oldPages, 'JSON file has not changed');
    });
  });
  t.test('processPages() aggregates page dates during save operation.', t => {
    t.plan(3); const pb = new MDPageBundler([`${mockFolder}/test_date_aggregation`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}${pathSep}test_date_aggregation.json`;
      const oldPages = await getPages(filePath);
      const oldPageWithDate = oldPages.find(page => page.title == 'static page with date')!;
      const oldPageNoDate   = oldPages.find(page => page.title == 'static page with no date')!;
      await pb.processPages('plain'); // file is changed in directory
      const updPages = await getPages(filePath);
      const doPagesHaveDates = updPages.every(page => !!page.date);
      const updPageWithDate  = updPages.find(page => page.title == 'static page with date')!;
      const updPageNoDate    = oldPages.find(page => page.title == 'static page with no date')!;


      t.ok(doPagesHaveDates, 'all pages have dates');
      t.is(oldPageWithDate.date, updPageWithDate.date, 'static date is retained');
      t.is(oldPageNoDate.date, updPageNoDate.date,     'dynamic date is retained');

      // Cleanup
      resetFileChanges(filePath, oldPages);
    });
  });
  t.test('processPages() adds pages if they do not exist in JSON file.', t => {
    t.plan(4); const pb = new MDPageBundler([`${mockFolder}/test_add_page`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}/test_add_page.json`;
      const oldPages = await getPages(filePath);
      const oldPage  = oldPages.find(page => page.title == 'test adding this page');
      await pb.processPages('plain');
      const updPages     = await getPages(filePath);
      const addedPage    = updPages.find(page => page.title == 'test adding this page');
      const pagesFromMap = pb.newPagesMap.get(pb.dirs[0])!;
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
  t.test('processPages() deletes pages if they do not exist in JSON file.', t => {
    t.plan(3); const pb = new MDPageBundler([`${mockFolder}/test_delete_page`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}/test_delete_page.json`;
      const oldPages = await getPages(filePath);
      const oldPage  = oldPages.find(page => page.title == 'page to delete');
      await pb.processPages('plain'); // file does not exist in directory
      const updPages     = await getPages(filePath);
      const deletedPage  = updPages.find(page => page.title == 'page to delete');
      const pagesFromMap = pb.newPagesMap.get(pb.dirs[0])
      ;
      t.isNot( oldPage,    undefined, 'page exists to delete');
      t.is(deletedPage,    undefined, 'page is deleted after update');
      t.same( updPages, pagesFromMap, 'JSON file matches internal page map')
      ;
      // Cleanup
      resetFileChanges(filePath, oldPages);
    });
  });
  t.test('processPages() updates pages if their content has changed.', t => {
    t.plan(5); const pb = new MDPageBundler([`${mockFolder}/test_change_page`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}/test_change_page.json`;
      const oldPages = await getPages(filePath);
      const oldPage  = oldPages.find(page => page.title == 'page that changes')!;
      await pb.processPages('plain'); // file is changed in directory
      const updPages     = await getPages(filePath);
      const updPage      = updPages.find(page => page.title == 'page that changes')!;
      const pagesFromMap = pb.newPagesMap.get(pb.dirs[0]);
      const changedStr   = 'This content has changed.';
      const dateIsValid  = new Date(oldPage!.date) < new Date(updPage!.date)
      ;
      t.isNot(oldPage,          undefined,    'page exists to change');
      t.is   (updPage.content, changedStr,    'page content is changed after update');
      t.same (updPages,         pagesFromMap, 'JSON file matches internal page map');
      t.isNot(oldPage.date, updPage.date,     'updated page has a date');
      t.ok   (dateIsValid,                    'updated page has valid date')
      ;
      // Cleanup
      resetFileChanges(filePath, oldPages);
    });
  });
  t.test('processPages() updates all pages in all specified directories.', t => {
    const rootPath = `${mockFolder}/test_multi_dir_changes`;
    const dirs = [
      `${rootPath}${pathSep}one`,
      `${rootPath}${pathSep}two`,
      `${rootPath}${pathSep}three`,
    ];
    t.plan(12); const pb = new MDPageBundler(dirs, async (err) => {
      if (err) throw err;
      const states = await getOldPageStates(pb.dirs);
      await pb.processPages('plain');
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
  t.test('processPages() will preserve static dates set inside pages.', t => {
    t.plan(3); const pb = new MDPageBundler([`${mockFolder}/test_static_dates`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}${pathSep}test_static_dates.json`;
      const oldPages = await getPages(filePath);
      const oldPage  = oldPages.find(page => page.title == 'page will change')!;
      await pb.processPages('plain'); // file is changed in directory
      const updPages      = await getPages(filePath);
      const updPage       = updPages.find(page => page.title == 'page will change')!;
      const addedPage     = updPages.find(page => page.title == 'page to add')!;
      const addedPageDate = new Date('2/22/2022').toISOString()
      ;
      t.isNot(oldPage.content, updPage.content, 'changed content updated');
      t.is(oldPage.date,       updPage.date,    'changed pages retain static dates');
      t.is(addedPage.date,     addedPageDate,   'added pages retain static dates')
      ;
      // Cleanup
      resetFileChanges(filePath, oldPages);
    });
  });
  t.test('processPages() sets URIs for all pages.', t => {
    t.plan(2); const pb = new MDPageBundler([`${mockFolder}/test_uri`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}${pathSep}test_uri.json`;
      await pb.processPages('plain');
      const pages = await getPages(filePath);
      t.is(pages[0].uri, 'page-with-spaced-title', 'uri is title with spaces converted to dashes');
      t.is(pages[1].uri, 'pagewithnospacedtitle',  'uri is title as-is when no spaces');
      // Cleanup
      del(`${filePath}`);
    });
  });


  t.test('processPages(html) returns all pages rendered as html', t => {
    t.plan(3); const pb = new MDPageBundler([`${mockFolder}/test_markdown_render`], async (err) => {
      if (err) throw err;
      const filePath = `${pb.dirs[0]}${pathSep}test_markdown_render.json`;
      const html = '<p>Some <strong>content</strong> with <em>markdown</em> in it</p>\n';
      await pb.processPages('html');
      const pages = await getPages(filePath);
      t.is(pages[0].content, html);
      t.is(pages[1].content, html);
      t.is(pages[2].content, html);
      del(filePath);
    });
  });
});