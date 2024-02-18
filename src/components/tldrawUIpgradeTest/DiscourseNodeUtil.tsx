import {
  HTMLContainer,
  Rectangle2d,
  ShapeProps,
  ShapeUtil,
  T,
  TLBaseShape,
} from "@tldraw/tldraw";
import React from "react";
import { DiscourseNode } from "./TldrawUpgrade";

export type DiscourseNodeShape = TLBaseShape<
  string,
  {
    w: number;
    h: number;
    uid: string;
    title: string;
    // color: string;
  }
>;

export const NodeUtilProps: ShapeProps<DiscourseNodeShape> = {
  w: T.number,
  h: T.number,
  uid: T.string,
  title: T.string,
  // color: T.string,
};

export const createShapeUtilsForNodes = (nodes: DiscourseNode[]) => {
  return nodes.map((node) => {
    class CustomCardShapeUtil extends DiscourseNodeUtil {
      static override type = node.type;
      // getDefaultProps(): DiscourseNodeShape["props"] {
      //   const baseProps = super.getDefaultProps();
      //   return {
      //     ...baseProps,
      //     color: node.color,
      //   };
      // }
    }
    return CustomCardShapeUtil;
  });
};

class DiscourseNodeUtil extends ShapeUtil<DiscourseNodeShape> {
  // Required
  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;
  override canEdit = () => true;
  getGeometry(shape: DiscourseNodeShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      // opacity: "1" as DiscourseNodeShape["props"]["opacity"],
      w: 160,
      h: 64,
      uid: window.roamAlphaAPI.util.generateUID(),
      title: "",
    };
  }

  indicator(shape: DiscourseNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  component(shape: DiscourseNodeShape) {
    const extensionAPI = useExtensionAPI();
    const {
      canvasSettings: { alias = "", "key-image": isKeyImage = "" } = {},
    } = discourseContext.nodes[this.type] || {};
    const isEditing = useValue(
      "isEditing",
      () => this.app.editingId === shape.id,
      [this.app, shape.id]
    );
    const [isLabelEditOpen, setIsEditLabelOpen] = useState(false);
    useEffect(() => {
      if (isEditing) setIsEditLabelOpen(true);
    }, [isEditing, setIsEditLabelOpen]);
    const contentRef = useRef<HTMLDivElement>(null);
    const [loaded, setLoaded] = useState("");
    useEffect(() => {
      if (
        shape.props.uid !== loaded &&
        !isPageUid(shape.props.uid) &&
        contentRef.current &&
        isLiveBlock(shape.props.uid)
      ) {
        window.roamAlphaAPI.ui.components.renderBlock({
          el: contentRef.current,
          uid: shape.props.uid,
        });
        // TODO: resize shape props once this is rendered
        setLoaded(shape.props.uid);
      }
    }, [setLoaded, loaded, contentRef, shape.props.uid]);
    useEffect(() => {
      const listener = (e: CustomEvent) => {
        if (e.detail === shape.id) {
          setIsEditLabelOpen(true);
          this.app.setEditingId(shape.id);
        }
      };
      document.body.addEventListener(
        "roamjs:query-builder:created-canvas-node",
        listener as EventListener
      );
      return () => {
        document.body.removeEventListener(
          "roamjs:query-builder:created-canvas-node",
          listener as EventListener
        );
      };
    }, [setIsEditLabelOpen]);

    const { backgroundCss, textColor } = this.getColors();

    const setSizeAndImgProps = async ({
      context,
      text,
      uid,
    }: {
      context: DiscourseNodeUtil;
      text: string;
      uid: string;
    }) => {
      if (!extensionAPI) return;
      const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
        nodeText: text,
        uid,
        nodeType: this.type,
        extensionAPI,
      });
      context.updateProps(shape.id, {
        h,
        w,
        imageUrl,
      });
    };

    return (
      <HTMLContainer
        id={shape.id}
        className="flex items-center justify-center pointer-events-auto rounded-2xl roamjs-tldraw-node overflow-hidden"
        style={{
          background: backgroundCss,
          color: textColor,
        }}
      >
        <div style={{ pointerEvents: "all" }}>
          {shape.props.imageUrl && isKeyImage ? (
            <img
              src={shape.props.imageUrl}
              className="w-full object-cover h-auto"
              draggable="false"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          <div
            ref={contentRef}
            style={{ ...DEFAULT_STYLE_PROPS, maxWidth: "" }}
          >
            {alias
              ? new RegExp(alias).exec(shape.props.title)?.[1] ||
                shape.props.title
              : shape.props.title}
          </div>
          <LabelDialog
            initialUid={shape.props.uid}
            isOpen={isLabelEditOpen}
            onClose={() => {
              this.app.setEditingId(null);
              setIsEditLabelOpen(false);
            }}
            label={shape.props.title}
            nodeType={this.type}
            discourseContext={discourseContext}
            onSuccess={async ({ text, uid, action }) => {
              if (action === "editing") {
                if (isPageUid(shape.props.uid))
                  await window.roamAlphaAPI.updatePage({
                    page: {
                      uid: shape.props.uid,
                      title: text,
                    },
                  });
                else await updateBlock({ uid: shape.props.uid, text });
              }

              if (action === "creating" && !getPageUidByPageTitle(text)) {
                createDiscourseNode({
                  configPageUid: shape.type,
                  text,
                  newPageUid: uid,
                });
              }

              // Update Shape Props
              setSizeAndImgProps({ context: this, text, uid });
              this.updateProps(shape.id, {
                title: text,
                uid,
              });

              // Update Shape Relations
              const allRecords = this.app.store.allRecords();
              const relationIds = getRelationIds();
              this.deleteRelationsInCanvas(shape, {
                allRecords,
                relationIds,
              });
              await this.createExistingRelations(shape, {
                allRecords,
                relationIds,
                finalUid: uid,
              });

              setIsEditLabelOpen(false);
              this.app.setEditingId(null);
            }}
            onCancel={() => {
              this.app.setEditingId(null);
              setIsEditLabelOpen(false);
              if (!isLiveBlock(shape.props.uid)) {
                this.app.deleteShapes([shape.id]);
              }
            }}
          />
        </div>
      </HTMLContainer>
    );
  }
}

