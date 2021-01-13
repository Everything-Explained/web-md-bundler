import tape from 'tape';
import MDPageBundler, { Page, PageMap } from '../lib/core/md_page_bundler';
import smap from 'source-map-support';
import { writeFile } from 'fs';
import importFresh from 'import-fresh';
import { sep as pathSep, basename as pathBasename } from 'path';
import fs from 'fs';
import del from 'del';

smap.install();


const mdMockFolder = './specs/mocks/md_file_tests';
const mapMockFolder = './specs/mocks/page_map_tests';

const getPages = (path: string) => importFresh(path) as Promise<Page[]>;

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

  t.test('initPagesFromDirs() logs to console when env variable is not set to "silent"', t => {
    const stdoutStr = getLastStdout();
    t.plan(3);
    const pb = new MDPageBundler();
    t.doesNotThrow(() => pb.initPagesFromDirs([`${mdMockFolder}/test_valid_directory`]), 'no errors occur');
    const initMsg = stdoutStr[0].trim();
    t.is(initMsg, 'Initializing', 'log matches expected value')
    ;
    console.log('custom stdout function should not execute this');
    t.is(stdoutStr.length, 1, 'write method reset')
    ;
    // Prevent logging for rest of tests
    process.env.logState = 'silent';
  });
  t.test('initPagesFromDirs() throws an error with empty directory array.', async t => {
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromDirs([]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('Path configuration is empty.'), 'shows custom error message');
    }
  });
  t.test('initPagesFromDirs() throws an error when a directory is not found.', async t => {
    t.plan(4); const pb = new MDPageBundler();
    let invalidPath = `${mdMockFolder}/dir_not_exist/ignores_file.json`;
    try { await pb.initPagesFromDirs([invalidPath]); }
    catch (err) {
      t.pass('throws error');
      t.ok(err.message.includes('Directory does NOT exist:'), 'directory not found with specified file');
    }
    invalidPath = `${mdMockFolder}/dir_not_exist`;
    try { await pb.initPagesFromDirs([invalidPath]); }
    catch (err) {
      t.pass('throws error');
      t.ok(err.message.includes('Directory does NOT exist:'), 'directory not found without specified file');
    }
  });
  t.test('initPagesFromDirs() throws an error when an invalid file or path is used', async t => {
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromDirs(['./an/invalid/file.js']); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('Invalid file name or directory'), 'shows custom error message');
    }
  });
  t.test('initPagesFromDirs() throws an error with invalid front matter.', async t => {
    const testFolder = `${mdMockFolder}/test_invalid_file`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromDirs([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('front matter'), 'includes "front matter" in error message');
    }
  });
  t.test('initPagesFromDirs() throws an error when directory missing .md files.', async t => {
    const testFolder = `${mdMockFolder}/test_no_md_files`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromDirs([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('No .md files'), 'includes "no .md files" in error message');
    }
  });
  t.test('initPagesFromDirs() throws an error when loaded file has missing title.', async t => {
    const testFolder = `${mdMockFolder}/test_missing_title`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromDirs([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('missing a title'), 'includes "missing a title" in error message');
    }
  });
  t.test('initPagesFromDirs() throws an error when loaded file has missing author.', async t => {
    const testFolder = `${mdMockFolder}/test_missing_author`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromDirs([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('Missing Author'), 'includes "Missing Author" in error message');
    }
  });
  t.test('initPagesFromDirs() throws an error when loaded file has missing content.', async t => {
    const testFolder = `${mdMockFolder}/test_missing_content`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromDirs([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('Empty file content'), 'includes "Empty file content" in error message');
    }
  });
  t.test('initPagesFromDirs() throws an error when loaded file has invalid static date.', async t => {
    const testFolder = `${mdMockFolder}/test_invalid_date`;
    t.plan(2); const pb = new MDPageBundler();
    try { await pb.initPagesFromDirs([testFolder]); }
    catch (err) {
      t.pass('throws an error');
      t.ok(err.message.includes('Invalid Date'), 'includes "Invalid Date" in error message');
    }
  });
  t.test('initPagesFromDirs() populates internal map with valid Pages.', async t => {
    const testFolder = `${mdMockFolder}/test_valid_directory`;
    t.plan(1); const pb = new MDPageBundler();
    try {
      await pb.initPagesFromDirs([testFolder]);
      const values = Array.from(pb.pages.values())[0].map(val => val.title);
      t.same(values, ['page 1', 'page 2', 'page 3']);
    }
    catch (err) {
      t.fail(err.message);
    }
  });

  t.test('init methods detect all front matter changes', async t => {
    t.plan(3);
    const dir = `${mapMockFolder}/test_frontmatter_changes`;
    const map = {
      dir,
      pages: [
        { title: 'This is a test', author: 'jaeiya', content: 'some random content' }
      ]
    } as PageMap;
    const page = map.pages[0];
    const pb = new MDPageBundler();
    await pb.initPagesFromMaps([map]);
    const filePath = `${pb.dirs[0]}${pathSep}/test_frontmatter_changes.json`;
    const oldPages = await getPages(filePath);
    let chgPage = oldPages;
    const processChanges = async () => {
      await pb.initPagesFromMaps([map]);
      await pb.processPages('plain');
      chgPage = await getPages(filePath);
    };
    page.test_prop = 'hello world';
    await processChanges();
    t.is(chgPage[0].test_prop, 'hello world', 'optional prop added');
    page.test_prop = 'i have changed';
    await processChanges();
    t.is(chgPage[0].test_prop, 'i have changed', 'optional prop changed');
    page.content = 'new content';
    await processChanges();
    t.is(chgPage[0].content, 'new content', 'content has changed');

    // Cleanup
    resetFileChanges(filePath, oldPages);
  });
  t.test('init methods detect changes on optional id', async t => {
    t.plan(4);
    const dir = `${mapMockFolder}/test_id_changes`;
    const map = {
      dir,
      pages: [
        { title: 'This is a test', id: 1, author: 'jaeiya', content: 'some random content' },
        { title: 'This is a test', id: 2, author: 'jaeiya', content: 'some random content' },
      ]
    } as PageMap;
    const page = map.pages[1]; // Page 2
    const pb = new MDPageBundler();
    await pb.initPagesFromMaps([map]);
    const filePath = `${pb.dirs[0]}${pathSep}/test_id_changes.json`;
    const oldPages = await getPages(filePath);
    let chgPages = oldPages;
    const processChanges = async () => {
      await pb.initPagesFromMaps([map]);
      await pb.processPages('plain');
      chgPages = await getPages(filePath);
    };
    page.title = 'new title';
    await processChanges();
    t.is(chgPages[1].title, 'new title');
    t.is(chgPages[1].id, 2);
    t.is(chgPages[0].title, 'This is a test');
    t.is(chgPages[0].id, 1);

    // Cleanup
    resetFileChanges(filePath, oldPages);
  });

  t.test('get dirs: return absolute paths of internal directories.', async t => {
    const rootDir = `${mdMockFolder}/test_multiple_directories`;
    const testFolders = [
      `${rootDir}/one`,
      `${rootDir}/two`,
      `${rootDir}/three`
    ];
    t.plan(1); const pb = new MDPageBundler();
    await pb.initPagesFromDirs(testFolders);
    const isAbsPath = (dir: string) => (!!~dir.indexOf(`:${pathSep}`));
    t.ok(pb.dirs.every(isAbsPath), 'contains root file directory');
  });

  t.test('get shortDirs: return short paths of internal directories.', async t => {
    const rootDir = `${mdMockFolder}/test_multiple_directories`;
    const testFolders = [
      `${rootDir}/one`,
      `${rootDir}/two`,
      `${rootDir}/three`
    ];
    t.plan(1); const pb = new MDPageBundler();
    await pb.initPagesFromDirs(testFolders);
    const isShortPath =
    (dir: string) => (dir == `test_multiple_directories/${pathBasename(dir)}`)
    ;
    t.ok(pb.shortDirs.every(isShortPath));
  });

  t.test('processPages() does not overwrite existing JSON file if there are no changes.', async t => {
    const dir = `${mdMockFolder}/test_valid_directory`;
    t.plan(2); const pb = new MDPageBundler();
    await pb.initPagesFromDirs([dir]);
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
    const dir = `${mdMockFolder}/test_date_aggregation`;
    t.plan(3); const pb = new MDPageBundler();
    await pb.initPagesFromDirs([dir]);
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
    const dir = `${mdMockFolder}/test_add_page`;
    await pb.initPagesFromDirs([dir]);
    const filePath = `${pb.dirs[0]}/test_add_page.json`;
    const oldPages = await getPages(filePath);
    const oldPage  = oldPages.find(page => page.title == 'test adding this page');
    await pb.processPages('plain');
    const updPages     = await getPages(filePath);
    const addedPage    = updPages.find(page => page.title == 'test adding this page');
    const pagesFromMap = pb.pages.get(pb.dirs[0])!;
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
    const dir = `${mdMockFolder}/test_delete_page`;
    t.plan(3); const pb = new MDPageBundler();
    await pb.initPagesFromDirs([dir]);
    const filePath = `${pb.dirs[0]}/test_delete_page.json`;
    const oldPages = await getPages(filePath);
    const oldPage  = oldPages.find(page => page.title == 'page to delete');
    await pb.processPages('plain'); // file does not exist in directory
    const updPages     = await getPages(filePath);
    const deletedPage  = updPages.find(page => page.title == 'page to delete');
    const pagesFromMap = pb.pages.get(pb.dirs[0])
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
    const dir = `${mdMockFolder}/test_change_page`;
    await pb.initPagesFromDirs([dir]);
    const filePath = `${pb.dirs[0]}/test_change_page.json`;
    const oldPages = await getPages(filePath);
    const oldPage  = oldPages.find(page => page.title == 'page that changes')!;
    await pb.processPages('plain'); // file is changed in directory
    const updPages     = await getPages(filePath);
    const updPage      = updPages.find(page => page.title == 'page that changes')!;
    const pagesFromMap = pb.pages.get(pb.dirs[0]);
    const changedStr   = 'This content has changed.';
    const dateIsValid  = new Date(oldPage!.date!) < new Date(updPage!.date!)
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
    const rootPath = `${mdMockFolder}/test_multi_dir_changes`;
    const dirs = [
      `${rootPath}${pathSep}one`,
      `${rootPath}${pathSep}two`,
      `${rootPath}${pathSep}three`,
    ];
    t.plan(12); const pb = new MDPageBundler();
    await pb.initPagesFromDirs(dirs);
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
      t.ok(new Date(oldPage.date!) < new Date(chgPage.date!),'date updated');
      t.is(addedPage.content, 'page added',                  'page was added');
      t.same(oldStaticPage, staticPage2,                     'existing page untouched');
      // Cleanup
      resetFileChanges(filePath, oldPages);
    }
  });
  t.test('processPages() will preserve static dates set inside pages.', async t => {
    t.plan(3); const pb = new MDPageBundler();
    const dir = `${mdMockFolder}/test_static_dates`;
    await pb.initPagesFromDirs([dir]);
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
    const dir = `${mdMockFolder}/test_uri`;
    await pb.initPagesFromDirs([dir]);
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
    const dir = `${mdMockFolder}/test_markdown_render`;
    await pb.initPagesFromDirs([dir]);
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

  t.test('initPagesFromMaps() maintains proper order of directories to pages', async t => {
    t.plan(3); const pb = new MDPageBundler();
    const pages = [
      { dir: `${mapMockFolder}/init/1`,
      pages: [
        { title: 'A page in 1', content: 'this is a test', author: 'test' }
      ]},
      { dir: `${mapMockFolder}/init/2`,
      pages: [
        { title: 'A page in 2', content: 'this is a test', author: 'test' }
      ]},
      { dir: `${mapMockFolder}/init/3`,
      pages: [
        { title: 'A page in 3', content: 'this is a test', author: 'test' }
      ]},
    ] as PageMap[];
    await pb.initPagesFromMaps(pages);
    let i = 1;
    for(const page of pb.pages.values()) {
      t.is(page[0].title, `A page in ${i++}`);
    }
  });
  t.test('initPagesFromMaps() bundles all page-map data to their bundle directory', async t => {
    t.plan(4);
    const addedPages = [
      { dir: `${mapMockFolder}/test_bundles/1`,
      pages: [
        { title: 'A page in 1', id: 1, content: 'this is a test', author: 'test' }
      ]},
      { dir: `${mapMockFolder}/test_bundles/2`,
      pages: [
        { title: 'A page in 2', id: 5, content: 'this is a test', author: 'test', extraProp: 'extra' }
      ]},
      { dir: `${mapMockFolder}/test_bundles/3`,
      pages: [
        { title: 'A page in 3', id: 7, content: 'this is a test', author: 'test' }
      ]},
    ] as PageMap[];
    const pb = new MDPageBundler();
    await pb.initPagesFromMaps(addedPages);
    await pb.processPages('plain');
    for(const dir of pb.dirs) {
      const resDir = `${dir}${pathSep}${pathBasename(dir)}.json`;
      const pages = await getPages(resDir);
      const page = pages[0];
      if (page.id == 1) {
        t.is(page.title, addedPages[0].pages[0].title, 'bundle found');
        continue;
      }
      if (page.id == 5) {
        t.is(page.title, addedPages[1].pages[0].title, 'bundle found');
        t.is(page.extraProp, 'extra', 'has extra prop');
        continue;
      }
      if (page.id == 7) {
        t.is(page.title, addedPages[2].pages[0].title, 'bundle found');
        continue;
      }
      t.fail('bundle not found');
    }

    // Cleanup
    const dirs = pb.dirs.map(dir => `${dir}${pathSep}${pathBasename(dir)}.json`);
    del(dirs);
  });
  t.test('initPagesFromMaps() can set a filename that is not associated with the dir', async t => {
    t.plan(1);
    const pb = new MDPageBundler();
    const map = [
      {
        dir: `${mapMockFolder}/test_filename/customname.json`,
        pages: [
          { title: 'A page', id: 1, content: 'some content', author: 'test' }
        ]
      },
    ] as PageMap[];
    await pb.initPagesFromMaps(map);
    await pb.processPages('plain');
    const dir = pb.dirs[0];
    const pages = await getPages(dir);
    t.deepEquals(pages[0], map[0].pages[0]);

    // Cleanup
    del(dir);
  });



});