import tape from 'tape';
import { PageBuilder } from '../lib/page_builder';
import smap from 'source-map-support';

smap.install();


const mockFolder = './specs/mocks';

tape('PageBuilder{}', t => {

  t.test('contructor() throws an error with empty paths.', t => {
    t.plan(1); new PageBuilder([], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('contructor() throws an error with invalid front matter.', t => {
    const testFolder = `${mockFolder}/test_invalid_file`;
    t.plan(1); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('contructor() throws an error when directory missing .md files.', t => {
    const testFolder = `${mockFolder}/test_no_md_files`;
    t.plan(2); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error, 'no .md files present');
    });
    new PageBuilder([`${mockFolder}/test_empty_directory`], (err) => {
      t.ok(err instanceof Error, 'empty directory');
    });
  });
  t.test('contructor() throws an error when loaded file has invalid title.', t => {
    const testFolder = `${mockFolder}/test_inconsistent_title`;
    t.plan(1); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('contructor() throws an error when loaded file has missing title.', t => {
    const testFolder = `${mockFolder}/test_missing_title`;
    t.plan(1); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('contructor() throws an error when loaded file has missing author.', t => {
    const testFolder = `${mockFolder}/test_missing_author`;
    t.plan(1); new PageBuilder([testFolder], (err) => {
      t.ok(err instanceof Error);
    });
  });

  t.test('get areDirsValid throws an error with invalid directories.', t => {
    t.plan(1); new PageBuilder(['../invalid/path'], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('get areDirsValid returns true when paths are valid.', t => {
    t.plan(2);
    const pg = new PageBuilder([`${mockFolder}/test_valid_directory`], (err) => {
      t.is(err, null,       'error is null');
      t.ok(pg.areDirsValid, 'should be valid');
    });
  });
});