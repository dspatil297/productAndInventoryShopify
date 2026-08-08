import Script from "next/script";

/**
 * Custom tunnel (ims.firefist.co.in) cannot proxy Next HMR websockets.
 * Failed HMR reconnects trigger full page reloads and wipe form state.
 * Stub those sockets before Next bootstraps.
 */
export function DisableBrokenHmrScript() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Script id="disable-broken-hmr" strategy="beforeInteractive">
      {`(function () {
  if (typeof WebSocket === "undefined") return;
  var Orig = WebSocket;
  function Wrapped(url, protocols) {
    var u = String(url);
    if (u.indexOf("/_next/webpack-hmr") !== -1 || u.indexOf("/_next/hmr") !== -1) {
      return {
        readyState: 3,
        bufferedAmount: 0,
        extensions: "",
        protocol: "",
        url: u,
        binaryType: "blob",
        close: function () {},
        send: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () { return false; },
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null
      };
    }
    if (protocols === undefined) return new Orig(url);
    return new Orig(url, protocols);
  }
  Wrapped.prototype = Orig.prototype;
  Wrapped.CONNECTING = 0;
  Wrapped.OPEN = 1;
  Wrapped.CLOSING = 2;
  Wrapped.CLOSED = 3;
  window.WebSocket = Wrapped;
})();`}
    </Script>
  );
}
