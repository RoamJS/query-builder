declare module "*.png" {
  const value: string;
  export default value;
}

declare module "cytoscape-navigator" {
  const value: (cy: cytoscape) => void;
  export default value;
}