// export class DiscourseNodeUtil extends ShapeUtil<DiscourseNodeShape> {
//   // Required
//   type = "asdf" as const;
//   static override props = NodeUtilProps;
//   // static override migrations = cardShapeMigrations;

//   override isAspectRatioLocked = () => false;
//   override canResize = () => true;
//   override canBind = () => true;
//   override canEdit = () => true;

//   getGeometry(shape: DiscourseNodeShape) {
//     return new Rectangle2d({
//       width: shape.props.w,
//       height: shape.props.h,
//       isFilled: true,
//     });
//   }
//   getDefaultProps(): DiscourseNodeShape["props"] {
//     return {
//       // opacity: "1" as DiscourseNodeShape["props"]["opacity"],
//       w: 160,
//       h: 64,
//       uid: "123",
//       title: "",
//       color: "black",
//     };
//   }
//   component(shape: DiscourseNodeShape) {
//     return (
//       <HTMLContainer
//         id={shape.id}
//         className="flex items-center justify-center pointer-events-auto rounded-2xl roamjs-tldraw-node overflow-hidden"
//         style={{
//           background: "rgba(255, 255, 255, 0.9)",
//           color: "black",
//         }}
//       >
//         <div style={{ pointerEvents: "all" }}>
//           <img
//             src={"https://placehold.co/600x600"}
//             className="w-full object-cover h-auto"
//             draggable="false"
//             style={{ pointerEvents: "none" }}
//           />
//         </div>
//       </HTMLContainer>
//     );
//   }
//   indicator(shape: DiscourseNodeShape) {
//     return <rect width={shape.props.w} height={shape.props.h} />;
//   }
// }
