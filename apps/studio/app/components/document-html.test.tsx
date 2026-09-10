import { expect, test } from "vitest";

import { DocumentHtml } from "./document-html";

test("allows browser extensions to annotate the document before hydration", () => {
  const document = DocumentHtml({ children: null });

  expect(document.props).toMatchObject({
    lang: "en",
    suppressHydrationWarning: true,
  });
});
