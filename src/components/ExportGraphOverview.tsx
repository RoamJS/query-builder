import React, { useEffect, useState } from "react";
import { Button, Classes, Dialog, Label, Slider } from "@blueprintjs/core";
import ReactDOM from "react-dom";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import getDiscourseContextResults from "../utils/getDiscourseContextResults";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { Result } from "../utils/types";
import { render as exportRender } from "./Export";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";

const processLevel = async (
  uid: string,
  currentDepth: number,
  maxDepth: number,
  visitedUids: Set<string>
) => {
  const initialResult = { uid, text: getPageTitleByPageUid(uid) };
  let aggregatedResults: Result[] = [initialResult];

  if (currentDepth >= maxDepth || visitedUids.has(uid)) {
    return aggregatedResults;
  }

  visitedUids.add(uid);

  const discourseContextResults = await getDiscourseContextResults({ uid });

  for (const { results } of discourseContextResults) {
    for (const resultUid in results) {
      const result = results[resultUid];
      aggregatedResults.push(result as Result);
      if (typeof result.uid !== "string") continue;
      const deeperResults = await processLevel(
        result.uid,
        currentDepth + 1,
        maxDepth,
        visitedUids
      );
      aggregatedResults = aggregatedResults.concat(deeperResults);
    }
  }

  return aggregatedResults;
};

const getDiscourseContext = async (
  initialUids: string[],
  discourseContextDepth = 0,
  visitedUids = new Set<string>()
) => {
  const allResults = await Promise.all(
    initialUids.map((uid) =>
      processLevel(uid, 0, discourseContextDepth, visitedUids)
    )
  );

  // Flatten the results into one array
  const flattenedResults = allResults.flat();

  // Create uniqueResults using a Map for deduplication
  const uidToResultMap = new Map();
  for (const result of flattenedResults) {
    uidToResultMap.set(result.uid, result);
  }
  // Convert the Map values back to an array
  const uniqueResults: Result[] = [...uidToResultMap.values()];

  return uniqueResults;
};

const getDepthValues = () => {
  const controlPanelEl = document.querySelector(
    "div.rm-graph-view-control-panel__main-options"
  );
  if (!controlPanelEl) return { degreesIn: 0, degreesOut: 0 };

  const getSliderValueByText = (parentElement: Element, text: string) => {
    const element = Array.from(parentElement.querySelectorAll("strong")).find(
      (el) => el.textContent?.trim() === text
    );
    if (element) {
      const sliderDiv =
        element.parentElement?.parentElement?.nextElementSibling;
      if (sliderDiv) {
        const sliderLabel = sliderDiv.querySelector(
          ".bp3-slider-handle .bp3-slider-label"
        );
        return sliderLabel ? parseInt(sliderLabel.textContent || "0", 10) : 0;
      }
    }
    return 0;
  };

  const degreesIn = getSliderValueByText(controlPanelEl, "Degrees In");
  const degreesOut = getSliderValueByText(controlPanelEl, "Degrees Out");

  return {
    degreesIn,
    degreesOut,
  };
};

const GraphExportDialog = ({
  isOpen,
  onClose,
}: RoamOverlayProps<{ blockUid: string }>) => {
  const [loading, setLoading] = useState(false);
  const pages = window.roamAlphaAPI.ui.graphView.wholeGraph.getExplorePages();
  const initialUids = pages.map((x) => getPageUidByPageTitle(x)) || [];
  const [degreesIn, setDegreesIn] = useState(0);
  const [degreesOut, setDegreesOut] = useState(0);
  const [discourseContextDepth, setDiscourseContextDepth] = useState(0);
  useEffect(() => {
    const { degreesIn, degreesOut } = getDepthValues();
    setDegreesIn(degreesIn);
    setDegreesOut(degreesOut);
    setDiscourseContextDepth(Math.max(degreesIn, degreesOut));
  }, []);

  // TODO: Remove tempResults (dev testing)
  const [tempResults, setTempResults] = useState<Result[]>([]);

  return (
    <Dialog
      isOpen={isOpen}
      title="Discourse Graph Context Export"
      onClose={onClose}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>Discourse Context Depth</Label>
        <Slider
          min={0}
          max={5}
          stepSize={1}
          labelStepSize={1}
          onChange={(v) => setDiscourseContextDepth(v)}
          value={discourseContextDepth}
        />
      </div>

      {/* TODO: Remove tempResults (dev testing) */}
      <Button
        disabled={loading}
        onClick={() => {
          setLoading(true);
          setTimeout(async () => {
            const tempResults = await getDiscourseContext(
              initialUids,
              discourseContextDepth
            );
            setTempResults(tempResults);
            setLoading(false);
          }, 0);
        }}
      >
        Temp Results
      </Button>
      <div>
        {tempResults &&
          tempResults.map((r) => {
            return <div>{r.text}</div>;
          })}
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            loading={loading}
            intent="primary"
            onClick={() => {
              setLoading(true);
              setTimeout(async () => {
                const results = await getDiscourseContext(
                  initialUids,
                  discourseContextDepth
                );
                exportRender({
                  results,
                  title: "Export Discourse Graph",
                });
                onClose();
                setLoading(false);
              }, 0);
            }}
          >
            Export
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

const GraphExportButton = () => {
  return (
    <Button
      className="w-full"
      icon="export"
      onClick={() =>
        renderOverlay({
          id: "graph-export",
          Overlay: GraphExportDialog,
        })
      }
    >
      Export
    </Button>
  );
};

export const render = (block: HTMLDivElement) => {
  const div = document.createElement("div");
  ReactDOM.render(<GraphExportButton />, div);
  block.appendChild(div);
};
