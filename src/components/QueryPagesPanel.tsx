import { Button, InputGroup } from "@blueprintjs/core";
import React, { useEffect, useRef, useState } from "react";
import type { OnloadArgs } from "roamjs-components/types";

const QueryPagesPanel = (extensionAPI: OnloadArgs["extensionAPI"]) => () => {
  const [texts, setTexts] = useState(
    () => (extensionAPI.settings.get("query-pages") as string[]) || []
  );
  const [value, setValue] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current.className = "rm-extensions-settings";
  }, [inputRef]);
  return (
    <div
      className="flex flex-col"
      style={{
        width: "100%",
        minWidth: 256,
      }}
    >
      <div className={"flex gap-2"}>
        <InputGroup
          value={value}
          onChange={(e) => setValue(e.target.value)}
          ref={inputRef}
        />
        <Button
          icon={"plus"}
          minimal
          disabled={!value}
          onClick={() => {
            const newTexts = [...texts, value];
            setTexts(newTexts);
            extensionAPI.settings.set("query-pages", newTexts);
            setValue("");
          }}
        />
      </div>
      {texts.map((p, index) => (
        <div key={index} className="flex items-center justify-between">
          <span
            style={{
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {p}
          </span>
          <Button
            icon={"trash"}
            minimal
            onClick={() => {
              const newTexts = texts.filter((_, jndex) => index !== jndex);
              setTexts(newTexts);
              extensionAPI.settings.set("query-pages", newTexts);
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default QueryPagesPanel;
