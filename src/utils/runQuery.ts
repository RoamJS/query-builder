import type { OnloadArgs } from "roamjs-components/types/native";
import fireQuery, { QueryArgs } from "./fireQuery";
import parseQuery from "./parseQuery";
import parseResultSettings from "./parseResultSettings";
import postProcessResults from "./postProcessResults";

const runQuery = ({
  parentUid,
  extensionAPI,
  inputs,
}: {
  parentUid: string;
  extensionAPI: OnloadArgs["extensionAPI"];
  inputs?: QueryArgs["inputs"];
}) => {
  const queryArgs = Object.assign(parseQuery(parentUid), { inputs });
  return fireQuery(queryArgs).then((results) => {
    const settings = parseResultSettings(
      parentUid,
      ["text"].concat(queryArgs.selections.map((s) => s.label)),
      extensionAPI
    );
    return postProcessResults(results, settings);
  });
};

export default runQuery;
