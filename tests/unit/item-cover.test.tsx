import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ItemCover } from "../../components/item-cover";
import { coverVersion } from "../../lib/data/cover-selection";
afterEach(cleanup);
test("cover selection prefers chosen attachment over link metadata", () => {
  expect(coverVersion([{ id: "photo", is_cover: true }], [{ extraction_key: "link" }])).toBe("photo");
  expect(coverVersion([], [{ extraction_key: "link" }])).toBe("link");
  expect(coverVersion([], [])).toBe("");
});
test("a failed image falls back once and a new selection can load", () => {
  const { rerender } = render(<ItemCover itemId="item" title="고구마" type="recipe" version="one" />);
  fireEvent.error(screen.getByAltText("고구마 표지"));
  expect(screen.getByRole("img", { name: "레시피 기본 표지" })).toBeVisible();
  expect(screen.queryByAltText("고구마 표지")).toBeNull();
  rerender(<ItemCover itemId="item" title="고구마" type="recipe" version="two" />);
  expect(screen.getByAltText("고구마 표지")).toHaveAttribute("src", expect.stringContaining("/api/items/item/cover?v=two"));
});
test("non-recipe information uses its own default cover without a remote request", () => {
  render(<ItemCover itemId="item" title="메모" type="note" version="" />);
  expect(screen.getByRole("img", { name: "정보 기본 표지" })).toBeVisible();
  expect(screen.queryByRole("img", { name: "메모 표지" })).toBeNull();
});


test("a representative photo decoding failure tries the source thumbnail once", () => {
  render(<ItemCover itemId="item" title="고구마" type="recipe" version="photo" representative />);
  fireEvent.error(screen.getByAltText("고구마 표지"));
  expect(screen.getByAltText("고구마 표지")).toHaveAttribute("src", expect.stringContaining("&link=1"));
  fireEvent.error(screen.getByAltText("고구마 표지"));
  expect(screen.getByRole("img", { name: "레시피 기본 표지" })).toBeVisible();
  expect(screen.queryByAltText("고구마 표지")).toBeNull();
});
