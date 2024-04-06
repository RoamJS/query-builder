import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageViewType from "roamjs-components/queries/getPageViewType";
import { PullBlock, TreeNode, ViewType } from "roamjs-components/types";
import { Result } from "roamjs-components/types/query-builder";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import XRegExp from "xregexp";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getDiscourseNodes from "./getDiscourseNodes";
import isFlagEnabled from "./isFlagEnabled";
import matchDiscourseNode from "./matchDiscourseNode";
import getDiscourseRelations from "./getDiscourseRelations";
import type { ExportDialogProps } from "../components/Export";
import getPageMetadata from "./getPageMetadata";
import getDiscourseContextResults from "./getDiscourseContextResults";
import fireQuery from "./fireQuery";
import { ExportTypes } from "./types";
import {
  findReferencedNodeInText,
  getReferencedNodeInFormat,
} from "./formatUtils";

export const updateExportProgress = (detail: {
  progress: number;
  id: string;
}) =>
  document.body.dispatchEvent?.(
    new CustomEvent("roamjs:export:progress", {
      detail,
    })
  );

const pullBlockToTreeNode = (n: PullBlock, v: `:${ViewType}`): TreeNode => ({
  text: n[":block/string"] || n[":node/title"] || "",
  open: typeof n[":block/open"] === "undefined" ? true : n[":block/open"],
  order: n[":block/order"] || 0,
  uid: n[":block/uid"] || "",
  heading: n[":block/heading"] || 0,
  viewType: (n[":children/view-type"] || v).slice(1) as ViewType,
  editTime: new Date(n[":edit/time"] || 0),
  props: { imageResize: {}, iframe: {} },
  textAlign: n[":block/text-align"] || "left",
  children: ((n[":block/children"] || []) as PullBlock[])
    .sort(({ [":block/order"]: a = 0 }, { [":block/order"]: b = 0 }) => a - b)
    .map((r) => pullBlockToTreeNode(r, n[":children/view-type"] || v)),
  parents: (n[":block/parents"] || []).map((p) => p[":db/id"] || 0),
});

const getContentFromNodes = ({
  title,
  allNodes,
}: {
  title: string;
  allNodes: ReturnType<typeof getDiscourseNodes>;
}) => {
  const nodeFormat = allNodes.find((a) =>
    matchDiscourseNode({ title, ...a })
  )?.format;
  if (!nodeFormat) return title;
  const regex = new RegExp(
    `^${nodeFormat
      .replace(/\[/g, "\\[")
      .replace(/]/g, "\\]")
      .replace("{content}", "(.*?)")
      .replace(/{[^}]+}/g, "(?:.*?)")}$`
  );
  return regex.exec(title)?.[1] || title;
};

const getFilename = ({
  title = "",
  maxFilenameLength,
  simplifiedFilename,
  allNodes,
  removeSpecialCharacters,
  extension = ".md",
}: {
  title?: string;
  maxFilenameLength: number;
  simplifiedFilename: boolean;
  allNodes: ReturnType<typeof getDiscourseNodes>;
  removeSpecialCharacters: boolean;
  extension?: string;
}) => {
  const baseName = simplifiedFilename
    ? getContentFromNodes({ title, allNodes })
    : title;
  const name = `${
    removeSpecialCharacters
      ? baseName.replace(/[<>:"/\\|\?*[\]]/g, "")
      : baseName
  }${extension}`;

  return name.length > maxFilenameLength
    ? `${name.substring(
        0,
        Math.ceil((maxFilenameLength - 3) / 2)
      )}...${name.slice(-Math.floor((maxFilenameLength - 3) / 2))}`
    : name;
};

const uniqJsonArray = <T extends Record<string, unknown>>(arr: T[]) =>
  Array.from(
    new Set(
      arr.map((r) =>
        JSON.stringify(
          Object.entries(r).sort(([k], [k2]) => k.localeCompare(k2))
        )
      )
    )
  ).map((entries) => Object.fromEntries(JSON.parse(entries))) as T[];
const viewTypeToPrefix = {
  bullet: "- ",
  document: "",
  numbered: "1. ",
};

const collectUids = (t: TreeNode): string[] => [
  t.uid,
  ...t.children.flatMap(collectUids),
];

