import tape from 'tape';
import { PageBuilder } from '../lib/page_builder';
import smap from 'source-map-support';
import { writeFile } from 'fs';
import importFresh from 'import-fresh';
import testAddPages from './mocks/test_add_page/test_add_page.json';

smap.install();


const mockFolder = './specs/mocks';
process.env.debugState = 'is-debugging'; // prevent logging

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
});