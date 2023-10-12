import React, { useEffect, useState } from "react";
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
} from "@blueprintjs/core";
import ReactDOM from "react-dom";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import getDiscourseContextResults from "../utils/getDiscourseContextResults";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { Result } from "../utils/types";
import { render as exportRender } from "./Export";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageTitlesandBlockUidsReferencingPage from "roamjs-components/queries/getPageTitlesAndBlockUidsReferencingPage";
import getLinkedPageTitlesUnderUid from "roamjs-components/queries/getLinkedPageTitlesUnderUid";
import isDiscourseNode from "../utils/isDiscourseNode";

const convertToResult = (params: { uid?: string; pageTitle?: string }) => {
  const { uid, pageTitle } = params;

  if (!uid && !pageTitle) {
    throw new Error("Either uid or pageTitle must be provided.");
  }

  return {
    uid: uid || getPageUidByPageTitle(pageTitle!),
    text: pageTitle || getPageTitleByPageUid(uid!),
  };
};

const getInboundReferences = async (uid: string) => {
  const pageName = getPageTitleByPageUid(uid);
  const directReferences = getPageTitlesandBlockUidsReferencingPage(pageName);
  // convert page names to UIDs
  const inboundUids = directReferences.map((r) =>
    getPageUidByPageTitle(r.title)
  );

  return inboundUids;
};

const getOutboundReferences = async (uid: string) => {
  const outboundPageNames = getLinkedPageTitlesUnderUid(uid);

  // Convert page names to UIDs
  const outboundUids = outboundPageNames.map((name) =>
    getPageUidByPageTitle(name)
  );

  return outboundUids;
};

const getAllReferencesByDegree = async (
  initialUids: string[],
  degreesIn: number,
  degreesOut: number
) => {
  let currentInboundUids = [...initialUids];
  let currentOutboundUids = [...initialUids];
  const visitedInboundUids = new Set<string>();
  const visitedOutboundUids = new Set<string>();

  for (let i = 0; i < degreesIn; i++) {
    const nextInboundUids = [];

    for (const uid of currentInboundUids) {
      const refs = await getInboundReferences(uid);
      nextInboundUids.push(
        ...refs.filter((ref) => !visitedInboundUids.has(ref))
      );
    }

    nextInboundUids.forEach((uid) => visitedInboundUids.add(uid));
    currentInboundUids = nextInboundUids;
  }

  for (let j = 0; j < degreesOut; j++) {
    const nextOutboundUids = [];

    for (const uid of currentOutboundUids) {
      const refs = await getOutboundReferences(uid);
      nextOutboundUids.push(
        ...refs.filter((ref) => !visitedOutboundUids.has(ref))
      );
    }

    nextOutboundUids.forEach((uid) => visitedOutboundUids.add(uid));
    currentOutboundUids = nextOutboundUids;
  }

  return {
    inbound: [...visitedInboundUids],
    outbound: [...visitedOutboundUids],
  };
};

const getDiscourseContextResultsForUids = async (uids: string[]) => {
  let allResults: Result[] = [];

  for (const uid of uids) {
    const response = await getDiscourseContextResults({ uid });
    const resultItems = response.map((r) => Object.values(r.results)).flat();
    console.log(resultItems);

    const items = resultItems
      .filter(
        (item): item is { uid: string; text: string } =>
          typeof item.uid === "string" && typeof item.text === "string"
      )
      .map(({ uid, text }) => ({ uid, text }));

    allResults = [...allResults, ...items];
  }
  console.log(allResults);

  return allResults;
};

const getDiscourseContextResultsByLevel = async (
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
      const deeperResults = await getDiscourseContextResultsByLevel(
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
  discourseContextDepth = 1,
  visitedUids = new Set<string>()
) => {
  const allResults = await Promise.all(
    initialUids.map((uid) =>
      getDiscourseContextResultsByLevel(
        uid,
        0,
        discourseContextDepth,
        visitedUids
      )
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
  //convert uids to results
  // const initialResults = pages.map((pageTitle) =>
  //   convertToResult({ pageTitle })
  // );
  const [currentTab, setCurrentTab] = useState("by-references");
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
      {/* TODO: Remove tempResults (dev testing) */}
      {/* <Button
        onClick={async () => {
          const { inbound, outbound } = await getAllReferencesByDegree(
            initialUids,
            degreesIn,
            degreesOut
          );
          const uids = [...inbound, ...outbound, ...initialUids];
          const uniqueUids = [...new Set(uids)];
          const results = uniqueUids.map((uid) => convertToResult({ uid }));
          setTempByPageResults(results);
        }}
      >
        Process Block References
      </Button> */}
      {/* <Button
        onClick={async () => {
          const { inbound, outbound } = await getAllReferencesByDegree(
            initialUids,
            degreesIn,
            degreesOut
          );
          const uids = [...inbound, ...outbound, ...initialUids];
          const uniqueUids = [...new Set(uids)];
          const discourseNodeUids = uniqueUids.filter((uid) =>
            isDiscourseNode(uid)
          );
          const results = await getDiscourseContext(
            discourseNodeUids,
            Math.max(degreesIn, degreesOut)
          );
          setTempByPageResults(results);
        }}
      >
        Get Discourse Context Results
      </Button> */}
    </>
  );

  const getResults = async () => {
    if (currentTab === "by-references") {
      const { inbound, outbound } = await getAllReferencesByDegree(
        initialUids,
        degreesIn,
        degreesOut
      );
      const uids = [...inbound, ...outbound, ...initialUids];
      const uniqueUids = [...new Set(uids)];
      const discourseNodeUids = uniqueUids.filter((uid) =>
        isDiscourseNode(uid)
      );
      return await getDiscourseContext(
        discourseNodeUids,
        Math.max(degreesIn, degreesOut)
      );
    }
    if (currentTab === "by-discourse-relations") {
      return await getDiscourseContext(initialUids, discourseContextDepth);
    }
    return [];
  };

  // TODO: Remove tempResults (dev testing)
  const previewResults = async () => {
    setLoading(true);
    setTimeout(async () => {
      const results = await getResults();
      setTempResults(results);
      setLoading(false);
    }, 0);
  };

  const onSubmit = async () => {
    setLoading(true);
    setTimeout(async () => {
      const results = await getResults();
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
    >
      <div className={Classes.DIALOG_BODY}>
        <Tabs
          id="discourse-graph-export-tabs"
          selectedTabId={currentTab}
          onChange={(id) => setCurrentTab(id as string)}
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
        {/* TEMP DEV REMOVE */}
        <div>
          {tempResults && (
            <ul>
              {tempResults.map((r) => {
                return <li>{r.text}</li>;
              })}
            </ul>
          )}
        </div>
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button loading={loading} onClick={previewResults} intent="warning">
            Preview
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button loading={loading} intent="primary" onClick={onSubmit}>
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
