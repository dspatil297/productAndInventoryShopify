import { agencyButtonClass } from "@/components/agency/styles";

export const ConnectStoreForm = () => {
  return (
    <form action="/api/auth" method="GET" className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="shop" className="text-sm font-medium">
          Store domain
        </label>
        <input
          id="shop"
          name="shop"
          type="text"
          required
          placeholder="client-store or client-store.myshopify.com"
          className={agencyButtonClass.input}
        />
      </div>
      <button type="submit" className={agencyButtonClass.primary}>
        Start OAuth install
      </button>
    </form>
  );
};
