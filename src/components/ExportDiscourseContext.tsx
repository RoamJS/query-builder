import React, { useState } from "react";
import ReactDOM from "react-dom";
import {
  Button,
  Classes,
  Dialog,
  Label,
  Slider,
  Tab,
  Tabs,
  Tooltip,
  Callout,
  Collapse,
} from "@blueprintjs/core";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageTitlesandBlockUidsReferencingPage from "roamjs-components/queries/getPageTitlesAndBlockUidsReferencingPage";
import getLinkedPageTitlesUnderUid from "roamjs-components/queries/getLinkedPageTitlesUnderUid";
import isDiscourseNode from "../utils/isDiscourseNode";
import getDiscourseContextResults from "../utils/getDiscourseContextResults";
import { render as exportRender } from "./Export";
import { Result } from "../utils/types";

const getInboundReferences = async (uid: string) => {
  // TODO: Optimize this with custom query to take in and return Result[]
  const pageTitle = getPageTitleByPageUid(uid);
  const refs = getPageTitlesandBlockUidsReferencingPage(pageTitle);
  const refPageUids = refs.map((r) => getPageUidByPageTitle(r.title));
  return refPageUids;
};

const getOutboundReferences = async (uid: string) => {
  // TODO: Optimize this with custom query take in and return Result[]
  const refPageTitles = getLinkedPageTitlesUnderUid(uid);
  const refPageUids = refPageTitles.map((title) =>
    getPageUidByPageTitle(title)
  );
  return refPageUids;
};

const getReferencesByDegree = async (
  initialUids: string[],
  degrees: number,
  getReferences: (uid: string) => Promise<string[]>
): Promise<Set<string>> => {
  let currentUids = [...initialUids];
  const visitedUids = new Set<string>();

  for (let i = 0; i < degrees; i++) {
    const nextUids = [];
    for (let uid of currentUids) {
      const refs = await getReferences(uid);
      nextUids.push(...refs.filter((ref) => !visitedUids.has(ref)));
    }

    nextUids.forEach((uid) => visitedUids.add(uid));
    currentUids = nextUids;
  }

  return visitedUids;
};

const getAllReferencesByDegree = async (
  initialUids: string[],
  degreesIn: number,
  degreesOut: number
): Promise<Set<string>> => {
  const inboundUids = await getReferencesByDegree(
    initialUids,
    degreesIn,
    getInboundReferences
  );
  const outboundUids = await getReferencesByDegree(
    initialUids,
    degreesOut,
    getOutboundReferences
  );

  return new Set([...inboundUids, ...outboundUids, ...initialUids]);
};

const getDiscourseContextResultsByDepth = async ({
  uid,
  title,
  currentDepth,
  maxDepth,
  visitedUids,
}: {
  uid: string;
  title?: string;
  currentDepth: number;
  maxDepth: number;
  visitedUids: Set<string>;
}) => {
  if (!isDiscourseNode(uid)) return [];

  const initialResult = { uid, text: title || getPageTitleByPageUid(uid) };
  let aggregatedResults: Result[] = [initialResult];

  if (currentDepth >= maxDepth || visitedUids.has(uid)) {
    return aggregatedResults;
  }

  visitedUids.add(uid);

  const discourseContextResults = await getDiscourseContextResults({ uid });

  for (const { results } of discourseContextResults) {
    for (const result in results) {
      const r = results[result] as Result;
      aggregatedResults.push(r);
      const deeperResults = await getDiscourseContextResultsByDepth({
        uid: r.uid,
        title: r.text,
        currentDepth: currentDepth + 1,
        maxDepth: maxDepth,
        visitedUids,
      });
      aggregatedResults = aggregatedResults.concat(deeperResults);
    }
  }

  return aggregatedResults;
};

const getAllDiscourseContext = async (
  initialUids: string[],
  discourseContextDepth = 1,
  visitedUids = new Set<string>()
) => {
  const allResults = await Promise.all(
    initialUids.map((uid) =>
      getDiscourseContextResultsByDepth({
        uid,
        currentDepth: 0,
        maxDepth: discourseContextDepth,
        visitedUids,
      })
    )
  );

  // Remove duplicates
  const flattenedResults = allResults.flat();
  const uidToResultMap = new Map();
  for (const result of flattenedResults) {
    uidToResultMap.set(result.uid, result);
  }
  const uniqueResults: Result[] = [...uidToResultMap.values()];

  return uniqueResults;
};

