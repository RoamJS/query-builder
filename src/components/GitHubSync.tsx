import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import getDiscourseNodes from "../utils/getDiscourseNodes";
import matchDiscourseNode from "../utils/matchDiscourseNode";
import { OnloadArgs, PullBlock, RoamBasicNode } from "roamjs-components/types";
import { Button, Card, Classes, Dialog, Tag } from "@blueprintjs/core";
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
import { handleTitleAdditions } from "../utils/handleTitleAdditions";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import getUids from "roamjs-components/dom/getUids";
import createBlockObserver from "roamjs-components/dom/createBlockObserver";
import ReactDOM from "react-dom";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import getUidsFromButton from "roamjs-components/dom/getUidsFromButton";
import getPageUidByBlockUid from "roamjs-components/queries/getPageUidByBlockUid";
import apiPost from "roamjs-components/util/apiPost";
import renderOverlay from "roamjs-components/util/renderOverlay";
import {
  WINDOW_HEIGHT,
  WINDOW_LEFT,
  WINDOW_TOP,
  WINDOW_WIDTH,
  fetchInstallationStatus,
} from "./ExportGithub";
import localStorageSet from "roamjs-components/util/localStorageSet";
import { getNodeEnv } from "roamjs-components/util/env";
import nanoid from "nanoid";

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
  html_url: string;
  state: string;
};
type GitHubIssueResponse = {
  data: GitHubIssue[];
  status: number;
};
type GitHubCommentBlock = {
  "github-sync": {
    comment: GitHubComment;
  };
};
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
type GitHubCommentResponse = GitHubComment & { status: number };
type GitHubCommentsResponse = {
  data: GitHubComment[];
  status: number;
};

// type GitHubCommentBlock = {
//   uid: string;
//   props: GitHubComment;
//   string: string;
// };

const CONFIG_PAGE = "roam/js/github-sync";
const SETTING = "github-sync";
let enabled = false;

