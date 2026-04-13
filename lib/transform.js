/**
 * transform.js — Backlog API レスポンスを tasks.yaml 形式に変換するユーティリティ
 */

export const toDate     = s   => s ? s.slice(0, 10) : null;
export const toName     = obj => obj?.name ?? null;
export const toNames    = arr => (arr ?? []).map(o => o.name);
export const toNamesStr = arr => (arr ?? []).map(o => o.name).join(', ');

/**
 * Backlog API レスポンス 1件 → tasks.yaml のタスク形式に変換
 * @param {object} issue    - Backlog issue オブジェクト
 * @param {object} existing - { [issue_key]: { release_date, note } }
 * @param {string} urlBase  - URL プレフィックス (例: https://space.backlog.jp/view)
 * @param {object} idToKey  - { [id]: issueKey } 親課題ID → issueKey の解決マップ
 * @param {Set} parentIds   - 子課題から参照されている課題IDのセット
 */
export function convertIssue(issue, existing, urlBase = '', idToKey = {}, parentIds = new Set()) {
  const key  = issue.issueKey;
  const prev = existing[key] ?? {};

  const customField = name => {
    const f = (issue.customFields ?? []).find(f => f.name === name);
    if (!f || f.value == null) return null;
    return f.value?.name ?? f.value;
  };

  return {
    backlog: {
      backlog_id:    issue.id,
      issue_key:     key,
      url:           urlBase ? `${urlBase}/${key}` : null,
      title:         issue.summary,
      status:        toName(issue.status),
      issue_type:    toName(issue.issueType),
      assignee:      toName(issue.assignee),
      category:      toNamesStr(issue.category),
      due_date:      toDate(issue.dueDate),
      created_at:    toDate(issue.created),
      dates:         `${toDate(issue.created) ?? ''} / ${toDate(issue.updated) ?? ''}`,
      release_phase: customField('リリース時期'),
      is_parent:        parentIds.has(issue.id),
      is_child:         issue.parentIssueId != null,
      parent_issue_key: issue.parentIssueId ? (idToKey[issue.parentIssueId] ?? null) : null,
    },
    custom: {
      release_date: prev.release_date ?? null,
      uat_in_date:  prev.uat_in_date  ?? null,
      note:         prev.note         ?? '',
      note2:        prev.note2        ?? '',
      attributes:   prev.attributes   ?? {},
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
  const domain  = config.api.domain ?? 'backlog.jp';
  const urlBase = `https://${config.api.space_id}.${domain}/view`;

  const idToKey   = Object.fromEntries(rawIssues.map(i => [i.id, i.issueKey]));
  const parentIds = new Set(rawIssues.map(i => i.parentIssueId).filter(Boolean));

  let tasks = rawIssues.map(issue => convertIssue(issue, existing, urlBase, idToKey, parentIds));

  // closed_task_action: mark — API から消えたタスクを "closed" としてマーク
  if (config.fetch?.closed_task_action === 'mark') {
    const fetchedKeys = new Set(rawIssues.map(i => i.issueKey));
    for (const [key, prev] of Object.entries(existing)) {
      if (!fetchedKeys.has(key)) {
        tasks.push({
          backlog: { issue_key: key, status: 'closed' },
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
    const key  = date != null
      ? (date instanceof Date ? date.toISOString().slice(0, 10) : String(date))
      : '__untagged__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === '__untagged__') return 1;
    if (b === '__untagged__') return -1;
    return a.localeCompare(b);
  });
}