const getGraphOverviewDepthValues = () => {
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

type GraphExportDialogProps = {
  initialDegreesIn?: number;
  initialDegreesOut?: number;
  initialDiscourseContextDepth?: number;
};

type GraphExportDialogComponent = (
  props: RoamOverlayProps<GraphExportDialogProps>
) => JSX.Element;

const GraphExportDialog: GraphExportDialogComponent = ({
  isOpen,
  onClose,
  initialDegreesIn = 0,
  initialDegreesOut = 0,
  initialDiscourseContextDepth,
}) => {
  const [loading, setLoading] = useState(false);
  const pages = window.roamAlphaAPI.ui.graphView.wholeGraph.getExplorePages();
  const initialUids = pages.map((x) => getPageUidByPageTitle(x)) || [];
  const [currentTab, setCurrentTab] = useState("by-references");
  const [showPreview, setShowPreview] = useState(false);
  const [previewResults, setPreviewResults] = useState<Result[]>([]);
  const [degreesIn, setDegreesIn] = useState(initialDegreesIn);
  const [degreesOut, setDegreesOut] = useState(initialDegreesOut);
  const [discourseContextDepth, setDiscourseContextDepth] = useState(
    initialDiscourseContextDepth || Math.max(degreesIn, degreesOut)
  );

  const ByDiscourseContextPanel = (
    <>
      <Callout className="mb-5">
        Export Discourse Nodes and their Discourse Context based on relation
        depth from the initial nodes.
      </Callout>
      <Label>Depth</Label>
      <Slider
        min={0}
        max={5}
        stepSize={1}
        labelStepSize={1}
        onChange={(v) => setDiscourseContextDepth(v)}
        value={discourseContextDepth}
      />
    </>
  );

  const ByReferencesPanel = (
    <>
      <Callout className="mb-5">
        Export any Discourse Nodes and their Discourse Context that reference or
        are referenced by any page starting from the initial pages.
      </Callout>
      <Tooltip placement="top" content={"Pages that link to a selected page"}>
        <Label>Degrees In</Label>
      </Tooltip>
      <Slider
        min={0}
        max={5}
        stepSize={1}
        labelStepSize={1}
        onChange={(v) => setDegreesIn(v)}
        value={degreesIn}
      />
      <Tooltip placement="top" content={"Pages that link from a selected page"}>
        <Label>Degrees Out</Label>
      </Tooltip>
      <Slider
        min={0}
        max={5}
        stepSize={1}
        labelStepSize={1}
        onChange={(v) => setDegreesOut(v)}
        value={degreesOut}
      />
    </>
  );

  const getResults = async () => {
    if (currentTab === "by-references") {
      const referenceUids = await getAllReferencesByDegree(
        initialUids,
        degreesIn,
        degreesOut
      );
      const discourseNodeUids = Array.from(referenceUids).filter((uid) =>
        isDiscourseNode(uid)
      );
      return await getAllDiscourseContext(
        discourseNodeUids,
        Math.max(degreesIn, degreesOut)
      );
    }
    if (currentTab === "by-discourse-relations") {
      return await getAllDiscourseContext(initialUids, discourseContextDepth);
    }
    return [];
  };

  const onSubmit = async (preview?: boolean) => {
    setLoading(true);
    setTimeout(async () => {
      const results = await getResults();

      if (preview) {
        setPreviewResults(results);
        setShowPreview(true);
        setLoading(false);
        return;
      }

      exportRender({
        results,
        title: "Export Discourse Graph",
      });
      onClose();
      setLoading(false);
    }, 0);
  };

  return (
    <Dialog
      isOpen={isOpen}
      title="Discourse Graph Context Export"
      onClose={onClose}
      autoFocus={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <Tabs
          id="discourse-graph-export-tabs"
          selectedTabId={currentTab}
          onChange={(id) => {
            setShowPreview(false);
            setCurrentTab(id as string);
          }}
          large={true}
        >
          <Tab
            id="by-references"
            title="By References"
            panel={ByReferencesPanel}
          />
          <Tab
            id="by-discourse-relations"
            title="By Discourse Relations"
            panel={ByDiscourseContextPanel}
          />
        </Tabs>
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            loading={loading}
            onClick={() => onSubmit(true)}
            intent="warning"
          >
            Preview
          </Button>
          <Button loading={loading} intent="primary" onClick={() => onSubmit()}>
            Export
          </Button>
        </div>
        <Collapse isOpen={showPreview}>
          {previewResults.length > 0 ? (
            <ul>
              {previewResults.map((r) => {
                return <li>{r.text}</li>;
              })}
            </ul>
          ) : (
            "No results"
          )}
        </Collapse>
      </div>
    </Dialog>
  );
};

const GraphExportButton = () => {
  return (
    <Button
      className="w-full"
      icon="export"
      onClick={() => {
        const { degreesIn, degreesOut } = getGraphOverviewDepthValues();
        renderOverlay({
          id: "graph-export",
          Overlay: GraphExportDialog,
          props: {
            initialDegreesIn: degreesIn,
            initialDegreesOut: degreesOut,
          },
        });
      }}
    >
      Export
    </Button>
  );
};

export const render = (block: HTMLDivElement) => {
  const div = document.createElement("div");
  div.className = "roamjs-discourse-graph-export-button";
  ReactDOM.render(<GraphExportButton />, div);
  block.appendChild(div);
};
