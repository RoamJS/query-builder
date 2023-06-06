import { Button, H6, InputGroup, Intent, Label } from "@blueprintjs/core";
import React, { useState } from "react";
import getDiscourseNodes from "../utils/getDiscourseNodes";
import refreshConfigTree from "../utils/refreshConfigTree";
import createPage from "roamjs-components/writes/createPage";
import type { CustomField } from "roamjs-components/components/ConfigPanels/types";

const DiscourseNodeConfigPanel: CustomField["options"]["component"] = ({}) => {
  const [nodes, setNodes] = useState(() =>
    getDiscourseNodes().filter((n) => n.backedBy === "user")
  );
  const [label, setLabel] = useState("");
  return (
    <>
      <Label>
        Label
        <InputGroup
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={"roamjs-discourse-config-label"}
        />
      </Label>
      <Button
        text={"Add Node"}
        intent={Intent.PRIMARY}
        rightIcon={"plus"}
        minimal
        style={{ marginBottom: 8 }}
        disabled={!label}
        onClick={() => {
          createPage({
            title: `discourse-graph/nodes/${label}`,
            tree: [
              {
                text: "Shortcut",
                children: [{ text: label.slice(0, 1).toUpperCase() }],
              },
              {
                text: "Format",
                children: [
                  {
                    text: `[[${label.slice(0, 3).toUpperCase()}]] - {content}`,
                  },
                ],
              },
            ],
          }).then((valueUid) => {
            setNodes([
              ...nodes,
              {
                format: "",
                type: valueUid,
                text: label,
                shortcut: "",
                specification: [],
                backedBy: "user",
                canvasSettings: {},
              },
            ]);
            refreshConfigTree();
            setLabel("");
          });
        }}
      />
      <ul
        style={{
          listStyle: "none",
          paddingInlineStart: 0,
        }}
      >
        {nodes.map((n) => {
          return (
            <li
              key={n.type}
              style={{ border: "1px dashed #80808080" }}
              className={"p-2"}
            >
              <div className="flex justify-between items-center">
                <H6
                  className={"flex-grow m-0 cursor-pointer"}
                  onClick={() =>
                    window.roamAlphaAPI.ui.mainWindow.openPage({
                      page: { uid: n.type },
                    })
                  }
                >
                  {n.text}
                </H6>
                <Button
                  icon={"trash"}
                  minimal
                  onClick={() => {
                    window.roamAlphaAPI
                      .deletePage({ page: { uid: n.type } })
                      .then(() => {
                        setNodes(nodes.filter((nn) => nn.type !== n.type));
                        refreshConfigTree();
                      });
                  }}
                  style={{ minWidth: 30 }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default DiscourseNodeConfigPanel;
