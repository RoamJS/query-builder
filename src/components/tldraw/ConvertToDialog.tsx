import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Editor } from "tldraw";
import { DiscourseNode } from "../../utils/getDiscourseNodes";
import { getOnSelectForShape } from "./uiOverrides";
import { Dialog, Button, Classes } from "@blueprintjs/core";

const ConvertToDialog = ({
  extensionAPI,
  allNodes,
  isOpen,
  onClose,
  editor,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
  allNodes: DiscourseNode[];
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
}) => {
  if (!editor) return null;
  const selectedShapes = editor.getSelectedShapes();
  const isTextSelected = selectedShapes[0]?.type === "text";
  const isImageSelected = selectedShapes[0]?.type === "image";
  const oneShapeSelected = selectedShapes.length === 1;
  const isNodeSelected =
    (isTextSelected || isImageSelected) && oneShapeSelected;

  let errorMessage = "Please select a text or image shape";
  if (!oneShapeSelected) errorMessage = "Please select only one shape";

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      canOutsideClickClose
      canEscapeKeyClose
      className={`roamjs-canvas-dialog`}
      style={{ width: isNodeSelected ? "20rem" : "24rem" }}
    >
      <div
        className={Classes.DIALOG_BODY}
        style={{ padding: "1rem 0rem", margin: "0px" }}
      >
        <div className="flex flex-col">
          {/* Dialog title messes with keyboard focus */}
          <div className="text-lg font-bold p-2 mb-2 mx-5 mt-0">Convert To</div>
          {isNodeSelected ? (
            <>
              {allNodes
                // Page not yet supported: requires page-node to have image flag option
                .filter(
                  (node) => !(isImageSelected && node.type === "page-node")
                )
                .map((node) => {
                  const color =
                    node.canvasSettings.color &&
                    !node.canvasSettings.color.startsWith("#")
                      ? `#${node.canvasSettings.color}`
                      : node.canvasSettings.color;
                  return (
                    <div className="flex items-center">
                      <Button
                        minimal
                        key={node.type}
                        text={node.text}
                        className="p-2 px-7 focus:outline-none focus:bg-gray-300 justify-start flex-grow"
                        style={{
                          caretColor: "transparent",
                        }}
                        onClick={() => {
                          getOnSelectForShape({
                            shape: selectedShapes[0],
                            nodeType: node.type,
                            editor,
                            extensionAPI,
                          })();
                          onClose();
                        }}
                        icon={
                          <div
                            className="w-4 h-4 rounded-full mr-2 select-none"
                            style={{
                              backgroundColor: color || "#000",
                            }}
                          ></div>
                        }
                      />
                    </div>
                  );
                })}
            </>
          ) : (
            <div className="p-4 text-center">{errorMessage}</div>
          )}
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={`${Classes.DIALOG_FOOTER_ACTIONS} justify-start`}>
          <Button
            className="m-0 w-full"
            style={{ caretColor: "transparent" }}
            text={"Cancel"}
            onClick={onClose}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default ConvertToDialog;
