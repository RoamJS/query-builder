import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import PageInput from "roamjs-components/components/PageInput";
import type { RoamOverlayProps } from "roamjs-components/util/renderOverlay";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import { PullBlock, TreeNode } from "roamjs-components/types";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import nanoid from "nanoid";
import getSamePageApi from "@samepage/external/getSamePageAPI";

type Props = {
  uid?: string;
};

const SendQueryRequest = ({ onClose, uid }: RoamOverlayProps<Props>) => {
  const [loading, setLoading] = useState(false);
  const [graph, setGraph] = useState<string>("");
  const [page, setPage] = useState(() =>
    uid
      ? (
          window.roamAlphaAPI.data.fast.q(
            `[:find (pull ?p [:node/title]) :where [?r :block/uid "${uid}"] [?r :block/refs ?p]]`
          ) as [PullBlock][]
        )
          .map((p) => p[0]?.[":node/title"] || "")
          .reduce((prev, cur) => (cur.length > prev.length ? cur : prev), "")
      : ""
  );
  const requestId = useMemo(() => nanoid(), []);
  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Send Query Request`}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          Graph
          <InputGroup
            value={graph}
            onChange={(e) => setGraph(e.target.value)}
          />
        </Label>
        <Label>
          Page
          <PageInput value={page} setValue={setPage} />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
          <Button
            text={"Request"}
            intent={Intent.PRIMARY}
            onClick={async () => {
              setLoading(true);
              const {
                sendToNotebook,
                addNotebookListener,
                removeNotebookListener,
              } = await getSamePageApi();
              sendToNotebook({
                target: { app: 1, workspace: graph },
                operation: "QUERY_REQUEST",
                data: { page, requestId },
              });
              addNotebookListener({
                operation: "QUERY_REQUEST_RECEIVED",
                handler: (_, g) => {
                  if (g.workspace === graph) {
                    renderToast({
                      id: "query-request-success",
                      content: `Query Successfully Requested From ${g}`,
                      intent: Intent.SUCCESS,
                    });
                    removeNotebookListener({
                      operation: "QUERY_REQUEST_RECEIVED",
                    });
                    const operation = `QUERY_RESPONSE/${requestId}`;
                    addNotebookListener({
                      operation,
                      handler: (json, g) => {
                        if (g.workspace === graph) {
                          const { page } = json as {
                            page: {
                              title: string;
                              tree: TreeNode[];
                              uid: string;
                            };
                          };
                          const pageUid = getPageUidByPageTitle(page.title);
                          if (pageUid) {
                            page.tree.forEach((node, order) =>
                              createBlock({ parentUid: pageUid, node, order })
                            );
                          } else {
                            createPage(page);
                          }
                          renderToast({
                            id: "query-response-success",
                            content: `New Query Response From ${g.workspace}!`,
                            intent: Intent.SUCCESS,
                          });
                          removeNotebookListener({ operation });
                          sendToNotebook({
                            target: g.uuid,
                            operation: `QUERY_RESPONSE_RECEIVED/${requestId}`,
                          });
                          const todayUid =
                            window.roamAlphaAPI.util.dateToPageUid(new Date());
                          createBlock({
                            parentUid: todayUid,
                            node: {
                              text: `Received response for page ${page.title} from graph ${g.workspace}.`,
                            },
                            order: getChildrenLengthByPageUid(todayUid),
                          });
                        }
                      },
                    });
                    onClose();
                  }
                },
              });
            }}
            style={{ minWidth: 64 }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = createOverlayRender<Props>(
  "send-query-request",
  SendQueryRequest
);
