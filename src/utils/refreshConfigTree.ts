import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageTitlesStartingWithPrefix from "roamjs-components/queries/getPageTitlesStartingWithPrefix";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getDiscourseRelationLabels from "./getDiscourseRelationLabels";
import discourseConfigRef from "./discourseConfigRef";
import registerDiscourseDatalogTranslators from "./registerDiscourseDatalogTranslators";
import { unregisterDatalogTranslator } from "./conditionToDatalog";

const refreshConfigTree = () => {
  getDiscourseRelationLabels().forEach((key) =>
    unregisterDatalogTranslator({ key })
  );
  discourseConfigRef.tree = getBasicTreeByParentUid(
    getPageUidByPageTitle("roam/js/discourse-graph")
  );
  const titles = getPageTitlesStartingWithPrefix("discourse-graph/nodes");
  discourseConfigRef.nodes = Object.fromEntries(
    titles.map((title) => {
      const uid = getPageUidByPageTitle(title);
      return [
        uid,
        {
          text: title.substring("discourse-graph/nodes/".length),
          children: getBasicTreeByParentUid(uid),
        },
      ];
    })
  );
  registerDiscourseDatalogTranslators();
};

export default refreshConfigTree;
