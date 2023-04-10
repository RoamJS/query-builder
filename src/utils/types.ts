type QBBase = {
  uid: string;
};
export type QBClauseData = {
  relation: string;
  source: string;
  target: string;
  uid: string;
  not?: boolean;
} & QBBase;
export type QBNestedData = {
  conditions: Condition[][];
} & QBBase;
export type QBClause = QBClauseData & {
  type: "clause";
};
export type QBNot = QBClauseData & {
  type: "not";
};
export type QBOr = QBNestedData & {
  type: "or";
};
export type QBNor = QBNestedData & {
  type: "not or";
};
export type Condition = QBClause | QBNot | QBOr | QBNor;

export type Selection = {
  text: string;
  label: string;
  uid: string;
};

export type ExportTypes = {
  name: string;
  callback: (args: {
    filename: string;
    graph: string;
    isBackendEnabled: boolean;
  }) => Promise<{ title: string; content: string }[]>;
}[];
