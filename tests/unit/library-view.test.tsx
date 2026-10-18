import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryView } from "../../components/library-view";

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.cookie = "chagok-library-view=; Max-Age=0; Path=/"; });

test("uses the server preference immediately and retains content while changing views", () => {
  const children = createElement("a", { href: "/items/recipe" }, "고구마 누룽지");
  render(<LibraryView initialView="list">{children}</LibraryView>);
  expect(screen.getByRole("button", { name: "목록형" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "카드형" }));
  expect(screen.getByRole("link", { name: "고구마 누룽지" })).toHaveAttribute("href", "/items/recipe");
  expect(document.cookie).toContain("chagok-library-view=cards");
  fireEvent.click(screen.getByRole("button", { name: "목록형" }));
  expect(screen.getByRole("button", { name: "목록형" })).toHaveAttribute("aria-pressed", "true");
  expect(document.cookie).toContain("chagok-library-view=list");
});

test("blocked browser cookies still permit both layouts", () => {
  vi.spyOn(Document.prototype, "cookie", "set").mockImplementation(() => { throw new Error("Cookies blocked"); });
  render(createElement(LibraryView, null, "레시피"));
  fireEvent.click(screen.getByRole("button", { name: "목록형" }));
  expect(screen.getByRole("button", { name: "목록형" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "카드형" }));
  expect(screen.getByRole("button", { name: "카드형" })).toHaveAttribute("aria-pressed", "true");
});

test("defaults to cards when no preference is supplied", () => {
  render(createElement(LibraryView, null, "레시피"));
  expect(screen.getByRole("button", { name: "카드형" })).toHaveAttribute("aria-pressed", "true");
});
