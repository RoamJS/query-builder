import React from "react";
import getDiscourseNodes from "../utils/getDiscourseNodes";
import matchDiscourseNode from "../utils/matchDiscourseNode";
import { OnloadArgs, PullBlock } from "roamjs-components/types";
import { Button } from "@blueprintjs/core";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import createBlock from "roamjs-components/writes/createBlock";
import resolveQueryBuilderRef from "../utils/resolveQueryBuilderRef";
import runQuery from "../utils/runQuery";
import { render as renderToast } from "roamjs-components/components/Toast";
import { render as renderConfigPage } from "roamjs-components/components/ConfigPage";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import { render as exportRender } from "../components/Export";
import getBlockProps from "../utils/getBlockProps";
import localStorageGet from "roamjs-components/util/localStorageGet";
import apiGet from "roamjs-components/util/apiGet";

type GitHubIssuePage = {
  "github-sync": {
    issue: GitHubIssue;
  };
};
type GitHubIssue = {
  number: number;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  id: number;
  url: string;
  state: string;
};
type GitHubIssueResponse = {
  data: GitHubIssue[];
  status: number;
};

// TODO COMBINE WITH GITHUB GITHUBCOMMENTRESPONSE
type GitHubComment = {
  id: number;
  body: string;
  html_url: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
};
type GitHubCommentResponse = {
  data: GitHubComment[];
  status: number;
};

type GitHubCommentBlock = {
  uid: string;
  props: GitHubComment;
  string: string;
};

const CONFIG_PAGE = "roam/js/github-sync";

const getPageIssueNumber = (pageUid: string) => {
  const blockProps = getBlockProps(pageUid) as GitHubIssuePage;
  const issueNumber = blockProps?.["github-sync"]?.["issue"]?.["number"];
  return issueNumber;
};