const MATCHES_NONE = /$.+^/;
const EMBED_REGEX = /{{(?:\[\[)embed(?:\]\]):\s*\(\(([\w\d-]{9,10})\)\)\s*}}/;

const toLink = (s: string, linkType: string) => {
  if (linkType === "wikilinks") return `[[${s.replace(/\.md$/, "")}]]`;
  if (linkType === "alias") return `[${s}](${s})`;
  return s;
};

const toMarkdown = ({
  c,
  i = 0,
  v = "bullet",
  opts,
}: {
  c: TreeNode;
  i?: number;
  v?: ViewType;
  opts: {
    refs: boolean;
    embeds: boolean;
    simplifiedFilename: boolean;
    maxFilenameLength: number;
    allNodes: ReturnType<typeof getDiscourseNodes>;
    removeSpecialCharacters: boolean;
    linkType: string;
    flatten?: boolean;
  };
}): string => {
  const {
    refs,
    embeds,
    simplifiedFilename,
    maxFilenameLength,
    allNodes,
    removeSpecialCharacters,
    linkType,
    flatten = false,
  } = opts;
  const processedText = c.text
    .replace(refs ? BLOCK_REF_REGEX : MATCHES_NONE, (_, blockUid) => {
      const reference = getTextByBlockUid(blockUid);
      return reference || blockUid;
    })
    .replace(embeds ? EMBED_REGEX : MATCHES_NONE, (_, blockUid) => {
      const reference = getFullTreeByParentUid(blockUid);
      return toMarkdown({ c: reference, i, v, opts });
    })
    .replace(/{{\[\[TODO\]\]}}/g, v === "bullet" ? "[ ]" : "- [ ]")
    .replace(/{{\[\[DONE\]\]}}/g, v === "bullet" ? "[x]" : "- [x]")
    .replace(/\_\_(.+?)\_\_/g, "_$1_") // convert Roam italics __ to markdown italics _
    .replace(/(?<!\n)```/g, "\n```") // Add line break before last code blocks
    .trim();
  const finalProcessedText =
    simplifiedFilename || removeSpecialCharacters
      ? XRegExp.matchRecursive(processedText, "#?\\[\\[", "\\]\\]", "i", {
          valueNames: ["between", "left", "match", "right"],
          unbalanced: "skip",
        })
          .map((s) => {
            if (s.name === "match") {
              const name = getFilename({
                title: s.value,
                allNodes,
                maxFilenameLength,
                simplifiedFilename,
                removeSpecialCharacters,
              });
              return toLink(name, linkType);
            } else if (s.name === "left" || s.name === "right") {
              return "";
            } else {
              return s.value;
            }
          })
          .join("") || processedText
      : processedText;
  const indentation = flatten ? "" : "".padStart(i * 4, " ");
  const viewTypePrefix = viewTypeToPrefix[v];
  const headingPrefix = c.heading ? `${"".padStart(c.heading, "#")} ` : "";
  const childrenMarkdown = (c.children || [])
    .filter((nested) => !!nested.text || !!nested.children?.length)
    .map((nested) => {
      const childViewType = v !== "bullet" ? v : nested.viewType || "bullet";
      const childMarkdown = toMarkdown({
        c: nested,
        i: i + 1,
        v: childViewType,
        opts,
      });
      return `\n${childMarkdown}`;
    })
    .join("");
  const lineBreak = v === "document" ? "\n" : "";

  return `${indentation}${viewTypePrefix}${headingPrefix}${finalProcessedText}${lineBreak}${childrenMarkdown}`;
};

const handleDiscourseContext = async ({
  includeDiscourseContext,
  uid,
  pageTitle,
  isSamePageEnabled,
  appendRefNodeContext,
}: {
  includeDiscourseContext: boolean;
  uid: string;
  pageTitle: string;
  isSamePageEnabled: boolean;
  appendRefNodeContext: boolean;
}) => {
  if (!includeDiscourseContext) return [];

  const discourseResults = await getDiscourseContextResults({
    uid,
    isSamePageEnabled,
  });
  if (!appendRefNodeContext) return discourseResults;

  const referencedDiscourseNode = getReferencedNodeInFormat({ uid });
  if (referencedDiscourseNode) {
    const referencedResult = findReferencedNodeInText({
      text: pageTitle,
      discourseNode: referencedDiscourseNode,
    });
    if (!referencedResult) return discourseResults;
    const appendedContext = {
      label: referencedDiscourseNode.text,
      results: { [referencedResult.uid]: referencedResult },
    };
    return [...discourseResults, appendedContext];
  }

  return discourseResults;
};

type getExportTypesProps = {
  results?: ExportDialogProps["results"];
  exportId: string;
  isExportDiscourseGraph: boolean;
};

export type DiscourseExportResult = Result & { type: string };

const getExportTypes = ({
  results,
  exportId,
  isExportDiscourseGraph,
}: getExportTypesProps): ExportTypes => {
  const allRelations = getDiscourseRelations();
  const allNodes = getDiscourseNodes(allRelations);
  const nodeLabelByType = Object.fromEntries(
    allNodes.map((a) => [a.type, a.text])
  );
  nodeLabelByType["*"] = "Any";
  const getPageData = async (
    isSamePageEnabled: boolean,
    isExportDiscourseGraph?: boolean
  ): Promise<(Result & { type: string })[]> => {
    const allResults =
      typeof results === "function"
        ? await results(isSamePageEnabled)
        : results || [];

    if (isExportDiscourseGraph) return allResults as DiscourseExportResult[];

    const matchedTexts = new Set();
    return allNodes.flatMap((n) =>
      (allResults
        ? allResults.flatMap((r) =>
            Object.keys(r)
              .filter((k) => k.endsWith(`-uid`) && k !== "text-uid")
              .map((k) => ({
                ...r,
                text: r[k.slice(0, -4)].toString(),
                uid: r[k] as string,
              }))
              .concat({
                text: r.text,
                uid: r.uid,
              })
          )
        : (
            window.roamAlphaAPI.q(
              "[:find (pull ?e [:block/uid :node/title]) :where [?e :node/title _]]"
            ) as [Record<string, string>][]
          ).map(([{ title, uid }]) => ({
            text: title,
            uid,
          }))
      )
        .filter(({ text }) => {
          if (matchedTexts.has(text)) return false;
          const isMatch = matchDiscourseNode({ title: text, ...n });
          if (isMatch) matchedTexts.add(text);

          return isMatch;
        })
        .map((node) => ({ ...node, type: n.text }))
    );
  };
  const getRelationData = (isSamePageEnabled: boolean) =>
    Promise.all(
      allRelations
        .filter(
          (s) =>
            s.triples.some((t) => t[2] === "source") &&
            s.triples.some((t) => t[2] === "destination")
        )
        .flatMap((s) => {
          const sourceLabel = nodeLabelByType[s.source];
          const targetLabel = nodeLabelByType[s.destination];
          return !sourceLabel || !targetLabel
            ? []
            : fireQuery({
                returnNode: sourceLabel,
                conditions: [
                  {
                    relation: s.label,
                    source: sourceLabel,
                    target: targetLabel,
                    uid: s.id,
                    type: "clause",
                  },
                ],
                selections: [
                  {
                    uid: window.roamAlphaAPI.util.generateUID(),
                    text: `node:${targetLabel}`,
                    label: "target",
                  },
                ],
                isSamePageEnabled,
              }).then((results) =>
                results.map((result) => ({
                  source: result.uid,
                  target: result["target-uid"],
                  label: s.label,
                }))
              );
        })
    ).then((r) => r.flat());
  const getJsonData = async (isSamePageEnabled: boolean) => {
    const grammar = allRelations.map(({ label, destination, source }) => ({
      label,
      destination: nodeLabelByType[destination],
      source: nodeLabelByType[source],
    }));
    const nodes = (await getPageData(isSamePageEnabled)).map(
      ({ text, uid }) => {
        const { date, displayName } = getPageMetadata(text);
        const { children } = getFullTreeByParentUid(uid);
        return {
          uid,
          title: text,
          children,
          date: date.toJSON(),
          createdBy: displayName,
        };
      }
    );
    const nodeSet = new Set(nodes.map((n) => n.uid));
    return getRelationData(isSamePageEnabled).then((rels) => {
      const relations = uniqJsonArray(
        rels.filter((r) => nodeSet.has(r.source) && nodeSet.has(r.target))
      );
      return { grammar, nodes, relations };
    });
  };
  const getExportSettings = () => {
    const configTree = getBasicTreeByParentUid(
      getPageUidByPageTitle("roam/js/discourse-graph")
    );
    const exportTree = getSubTree({
      tree: configTree,
      key: "export",
    });
    const maxFilenameLength = getSettingIntFromTree({
      tree: exportTree.children,
      key: "max filename length",
      defaultValue: 64,
    });
    const linkType = getSettingValueFromTree({
      tree: exportTree.children,
      key: "link type",
      defaultValue: "alias",
    });
    const removeSpecialCharacters = !!getSubTree({
      tree: exportTree.children,
      key: "remove special characters",
    }).uid;
    const simplifiedFilename = !!getSubTree({
      tree: exportTree.children,
      key: "simplified filename",
    }).uid;
    const frontmatter = getSubTree({
      tree: exportTree.children,
      key: "frontmatter",
    }).children.map((t) => t.text);
    const optsRefs = !!getSubTree({
      tree: exportTree.children,
      key: "resolve block references",
    }).uid;
    const optsEmbeds = !!getSubTree({
      tree: exportTree.children,
      key: "resolve block embeds",
    }).uid;
    const appendRefNodeContext = !!getSubTree({
      tree: exportTree.children,
      key: "append referenced node",
    }).uid;
    const yaml = frontmatter.length
      ? frontmatter
      : [
          "title: {text}",
          `url: https://roamresearch.com/#/app/${window.roamAlphaAPI.graph.name}/page/{uid}`,
          `author: {author}`,
          "date: {date}",
        ];
    return {
      yaml,
      optsRefs,
      optsEmbeds,
      simplifiedFilename,
      maxFilenameLength,
      removeSpecialCharacters,
      linkType,
      appendRefNodeContext,
    };
  };

  return [
    {
      name: "Markdown",
      callback: async ({
        isSamePageEnabled,
        includeDiscourseContext = false,
      }) => {
        const {
          yaml,
          optsRefs,
          optsEmbeds,
          simplifiedFilename,
          maxFilenameLength,
          removeSpecialCharacters,
          linkType,
          appendRefNodeContext,
        } = getExportSettings();
        const allPages = await getPageData(
          isSamePageEnabled,
          isExportDiscourseGraph
        );
        const gatherings = allPages.map(
          ({ text, uid, context: _, type, ...rest }, i, all) =>
            async function getMarkdownData() {
              updateExportProgress({ progress: i / all.length, id: exportId });
              // skip a beat to let progress render
              await new Promise((resolve) => setTimeout(resolve));
              const v = getPageViewType(text) || "bullet";
              const { date, displayName } = getPageMetadata(text);
              const resultCols = Object.keys(rest).filter(
                (k) => !k.includes("uid")
              );
              const yamlLines = yaml.concat(
                resultCols.map((k) => `${k}: {${k}}`)
              );
              const result: Result = {
                ...rest,
                date,
                text,
                uid,
                author: displayName,
                type,
              };
              const treeNode = getFullTreeByParentUid(uid);

              const discourseResults = await handleDiscourseContext({
                includeDiscourseContext,
                pageTitle: text,
                uid,
                isSamePageEnabled,
                appendRefNodeContext,
              });

              const referenceResults = isFlagEnabled("render references")
                ? (
                    window.roamAlphaAPI.data.fast.q(
                      `[:find (pull ?pr [:node/title]) (pull ?r [:block/heading [:block/string :as "text"] [:children/view-type :as "viewType"] {:block/children ...}]) :where [?p :node/title "${normalizePageTitle(
                        text
                      )}"] [?r :block/refs ?p] [?r :block/page ?pr]]`
                    ) as [PullBlock, PullBlock][]
                  ).filter(
                    ([, { [":block/children"]: children }]) =>
                      Array.isArray(children) && children.length
                  )
                : [];
              const content = `---\n${yamlLines
                .map((s) =>
                  s.replace(/{([^}]+)}/g, (_, capt: string) =>
                    result[capt].toString()
                  )
                )
                .join("\n")}\n---\n\n${treeNode.children
                .map((c) =>
                  toMarkdown({
                    c,
                    v,
                    i: 0,
                    opts: {
                      refs: optsRefs,
                      embeds: optsEmbeds,
                      simplifiedFilename,
                      allNodes,
                      maxFilenameLength,
                      removeSpecialCharacters,
                      linkType,
                    },
                  })
                )
                .join("\n")}\n${
                discourseResults.length
                  ? `\n###### Discourse Context\n\n${discourseResults
                      .flatMap((r) =>
                        Object.values(r.results).map(
                          (t) =>
                            `- **${r.label}::** ${toLink(
                              getFilename({
                                title: t.text,
                                maxFilenameLength,
                                simplifiedFilename,
                                allNodes,
                                removeSpecialCharacters,
                              }),
                              linkType
                            )}`
                        )
                      )
                      .join("\n")}\n`
                  : ""
              }${
                referenceResults.length
                  ? `\n###### References\n\n${referenceResults
                      .map(
                        (r_1) =>
                          `${toLink(
                            getFilename({
                              title: r_1[0][":node/title"],
                              maxFilenameLength,
                              simplifiedFilename,
                              allNodes,
                              removeSpecialCharacters,
                            }),
                            linkType
                          )}\n\n${toMarkdown({
                            c: pullBlockToTreeNode(r_1[1], ":bullet"),
                            opts: {
                              refs: optsRefs,
                              embeds: optsEmbeds,
                              simplifiedFilename,
                              allNodes,
                              maxFilenameLength,
                              removeSpecialCharacters,
                              linkType,
                            },
                          })}`
                      )
                      .join("\n")}\n`
                  : ""
              }`;
              const uids = new Set(collectUids(treeNode));
              return { title: text, content, uids };
            }
        );
        const pages = await gatherings.reduce(
          (p, c) =>
            p.then((arr) =>
              c().then((item) => {
                arr.push(item);
                return arr;
              })
            ),
          Promise.resolve(
            [] as Awaited<ReturnType<(typeof gatherings)[number]>>[]
          )
        );
        return pages.map(({ title, content }) => ({
          title: getFilename({
            title,
            maxFilenameLength,
            simplifiedFilename,
            allNodes,
            removeSpecialCharacters,
          }),
          content,
        }));
      },
    },
    {
      name: "JSON",
      callback: async ({ filename, isSamePageEnabled }) => {
        const data = await getJsonData(isSamePageEnabled);
        return [
          {
            title: `${filename.replace(/\.json$/, "")}.json`,
            content: JSON.stringify(data),
          },
        ];
      },
    },
    {
      name: "Neo4j",
      callback: async ({ filename, isSamePageEnabled }) => {
        const nodeHeader = "uid:ID,label:LABEL,title,author,date\n";
        const nodeData = (await getPageData(isSamePageEnabled))
          .map(({ text, uid, type }) => {
            const value = text.replace(new RegExp(`^\\[\\[\\w*\\]\\] - `), "");
            const { displayName, date } = getPageMetadata(text);
            return `${uid},${type.toUpperCase()},${
              value.includes(",") ? `"${value}"` : value
            },${displayName},"${date.toLocaleString()}"`;
          })
          .join("\n");
        const relationHeader = "start:START_ID,end:END_ID,label:TYPE\n";
        return getRelationData(isSamePageEnabled).then((rels) => {
          const relationData = rels.map(
            ({ source, target, label }) =>
              `${source},${target},${label.toUpperCase()}`
          );
          const relations = relationData.join("\n");
          return [
            {
              title: `${filename.replace(/\.csv/, "")}_nodes.csv`,
              content: `${nodeHeader}${nodeData}`,
            },
            {
              title: `${filename.replace(/\.csv/, "")}_relations.csv`,
              content: `${relationHeader}${relations}`,
            },
          ];
        });
      },
    },
    {
      name: "CSV",
      callback: async ({ filename, isSamePageEnabled }) => {
        const resolvedResults =
          typeof results === "function"
            ? await results(isSamePageEnabled)
            : results;
        if (!resolvedResults) return [];
        const keys = Object.keys(resolvedResults[0]).filter(
          (u) => !/uid/i.test(u)
        );
        const header = `${keys.join(",")}\n`;
        const data = resolvedResults
          .map((r) =>
            keys
              .map((k) => r[k].toString())
              .map((v) => (v.includes(",") ? `"${v}"` : v))
          )
          .join("\n");
        return [
          {
            title: `${filename.replace(/\.csv/, "")}.csv`,
            content: `${header}${data}`,
          },
        ];
      },
    },
    {
      name: "PDF",
      callback: async ({
        isSamePageEnabled,
        includeDiscourseContext = false,
      }) => {
        const {
          optsRefs,
          optsEmbeds,
          simplifiedFilename,
          maxFilenameLength,
          removeSpecialCharacters,
          linkType,
        } = getExportSettings();
        const allPages = await getPageData(
          isSamePageEnabled,
          isExportDiscourseGraph
        );
        const gatherings = allPages.map(
          ({ text, uid }, i, all) =>
            async function getMarkdownDataForPdf() {
              updateExportProgress({ progress: i / all.length, id: exportId });
              // skip a beat to let progress render
              await new Promise((resolve) => setTimeout(resolve));

              // TODO - resuse these with the markdown export
              const treeNodeToMarkdown = (c: TreeNode) => {
                return toMarkdown({
                  c,
                  v: "document",
                  i: 0,
                  opts: {
                    refs: optsRefs,
                    embeds: optsEmbeds,
                    simplifiedFilename,
                    allNodes,
                    maxFilenameLength,
                    removeSpecialCharacters,
                    linkType,
                    flatten: true,
                  },
                });
              };
              const treeNode = getFullTreeByParentUid(uid);
              const getMarkdownContent = () => {
                return treeNode.children.map(treeNodeToMarkdown).join("\n");
              };
              const getDiscourseResultsContent = async () => {
                const discourseResults = includeDiscourseContext
                  ? await getDiscourseContextResults({
                      uid,
                      isSamePageEnabled,
                    })
                  : [];
                if (discourseResults.length === 0) return "";

                const formattedResults = discourseResults
                  .flatMap((r) =>
                    Object.values(r.results).map((t) => {
                      const filename = getFilename({
                        title: t.text,
                        maxFilenameLength,
                        simplifiedFilename,
                        allNodes,
                        removeSpecialCharacters,
                      });
                      const link = toLink(filename, linkType);
                      return `**${r.label}::** ${link}`;
                    })
                  )
                  .join("\n");

                return `### Discourse Context\n\n${formattedResults}`;
              };
              const getReferenceResultsContent = async () => {
                const normalizedTitle = normalizePageTitle(text);
                const flag = isFlagEnabled("render references");
                const referenceResults = flag
                  ? (
                      window.roamAlphaAPI.data.fast.q(
                        `[:find (pull ?pr [:node/title]) 
                        (pull ?r 
                          [:block/heading [:block/string :as "text"] 
                          [:children/view-type :as "viewType"] 
                          {:block/children ...}]) 
                        :where 
                          [?p :node/title "${normalizedTitle}"] 
                          [?r :block/refs ?p] 
                          [?r :block/page ?pr]]`
                      ) as [PullBlock, PullBlock][]
                    ).filter(
                      ([, { [":block/children"]: children }]) =>
                        Array.isArray(children) && children.length
                    )
                  : [];
                if (referenceResults.length === 0) return "";

                const refResultsMarkdown = referenceResults
                  .map((r) => {
                    const filename = getFilename({
                      title: r[0][":node/title"],
                      maxFilenameLength,
                      simplifiedFilename,
                      allNodes,
                      removeSpecialCharacters,
                    });
                    const link = toLink(filename, linkType);
                    const node = treeNodeToMarkdown(
                      pullBlockToTreeNode(r[1], ":bullet")
                    );
                    return `${link}${node}`;
                  })
                  .join("\n");

                return `### References\n\n${refResultsMarkdown}`;
              };

              const markdownContent = getMarkdownContent();
              const discourseResults = await getDiscourseResultsContent();
              const referenceResults = await getReferenceResultsContent();
              const contentParts = [
                markdownContent,
                discourseResults,
                referenceResults,
              ];
              const content = contentParts.filter((part) => part).join("\n\n");
              const uids = new Set(collectUids(treeNode));

              return { title: text, content, uids };
            }
        );
        const pages = await gatherings.reduce(
          (p, c) =>
            p.then((arr) =>
              c().then((item) => {
                arr.push(item);
                return arr;
              })
            ),
          Promise.resolve(
            [] as Awaited<ReturnType<(typeof gatherings)[number]>>[]
          )
        );

        return pages.map(({ title, content }) => ({
          title: getFilename({
            title,
            maxFilenameLength,
            simplifiedFilename,
            allNodes,
            removeSpecialCharacters,
            extension: ".pdf",
          }),
          content,
        }));
      },
    },
  ];
};

export default getExportTypes;
