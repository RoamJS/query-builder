export const defaultNanopubTemplate = [
  {
    predicate: "is a",
    object: "{nodeType}",
    type: "assertion",
  },
  {
    predicate: "has the label",
    object: "{title}",
    type: "assertion",
  },
  {
    predicate: "has the description",
    object: "{body}",
    type: "assertion",
  },
  {
    predicate: "has more info at",
    object: "{url}",
    type: "assertion",
  },
  {
    predicate: "is attributed to",
    object: "{myORCID}",
    type: "provenance",
  },
  {
    predicate: "is created by",
    object: "{createdBy}",
    type: "publicationInfo",
  },
];
