import type { AnchorHTMLAttributes, DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
      "s-link": DetailedHTMLProps<
        AnchorHTMLAttributes<HTMLElement> & { href?: string; rel?: string },
        HTMLElement
      >;
    }
  }
}

export {};
