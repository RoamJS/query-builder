// To be removed when format is migrated to specification
// https://github.com/RoamJS/query-builder/issues/189

import { PullBlock } from "roamjs-components/types";
import getDiscourseNodes from "../utils/getDiscourseNodes";
import compileDatalog from "./compileDatalog";
import discourseNodeFormatToDatalog from "./discourseNodeFormatToDatalog";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import { render as renderToast } from "roamjs-components/components/Toast";
import FormDialog from "roamjs-components/components/FormDialog";

type FormDialogProps = Parameters<typeof FormDialog>[0];
const renderFormDialog = createOverlayRender<FormDialogProps>(
  "form-dialog",
  FormDialog
);

export const getNewDiscourseNodeText = async ({
  text,
  nodeType,
  blockUid,
}: {
  text: string;
  nodeType: string;
  blockUid?: string;
}) => {
  const discourseNodes = getDiscourseNodes();
  let newText = text;
  if (!text) {
    newText = await new Promise<string>((resolve) => {
      const nodeName =
        discourseNodes.find((n) => n.type === nodeType)?.text || "Discourse";
      renderFormDialog({
        title: `Create ${nodeName} Node`,
        fields: {
          textField: {
            type: "text",
            label: `Create ${nodeName} Node`,
          },
        },
        onSubmit: (data: Record<string, unknown>) => {
          resolve(data.textField as string);
        },
        onClose: () => {
          resolve("");
        },
        isOpen: true,
      });
    });
  }
  if (!newText) {
    renderToast({
      content: "No text provided.",
      id: "roamjs-create-discourse-node-dialog-error",
      intent: "warning",
    });
  }

  const indexedByType = Object.fromEntries(
    discourseNodes.map((mi, i) => [mi.type, mi])
  );

  const format = indexedByType[nodeType]?.format || "";
  const formattedText = format.replace(/{([\w\d-]*)}/g, (_, val) => {
    if (/content/i.test(val)) return newText;
    const referencedNode = discourseNodes.find(({ text: newText }) =>
      new RegExp(newText, "i").test(val)
    );
    if (referencedNode) {
      const referenced = window.roamAlphaAPI.data.fast.q(
        `[:find (pull ?r [:node/title :block/string]) :where [?b :block/uid "${blockUid}"] (or-join [?b ?r] (and [?b :block/parents ?p] [?p :block/refs ?r]) (and [?b :block/page ?r])) ${discourseNodeFormatToDatalog(
          {
            freeVar: "r",
            ...referencedNode,
          }
        )
          .map((c) => compileDatalog(c, 0))
          .join(" ")}]`
      )?.[0]?.[0] as PullBlock;
      return referenced?.[":node/title"]
        ? `[[${referenced?.[":node/title"]}]]`
        : referenced?.[":block/string"] || "";
    }
    return "";
  });
  return formattedText;
};
