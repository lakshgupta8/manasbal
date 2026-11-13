import { composeStories } from "@storybook/react-vite";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductCard, type ProductCardLinkProps } from "./ProductCard";
import * as stories from "./ProductCard.stories";

const { Default, WithoutRating, NotSample, LongName, WithPicture, Focus, Dark, FocusDark } =
  composeStories(stories);

describe("ProductCard", () => {
  it("is an article whose heading is its one link", () => {
    render(<Default />);

    const card = screen.getByRole("article");
    const heading = within(card).getByRole("heading", { level: 3, name: "Striped cotton tee" });
    const link = within(heading).getByRole("link", { name: "Striped cotton tee" });
    expect(link.getAttribute("href")).toBe("#striped-cotton-tee");
    expect(link.className).toBe("mb-product-card__link");
    expect(within(card).getAllByRole("link")).toHaveLength(1);
    expect(card.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(1);
  });

  it("shows the rating, the price and the Sample badge", () => {
    render(<Default />);

    expect(screen.getByRole("img", { name: "Rated 4.5 out of 5" })).toBeDefined();
    expect(screen.getByText("(120 reviews)")).toBeDefined();
    expect(screen.getByText("₹499.00")).toBeDefined();
    expect(screen.getByText("499 rupees")).toBeDefined();
    expect(screen.getByText("Sample").className).toBe("mb-sample-badge mb-product-card__badge");
  });

  it("stands a grey box in for a missing picture, hidden from assistive tech", () => {
    const { container } = render(<Default />);

    const box = container.querySelector(".mb-product-card__placeholder")!;
    expect(box.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows a picture with the caller's alt text", () => {
    render(<WithPicture />);

    const img = screen.getByRole("img", { name: "A pale teal and pink cotton tee, folded" });
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(document.querySelector(".mb-product-card__placeholder")).toBeNull();
  });

  it("leaves out the stars without a rating, and the badge for real data", () => {
    const { unmount } = render(<WithoutRating />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText("(120 reviews)")).toBeNull();
    unmount();

    render(<NotSample />);
    expect(screen.queryByText("Sample")).toBeNull();
  });

  it("keeps a long name whole, as the link's text", () => {
    render(<LongName />);

    expect(
      screen.getByRole("link", {
        name: "Handloom cotton kurta with mirror work on the yoke and long sleeves",
      }),
    ).toBeDefined();
  });

  it("passes other attributes to the article, such as the focus preview", () => {
    const { container: light } = render(<Focus className="extra" />);
    expect(light.querySelector("article")!.getAttribute("data-preview")).toBe("focus");
    expect(light.querySelector("article")!.className).toBe("mb-product-card extra");

    const { container: dark } = render(<FocusDark />);
    expect(dark.querySelector("article")!.getAttribute("data-preview")).toBe("focus");
  });

  it("draws in the dark story too", () => {
    render(<Dark />);

    expect(screen.getByRole("article")).toBeDefined();
  });

  it("uses the caller's words, heading level and link component", () => {
    const seen: ProductCardLinkProps[] = [];
    function ShopLink(props: ProductCardLinkProps) {
      seen.push(props);
      return (
        <a href={`/hi${props.href}`} className={props.className}>
          {props.children}
        </a>
      );
    }

    render(
      <ProductCard
        name="पीतल की छलनी"
        href="/products/brass-strainer"
        pricePaise={34900}
        rating={4}
        ratingLabel="5 में से 4"
        sample
        sampleLabel="नमूना"
        priceUnit="रुपये"
        headingLevel={2}
        linkAs={ShopLink}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/hi/products/brass-strainer");
    expect(seen[0]).toEqual({
      href: "/products/brass-strainer",
      className: "mb-product-card__link",
      children: "पीतल की छलनी",
    });
    expect(screen.getByRole("img", { name: "5 में से 4" })).toBeDefined();
    expect(screen.getByText("नमूना")).toBeDefined();
    expect(screen.getByText("349 रुपये")).toBeDefined();
  });

  it("refuses a price that is not whole paise", () => {
    expect(() => render(<ProductCard name="Tee" href="#" pricePaise={499.5} />)).toThrow(TypeError);
  });
});
