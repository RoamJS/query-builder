import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getUids from "roamjs-components/dom/getUids";
import getSubTree from "roamjs-components/util/getSubTree";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import type { OnloadArgs, RoamBlock } from "roamjs-components/types";
import getCreateTimeByBlockUid from "roamjs-components/queries/getCreateTimeByBlockUid";
import getEditTimeByBlockUid from "roamjs-components/queries/getEditTimeByBlockUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import createObserver from "roamjs-components/dom/createObserver";

export const getCreatedTimeByTitle = (title: string): number => {
  const result = window.roamAlphaAPI.q(
    `[:find (pull ?e [:create/time]) :where [?e :node/title "${title.replace(
      /"/g,
      '\\"'
    )}"]]`
  )[0][0] as RoamBlock;
  return result?.time || getEditTimeByTitle(title);
};

export const getEditTimeByTitle = (title: string): number => {
  const result = window.roamAlphaAPI.q(
    `[:find (pull ?e [:edit/time]) :where [?e :node/title "${title.replace(
      /"/g,
      '\\"'
    )}"]]`
  )[0][0] as RoamBlock;
  return result?.time || 0;
};

export const getWordCount = (str = ""): number =>
  str.trim().split(/\s+/).length;

const getWordCountByBlockId = (blockId = 0): number => {
  const block = window.roamAlphaAPI.pull(
    "[:block/children, :block/string]",
    blockId
  );
  const children = block[":block/children"] || [];
  const count = getWordCount(block[":block/string"]);
  return (
    count +
    children
      .map((c) => getWordCountByBlockId(c[":db/id"]))
      .reduce((total, cur) => cur + total, 0)
  );
};

const getWordCountByBlockUid = (blockUid: string): number => {
  const block = window.roamAlphaAPI.q(
    `[:find (pull ?e [:block/children, :block/string]) :where [?e :block/uid "${blockUid}"]]`
  )[0][0] as RoamBlock;
  const children = block.children || [];
  const count = getWordCount(block.string);
  return (
    count +
    children
      .map((c) => getWordCountByBlockId(c.id))
      .reduce((total, cur) => cur + total, 0)
  );
};

const getWordCountByPageTitle = (title: string): number => {
  const page = window.roamAlphaAPI.q(
    `[:find (pull ?e [:block/children]) :where [?e :node/title "${title}"]]`
  )[0][0] as RoamBlock;
  const children = page.children || [];
  return children
    .map((c) => getWordCountByBlockId(c.id))
    .reduce((total, cur) => cur + total, 0);
};

