/**
 * transform.js — Backlog API レスポンスを tasks.yaml 形式に変換するユーティリティ
 */

export const toDate = s => s ? s.slice(0, 10) : null;
export const toName = obj => obj?.name ?? null;
export const toNames = arr => (arr ?? []).map(o => o.name);

/**
 * Backlog API レスポンス 1件 → tasks.yaml のタスク形式に変換
 * @param {object} issue  - Backlog issue オブジェクト
 * @param {object} existing - { [id]: { release_date, note } }
 */
export function convertIssue(issue, existing) {
  const id = String(issue.id);
  const prev = existing[id] ?? {};

  return {
    backlog: {
      id,
      issue_key:  issue.issueKey,
      title:      issue.summary,
      status:     toName(issue.status),
      priority:   toName(issue.priority),
      issue_type: toName(issue.issueType),
      assignee:   toName(issue.assignee),
      milestone:  toNames(issue.milestone),
      category:   toNames(issue.category),
      due_date:   toDate(issue.dueDate),
      created_at: toDate(issue.created),
      updated_at: toDate(issue.updated),
    },
    custom: {
      release_date: prev.release_date ?? null,
      note:         prev.note         ?? '',
    },
  };
}

/**
 * 取得した課題一覧と既存データから tasks.yaml の出力オブジェクトを構築
 * @param {object[]} rawIssues - Backlog API から取得した課題配列
 * @param {object}   existing  - { [id]: { release_date, note } }
 * @param {object}   config    - 設定オブジェクト
 * @param {string}   [now]     - ISO 8601 文字列 (テスト用に差し替え可)
 */
export function buildOutput(rawIssues, existing, config, now = new Date().toISOString()) {
  let tasks = rawIssues.map(issue => convertIssue(issue, existing));

  // closed_task_action: mark — API から消えたタスクを "closed" としてマーク
  if (config.fetch?.closed_task_action === 'mark') {
    const fetchedIds = new Set(rawIssues.map(i => String(i.id)));
    for (const [id, prev] of Object.entries(existing)) {
      if (!fetchedIds.has(id)) {
        tasks.push({
          backlog: { id, status: 'closed' },
          custom:  { release_date: prev.release_date, note: prev.note },
        });
      }
    }
  }

  return {
    meta: {
      fetched_at: now,
      space_id:   config.api.space_id,
      total:      tasks.length,
    },
    tasks,
  };
}

/**
 * タスク配列をリリース日ごとにグループ化し、日付順に並べた配列を返す
 * @param {object[]} tasks
 * @returns {Array<[string, object[]]>} [key, tasks][] — key は日付文字列または '__untagged__'
 */
export function groupByReleaseDate(tasks) {
  const groups = new Map();

  for (const task of tasks) {
    const date = task?.custom?.release_date ?? null;
    const key  = date ?? '__untagged__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === '__untagged__') return 1;
    if (b === '__untagged__') return -1;
    return a.localeCompare(b);
  });
}