export const getGitHubIssueComments = async ({
  extensionAPI,
  pageUid,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
  pageUid: string;
}) => {
  const getCommentsOnPage = (pageUid: string) => {
    const query = `[:find
      (pull ?node [:block/string :block/uid :block/props])
       :where
      [?p :block/uid "${pageUid}"]
      [?node :block/page ?p]
      [?node :block/props ?props]
    ]`;
    const results = window.roamAlphaAPI.q(query);
    return results
      .filter((r: any) => r[0].props["github-sync"])
      .map((r: any) => {
        const node = r[0];
        return {
          id: node.props["github-sync"]["comment"]["id"],
          uid: node.uid,
          string: node.string,
        };
      });
  };

  const pageTitle = getPageTitleByPageUid(pageUid);
  const issueNumber = getPageIssueNumber(pageUid);
  if (!issueNumber) {
    renderToast({
      id: "github-issue-comments",
      content: "No Issue Number",
    });
    return;
  }

  const gitHubAccessToken = localStorageGet("oauth-github");
  const selectedRepo = localStorageGet("selected-repo");

  try {
    const response = await apiGet<GitHubCommentResponse>({
      domain: "https://api.github.com",
      path: `repos/${selectedRepo}/issues/${issueNumber}/comments`,
      headers: {
        Authorization: `token ${gitHubAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200) {
      const body = response.data;
      const commentsOnGithub = body.map((c) => ({
        id: c.id,
        body: c.body,
        html_url: c.html_url,
        user: {
          login: c.user.login,
        },
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));

      const commentsOnPage = getCommentsOnPage(pageUid);
      const commentsOnPageIds = new Set(commentsOnPage.map((gc) => gc.id));
      const newComments = commentsOnGithub.filter(
        (comment) => !commentsOnPageIds.has(comment.id)
      );

      if (newComments.length === 0) {
        renderToast({
          id: "github-issue-comments",
          content: "No new comments",
        });
        return;
      }

      const configUid = getPageUidByPageTitle(CONFIG_PAGE);
      const configTree = getBasicTreeByParentUid(configUid);
      const qbAlias = getSettingValueFromTree({
        tree: configTree,
        key: "Comments Block",
      });
      if (!qbAlias) {
        renderToast({
          id: "github-issue-comments",
          content: `Comments Block reference not set. Set it in ${CONFIG_PAGE}`,
        });
        return;
      }
      const qbAliasUid = resolveQueryBuilderRef({
        queryRef: qbAlias,
        extensionAPI,
      });
      const results = await runQuery({
        extensionAPI,
        parentUid: qbAliasUid,
        inputs: { NODETEXT: pageTitle, NODEUID: configUid },
      });
      const commentHeaderUid = results.results[0]?.uid;

      if (!commentHeaderUid) {
        renderToast({
          id: "github-issue-comments",
          content: "Comments Block not found.  Please create one.",
        });
        return;
      }
      await Promise.all(
        newComments.map(async (c) => {
          const roamCreatedDate = window.roamAlphaAPI.util.dateToPageTitle(
            new Date(c.created_at)
          );
          const roamUpdatedDate = window.roamAlphaAPI.util.dateToPageTitle(
            new Date(c.updated_at)
          );
          const commentHeader = `${c.user.login} on [[${roamCreatedDate}]] (from [GitHub](${c.html_url}))`;
          const commentBody = c.body.trim();
          await createBlock({
            node: {
              text: commentHeader,
              children: [{ text: commentBody }],
              props: {
                "github-sync": {
                  comment: c,
                },
              },
            },
            parentUid: commentHeaderUid,
          });
        })
      );
      renderToast({
        intent: "success",
        id: "github-issue-comments",
        content: "GitHub Comments Added",
      });
    }
  } catch (error) {
    const e = error as Error;
    const message = e.message;
    renderToast({
      intent: "danger",
      id: "github-issue-comments",
      content: `Failed to add comments: ${message}`,
    });
  }
};

export const renderGitHubSyncConfigPage = ({
  title,
  h,
}: {
  title: string;
  h: HTMLHeadingElement;
}) => {
  renderConfigPage({
    title,
    h,
    config: {
      tabs: [
        {
          id: "home",
          fields: [
            {
              // TODO: this should create node "type" as a block
              // TODO: should they be able to have multiple?
              // @ts-ignore
              Panel: SelectPanel,
              title: "Node Select",
              description: "Select a node to pull comments from",
              options: {
                items: [
                  "None",
                  ...getDiscourseNodes()
                    .map((node) => node.text)
                    .filter((text) => text !== "Block"),
                ],
              },
              defaultValue: "None",
            },
            {
              // @ts-ignore
              Panel: TextPanel,
              title: "Comments Block",
              description: "Use a Query Builder alias or block reference",
            },
          ],
        },
      ],
    },
  });
};

const GitHubSync = ({
  title,
  pageTitle,
  extensionAPI,
}: {
  title: string;
  pageTitle: string;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const pageUid = getPageUidByPageTitle(pageTitle);
  const result = window.roamAlphaAPI.data.fast.q(`[:find
    (pull ?node [:block/string])
  :where
    [?roamjsgithub-sync :node/title "roam/js/github-sync"]
    [?node :block/page ?roamjsgithub-sync]
    [?p :block/children ?node]
    (or     [?p :block/string ?p-String]
      [?p :node/title ?p-String])
    [(clojure.string/includes? ?p-String "Node Select")]
  ]`) as [PullBlock][];
  const nodeText = result[0]?.[0]?.[":block/string"] || "";
  if (!nodeText) return;

  const discourseNodes = getDiscourseNodes();
  const selectedNode = discourseNodes.find((node) => node.text === nodeText);
  const isTypeOfNode = matchDiscourseNode({
    format: selectedNode?.format || "",
    specification: selectedNode?.specification || [],
    text: selectedNode?.text || "",
    title,
  });
  if (!isTypeOfNode) return;

  return (
    <div className="github-sync-container flex space-x-2">
      <Button
        text="Send To GitHub"
        icon="send-to"
        minimal
        outlined
        onClick={() =>
          exportRender({
            results: [
              {
                uid: pageUid,
                text: pageTitle,
              },
            ],
            title: "Export Current Page",
            initialPanel: "export",
            initialExportType: "github-issue",
          })
        }
      />
      <Button text="Sync with GitHub" icon="refresh" minimal outlined />
      <Button
        text="Get New Comments"
        icon="comment"
        minimal
        outlined
        onClick={() => getGitHubIssueComments({ extensionAPI, pageUid })}
      />
      <Button
        text="Get Block Props"
        icon="add"
        minimal
        outlined
        onClick={() => getPageIssueNumber(pageUid)}
      />
    </div>
  );
};

export default GitHubSync;
