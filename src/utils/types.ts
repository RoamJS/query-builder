export type Condition = {
  relation: string;
  source: string;
  target: string;
  uid: string;
  not: boolean;
};

export type Selection = {
  text: string;
  label: string;
  uid: string;
};
