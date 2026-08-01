import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../button";
import React from "react";

describe("Button component", () => {
  it("renders children correctly", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click Me");
  });

  it("applies primary variant by default", () => {
    render(<Button>Submit</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-brand");
  });

  it("disables button when isLoading is true", () => {
    render(<Button isLoading>Saving...</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });
});
