import tape from 'tape';
import MDPageBundler, { Page } from '../lib/core/md_page_bundler';
import smap from 'source-map-support';
import { writeFile } from 'fs';
import importFresh from 'import-fresh';
import testAddPages from './mocks/test_add_page/test_add_page.json';
import { sep as pathSep, basename as pathBasename } from 'path';
import fs from 'fs';
import del from 'del';
import { dir } from 'console';

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

  t.test('initPagesFromFiles() logs to console when env variable is not set to "silent"', t => {
    const stdoutStr = getLastStdout();
    t.plan(3);
    const pb = new MDPageBundler();
    t.doesNotThrow(() => pb.initPagesFromFiles([`${mockFolder}/test_valid_directory`]), 'no errors occur');
    const initMsg = JSON.parse(stdoutStr[0]).msg;
    t.is(initMsg, 'Initializing', 'log matches expected value')
    ;
    console.log('custom stdout function should not execute this');
    t.is(stdoutStr.length, 1, 'write method reset')
    ;
    // Prevent logging for rest of tests
    process.env.logState = 'silent';
  });
  t.test('initPagesFromFiles() throws an error with empty directory array.', async t => {
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromFiles([]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('empty'), 'includes "empty" in error message.');
    }
  });
  t.test('initPagesFromFiles() throws an error when a directory is not found.', async t => {
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromFiles(['../invalid/path']); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('not exist'), 'includes "not exist" in error message.');
    }
  });
  t.test('initPagesFromFiles() throws an error with invalid front matter.', async t => {
    const testFolder = `${mockFolder}/test_invalid_file`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromFiles([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('front matter'), 'includes "front matter" in error message');
    }
  });
  t.test('initPagesFromFiles() throws an error when directory missing .md files.', async t => {
    let testFolder = `${mockFolder}/test_no_md_files`;
    t.plan(4); const pb = new MDPageBundler();
    try { await pb.initPagesFromFiles([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('No .md files'), 'includes "no .md files" in error message');
    }
    testFolder = `${mockFolder}/test_empty_dir`;
    try { await pb.initPagesFromFiles([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('do not exist'), 'includes "do not exist" in error message');
    }
  });
  t.test('initPagesFromFiles() throws an error when loaded file has missing title.', async t => {
    const testFolder = `${mockFolder}/test_missing_title`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromFiles([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('missing a title'), 'includes "missing a title" in error message');
    }
  });
  t.test('initPagesFromFiles() throws an error when loaded file has missing author.', async t => {
    const testFolder = `${mockFolder}/test_missing_author`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromFiles([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('Missing Author'), 'includes "Missing Author" in error message');
    }
  });
  t.test('initPagesFromFiles() throws an error when loaded file has missing content.', async t => {
    const testFolder = `${mockFolder}/test_missing_content`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromFiles([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('Empty file content'), 'includes "Empty file content" in error message');
    }
  });
  t.test('initPagesFromFiles() throws an error when loaded file has invalid static date.', async t => {
    const testFolder = `${mockFolder}/test_invalid_date`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromFiles([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('Invalid Date'), 'includes "Invalid Date" in error message');
    }
  });
  t.test('initPagesFromFiles() populates internal map with valid Pages.', async t => {
    const testFolder = `${mockFolder}/test_valid_directory`;
    t.plan(1); const pb = new MDPageBundler();
    try {
      await pb.initPagesFromFiles([testFolder]);
      const values = Array.from(pb.newPagesMap.values())[0].map(val => val.title);
      t.same(values, ['page 1', 'page 2', 'page 3']);
    }
    catch (err) {
      t.fail(err.message);
    }
  });

  t.test('get dirs: return absolute paths of internal directories.', async t => {
    const rootDir = `${mockFolder}/test_multiple_directories`;
    const testFolders = [
      `${rootDir}/one`,
      `${rootDir}/two`,
      `${rootDir}/three`
    ];
    t.plan(1); const pb = new MDPageBundler();
    await pb.initPagesFromFiles(testFolders);
    const isAbsPath = (dir: string) => (!!~dir.indexOf(`:${pathSep}`));
    t.ok(pb.dirs.every(isAbsPath), 'contains root file directory');
  });

  t.test('get shortDirs: return short paths of internal directories.', async t => {
    const rootDir = `${mockFolder}/test_multiple_directories`;
    const testFolders = [
      `${rootDir}/one`,
      `${rootDir}/two`,
      `${rootDir}/three`
    ];
    t.plan(1); const pb = new MDPageBundler();
    await pb.initPagesFromFiles(testFolders);
    const isShortPath =
    (dir: string) => (dir == `test_multiple_directories/${pathBasename(dir)}`)
    ;
    t.ok(pb.shortDirs.every(isShortPath));
  });

  t.test('processPages() does not overwrite existing JSON file if there are no changes.', async t => {
    const dir = `${mockFolder}/test_valid_directory`;
    t.plan(2); const pb = new MDPageBundler();
    await pb.initPagesFromFiles([dir]);
    const filePath   = `${pb.dirs[0]}${pathSep}test_valid_directory.json`;
    const oldPages   = await getPages(filePath);
    const oldModTime = (await fs.promises.stat(filePath)).mtimeMs;
    await pb.processPages('plain');
    const updPages   = await getPages(filePath);
    const updModTime = (await fs.promises.stat(filePath)).mtimeMs
    ;
    t.is(oldModTime, updModTime, 'same modified time');
    t.same(updPages, oldPages, 'JSON file has not changed');
  });
  t.test('processPages() aggregates page dates during save operation.', async t => {
    const dir = `${mockFolder}/test_date_aggregation`;
    t.plan(3); const pb = new MDPageBundler();
    await pb.initPagesFromFiles([dir]);
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
  t.test('processPages() adds pages if they do not exist in JSON file.', async t => {
    t.plan(4); const pb = new MDPageBundler();
    const dir = `${mockFolder}/test_add_page`;
    await pb.initPagesFromFiles([dir]);
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
  t.test('processPages() deletes pages if they do not exist in JSON file.', async t => {
    const dir = `${mockFolder}/test_delete_page`;
    t.plan(3); const pb = new MDPageBundler();
    await pb.initPagesFromFiles([dir]);
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
  t.test('processPages() updates pages if their content has changed.', async t => {
    t.plan(5); const pb = new MDPageBundler();
    const dir = `${mockFolder}/test_change_page`;
    await pb.initPagesFromFiles([dir]);
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
  t.test('processPages() updates all pages in all specified directories.', async t => {
    const rootPath = `${mockFolder}/test_multi_dir_changes`;
    const dirs = [
      `${rootPath}${pathSep}one`,
      `${rootPath}${pathSep}two`,
      `${rootPath}${pathSep}three`,
    ];
    t.plan(12); const pb = new MDPageBundler();
    await pb.initPagesFromFiles(dirs);
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
  t.test('processPages() will preserve static dates set inside pages.', async t => {
    t.plan(3); const pb = new MDPageBundler();
    const dir = `${mockFolder}/test_static_dates`;
    await pb.initPagesFromFiles([dir]);
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
  t.test('processPages() sets URIs for all pages.', async t => {
    t.plan(2); const pb = new MDPageBundler();
    const dir = `${mockFolder}/test_uri`;
    await pb.initPagesFromFiles([dir]);
    const filePath = `${pb.dirs[0]}${pathSep}test_uri.json`;
    await pb.processPages('plain');
    const pages = await getPages(filePath);
    t.is(pages[0].uri, 'page-with-spaced-title', 'uri is title with spaces converted to dashes');
    t.is(pages[1].uri, 'pagewithnospacedtitle',  'uri is title as-is when no spaces');
    // Cleanup
    del(`${filePath}`);
  });
  t.test('processPages(html) returns all pages rendered as html', async t => {
    t.plan(3); const pb = new MDPageBundler();
    const dir = `${mockFolder}/test_markdown_render`;
    await pb.initPagesFromFiles([dir]);
    const filePath = `${pb.dirs[0]}${pathSep}test_markdown_render.json`;
    const html = '<p>Some <strong>content</strong> with <em>markdown</em> in it</p>\n';
    await pb.processPages('html');
    const pages = await getPages(filePath);
    t.is(pages[0].content, html);
    t.is(pages[1].content, html);
    t.is(pages[2].content, html);
    // Cleanup
    del(filePath);
  });
});