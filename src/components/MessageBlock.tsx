import { Button, Card } from "@blueprintjs/core";
import React from "react";
import getSubTree from "roamjs-components/util/getSubTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { OnloadArgs, PullBlock } from "roamjs-components/types/native";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import getBlockUidsReferencingBlock from "roamjs-components/queries/getBlockUidsReferencingBlock";
import getPageUidByBlockUid from "roamjs-components/queries/getPageUidByBlockUid";

type QueryPageComponent = (props: { blockUid: string }) => JSX.Element;

type Props = Parameters<QueryPageComponent>[0];

const getThread = (blockUid: string) => {
  const allBlockUidsInThread = new Set([blockUid]);
  const getMessageInfo = (uid: string) => {
    const tree = getBasicTreeByParentUid(uid);
    if (!tree.length) return;
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
    const body = getSubTree({ tree, key: "body::" }).uid;
    const { text: actionsText, uid: actionsUid } = getSubTree({
      tree,
      key: "actions::",
    }).children[0];
    const buttons = Array.from(
      actionsText.matchAll(/{{([^:]+):SmartBlock:([^:]+)[^}]*}}/g)
    ).map((m) => ({
      text: m[1],
      trigger: m[2],
    }));
    return {
      subject,
      from,
      when,
      body,
      recipients,
      buttons,
      actionsUid,
      uid,
    };
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
        `[:find (pull ?ref [:block/uid]) :where [?block :block/uid "${uid}"] [?block :block/refs ?ref]]`
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
  return uids
    .map(getMessageInfo)
    .filter(
      (i): i is Exclude<ReturnType<typeof getMessageInfo>, undefined> => !!i
    );
};

const SingleMessage = (
  t: ReturnType<typeof getThread>[number] & { focused: boolean }
) => {
  const bodyRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (bodyRef.current) {
      window.roamAlphaAPI.ui.components.renderPage({
        uid: t.body,
        el: bodyRef.current,
      });
    }
  }, [bodyRef.current, t.body]);
  return (
    <div
      className={`px-4 py-2 roamjs-message ${
        t.focused ? "roamjs-message-focused" : ""
      }`}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
        onClick={() => {
          window.roamAlphaAPI.ui.mainWindow.openPage({
            page: {
              uid: getPageUidByBlockUid(t.uid),
            },
          });
        }}
      >
        <div className="roamjs-message-recipients">
          <span className="block mb-1 font-bold">{t.from}</span>
          <span style={{ fontSize: 12 }}>
            to{" "}
            {t.recipients
              .map((r) => `${r.to}${/unread/i.test(r.status) ? "*" : ""}`)
              .join(", ")}
          </span>
        </div>
        <div
          style={{ fontSize: 12, alignSelf: "end" }}
          className="roamjs-message-datetime"
        >
          {t.when.toLocaleString()}
        </div>
      </div>
      <div
        className="pt-2 pb-4 pointer-events-none cursor-default roamjs-message-body"
        ref={bodyRef}
      />
    </div>
  );
};

/**
 * This component is hyper custom towards a single user's use case, so we want to keep it mostly hidden for now.
 * Once Roam releases custom block views, we'll be able to expose a way (via SamePage) to allow users to build
 * their own custom views (UI) in a No-Code way, similar to SmartBlocks (automations) and Query Builder (Requests) today.
 */
const MessageBlock = ({ blockUid }: Props) => {
  const [thread, setThread] = React.useState(() => getThread(blockUid));
  return (
    <Card
      id={`roamjs-message-block-${blockUid}`}
      className={"roamjs-message-block pt-0 px-0 pb-4 overflow-auto"}
    >
      <style>{`div[data-roamjs-message-block=true] > .rm-block-children {
  display: none;
}
div[data-roamjs-message-block=true] .roamjs-message-body .rm-api-render--block > .rm-block > .rm-block-main {
  display: none;
}
div[data-roamjs-message-block=true] .roamjs-message-body .rm-api-render--block > .rm-block > .rm-block-children {
  margin-left: 0;
}`}</style>
      <h1 className="px-4">{thread[0].subject}</h1>
      {thread.map((t, i) => (
        <SingleMessage {...t} key={i} focused={t.uid === blockUid} />
      ))}
      <div className="flex gap-2 px-4 mt-4">
        {thread.slice(-1)[0].buttons.map((b, i) => (
          <Button
            key={i}
            icon={
              <img
                src="https://raw.githubusercontent.com/dvargas92495/roamjs-smartblocks/main/src/img/lego3blocks.png"
                height={16}
                width={16}
              />
            }
            text={b.text}
            onClick={async () => {
              await window.roamjs.extension.smartblocks?.triggerSmartblock({
                srcName: b.trigger,
                targetUid: thread.slice(-1)[0].actionsUid,
              });
              setThread(getThread(blockUid));
            }}
          />
        ))}
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
