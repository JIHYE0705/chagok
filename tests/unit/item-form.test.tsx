import { act } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ItemForm } from "../../components/item-form";

const { save, push, refresh } = vi.hoisted(() => ({ save: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("../../app/(protected)/items/actions", () => ({ saveItemAction: save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => { cleanup(); sessionStorage.clear(); vi.resetAllMocks(); });

test("saving freezes both sections, announces completion and opens the saved item", async () => {
  let finish!: (value: { error: string; saved: string }) => void;
  save.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<ItemForm ownerId="owner" />);
  fireEvent.change(screen.getByLabelText("제목", { exact: true }), { target: { value: "고구마 누룽지" } });
  fireEvent.submit(screen.getByRole("button", { name: "저장하기" }).closest("form")!);
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("입력 방식")).toBeDisabled();
  expect(screen.getByLabelText("제목", { exact: true })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("저장하고 있어요");
  await act(async () => finish({ error: "", saved: "item-id" }));
  expect(screen.getByRole("status")).toHaveTextContent("저장했어요. 상세 화면으로 이동");
  expect(screen.getByRole("button", { name: "저장 완료" })).toBeDisabled();
  expect(push).toHaveBeenCalledWith("/items/item-id");
  expect(refresh).toHaveBeenCalledOnce();
  expect(sessionStorage.getItem("chagok:draft:owner:new")).toBeNull();
});

test("failed saving keeps editable source and recipe fields and restores the draft", async () => {
  save.mockRejectedValue(new Error("offline"));
  const view = render(<ItemForm ownerId="owner" />);
  fireEvent.change(screen.getByLabelText("입력 방식"), { target: { value: "text" } });
  fireEvent.change(screen.getByLabelText("원문", { exact: true }), { target: { value: "보존할 원문" } });
  fireEvent.change(screen.getByLabelText("제목", { exact: true }), { target: { value: "보존할 제목" } });
  fireEvent.change(screen.getByLabelText("재료와 분량"), { target: { value: "고구마 | 200 g" } });
  fireEvent.submit(screen.getByRole("button", { name: "저장하기" }).closest("form")!);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("입력은 그대로"));
  expect(screen.getByLabelText("제목", { exact: true })).toBeEnabled();
  view.unmount();
  render(<ItemForm ownerId="owner" />);
  expect(screen.getByRole("status")).toHaveTextContent("입력을 복구");
  expect(screen.getByLabelText("원문", { exact: true })).toHaveValue("보존할 원문");
  expect(screen.getByLabelText("재료와 분량")).toHaveValue("고구마 | 200 g");
});
