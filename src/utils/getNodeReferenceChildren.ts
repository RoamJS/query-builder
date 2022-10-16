import { render as referenceRender } from "../components/ReferenceContext";

const getNodeReferenceChildren = (title: string) => {
  const container = document.createElement("div");
  referenceRender({
    title,
    container,
  });
  return container;
};

export default getNodeReferenceChildren;
