import { Button, Card } from "@blueprintjs/core";
import React, { useMemo } from "react";
import getSubTree from "roamjs-components/util/getSubTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { OnloadArgs, PullBlock } from "roamjs-components/types/native";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import getBlockUidsReferencingBlock from "roamjs-components/queries/getBlockUidsReferencingBlock";

type QueryPageComponent = (props: { blockUid: string }) => JSX.Element;

type Props = Parameters<QueryPageComponent>[0];

const MessageBlock = ({ blockUid }: Props) => {
  const thread = useMemo(() => {
    const allBlockUidsInThread = new Set([blockUid]);
    const getMessageInfo = (uid: string) => {
      const tree = getBasicTreeByParentUid(uid);
      const pull = window.roamAlphaAPI.pull(
        "[:block/string :create/user :create/time]",
        [":block/uid", uid]
      );
      const fromPage = window.roamAlphaAPI.pull(
        "[:user/display-page]",
        pull[":create/user"]?.[":db/id"] || 0
      )?.[":user/display-page"]?.[":db/id"];
      const from =
        window.roamAlphaAPI.pull("[:node/title]", fromPage || 0)?.[
          ":node/title"
        ] || "";
      const subject = pull[":block/string"] || "";
      const when = new Date(pull[":create/time"] || 0);
      const recipients = getSubTree({ tree, key: "to::" })
        .children.map((c) => /#([^\s]+)\s+\[\[([^\]]+)\]\]/.exec(c.text))
        .filter((s): s is RegExpExecArray => !!s)
        .map(([_, to, status]) => ({ to, status }));
      const body = getSubTree({ tree, key: "body::" }).children[0].text;
      return { subject, from, when, body, recipients };
    };
    const getReplies = (uid: string): string[] => {
      const referringUids = getBlockUidsReferencingBlock(uid).filter(
        (u) => u && !allBlockUidsInThread.has(u)
      );
      referringUids.forEach((u) => allBlockUidsInThread.add(u));
      return [uid, ...referringUids.flatMap(getReplies)];
    };
    const getAncestors = (uid: string): string[] => {
      const refs = (
        window.roamAlphaAPI.data.fast.q(
          `[:find (pull ?ref [:block/uid]) :where [?block :block/uid ${uid}] [?block :block/refs ?ref]]`
        ) as [PullBlock][]
      )
        .map((r) => r[0]?.[":block/uid"])
        .filter((u): u is string => !!u && !allBlockUidsInThread.has(u));
      refs.forEach((u) => allBlockUidsInThread.add(u));
      return [...refs.flatMap(getAncestors), uid];
    };
    const ancestors = getAncestors(blockUid);
    const replies = getReplies(blockUid);
    const uids = [...ancestors.slice(0, -1), blockUid, ...replies.slice(1)];
    return uids.map(getMessageInfo);
  }, [blockUid]);
  return (
    <Card
      id={`roamjs-message-block-${blockUid}`}
      className={"roamjs-message-block pt-0 px-4 pb-4 overflow-auto"}
    >
      <style>{`div[data-roamjs-message-block=true] .rm-block-children {
  display: none;
}`}</style>
      <h1>{thread[0].subject}</h1>
      {thread.map((t, i) => (
        <div className="hover:bg-opacity-75 roamjs-message" key={i}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <b className="block mb-1">{t.from}</b>
              <span style={{ fontSize: 12 }}>
                to{" "}
                {t.recipients
                  .map((r) => `${r.to}${/unread/i.test(r.status) ? "*" : ""}`)
                  .join(", ")}
              </span>
            </div>
            <div style={{ fontSize: 12, alignSelf: "end" }}>
              {t.when.toLocaleString()}
            </div>
          </div>
          <div className="pt-2 pb-4">{t.body}</div>
        </div>
      ))}
      <div className="flex gap-4">
        <Button
          icon={
            <img
              src="https://raw.githubusercontent.com/dvargas92495/roamjs-smartblocks/main/src/img/lego3blocks.png"
              height={16}
              width={16}
            />
          }
          text="Mark Read"
        />
        <Button
          icon={
            <img
              src="https://raw.githubusercontent.com/dvargas92495/roamjs-smartblocks/main/src/img/lego3blocks.png"
              height={16}
              width={16}
            />
          }
          text="Reply"
        />
      </div>
    </Card>
  );
};

export const render = ({
  parent,
  onloadArgs,
  ...props
}: { parent: HTMLElement; onloadArgs: OnloadArgs } & Props) => {
  parent.onmousedown = (e) => e.stopPropagation();
  const root = parent.closest(".roam-block-container");
  if (root) {
    root.setAttribute("data-roamjs-message-block", "true");
  }
  return renderWithUnmount(<MessageBlock {...props} />, parent, onloadArgs);
};

export default MessageBlock;
