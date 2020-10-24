import tape from 'tape';
import { PageBuilder } from '../lib/page_builder';

tape('PageBuilder{}', t => {
  t.test('contructor() throws an error with empty paths.', async t => {
    t.throws(() => new PageBuilder([]));
  });
  t.test('contructor() throws an error with invalid paths.', async t => {
    t.throws(() => new PageBuilder(['../invalid/path.md']));
  });
  t.test('get arePathsValid returns true when paths are valid', async t => {
    t.ok(new PageBuilder(['./specs/mockdir']).arePathsValid);
  });
});