import React, { useMemo, useState } from "react";
import {
  ExportDialogComponent,
  Result,
} from "roamjs-components/types/query-builder";
import getExportTypes from "../utils/getExportTypes";
// TODO POST MIGRATE - merge with ./Export.tsx
import { ExportDialog as QBExportDialog } from "./Export";
import renderOverlay from "roamjs-components/util/renderOverlay";
import getDiscourseNodes from "../utils/getDiscourseNodes";

type Props = {
  fromQuery?: {
    nodes?: Result[];
    relations?: {
      target: string;
      source: string;
      label: string;
    }[];
  };
};

const ExportDialog = ({
  onClose,
  fromQuery,
}: {
  onClose: () => void;
} & Props) => {
  const exportArgs = useMemo(() => {
    if (fromQuery) return fromQuery;
    const discourseNodes = getDiscourseNodes();
    return {
      nodes: (isBackendEnabled: boolean) =>
        Promise.all(
          discourseNodes.map((d) =>
            window.roamjs.extension.queryBuilder.fireQuery({
              returnNode: "node",
              conditions: [
                {
                  relation: "is a",
                  source: "node",
                  target: d.type,
                  uid: window.roamAlphaAPI.util.generateUID(),
                  type: "clause",
                },
              ],
              selections: [],
              isBackendEnabled,
            })
          )
        ).then((r) => r.flat()),
      relations: undefined,
    };
  }, [fromQuery]);
  return (
    <>
      <QBExportDialog
        isOpen={true}
        onClose={onClose}
        results={exportArgs.nodes}
        exportTypes={getExportTypes({
          results: exportArgs.nodes,
          relations: exportArgs.relations,
        })}
      />
    </>
  );
};

export const render = (props: Props) =>
  renderOverlay({ Overlay: ExportDialog, props });

export type ExportRenderProps = Omit<Parameters<typeof render>[0], "fromQuery">;

export default ExportDialog;
