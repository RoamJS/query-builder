import { Button, InputGroup } from "@blueprintjs/core";
import React, { useEffect, useRef, useState } from "react";
import type { OnloadArgs } from "roamjs-components/types";

export const getQueryPages = (extensionAPI: OnloadArgs["extensionAPI"]) => {
  const value = extensionAPI.settings.get("query-pages") as string[] | string;
  return typeof value === "string" ? [value] : value || ["queries/*"];
};

const QueryPagesPanel = (extensionAPI: OnloadArgs["extensionAPI"]) => () => {
  const [texts, setTexts] = useState(() => getQueryPages(extensionAPI));
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current.className = "rm-extensions-settings";
    if (!inputRef.current.style) {
      console.log(inputRef);
    }
    inputRef.current.style.minWidth = "100%";
    inputRef.current.style.maxWidth = "100%";
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
          inputRef={inputRef}
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
