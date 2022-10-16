import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import {
  CustomField,
  Field,
} from "roamjs-components/components/ConfigPanels/types";
import DiscourseNodeConfigPanel from "./components/DiscourseNodeConfigPanel";
import DiscourseRelationConfigPanel from "./components/DiscourseRelationConfigPanel";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import DEFAULT_RELATION_VALUES from "./data/defaultDiscourseRelations";
import { OnloadArgs } from "roamjs-components/types";

export const SETTING = "discourse-graphs";

const initializeDiscourseGraphsMode = (
  extensionAPI: OnloadArgs["extensionAPI"]
) => {
  const unloads = new Set<() => void>();
  const toggle = async (flag: boolean) => {
    if (flag) {
      const { pageUid, observer } = await createConfigObserver({
        title: "roam/js/discourse-graph",
        config: {
          tabs: [
            //   {
            //     id: "home",
            //     fields: [
            //       {
            //         title: "trigger",
            //         description:
            //           "The trigger to create the node menu. Must refresh after editing.",
            //         defaultValue: "\\",
            //         Panel: TextPanel,
            //       },
            //       {
            //         title: "hide page metadata",
            //         description:
            //           "Whether or not to display the page author and created date under each title",
            //         Panel: FlagPanel,
            //       },
            //       {
            //         title: "preview",
            //         description:
            //           "Whether or not to display page previews when hovering over page refs",
            //         Panel: FlagPanel,
            //         options: {
            //           onChange: onPageRefObserverChange(previewPageRefHandler),
            //         },
            //       } as Field<FlagField>,
            //       {
            //         title: "render references",
            //         Panel: FlagPanel,
            //         description:
            //           "Whether or not to render linked references within outline sidebar",
            //       },
            //       {
            //         title: "subscriptions",
            //         description:
            //           "Subscription User Settings to notify you of latest changes",
            //         Panel: CustomPanel,
            //         options: {
            //           component: SubscriptionConfigPanel,
            //         },
            //       } as Field<CustomField>,
            //     ],
            //   },
            {
              id: "grammar",
              fields: [
                {
                  title: "nodes",
                  Panel: CustomPanel,
                  description: "The types of nodes in your discourse graph",
                  options: {
                    component: DiscourseNodeConfigPanel,
                  },
                } as Field<CustomField>,
                {
                  title: "relations",
                  Panel: CustomPanel,
                  description: "The types of relations in your discourse graph",
                  defaultValue: DEFAULT_RELATION_VALUES,
                  options: {
                    component: DiscourseRelationConfigPanel,
                  },
                } as Field<CustomField>,
                //   {
                //     title: "overlay",
                //     Panel: FlagPanel,
                //     description:
                //       "Whether to overlay discourse context information over node references",
                //     options: {
                //       onChange: (val) => {
                //         onPageRefObserverChange(overlayPageRefHandler)(val);
                //       },
                //     },
                //   } as Field<FlagField>,
              ],
            },
            //   {
            //     id: "export",
            //     fields: [
            //       {
            //         title: "max filename length",
            //         Panel: NumberPanel,
            //         description:
            //           "Set the maximum name length for markdown file exports",
            //         defaultValue: 64,
            //       },
            //       {
            //         title: "remove special characters",
            //         Panel: FlagPanel,
            //         description:
            //           "Whether or not to remove the special characters in a file name",
            //       },
            //       {
            //         title: "simplified filename",
            //         Panel: FlagPanel,
            //         description:
            //           "For discourse nodes, extract out the {content} from the page name to become the file name",
            //       },
            //       {
            //         title: "frontmatter",
            //         Panel: MultiTextPanel,
            //         description:
            //           "Specify all the lines that should go to the Frontmatter of the markdown file",
            //       },
            //       {
            //         title: "resolve block references",
            //         Panel: FlagPanel,
            //         description:
            //           "Replaces block references in the markdown content with the block's content",
            //       },
            //       {
            //         title: "resolve block embeds",
            //         Panel: FlagPanel,
            //         description:
            //           "Replaces block embeds in the markdown content with the block's content tree",
            //       },
            //       {
            //         title: "link type",
            //         Panel: SelectPanel,
            //         description: "How to format links that appear in your export",
            //         options: {
            //           items: ["alias", "wikilinks"],
            //         },
            //       } as Field<SelectField>,
            //     ],
            //   },
          ],
          // versioning,
        },
      });
      unloads.add(() => {
        observer.disconnect();
      });
    } else {
      unloads.forEach((u) => u());
      unloads.clear();
    }
  };
  toggle(!!extensionAPI.settings.get(SETTING));
  return toggle;
};

export default initializeDiscourseGraphsMode;
