// For the page
// ["github-sync"]: {
//     issue: {
//     id: response.id,
//     number: response.number,
//     html_url: response.html_url,
//     state: response.state,
//     labels: response.labels,
//     createdAt: response.created_at,
//     updatedAt: response.updated_at,
//     }
//   },

// For a comment
// ["github-sync"]: {
//   comment: {
//     id: commentResponse.id,
//     html_url: commentResponse.html_url,
//     author: commentResponse.user.login,
//     createdAt: commentResponse.created_at,
//     updatedAt: commentResponse.updated_at
//   }
// }

const registerSmartBlocksCommand = (args) => {
  if (window.roamjs?.extension?.smartblocks) {
    window.roamjs.extension.smartblocks.registerCommand(args);
  } else {
    document.body.addEventListener(
      `roamjs:smartblocks:loaded`,
      () =>
        window.roamjs?.extension.smartblocks &&
        window.roamjs.extension.smartblocks.registerCommand(args)
    );
  }
};

const getTextByBlockUid = (uid = "") =>
  (uid &&
    window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid])?.[
      ":block/string"
    ]) ||
  "";

const getBlockProps = (uid) => {
  return (
    window.roamAlphaAPI.pull("[:block/props]", [":block/uid", uid])?.[
      ":block/props"
    ] || {}
  );
};
const getPageUidbyBlockUid = (uid) => {
  return window.roamAlphaAPI.q(
    `[:find (pull ?p [:block/uid]) :where [?e :block/uid "${uid}"] [?e :block/page ?p]]`
  )?.[0]?.[0].uid;
};

registerSmartBlocksCommand({
  text: "postGitHubIssueComment",
  handler: (context) => async (issueNumber, comment) => {
    const gitHubAccessToken = localStorage.getItem(
      "roamjs:oauth-github:roamjs-dev"
    );
    const selectedRepo = localStorage.getItem(
      "roamjs:selected-repo:roamjs-dev"
    );

    console.log(issueNumber);
    console.log(comment);
    // console.log(gitHubAccessToken)
    // console.log(selectedRepo)

    const apiUrl = `https://api.github.com/repos/${selectedRepo}/issues/${issueNumber}/comments`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `token ${gitHubAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: comment }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to add comment: ${response.status} ${message}`);
    }
    console.log("Comment added successfully.", response);
    const body = await response.json();

    const uid = context.triggerUid;
    const blockText = getTextByBlockUid(uid);
    const newBlockText = blockText
      .replace(/\{\{[^{}]*:SmartBlock:[^{}]*\}\}/g, "")
      .concat(`[link](${body.html_url})`);
    const props = getBlockProps(uid);
    const newProps = {
      ...props,
      ["github-sync"]: {
        comment: {
          id: body.id,
          html_url: body.html_url,
          author: body.user.login,
          createdAt: body.created_at,
          updatedAt: body.updated_at,
        },
      },
    };

    window.roamAlphaAPI.updateBlock({
      block: { uid, string: newBlockText, props: newProps },
    });

    return "";
  },
});

registerSmartBlocksCommand({
  text: "getPageIssueNumber",
  handler: (context) => async () => {
    const uid = context.triggerUid;
    const pageUid = getPageUidbyBlockUid(uid);
    const blockProps = getBlockProps(pageUid);
    const issueNumber = blockProps?.[":github-sync"]?.[":issue"]?.[":number"];
    console.log("Issue Number", issueNumber ? issueNumber : "No Issue Number");

    return issueNumber ? issueNumber.toString() : "No Issue Number";
  },
});
