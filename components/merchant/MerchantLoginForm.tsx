"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  merchantLoginAction,
  type MerchantAuthFormState,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";

interface MerchantLoginFormProps {
  returnTo: string;
  shopId?: string;
  handoff?: string;
  shopName?: string;
  shopDomain?: string;
  defaultEmail?: string;
  hasUsers: boolean;
}

export const MerchantLoginForm = ({
  returnTo,
  shopId,
  handoff,
  shopName,
  shopDomain,
  defaultEmail = "",
  hasUsers,
}: MerchantLoginFormProps) => {
  const [state, formAction, isPending] = useActionState<
    MerchantAuthFormState | null,
    FormData
  >(merchantLoginAction, null);

  const registerHref = (() => {
    const params = new URLSearchParams();
    params.set("return_to", returnTo);
    if (handoff) {
      params.set("handoff", handoff);
    }
    if (shopId) {
      params.set("shopId", shopId);
    }
    return `/register?${params.toString()}`;
  })();

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="return_to" value={returnTo} />
      {shopId ? <input type="hidden" name="shopId" value={shopId} /> : null}

      {shopName ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Store: <span className="font-medium text-foreground">{shopName}</span>
          {shopDomain ? ` (${shopDomain})` : null}
        </p>
      ) : null}

      {state?.error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={defaultEmail}
          required
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {defaultEmail ? (
          <p className="text-xs text-muted-foreground">
            Prefilled from Shopify store email — change only if needed.
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      {handoff ? (
        <p className="text-center text-sm text-muted-foreground">
          {hasUsers ? "Need an account for this store? " : "First time? "}
          <Link className="underline" href={registerHref}>
            Create dashboard login
          </Link>
        </p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          First login: open app from Shopify Admin Home, then create an account.
        </p>
      )}
    </form>
  );
};
