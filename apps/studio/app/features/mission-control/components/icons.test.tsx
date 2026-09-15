import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Icon, SenderosMark } from "./icons";

const iconNames = [
  "inbox", "nodes", "target", "activity", "check", "spark", "clock",
  "settings", "branch", "plus", "search", "x", "arrow", "pulse", "database",
];

describe("Icon", () => {
  test("inherits a contrasting foreground instead of using the dark SVG default", () => {
    const { container } = render(
      <>{iconNames.map((name) => <Icon key={name} name={name} />)}<SenderosMark /></>,
    );
    const icons = container.querySelectorAll("svg.ui-icon");

    expect(icons).toHaveLength(iconNames.length);
    for (const icon of icons) {
      expect(icon.getAttribute("fill")).toBe("none");
      expect(icon.getAttribute("stroke")).toBe("currentColor");
      expect(icon.getAttribute("stroke-width")).toBe("1.7");
    }
    expect(container.querySelector(".senderos-mark svg")).not.toBeNull();
  });
});
