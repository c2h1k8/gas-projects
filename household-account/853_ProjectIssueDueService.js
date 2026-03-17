const ProjectIssueDueService = (function () {
  // ===== config =====
  const OWNER = "c2h1k8";
  const PROJECT_NUMBER = 1;
  const DUE_FIELD_NAME = "Due";

  // ===== public =====
  function getDueSummary() {
    const openIssues = fetchOpenIssuesWithDue_();
    return classifyByDueDate_(openIssues);
  }

  function listOverdue() {
    return getDueSummary().overdue;
  }

  function listDueToday() {
    return getDueSummary().dueToday;
  }

  // ===== private: main flow =====
  function fetchOpenIssuesWithDue_() {
    const token = Props.getValue(PKeys.GITHUB_TOKEN);
    if (!token) throw new Error("GITHUB_TOKEN が未設定です");

    const { projectId, dueFieldId } =
      resolveProjectAndDueFieldIds_(token, OWNER, PROJECT_NUMBER, DUE_FIELD_NAME);

    const items = fetchAllProjectItemsWithDue_(token, projectId, dueFieldId);

    // OPEN + dueあり + 非アーカイブ（fetch側でも除外してるが保険で）
    return items.filter(it => it.state === "OPEN" && !it.isArchived && !!it.dueDate);
  }

  function classifyByDueDate_(issues) {
    const today = startOfToday_();

    const overdue = [];
    const dueToday = [];

    for (const it of issues) {
      const due = parseDateOnly_(it.dueDate); // YYYY-MM-DD を時差ズレなく扱う
      if (due < today) overdue.push(it);
      else if (due.getTime() === today.getTime()) dueToday.push(it);
    }

    return { overdue, dueToday };
  }

  function startOfToday_() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function parseDateOnly_(yyyyMmDd) {
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // ===== private: GitHub (Projects v2) =====

  /**
   * user の Project v2 ID と、期限フィールド(Date)のフィールドIDを解決
   */
  function resolveProjectAndDueFieldIds_(token, owner, projectNumber, dueFieldName) {
    const query = `
      query($login: String!, $number: Int!) {
        user(login: $login) {
          projectV2(number: $number) {
            id
            fields(first: 100) {
              nodes {
                __typename
                ... on ProjectV2FieldCommon {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `;

    const data = githubGraphql_(token, query, { login: owner, number: projectNumber });
    const proj = data.user?.projectV2;
    if (!proj) throw new Error("User project が見つかりません（owner / projectNumber を確認）");

    const dueField = (proj.fields?.nodes || []).find(f => f?.name === dueFieldName);
    if (!dueField) throw new Error(`期限フィールド "${dueFieldName}" が見つかりません`);

    return { projectId: proj.id, dueFieldId: dueField.id };
  }

  /**
   * projectId を指定して全アイテムを取得し、期限フィールド(Date)の値を取り出す
   */
  function fetchAllProjectItemsWithDue_(token, projectId, dueFieldId) {
    const query = `
      query($projectId: ID!, $after: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 50, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                isArchived
                content {
                  __typename
                  ... on Issue { title url number state }
                  ... on PullRequest { title url number state }
                  ... on DraftIssue { title }
                }
                fieldValues(first: 50) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field { ... on ProjectV2FieldCommon { id name } }
                    }
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2FieldCommon { id name } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    let after = null;
    const out = [];

    while (true) {
      const data = githubGraphql_(token, query, { projectId, after });

      const items = data?.node?.items?.nodes;
      const pageInfo = data?.node?.items?.pageInfo;
      if (!items || !pageInfo) throw new Error("Project items の取得に失敗しました（権限/ID/レスポンスを確認）");

      for (const n of items) {
        const fv = n.fieldValues?.nodes || [];
        const dueNode = fv.find(x =>
          x?.__typename === "ProjectV2ItemFieldDateValue" &&
          x?.field?.id === dueFieldId
        );

        out.push({
          itemId: n.id,
          isArchived: n.isArchived,
          title: n.content?.title || "(no title)",
          url: n.content?.url || null,
          number: n.content?.number || null,
          state: n.content?.state || null,
          dueDate: dueNode?.date || null,
        });
      }

      if (!pageInfo.hasNextPage) break;
      after = pageInfo.endCursor;
    }

    // Draft/PR も混ざるが、後段で state===OPEN + dueDate ありに絞る
    return out.filter(x => !x.isArchived);
  }

  /**
   * GitHub GraphQL 呼び出し（GAS）
   */
  function githubGraphql_(token, query, variables) {
    const url = "https://api.github.com/graphql";
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "GAS",
      },
      payload: JSON.stringify({ query, variables }),
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    const body = res.getContentText();
    const json = JSON.parse(body);

    // data が取れているのに errors が混ざるケースがあるので、data が無ければエラーにする
    if (code >= 400) throw new Error(`GitHub GraphQL HTTP error: ${body}`);
    if (json.errors && !json.data) throw new Error(`GitHub GraphQL error: ${body}`);

    return json.data;
  }

  // ===== exports =====
  return {
    getDueSummary,
    listOverdue,
    listDueToday,
  };
})();

function testDue() {
  const { overdue, dueToday } = ProjectIssueDueService.getDueSummary();
  Logger.log(overdue.map(x => `${x.dueDate} ${x.title}`).join("\n"));
  Logger.log(dueToday.map(x => `${x.dueDate} ${x.title}`).join("\n"));
}