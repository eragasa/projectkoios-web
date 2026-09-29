import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NoteReviewPage } from "./NoteReviewPage";

test("reviews fixture proposals without exposing a write operation", async () => {
  const user = userEvent.setup();
  render(<NoteReviewPage />);

  expect(screen.getByRole("heading", { name: "Note review" })).toBeInTheDocument();
  expect(screen.getByText("Prototype only")).toBeInTheDocument();
  expect(screen.getByText("No write capability")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^apply$/i })).not.toBeInTheDocument();

  expect(
    screen.getAllByRole("heading", {
      name: "Two-dimensional periodic defect literature",
    }),
  ).toHaveLength(2);
  expect(screen.getByText("periodic2dDefectReview")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Managed diff" }));
  expect(screen.getByLabelText("Proposed note diff")).toHaveTextContent(
    "Tracks candidate sources and their evidence boundaries.",
  );

  await user.click(screen.getByRole("button", { name: "Request revision" }));
  expect(
    screen.getByText("Current browser-local disposition: Revision requested."),
  ).toBeInTheDocument();
});

test("prevents a conflicted fixture from being marked ready", async () => {
  const user = userEvent.setup();
  render(<NoteReviewPage />);

  await user.click(screen.getByRole("button", { name: /Stale managed-note proposal/ }));

  expect(screen.getByRole("alert")).toHaveTextContent(
    "destination identity no longer matches",
  );
  expect(
    screen.getByRole("button", { name: "Mark ready for future apply" }),
  ).toBeDisabled();
});
