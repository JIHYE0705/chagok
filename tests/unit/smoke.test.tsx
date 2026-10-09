import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../../app/page";

describe("root app shell", () => {
  it("renders the stable app shell marker", () => {
    render(createElement(Home));

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });
});
