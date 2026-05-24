"use client";

import { useEffect } from "react";

const authShellSelector = "[data-drylake-auth-shell]";
const developmentModeSelector = [
  "[data-localization-key*='developmentMode' i]",
  "[data-localization-key*='development_mode' i]",
  "[data-localization-key*='devmode' i]",
].join(",");

function suppressElement(element: Element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.setAttribute("aria-hidden", "true");
  element.style.display = "none";
}

function suppressDevelopmentModeLabels(root: Element) {
  root.querySelectorAll(developmentModeSelector).forEach(suppressElement);

  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = textWalker.nextNode();

  while (node) {
    const text = node.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

    if (text.includes("development mode")) {
      const parent = node.parentElement;
      const parentText = parent?.textContent?.replace(/\s+/g, " ").trim() ?? "";

      if (parent && parentText.length <= 80) {
        suppressElement(parent);
      } else {
        node.textContent = "";
      }
    }

    node = textWalker.nextNode();
  }
}

export function ClerkDevelopmentModeSuppressor() {
  useEffect(() => {
    const root = document.querySelector(authShellSelector);

    if (!root) {
      return;
    }

    suppressDevelopmentModeLabels(root);

    const observer = new MutationObserver(() => {
      suppressDevelopmentModeLabels(root);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