// Utils
const getPageIssueNumber = (pageUid: string) => {
  const blockProps = getBlockProps(pageUid) as GitHubIssuePage;
  const issueNumber = blockProps?.["github-sync"]?.["issue"]?.["number"];
  return issueNumber;
};
const getRoamCommentsContainerUid = async ({
  pageUid,
  extensionAPI,
}: {
  pageUid: string;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const pageTitle = getPageTitleByPageUid(pageUid);
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
    inputs: { NODETEXT: pageTitle, NODEUID: pageUid },
  });

  return results.results[0]?.uid;
};
export const insertNewCommentsFromGitHub = async ({
  pageUid,
  extensionAPI,
}: {
  pageUid: string;
  extensionAPI: OnloadArgs["extensionAPI"];
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

  const issueNumber = getPageIssueNumber(pageUid);
  if (!issueNumber) {
    renderToast({
      id: "github-issue-comments",
      content: "No Issue Number Found.  Please send to GitHub first.",
    });
    return;
  }

  const commentsContainerUid = await getRoamCommentsContainerUid({
    pageUid,
    extensionAPI,
  });

  const gitHubAccessToken = localStorageGet("oauth-github");
  const selectedRepo = localStorageGet("selected-repo");

  try {
    const response = await apiGet<GitHubCommentsResponse>({
      domain: "https://api.github.com",
      path: `repos/${selectedRepo}/issues/${issueNumber}/comments`,
      headers: {
        Authorization: `token ${gitHubAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200) {
      const commentsOnGithub = response.data.map((c) => ({
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
          content: "No new comments found.",
        });
        return;
      }

      if (!commentsContainerUid) {
        renderToast({
          id: "github-issue-comments",
          content: "Comments Block not found.  Please create one.",
        });
        return;
      }

      renderOverlay({
        Overlay: NewCommentsConfirmationDialog,
        props: {
          comments: newComments,
          commentsContainerUid,
        },
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
export const isGitHubSyncPage = (pageTitle: string) => {
  if (!enabled) return;
  const gitHubNodeResult = window.roamAlphaAPI.data.fast.q(`[:find
    (pull ?node [:block/string])
    :where
      [?roamjsgithub-sync :node/title "roam/js/github-sync"]
      [?node :block/page ?roamjsgithub-sync]
      [?p :block/children ?node]
    (or     [?p :block/string ?p-String]
      [?p :node/title ?p-String])
    [(clojure.string/includes? ?p-String "Node Select")]
    ]`) as [PullBlock][];
  const nodeText = gitHubNodeResult[0]?.[0]?.[":block/string"] || "";
  if (!nodeText) return;

  const discourseNodes = getDiscourseNodes();
  const selectedNode = discourseNodes.find((node) => node.text === nodeText);
  const isPageTypeOfNode = matchDiscourseNode({
    format: selectedNode?.format || "",
    specification: selectedNode?.specification || [],
    text: selectedNode?.text || "",
    title: pageTitle,
  });
  return isPageTypeOfNode;
};
export const renderGitHubSyncConfigPage = ({
  title,
  h,
}: {
  title: string;
  h: HTMLHeadingElement;
}) => {
  if (!enabled) return;
  renderConfigPage({
    title,
    h,
    config: {
      tabs: [
        {
          id: "home",
          fields: [
            {
              // TODO: should this create node "type" as a block to be able to have multiple defined?
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

export const renderGitHubSyncPage = async ({
  h1,
  pageUid,
  onloadArgs,
}: {
  h1: HTMLHeadingElement;
  pageUid: string;
  onloadArgs: OnloadArgs;
}) => {
  const extensionAPI = onloadArgs.extensionAPI;

  const commentsContainerUid = await getRoamCommentsContainerUid({
    pageUid,
    extensionAPI,
  });
  const commentHeaderEl = document.querySelector(
    `.rm-block__input[id$="${commentsContainerUid}"]`
  );
  if (commentHeaderEl && commentsContainerUid) {
    // TODO: seems like there is some redundancy here but I'm not sure
    if (commentHeaderEl.hasAttribute("github-sync-loaded")) return;
    commentHeaderEl.setAttribute("github-sync-loaded", "true");
    const containerDiv = document.createElement("div");
    containerDiv.className = "inline-block ml-2";
    commentHeaderEl.appendChild(containerDiv);
    ReactDOM.render(
      <GitHubSyncPage
        commentsContainerUid={commentsContainerUid}
        extensionAPI={extensionAPI}
      />,
      containerDiv
    );
  }
  commentHeaderEl;
  handleTitleAdditions(h1, <TitleButtons pageUid={pageUid} />);
};
const formatComment = (c: GitHubComment) => {
  const roamCreatedDate = window.roamAlphaAPI.util.dateToPageTitle(
    new Date(c.created_at)
  );
  const roamUpdatedDate = window.roamAlphaAPI.util.dateToPageTitle(
    new Date(c.updated_at)
  );
  const commentHeader = `${c.user.login} on [[${roamCreatedDate}]]`;
  const commentBody = c.body.trim();
  return {
    header: commentHeader,
    body: commentBody,
    props: {
      "github-sync": {
        comment: c,
      },
    },
  };
};

// Components
const CommentsComponent = ({ blockUid }: { blockUid: string }) => {
  const [loading, setLoading] = useState(false);
  const url = useMemo(() => {
    const props = getBlockProps(blockUid) as GitHubCommentBlock;
    const commentProps = props?.["github-sync"]?.["comment"];
    return commentProps?.html_url;
  }, [blockUid, loading]);

  return (
    <>
      <Button
        title={
          !!url
            ? "Comment was already sent. Click to view on GitHub."
            : "Add to GitHub"
        }
        text={!!url ? "" : "Add to GitHub"}
        icon={!!url ? "link" : "git-push"}
        minimal
        small
        loading={loading}
        outlined={!url}
        onClick={async (e) => {
          // const el = e.target as HTMLButtonElement;
          // const { blockUid: triggerUid } = getUidsFromButton(el);
          // const tree = getBasicTreeByParentUid(triggerUid);
          // const flatten = (nodes: RoamBasicNode[] = []): RoamBasicNode[] =>
          //   nodes.flatMap((node) => [node, ...flatten(node["children"])]);
          // const flattened = flatten(tree);
          // const comment = flattened.map((c) => c.text).join("\n\n");
          // console.log(comment);

          if (!!url) {
            window.open(url, "_blank");
            return;
          }
          setLoading(true);
          const gitHubAccessToken = localStorageGet("oauth-github");
          const selectedRepo = localStorageGet("selected-repo");
          const el = e.target as HTMLButtonElement;
          const { blockUid: triggerUid } = getUidsFromButton(el);
          const pageUid = getPageUidByBlockUid(triggerUid);
          const issueNumber = getPageIssueNumber(pageUid);
          if (!issueNumber) {
            renderToast({
              id: "github-issue-comments",
              content: "No Issue Number Found.  Please send to GitHub first.",
            });
            return;
          }

          const commentsTree = getBasicTreeByParentUid(blockUid);
          const flatten = (nodes: RoamBasicNode[] = []): RoamBasicNode[] =>
            nodes.flatMap((node) => [node, ...flatten(node["children"])]);
          const flattened = flatten(commentsTree);
          const comment = flattened.map((c) => c.text).join("\n\n");
          try {
            const response = await apiPost<GitHubCommentResponse>({
              domain: "https://api.github.com",
              path: `repos/${selectedRepo}/issues/${issueNumber}/comments`,
              headers: {
                Authorization: `token ${gitHubAccessToken}`,
                "Content-Type": "application/json",
              },
              data: {
                body: comment,
              },
            });
            if (response.status === 201) {
              const triggerProps = getBlockProps(triggerUid);
              const newProps = {
                ...triggerProps,
                ["github-sync"]: {
                  comment: {
                    id: response.id,
                    html_url: response.html_url,
                    author: response.user.login,
                    createdAt: response.created_at,
                    updatedAt: response.updated_at,
                  },
                },
              };

              await window.roamAlphaAPI.updateBlock({
                block: {
                  uid: triggerUid,
                  props: newProps,
                },
              });
              renderToast({
                intent: "success",
                id: "github-issue-comments",
                content: "Comment Added",
              });
            }
          } catch (error) {
            const e = error as Error;
            const message = e.message;
            console.log(e);
            renderToast({
              intent: "danger",
              id: "github-issue-comments",
              content: `Failed to add comment: ${message}`,
            });
          }
          setLoading(false);

          return null;
        }}
      />
    </>
  );
};
const CommentsContainerComponent = ({
  commentsContainerUid,
  extensionAPI,
}: {
  commentsContainerUid: string;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const [loadingComments, setLoadingComments] = useState(false);
  return (
    <div className="flex space-x-2">
      <Button
        text="Add Comment"
        icon="add"
        minimal
        small
        outlined
        onClick={async () => {
          const today = window.roamAlphaAPI.util.dateToPageTitle(new Date());
          const currentUserDisplayName = getCurrentUserDisplayName();
          const commentHeader = `[[${currentUserDisplayName}]] on [[${today}]]`;
          const newBlock = await createBlock({
            node: {
              text: commentHeader,
              children: [{ text: "" }],
            },
            parentUid: commentsContainerUid,
            order: "last",
          });
          setTimeout(() => {
            const commentBlockUid = getFirstChildUidByBlockUid(newBlock);
            const commentBlockEl = document.querySelector(
              `.rm-block__input[id$="${commentBlockUid}"]`
            ) as HTMLDivElement;
            if (!commentBlockEl) return;
            window.roamAlphaAPI.ui.setBlockFocusAndSelection({
              location: {
                "block-uid": commentBlockUid,
                "window-id": getUids(commentBlockEl).windowId,
              },
              selection: {
                start: 0,
                end: 0,
              },
            });
          }, 100);
        }}
      />
      <Button
        icon="import"
        title="Check for New Comments"
        minimal
        small
        outlined
        style={{ paddingLeft: "1rem", paddingRight: "1rem" }}
        className="transition"
        loading={loadingComments}
        onClick={async () => {
          setLoadingComments(true);
          const pageUid = getPageUidByBlockUid(commentsContainerUid);
          await insertNewCommentsFromGitHub({ pageUid, extensionAPI });
          setLoadingComments(false);
        }}
      />
    </div>
  );
};
const GitHubSyncPage = ({
  commentsContainerUid,
  extensionAPI,
}: {
  commentsContainerUid: string;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  useEffect(() => {
    const headerCommentObserver = createBlockObserver({
      onBlockLoad: (b) => {
        const { blockUid } = getUids(b);
        if (blockUid === commentsContainerUid) {
          if (b.hasAttribute("github-sync-comment-header")) return;
          b.setAttribute("github-sync-comment-header", "true");
          const containerDiv = document.createElement("div");
          containerDiv.className = "inline-block ml-2";
          containerDiv.onmousedown = (e) => e.stopPropagation();
          b.append(containerDiv);
          ReactDOM.render(
            <CommentsContainerComponent
              commentsContainerUid={commentsContainerUid}
              extensionAPI={extensionAPI}
            />,
            containerDiv
          );
        }
      },
    });
    const childCommentObserver = createBlockObserver({
      onBlockLoad: (b) => {
        const { blockUid } = getUids(b);
        const parentUid = getParentUidByBlockUid(blockUid);
        if (parentUid === commentsContainerUid) {
          if (b.hasAttribute("github-sync-comment")) return;
          b.setAttribute("github-sync-comment", "true");
          const containerDiv = document.createElement("div");
          containerDiv.className = "inline-block ml-2";
          containerDiv.onmousedown = (e) => e.stopPropagation();
          b.append(containerDiv);
          ReactDOM.render(
            <CommentsComponent blockUid={blockUid} />,
            containerDiv
          );
        }
      },
    });

    return () => {
      headerCommentObserver.forEach((o) => o.disconnect());
      childCommentObserver.forEach((o) => o.disconnect());
      // console.log("Disconnecting GitHubSyncComments useEffect"); // this isn't logging?
    };
  }, [commentsContainerUid]);

  return null;
};
export const TitleButtons = ({ pageUid }: { pageUid: string }) => {
  const [loading, setLoading] = useState({
    sendToGitHub: false,
    syncWithGitHub: false,
  });
  const pageTitle = getPageTitleByPageUid(pageUid);
  const issueNumber = useMemo(() => {
    const props = getBlockProps(pageUid) as GitHubIssuePage;
    return props?.["github-sync"]?.["issue"]?.["number"];
  }, [pageUid, loading.sendToGitHub]);

  return (
    <div className="github-sync-container flex space-x-2">
      <Button
        text="Send To GitHub"
        icon="git-push"
        minimal
        outlined
        hidden={!!issueNumber}
        onClick={() => {
          setLoading({ ...loading, sendToGitHub: true });
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
            onCloseCallback: () => {
              setTimeout(() => {
                setLoading({ ...loading, sendToGitHub: false });
              }, 500);
            },
          });
        }}
      />
      {/* TODO: sync with github */}
      {/* Title, Status, Assignee, Labels */}
      {/* <Button
        text="Sync with GitHub"
        icon="refresh"
        minimal
        outlined
        loading={loading.syncWithGitHub}
        hidden={!issueNumber}
        onClick={async () => {
          setLoading({ ...loading, syncWithGitHub: true });
          await new Promise((resolve) => setTimeout(resolve, 2000));
          setLoading({ ...loading, syncWithGitHub: false });
        }}
      /> */}
      <Button
        text={!!issueNumber ? "GitHub Sync Details" : ""}
        icon="cog"
        minimal
        outlined
        onClick={async () => {
          renderOverlay({
            Overlay: SettingsDialog,
            props: { pageUid },
          });
        }}
      />
    </div>
  );
};
const NewCommentsConfirmationDialog = ({
  comments,
  commentsContainerUid,
}: {
  comments: GitHubComment[];
  commentsContainerUid: string;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  // const [openInSidebar, setOpenInSidebar] = useState(false);
  return (
    <Dialog
      isOpen={isOpen}
      title="New Comments from GitHub"
      icon="comment"
      autoFocus={false}
      enforceFocus={false}
      onClose={() => setIsOpen(false)}
    >
      <div className={Classes.DIALOG_BODY}>
        <div className="flex flex-col space-y-4">
          {comments.map((c) => {
            const formattedComment = formatComment(c);
            return (
              <Card>
                <ul>
                  <li>{formattedComment.header}</li>
                  <ul>
                    <li>{formattedComment.body}</li>
                  </ul>
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div
          className={`${Classes.DIALOG_FOOTER_ACTIONS} flex flex-col items-end space-y-2`}
        >
          {/* <Checkbox
            label="Open in Sidebar"
            checked={openInSidebar}
            className="m-0"
            onChange={() => setOpenInSidebar(!openInSidebar)}
            alignIndicator="right"
          /> */}
          <Button
            text="Add Comments"
            icon="add"
            intent="primary"
            onClick={async () => {
              await Promise.all(
                comments.map(async (c) => {
                  const roamCreatedDate =
                    window.roamAlphaAPI.util.dateToPageTitle(
                      new Date(c.created_at)
                    );
                  const commentHeader = `${c.user.login} on [[${roamCreatedDate}]]`;
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
                    parentUid: commentsContainerUid,
                    order: "last",
                  });
                })
              );
              renderToast({
                intent: "success",
                id: "github-issue-comments",
                content: "GitHub Comments Added",
              });
              setIsOpen(false);
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};
const SettingsDialog = ({ pageUid }: { pageUid: string }) => {
  const authWindow = useRef<Window | null>(null);

  const [isGitHubAppInstalled, setIsGitHubAppInstalled] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [error, setError] = useState("");
  const [clickedInstall, setClickedInstall] = useState(false);
  const [state, setState] = useState("");

  const [gitHubAccessToken, setGitHubAccessToken] = useState<string | null>(
    localStorageGet("oauth-github")
  );

  const issueProps = useMemo(() => {
    const props = getBlockProps(pageUid) as GitHubIssuePage;
    return props?.["github-sync"]?.["issue"];
  }, [pageUid]);

  const isDev = useMemo(() => getNodeEnv() === "development", []);
  const configPageUid = useMemo(() => getPageUidByPageTitle(CONFIG_PAGE), []);

  const showGitHubLogin = isGitHubAppInstalled && !gitHubAccessToken;
  const repoSelectEnabled = isGitHubAppInstalled && gitHubAccessToken;

  const fetchAndSetInstallation = useCallback(async () => {
    try {
      const isAppInstalled = await fetchInstallationStatus();
      setIsGitHubAppInstalled(isAppInstalled);
    } catch (error) {
      const e = error as Error;
      if (e.message === "Bad credentials") {
        setGitHubAccessToken(null);
        localStorageSet("oauth-github", "");
      }
    }
  }, [fetchInstallationStatus]);

  // listen for messages from the auth window
  useEffect(() => {
    const otp = nanoid().replace(/_/g, "-");
    const key = nanoid().replace(/_/g, "-");
    const state = `github_${otp}_${key}`;
    setState(state);
    const handleGitHubAuthMessage = (event: MessageEvent) => {
      const targetOrigin = isDev
        ? "https://samepage.ngrok.io"
        : "https://samepage.network";
      if (event.data && event.origin === targetOrigin) {
        localStorageSet("oauth-github", event.data);
        setGitHubAccessToken(event.data);
        setClickedInstall(false);
        authWindow.current?.close();
      }
    };

    window.addEventListener("message", handleGitHubAuthMessage);

    return () => {
      window.removeEventListener("message", handleGitHubAuthMessage);
    };
  }, []);

  // check for installation
  useEffect(() => {
    if (gitHubAccessToken) fetchAndSetInstallation();
  }, [gitHubAccessToken]);

  return (
    <Dialog
      isOpen={isOpen}
      title="GitHub Sync Details"
      icon="cog"
      autoFocus={false}
      enforceFocus={false}
      onClose={() => setIsOpen(false)}
    >
      <div className={Classes.DIALOG_BODY}>
        <div className="flex flex-col justify-center mb-4">
          {issueProps && (
            <>
              <h3>Issue Details</h3>
              <Button
                text="Open in GitHub"
                icon="git-repo"
                onClick={() => {
                  window.open(issueProps.html_url, "_blank");
                }}
                className="mb-4 w-52"
              />
              <div className="grid grid-cols-2 gap-4">
                <span className="font-semibold">Number:</span>
                <span>{issueProps.number}</span>
                <span className="font-semibold">Status:</span>
                <span className="capitalize">{issueProps.state}</span>
                <span className="font-semibold">Created:</span>
                <span>{new Date(issueProps.createdAt).toLocaleString()}</span>
                <span className="font-semibold">Last Updated:</span>
                <span>{new Date(issueProps.updatedAt).toLocaleString()}</span>
              </div>
            </>
          )}
          <h3>Authorization</h3>
          {(!isGitHubAppInstalled || clickedInstall) && (
            <div className="flex flex-col">
              {!isGitHubAppInstalled && (
                <Button
                  text="Install SamePage App"
                  id="qb-install-button"
                  icon="cloud-download"
                  className={
                    clickedInstall ? "opacity-30 hover:opacity-100" : ""
                  }
                  intent={clickedInstall ? "none" : "primary"}
                  onClick={async () => {
                    authWindow.current = window.open(
                      isDev
                        ? "https://github.com/apps/samepage-network-dev"
                        : "https://github.com/apps/samepage-network",
                      "_blank",
                      `width=${WINDOW_WIDTH}, height=${WINDOW_HEIGHT}, top=${WINDOW_TOP}, left=${WINDOW_LEFT}`
                    );
                    setClickedInstall(true);
                    document.getElementById("qb-install-button")?.blur();
                  }}
                />
              )}
              {clickedInstall && (
                <Button
                  text="Confirm Installation"
                  icon="confirm"
                  intent="primary"
                  onClick={async () => {
                    setClickedInstall(false);
                    setIsGitHubAppInstalled(true);
                  }}
                />
              )}
            </div>
          )}

          {showGitHubLogin && (
            <Button
              text="Authorize"
              icon="key"
              intent="primary"
              onClick={async () => {
                const params = isDev
                  ? `client_id=Iv1.4bf062a6c6636672&state=${state}`
                  : `client_id=Iv1.e7e282a385b7b2da&state=${state}`;
                authWindow.current = window.open(
                  `https://github.com/login/oauth/authorize?${params}`,
                  "_blank",
                  `width=${WINDOW_WIDTH}, height=${WINDOW_HEIGHT}, top=${WINDOW_TOP}, left=${WINDOW_LEFT}`
                );

                let attemptCount = 0;
                const check = () => {
                  if (attemptCount < 10) {
                    apiPost({
                      path: "access-token",
                      domain: isDev
                        ? "https://api.samepage.ngrok.io"
                        : "https://api.samepage.network",
                      data: { state },
                    }).then((r) => {
                      if (r.accessToken) {
                        localStorageSet("oauth-github", r.accessToken);
                        setGitHubAccessToken(r.accessToken);
                        setClickedInstall(false);
                        authWindow.current?.close();
                      } else {
                        attemptCount++;
                        setTimeout(check, 1000);
                      }
                    });
                  } else {
                    setError("Something went wrong.  Please contact support.");
                  }
                };
                setTimeout(check, 1500);
              }}
            />
          )}
          {repoSelectEnabled && (
            <Tag intent="success" large className="text-center w-52">
              Authorized
            </Tag>
          )}
          <h3>GitHub Sync Settings</h3>
          <a
            href={`https://roamresearch.com/#/app/${window.roamAlphaAPI.graph.name}/page/${configPageUid}`}
          >
            {`[[${CONFIG_PAGE}]]`}
          </a>
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span style={{ color: "darkred" }}>{error}</span>
        </div>
      </div>
    </Dialog>
  );
};

// Init
const initializeGitHubSync = async (args: OnloadArgs) => {
  const unloads = new Set<() => void>();
  const toggle = async (flag: boolean) => {
    if (flag && !enabled) {
    } else if (!flag && enabled) {
      unloads.forEach((u) => u());
      unloads.clear();
    }
    enabled = flag;
  };
  await toggle(!!args.extensionAPI.settings.get(SETTING));
  return toggle;
};
export default initializeGitHubSync;
