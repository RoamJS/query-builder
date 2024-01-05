const INITIAL_NODE_VALUES = [
  {
    type: "_CLM-node",
    format: "[[CLM]] - {content}",
    text: "Claim",
    shortcut: "C",
  },
  {
    type: "_QUE-node",
    format: "[[QUE]] - {content}",
    text: "Question",
    shortcut: "Q",
  },
  {
    type: "_EVD-node",
    format: "[[EVD]] - {content} - {Source}",
    text: "Evidence",
    shortcut: "E",
  },
  {
    type: "_SRC-node",
    format: "@{content}",
    text: "Source",
    shortcut: "S",
  },
];

export default INITIAL_NODE_VALUES;