const runQueryTools = (extensionAPI: OnloadArgs["extensionAPI"]) => {
  let isSortByBlocks = false;

  const menuItemCallback =
    (sortContainer: Element, sortBy: (a: string, b: string) => number) =>
    () => {
      const blockConfig = getBasicTreeByParentUid(
        getUids(sortContainer as HTMLDivElement).blockUid
      );
      isSortByBlocks =
        !!getSubTree({ tree: blockConfig, key: "Sort Blocks" }).uid ||
        !!extensionAPI.settings.get("sort-blocks");
      const refContainer =
        sortContainer.getElementsByClassName("refs-by-page-view")[0] ||
        sortContainer;
      const refsInView =
        refContainer === sortContainer
          ? Array.from(refContainer.children).filter((n) => n.tagName === "DIV")
          : Array.from(refContainer.getElementsByClassName("rm-ref-page-view"));
      refsInView.forEach((r) => refContainer.removeChild(r));
      if (isSortByBlocks) {
        const blocksInView = refsInView.flatMap((r) =>
          Array.from(r.lastElementChild?.children || []).filter(
            (c) => (c as HTMLDivElement).style.display !== "none"
          ).length === 1
            ? [r]
            : Array.from(r.lastElementChild?.children || []).map((c) => {
                const refClone = r.cloneNode(true) as HTMLDivElement;
                Array.from(refClone.lastElementChild?.children || []).forEach(
                  (cc) => {
                    const ccDiv = cc as HTMLDivElement;
                    if (
                      cc.getElementsByClassName("roam-block")[0]?.id ===
                      c.getElementsByClassName("roam-block")[0]?.id
                    ) {
                      ccDiv.style.display = "flex";
                    } else {
                      ccDiv.style.display = "none";
                    }
                  }
                );
                return refClone;
              })
        );
        const getRoamBlock = (e: Element) =>
          Array.from(e.lastElementChild?.children || [])
            .filter((c) => (c as HTMLDivElement).style.display != "none")[0]
            .getElementsByClassName("roam-block")[0] as HTMLDivElement;
        blocksInView.sort((a, b) => {
          const { blockUid: aUid } = getUids(getRoamBlock(a));
          const { blockUid: bUid } = getUids(getRoamBlock(b));
          return sortBy(aUid, bUid);
        });
        blocksInView.forEach((r) => refContainer.appendChild(r));
      } else {
        refsInView.sort((a, b) => {
          const aTitle = (a.getElementsByClassName(
            "rm-ref-page-view-title"
          )[0] || a.querySelector(".rm-zoom-item-content")) as HTMLDivElement;
          const bTitle = (b.getElementsByClassName(
            "rm-ref-page-view-title"
          )[0] || b.querySelector(".rm-zoom-item-content")) as HTMLDivElement;
          return sortBy(aTitle.textContent || "", bTitle.textContent || "");
        });
        refsInView.forEach((r) => refContainer.appendChild(r));
      }
    };

  const sortCallbacks = {
    Alphabetically: (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) =>
        isSortByBlocks
          ? getTextByBlockUid(a).localeCompare(getTextByBlockUid(b))
          : a.localeCompare(b)
      ),
    "Alphabetically Descending": (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) =>
        isSortByBlocks
          ? getTextByBlockUid(b).localeCompare(getTextByBlockUid(a))
          : b.localeCompare(a)
      ),
    "Word Count": (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) =>
        isSortByBlocks
          ? getWordCountByBlockUid(a) - getWordCountByBlockUid(b)
          : getWordCountByPageTitle(a) - getWordCountByPageTitle(b)
      ),
    "Word Count Descending": (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) =>
        isSortByBlocks
          ? getWordCountByBlockUid(b) - getWordCountByBlockUid(a)
          : getWordCountByPageTitle(b) - getWordCountByPageTitle(a)
      ),
    "Created Date": (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) =>
        isSortByBlocks
          ? getCreateTimeByBlockUid(a) - getCreateTimeByBlockUid(b)
          : getCreatedTimeByTitle(a) - getCreatedTimeByTitle(b)
      ),
    "Created Date Descending": (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) =>
        isSortByBlocks
          ? getCreateTimeByBlockUid(b) - getCreateTimeByBlockUid(a)
          : getCreatedTimeByTitle(b) - getCreatedTimeByTitle(a)
      ),
    "Edited Date": (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) =>
        isSortByBlocks
          ? getEditTimeByBlockUid(a) - getEditTimeByBlockUid(b)
          : getEditTimeByTitle(a) - getEditTimeByTitle(b)
      ),
    "Edited Date Descending": (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) =>
        isSortByBlocks
          ? getEditTimeByBlockUid(b) - getEditTimeByBlockUid(a)
          : getEditTimeByTitle(b) - getEditTimeByTitle(a)
      ),
    "Daily Note": (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) => {
        const aText = isSortByBlocks ? getTextByBlockUid(a) : a;
        const bText = isSortByBlocks ? getTextByBlockUid(b) : b;
        const aDate = window.roamAlphaAPI.util.pageTitleToDate(aText);
        const bDate = window.roamAlphaAPI.util.pageTitleToDate(bText);
        if (!aDate && !bDate) {
          return isSortByBlocks
            ? getCreateTimeByBlockUid(a) - getCreateTimeByBlockUid(b)
            : getCreatedTimeByTitle(a) - getCreatedTimeByTitle(b);
        } else if (!aDate) {
          return 1;
        } else if (!bDate) {
          return -1;
        } else {
          return aDate.valueOf() - bDate.valueOf();
        }
      }),
    "Daily Note Descending": (refContainer: Element) =>
      menuItemCallback(refContainer, (a, b) => {
        const aText = isSortByBlocks ? getTextByBlockUid(a) : a;
        const bText = isSortByBlocks ? getTextByBlockUid(b) : b;
        const aDate = window.roamAlphaAPI.util.pageTitleToDate(aText);
        const bDate = window.roamAlphaAPI.util.pageTitleToDate(bText);
        if (!aDate && !bDate) {
          return isSortByBlocks
            ? getCreateTimeByBlockUid(b) - getCreateTimeByBlockUid(a)
            : getCreatedTimeByTitle(b) - getCreatedTimeByTitle(a);
        } else if (!aDate) {
          return 1;
        } else if (!bDate) {
          return -1;
        } else {
          return bDate.valueOf() - aDate.valueOf();
        }
      }),
  };

  const onCreateSortIcons = (container: HTMLDivElement) => {
    const blockConfig = getBasicTreeByParentUid(getUids(container).blockUid);

    const defaultSort = (getSettingValueFromTree({
      tree: blockConfig,
      key: "Default Sort",
    }) ||
      extensionAPI.settings.get("default-sort")) as keyof typeof sortCallbacks;
    if (defaultSort && sortCallbacks[defaultSort]) {
      sortCallbacks[defaultSort](container)();
    }
  };

  const randomize = (q: HTMLDivElement) => {
    const blockConfig = getBasicTreeByParentUid(
      getUids(q.closest<HTMLDivElement>(".roam-block")).blockUid
    );
    const numRandomResults = getSettingIntFromTree({
      key: "Random",
      tree: blockConfig,
    });
    const refsByPageView = q.querySelector(".refs-by-page-view");
    const allChildren = Array.from(
      q.getElementsByClassName("rm-reference-item")
    );
    const selected = allChildren
      .sort(() => 0.5 - Math.random())
      .slice(0, numRandomResults);
    Array.from(refsByPageView?.children || []).forEach((c: Element) => {
      if (selected.find((s) => c.contains(s))) {
        const itemContainer = c.lastElementChild;
        Array.from(itemContainer?.children || []).forEach((cc: Element) => {
          if (selected.find((s) => cc.contains(s))) {
            (cc as HTMLDivElement).style.display = "flex";
            (c as HTMLDivElement).style.display = "block";
          } else {
            (cc as HTMLDivElement).style.display = "none";
          }
        });
      } else {
        (c as HTMLDivElement).style.display = "none";
      }
    });
  };

  const createIconButton = (icon: string) => {
    const popoverButton = document.createElement("span");
    popoverButton.className = "bp3-button bp3-minimal bp3-small";
    popoverButton.tabIndex = 0;
    const popoverIcon = document.createElement("span");
    popoverIcon.className = `bp3-icon bp3-icon-${icon}`;
    popoverButton.appendChild(popoverIcon);
    return popoverButton;
  };

  const createSortIcon = (
    refContainer: HTMLDivElement,
    sortCallbacks: { [key: string]: (refContainer: Element) => () => void }
  ): HTMLSpanElement => {
    // Icon Button
    const popoverWrapper = document.createElement("span");
    popoverWrapper.className = `bp3-popover-wrapper sort-popover-wrapper`;

    const popoverTarget = document.createElement("span");
    popoverTarget.className = "bp3-popover-target";
    popoverWrapper.appendChild(popoverTarget);

    const popoverButton = createIconButton("sort");
    popoverTarget.appendChild(popoverButton);

    // Overlay Content
    const popoverOverlay = document.createElement("div");
    popoverOverlay.className = "bp3-overlay bp3-overlay-inline";
    popoverWrapper.appendChild(popoverOverlay);

    const transitionContainer = document.createElement("div");
    transitionContainer.className =
      "bp3-transition-container bp3-popover-enter-done";
    transitionContainer.style.position = "absolute";
    transitionContainer.style.willChange = "transform";
    transitionContainer.style.top = "0";
    transitionContainer.style.left = "0";

    const popover = document.createElement("div");
    popover.className = "bp3-popover";
    popover.style.transformOrigin = "162px top";
    transitionContainer.appendChild(popover);

    const popoverContent = document.createElement("div");
    popoverContent.className = "bp3-popover-content";
    popover.appendChild(popoverContent);

    const menuUl = document.createElement("ul");
    menuUl.className = "bp3-menu";
    popoverContent.appendChild(menuUl);

    let selectedMenuItem: HTMLAnchorElement;
    const createMenuItem = (text: string, sortCallback: () => void) => {
      const liItem = document.createElement("li");
      const aMenuItem = document.createElement("a");
      aMenuItem.className = "bp3-menu-item bp3-popover-dismiss";
      liItem.appendChild(aMenuItem);
      const menuItemText = document.createElement("div");
      menuItemText.className = "bp3-text-overflow-ellipsis bp3-fill";
      menuItemText.innerText = text;
      aMenuItem.appendChild(menuItemText);
      menuUl.appendChild(liItem);
      aMenuItem.onclick = (e) => {
        sortCallback();
        aMenuItem.style.fontWeight = "600";
        if (selectedMenuItem) {
          selectedMenuItem.style.fontWeight = "";
        }
        selectedMenuItem = aMenuItem;
        e.stopImmediatePropagation();
        e.preventDefault();
      };
      aMenuItem.onmousedown = (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
      };
    };
    Object.keys(sortCallbacks).forEach((k: keyof typeof sortCallbacks) =>
      createMenuItem(`Sort By ${k}`, sortCallbacks[k](refContainer))
    );

    let popoverOpen = false;
    const documentEventListener = (e: MouseEvent) => {
      if (
        (!e.target || !popoverOverlay.contains(e.target as HTMLElement)) &&
        popoverOpen
      ) {
        closePopover();
      }
    };

    const closePopover = () => {
      popoverOverlay.className = "bp3-overlay bp3-overlay-inline";
      popoverOverlay.removeChild(transitionContainer);
      document.removeEventListener("click", documentEventListener);
      popoverOpen = false;
    };

    popoverButton.onmousedown = (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
    };

    popoverButton.onclick = (e) => {
      if (!popoverOpen) {
        transitionContainer.style.transform = `translate3d(${
          popoverButton.offsetLeft <= 240
            ? popoverButton.offsetLeft
            : popoverButton.offsetLeft - 240
        }px, ${popoverButton.offsetTop + 24}px, 0px)`;
        popoverOverlay.className =
          "bp3-overlay bp3-overlay-open bp3-overlay-inline";
        popoverOverlay.appendChild(transitionContainer);
        e.stopImmediatePropagation();
        e.preventDefault();
        document.addEventListener("click", documentEventListener);
        popoverOpen = true;
      } else {
        closePopover();
      }
    };
    return popoverWrapper;
  };

  const observerCallback = () => {
    const sortButtonContainers = Array.from(
      document.getElementsByClassName("rm-query-content")
    ) as HTMLDivElement[];
    sortButtonContainers.forEach((sortButtonContainer) => {
      const exists =
        sortButtonContainer.getElementsByClassName("sort-popover-wrapper")
          .length > 0;
      if (exists) {
        return;
      }

      const popoverWrapper = createSortIcon(sortButtonContainer, sortCallbacks);
      const before = sortButtonContainer.children[1];
      sortButtonContainer.insertBefore(popoverWrapper, before);

      onCreateSortIcons(sortButtonContainer);
    });

    // Randomization
    const queries = Array.from(
      document.getElementsByClassName("rm-query-content")
    ).filter(
      (e) => !e.getAttribute("data-is-random-results")
    ) as HTMLDivElement[];
    queries.forEach((q) => {
      const config = getBasicTreeByParentUid(
        getUids(q.closest<HTMLDivElement>(".roam-block")).blockUid
      );
      if (getSettingIntFromTree({ tree: config, key: "Random" })) {
        q.setAttribute("data-is-random-results", "true");
        const randomIcon = createIconButton("reset");
        q.insertBefore(randomIcon, q.lastElementChild);
        randomIcon.onclick = (e) => {
          randomize(q);
          e.stopPropagation();
          e.preventDefault();
        };
        randomIcon.onmousedown = (e) => {
          e.stopImmediatePropagation();
          e.preventDefault();
        };
        randomize(q);
      }
    });

    // Alias
    const queryTitles = Array.from(
      document.getElementsByClassName("rm-query-title-text")
    ).filter(
      (e) => !e.getAttribute("data-roamjs-query-alias")
    ) as HTMLDivElement[];
    queryTitles.forEach((q) => {
      const block = q.closest<HTMLDivElement>(".roam-block");
      if (block) {
        const config = getBasicTreeByParentUid(getUids(block).blockUid);
        const alias = getSettingValueFromTree({ tree: config, key: "Alias" });
        if (alias) {
          q.setAttribute("data-roamjs-query-alias", "true");
          q.innerText = alias;
        }
      }
    });

    // Context
    const unContextedQueries = Array.from(
      document.getElementsByClassName("rm-query-content")
    ).filter(
      (e) => !e.getAttribute("data-is-contexted-results")
    ) as HTMLDivElement[];
    if (unContextedQueries.length) {
      unContextedQueries.forEach((q) => {
        const config = getBasicTreeByParentUid(
          getUids(q.closest<HTMLDivElement>(".roam-block")).blockUid
        );
        const configContext =
          getSettingValueFromTree({ tree: config, key: "Context" }) ||
          (extensionAPI.settings.get("context") as string);
        if (configContext) {
          q.setAttribute("data-is-contexted-results", "true");
          const context = Number.isNaN(configContext)
            ? configContext
            : parseInt(configContext);
          const contexts = Array.from(
            q.getElementsByClassName("zoom-mentions-view")
          ).filter((c) => c.childElementCount);
          contexts.forEach((ctx) => {
            const children = Array.from(
              ctx.children
            ).reverse() as HTMLDivElement[];
            const index = !Number.isNaN(context)
              ? Math.min(Number(context), children.length)
              : children.length;
            children[index - 1].click();
          });
        }
      });
    }
  };

  observerCallback();
  return createObserver(observerCallback);
};

export default runQueryTools;
