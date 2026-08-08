"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  merchantRegisterAction,
  type MerchantAuthFormState,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";

interface MerchantRegisterFormProps {
  returnTo: string;
  handoff: string;
  shopId: string;
  shopName: string;
  shopDomain: string;
  defaultEmail?: string;
}

export const MerchantRegisterForm = ({
  returnTo,
  handoff,
  shopId,
  shopName,
  shopDomain,
  defaultEmail = "",
}: MerchantRegisterFormProps) => {
  const [state, formAction, isPending] = useActionState<
    MerchantAuthFormState | null,
    FormData
  >(merchantRegisterAction, null);

  const loginParams = new URLSearchParams({
    return_to: returnTo,
    handoff,
    shopId,
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="handoff" value={handoff} />

      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Creating login for{" "}
        <span className="font-medium text-foreground">{shopName}</span> (
        {shopDomain})
      </p>

      {state?.error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>
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
        <p className="text-xs text-muted-foreground">
          {defaultEmail
            ? "Loaded from Shopify store email. Linking another store: same email + same password."
            : "Prefer the Shopify store email. Linking another store later: same email + same password."}
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">
          At least 8 characters. Same password links this email to more stores.
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating…" : "Create dashboard login"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="underline" href={`/login?${loginParams.toString()}`}>
          Sign in
        </Link>
      </p>
    </form>
  );
};
