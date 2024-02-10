import React, { useEffect, useMemo, useState } from "react";
import ResizableDrawer from "./ResizableDrawer";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { DiscourseNodeShape } from "./TldrawCanvas";
import { Button, Collapse, Checkbox } from "@blueprintjs/core";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";

export type GroupedShapes = Record<string, DiscourseNodeShape[]>;

type Props = {
  groupedShapes: GroupedShapes;
  pageUid: string;
};

const CanvasDrawerContent = ({ groupedShapes, pageUid }: Props) => {
  const pageTitle = useMemo(() => getPageTitleByPageUid(pageUid), []);
  const noResults = Object.keys(groupedShapes).length === 0;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [filterType, setFilterType] = useState("All");
  const [filteredShapes, setFilteredShapes] = useState<GroupedShapes>({});

  useEffect(() => {
    const filtered = Object.entries(groupedShapes).reduce<GroupedShapes>(
      (acc, [uid, shapes]) => {
        const filteredShapes = shapes.filter((shape) => {
          if (filterType === "All") return true;
          const matchesType = filterType ? shape.type === filterType : true;
          return matchesType;
        });

        if (
          filteredShapes.length > 0 &&
          (!showDuplicates || filteredShapes.length > 1)
        ) {
          acc[uid] = filteredShapes;
        }

        return acc;
      },
      {}
    );

    setFilteredShapes(filtered);
  }, [groupedShapes, showDuplicates, filterType]);

  const toggleCollapse = (uid: string) => {
    setOpenSections((prevState) => ({
      ...prevState,
      [uid]: !prevState[uid],
    }));
  };

  return (
    <div>
      <div className="flex items-baseline justify-around my-4">
        <MenuItemSelect
          onItemSelect={(type) => setFilterType(type)}
          activeItem={filterType}
          items={["All", "type1", "type2", "type3"]}
        />
        <Checkbox
          label="Duplicates"
          checked={showDuplicates}
          onChange={() => setShowDuplicates(!showDuplicates)}
        />
      </div>
      {noResults ? (
        <div>No nodes found for {pageTitle}</div>
      ) : (
        Object.entries(filteredShapes).map(([uid, shapes]) => {
          const title = shapes[0].props.title;
          const isExpandable = shapes.length > 1;
          return (
            <div key={uid} style={{ marginBottom: "10px" }}>
              <Button
                onClick={() => isExpandable && toggleCollapse(uid)}
                icon={
                  isExpandable
                    ? openSections[uid]
                      ? "chevron-down"
                      : "chevron-right"
                    : "dot"
                }
                alignText="left"
                fill
                minimal
              >
                {title}
              </Button>
              <Collapse isOpen={openSections[uid]}>
                <div className="pt-2 " style={{ background: "#eeeeee80" }}>
                  {shapes.map((shape) => (
                    <Button
                      key={shape.id}
                      icon={"dot"}
                      onClick={() => console.log("clicked")}
                      alignText="left"
                      fill
                      minimal
                      className="ml-4"
                    >
                      {shape.props.title}
                    </Button>
                  ))}
                </div>
              </Collapse>
            </div>
          );
        })
      )}
    </div>
  );
};

const CanvasDrawer = ({
  onClose,
  ...props
}: { onClose: () => void } & Props) => (
  <ResizableDrawer onClose={onClose} title={"Nodes"}>
    <CanvasDrawerContent {...props} />
  </ResizableDrawer>
);

export const render = (props: Props) =>
  renderOverlay({ Overlay: CanvasDrawer, props });

export default CanvasDrawer;
