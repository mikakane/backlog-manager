import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDate,
  toName,
  toNames,
  convertIssue,
  buildOutput,
  groupByReleaseDate,
} from '../lib/transform.js';

// ---------------------------------------------------------------------------
// toDate
// ---------------------------------------------------------------------------
describe('toDate', () => {
  it('ISO 文字列から YYYY-MM-DD を返す', () => {
    assert.equal(toDate('2024-03-15T12:34:56Z'), '2024-03-15');
  });

  it('null/undefined は null を返す', () => {
    assert.equal(toDate(null), null);
    assert.equal(toDate(undefined), null);
    assert.equal(toDate(''), null);
  });
});

// ---------------------------------------------------------------------------
// toName
// ---------------------------------------------------------------------------
describe('toName', () => {
  it('オブジェクトの name プロパティを返す', () => {
    assert.equal(toName({ name: '高優先度' }), '高優先度');
  });

  it('null/undefined は null を返す', () => {
    assert.equal(toName(null), null);
    assert.equal(toName(undefined), null);
    assert.equal(toName({}), null);
  });
});

// ---------------------------------------------------------------------------
// toNames
// ---------------------------------------------------------------------------
describe('toNames', () => {
  it('配列の各要素の name を返す', () => {
    assert.deepEqual(toNames([{ name: 'A' }, { name: 'B' }]), ['A', 'B']);
  });

  it('null/undefined は空配列を返す', () => {
    assert.deepEqual(toNames(null), []);
    assert.deepEqual(toNames(undefined), []);
  });

  it('空配列は空配列を返す', () => {
    assert.deepEqual(toNames([]), []);
  });
});

// ---------------------------------------------------------------------------
// convertIssue
// ---------------------------------------------------------------------------
describe('convertIssue', () => {
  const baseIssue = {
    id: 42,
    issueKey: 'PROJ-42',
    summary: 'テスト課題',
    status:    { name: '処理中' },
    priority:  { name: '高' },
    issueType: { name: 'バグ' },
    assignee:  { name: '山田太郎' },
    milestone: [{ name: 'v1.0' }],
    category:  [{ name: 'frontend' }],
    dueDate:   '2024-04-01T00:00:00Z',
    created:   '2024-01-10T00:00:00Z',
    updated:   '2024-03-01T00:00:00Z',
  };

  it('Backlog issue を正しく変換する', () => {
    const result = convertIssue(baseIssue, {});

    assert.equal(result.backlog.id, '42');
    assert.equal(result.backlog.issue_key, 'PROJ-42');
    assert.equal(result.backlog.title, 'テスト課題');
    assert.equal(result.backlog.status, '処理中');
    assert.equal(result.backlog.priority, '高');
    assert.equal(result.backlog.issue_type, 'バグ');
    assert.equal(result.backlog.assignee, '山田太郎');
    assert.deepEqual(result.backlog.milestone, ['v1.0']);
    assert.deepEqual(result.backlog.category, ['frontend']);
    assert.equal(result.backlog.due_date, '2024-04-01');
    assert.equal(result.backlog.created_at, '2024-01-10');
    assert.equal(result.backlog.updated_at, '2024-03-01');
  });

  it('custom.release_date / note のデフォルト値は null / 空文字', () => {
    const result = convertIssue(baseIssue, {});
    assert.equal(result.custom.release_date, null);
    assert.equal(result.custom.note, '');
  });

  it('既存データの release_date / note を引き継ぐ', () => {
    const existing = { '42': { release_date: '2024-04-15', note: 'urgent' } };
    const result = convertIssue(baseIssue, existing);
    assert.equal(result.custom.release_date, '2024-04-15');
    assert.equal(result.custom.note, 'urgent');
  });

  it('assignee が null の場合は null', () => {
    const result = convertIssue({ ...baseIssue, assignee: null }, {});
    assert.equal(result.backlog.assignee, null);
  });
});

// ---------------------------------------------------------------------------
// buildOutput
// ---------------------------------------------------------------------------
describe('buildOutput', () => {
  const issue1 = {
    id: 1, issueKey: 'P-1', summary: '課題1',
    status: { name: '未対応' }, priority: { name: '中' }, issueType: { name: 'タスク' },
    assignee: null, milestone: [], category: [],
    dueDate: null, created: '2024-01-01T00:00:00Z', updated: '2024-01-02T00:00:00Z',
  };

  const config = { api: { space_id: 'my-space' } };
  const fixedNow = '2024-03-15T00:00:00.000Z';

  it('meta と tasks を正しく構築する', () => {
    const result = buildOutput([issue1], {}, config, fixedNow);

    assert.equal(result.meta.fetched_at, fixedNow);
    assert.equal(result.meta.space_id, 'my-space');
    assert.equal(result.meta.total, 1);
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].backlog.id, '1');
  });

  it('closed_task_action: mark — API にない既存タスクを closed として追加', () => {
    const existing = {
      '99': { release_date: '2024-02-01', note: 'old task' },
    };
    const markConfig = { api: { space_id: 'my-space' }, fetch: { closed_task_action: 'mark' } };

    const result = buildOutput([issue1], existing, markConfig, fixedNow);

    assert.equal(result.meta.total, 2);
    const closedTask = result.tasks.find(t => t.backlog.id === '99');
    assert.ok(closedTask);
    assert.equal(closedTask.backlog.status, 'closed');
    assert.equal(closedTask.custom.release_date, '2024-02-01');
  });

  it('closed_task_action が mark でない場合は追加しない', () => {
    const existing = { '99': { release_date: null, note: '' } };
    const result = buildOutput([issue1], existing, config, fixedNow);
    assert.equal(result.meta.total, 1);
  });
});

// ---------------------------------------------------------------------------
// groupByReleaseDate
// ---------------------------------------------------------------------------
describe('groupByReleaseDate', () => {
  const makeTask = (release_date) => ({ custom: { release_date } });

  it('リリース日ごとにグループ化する', () => {
    const tasks = [
      makeTask('2024-04-01'),
      makeTask('2024-03-15'),
      makeTask('2024-04-01'),
    ];
    const result = groupByReleaseDate(tasks);
    assert.equal(result.length, 2);
    assert.equal(result[0][0], '2024-03-15');
    assert.equal(result[0][1].length, 1);
    assert.equal(result[1][0], '2024-04-01');
    assert.equal(result[1][1].length, 2);
  });

  it('release_date が null のタスクは __untagged__ キーに集約され末尾に来る', () => {
    const tasks = [
      makeTask('2024-04-01'),
      makeTask(null),
      makeTask(null),
    ];
    const result = groupByReleaseDate(tasks);
    assert.equal(result[result.length - 1][0], '__untagged__');
    assert.equal(result[result.length - 1][1].length, 2);
  });

  it('全タスクが untagged の場合', () => {
    const tasks = [makeTask(null), makeTask(null)];
    const result = groupByReleaseDate(tasks);
    assert.equal(result.length, 1);
    assert.equal(result[0][0], '__untagged__');
  });

  it('空配列は空配列を返す', () => {
    assert.deepEqual(groupByReleaseDate([]), []);
  });
});
