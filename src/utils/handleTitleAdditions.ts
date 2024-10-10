import React from "react";
import ReactDOM from "react-dom";

const addedElements: Set<HTMLElement> = new Set();

export const handleTitleAdditions = (
  h1: HTMLHeadingElement,
  element: React.ReactNode
) => {
  let container = h1.parentElement?.querySelector(
    ".query-builder-title-additions"
  ) as HTMLElement;

  if (!container) {
    container = document.createElement("div");
    container.className = "query-builder-title-additions flex flex-col";

    const oldMarginBottom = getComputedStyle(h1).marginBottom;
    const oldMarginBottomNum = Number(oldMarginBottom.replace("px", ""));
    const newMarginTop = `${4 - oldMarginBottomNum / 2}px`;

    container.style.marginTop = newMarginTop;
    container.style.marginBottom = oldMarginBottom;

    if (h1.parentElement) {
      if (h1.parentElement.lastChild === h1) {
        h1.parentElement.appendChild(container);
      } else {
        h1.parentElement.insertBefore(container, h1.nextSibling);
      }
    }
    addedElements.add(container);
  }

  let addedElement: HTMLElement;
  if (React.isValidElement(element)) {
    const renderContainer = document.createElement("div");
    container.appendChild(renderContainer);
    ReactDOM.render(element, renderContainer);
    addedElement = renderContainer;
  } else {
    addedElement = element as HTMLElement;
    container.appendChild(addedElement);
  }

  addedElements.add(addedElement);
};

export const removeTitleAdditions = () => {
  addedElements.forEach((element) => {
    if (element.parentElement) {
      ReactDOM.unmountComponentAtNode(element);
      element.remove();
    }
  });
  addedElements.clear();
};
