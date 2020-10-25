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
  t.test('contructor() throws an error with invalid paths.', t => {
    t.plan(1); new PageBuilder(['../invalid/path'], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('contructor() throws an error with invalid front matter.', t => {
    t.plan(1); new PageBuilder([`${mockFolder}/invalidfile`], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('contructor() throws an error with no .md files.', t => {
    t.plan(1); new PageBuilder([`${mockFolder}/emptytest`], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('contructor() throws an error when loaded file has invalid title.', t => {
    t.plan(1); new PageBuilder([`${mockFolder}/titleerror`], (err) => {
      t.ok(err instanceof Error);
    });
  });
  t.test('contructor() throws an error when loaded file has missing title.', t => {
    t.plan(1); new PageBuilder([`${mockFolder}/missingtitle`], (err) => {
      t.ok(err instanceof Error);

    });
  });
  t.test('contructor() throws an error when loaded file has missing author.', t => {
    t.plan(1); new PageBuilder([`${mockFolder}/missingauthor`], (err) => {
      t.ok(err instanceof Error);
    });
  });

  t.test('get areDirsValid returns true when paths are valid.', t => {
    t.plan(2);
    const pg = new PageBuilder([`${mockFolder}/one`], (err) => {
      t.is(err, null,       'error is null');
      t.ok(pg.areDirsValid, 'should be valid');
    });
  });
});