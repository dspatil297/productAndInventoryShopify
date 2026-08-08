"use client";

import { useActionState } from "react";
import {
  merchantSelectStoreAction,
  type MerchantAuthFormState,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";

interface StoreOption {
  userId: string;
  shopName: string;
  shopDomain: string;
}

interface MerchantSelectStoreFormProps {
  stores: StoreOption[];
}

export const MerchantSelectStoreForm = ({
  stores,
}: MerchantSelectStoreFormProps) => {
  const [state, formAction, isPending] = useActionState<
    MerchantAuthFormState | null,
    FormData
  >(merchantSelectStoreAction, null);

  return (
    <div className="space-y-3">
      {state?.error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {stores.map((store) => (
        <form key={store.userId} action={formAction}>
          <input type="hidden" name="userId" value={store.userId} />
          <Button
            type="submit"
            variant="outline"
            className="h-auto w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
            disabled={isPending}
          >
            <span className="font-medium text-foreground">{store.shopName}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {store.shopDomain}
            </span>
          </Button>
        </form>
      ))}
    </div>
  );
};
