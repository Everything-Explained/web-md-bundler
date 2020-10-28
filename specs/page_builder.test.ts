import tape from 'tape';
import { PageBuilder } from '../lib/page_builder';
import smap from 'source-map-support';
import { writeFile } from 'fs';
import importFresh from 'import-fresh';
import testAddPages from './mocks/test_add_page/test_add_page.json';

smap.install();


const mockFolder = './specs/mocks';
process.env.testState = 'is-testing'; // prevent logging

tape('PageBuilder{}', t => {

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
    t.plan(1); const pb = new PageBuilder([testFolder], (err) => {
      const values = Array.from(pb.pages.values())[0].map(val => val.title);
      t.same(values, ['testing the files', 'what is a love', 'what is a silence']);
    });
  });

  t.test('updatePages() adds pages if they do not exist in JSON file.', t => {
    t.plan(3); const pb = new PageBuilder([`${mockFolder}/test_add_page`], async (err) => {
      if (err) throw err;
      const getPages = () => importFresh('./mocks/test_add_page/test_add_page.json') as Promise<typeof testAddPages>;
      const oldPages = (await getPages());
      const pageExistsTest1 = oldPages.find(page => page.title == 'test adding this page');
      await pb.updatePages();
      const pageExistsTest2 = (await getPages()).find(page => page.title == 'test adding this page');
      const pagesFromMap = pb.pages.get(`${mockFolder}/test_add_page`)
      ;
      t.is(pageExistsTest1,    undefined,    'page does not already exist');
      t.isNot(pageExistsTest2, undefined,    'page is saved after update');
      t.same(await getPages(), pagesFromMap, 'JSON file matches internal page map')
      ;
      // Cleanup
      writeFile(
        `${mockFolder}/test_add_page/test_add_page.json`,
        JSON.stringify(oldPages, null, 2),
        () => {return;}
      );
    });
  });
  t.test('updatePages() deletes pages if they do not exist in pages map.', t => {
    t.plan(3); const pb = new PageBuilder([`${mockFolder}/test_delete_page`], async (err) => {
      if (err) throw err;
      const getPages = () => importFresh('./mocks/test_delete_page/test_delete_page.json') as Promise<typeof testAddPages>;
      const oldPages = (await getPages());
      const pageExistsTest1 = oldPages.find(page => page.title == 'test to delete this page');
      await pb.updatePages(); // file does not exist in directory
      const pageExistsTest2 = (await getPages()).find(page => page.title == 'test to delete this page');
      const pagesFromMap = pb.pages.get(`${mockFolder}/test_delete_page`)
      ;
      t.isNot(pageExistsTest1,    undefined, 'page exists to delete');
      t.is(pageExistsTest2,       undefined, 'page is deleted after update');
      t.same(await getPages(), pagesFromMap, 'JSON file matches internal page map')
      ;
      // Cleanup
      writeFile(
        `${mockFolder}/test_delete_page/test_delete_page.json`,
        JSON.stringify(oldPages, null, 2),
        () => {return;}
      );
    });
  });
  t.test('updatePages() update pages if their content has changed.', t => {
    t.plan(3); const pb = new PageBuilder([`${mockFolder}/test_change_page`], async (err) => {
      if (err) throw err;
      const getPages = () =>
        importFresh('./mocks/test_change_page/test_change_page.json') as Promise<typeof testAddPages>
      ;
      const oldPages = await getPages();
      const oldPage  = oldPages.find(page => page.title == 'page that changes');
      await pb.updatePages(); // file is changed in directory
      const updPages     = await getPages();
      const newPage      = updPages.find(page => page.title == 'page that changes');
      const pagesFromMap = pb.pages.get(`${mockFolder}/test_change_page`);
      const changedStr   = 'This content is now changed.'
      ;
      t.isNot(      oldPage,    undefined, 'page exists to change');
      t.is(newPage?.content,   changedStr, 'page content is changed after update');
      t.same(      updPages, pagesFromMap, 'JSON file matches internal page map')
      ;
      // Cleanup
      writeFile(
        `${mockFolder}/test_change_page/test_change_page.json`,
        JSON.stringify(oldPages, null, 2),
        () => {return;}
      );
    });
  });
});