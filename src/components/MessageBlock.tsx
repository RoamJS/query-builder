import { Card, Spinner } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import fireQuery from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import type { Result } from "roamjs-components/types/query-builder";
import ResultsView from "./ResultsView";
import ReactDOM from "react-dom";
import QueryEditor from "./QueryEditor";
import getSubTree from "roamjs-components/util/getSubTree";
import { createComponentRender } from "roamjs-components/components/ComponentContainer";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import setInputSetting from "roamjs-components/util/setInputSetting";
import { OnloadArgs } from "roamjs-components/types/native";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
import { Filters } from "roamjs-components/components/Filter";
import { ExportTypes } from "../utils/types";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";

type QueryPageComponent = (props: { blockUid: string }) => JSX.Element;

type Props = Parameters<QueryPageComponent>[0];

const MessageBlock = ({ blockUid }: Props) => {
  const extensionAPI = useExtensionAPI();
  const hideMetadata = useMemo(
    () => !!extensionAPI && !!extensionAPI.settings.get("hide-metadata"),
    [extensionAPI]
  );
  const tree = useMemo(() => getBasicTreeByParentUid(blockUid), [blockUid]);
  const { subject, from, when } = useMemo(() => {
    const pull = window.roamAlphaAPI.pull(
      "[:block/string :create/user :create/time]",
      [":block/uid", blockUid]
    );
    const fromPage = window.roamAlphaAPI.pull(
      "[:user/display-page]",
      pull[":create/user"]?.[":db/id"] || 0
    )?.[":user/display-page"]?.[":db/id"];
    const from =
      window.roamAlphaAPI.pull("[:node/title]", fromPage || 0)?.[
        ":node/title"
      ] || "";
    return {
      subject: pull[":block/string"] || "",
      from,
      when: new Date(pull[":create/time"] || 0),
    };
  }, [blockUid]);
  const to = useMemo(
    () =>
      getSubTree({ tree, key: "to::" })
        .children.map((c) => /#([^\s]+)\s/.exec(c.text)?.[1])
        .filter((s): s is string => !!s),
    [tree]
  );
  const body = useMemo(
    () => getSubTree({ tree, key: "body::" }).children[0].text,
    [tree]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  return (
    <Card
      id={`roamjs-message-block-${blockUid}`}
      className={"roamjs-message-block pt-0 px-4 pb-4 overflow-auto"}
    >
      <style>{`div[data-roamjs-message-block=true] .rm-block-children {
  display: none;
}`}</style>
      <h1>{subject}</h1>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <b className="block mb-2">{from}</b>
          <span className="text-small text-gray-200">to {to.join(", ")}</span>
        </div>
        <div>
          <span className="text-small text-gray-200">
            {when.toLocaleString()}
          </span>
        </div>
      </div>
      <div>{body}</div>
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
