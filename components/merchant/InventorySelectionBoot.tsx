/**
 * Cross-page inventory selection via sessionStorage + native DOM.
 * Works without React hydration (tunnel/HMR often breaks client JS).
 */
export function InventorySelectionBoot({
  storageKey,
  rowCount,
}: {
  storageKey: string;
  rowCount: number;
}) {
  // Keep script as one string — no template nesting that breaks HTML attrs
  const boot = `
(function(){
  var KEY=${JSON.stringify(storageKey)};
  function load(){
    try{return JSON.parse(sessionStorage.getItem(KEY)||"{}");}catch(e){return{};}
  }
  function save(map){sessionStorage.setItem(KEY,JSON.stringify(map));}
  function count(){return Object.keys(load()).length;}
  function renderCount(){
    var el=document.getElementById("inv-sel-count");
    if(!el)return;
    var n=count();
    el.textContent=n?(n+" selected across pages"):"None selected";
  }
  function restorePage(){
    var map=load();
    document.querySelectorAll("[data-inv-pick]").forEach(function(el){
      var id=el.getAttribute("data-inv-id");
      el.checked=!!(id&&map[id]);
    });
    renderCount();
  }
  window.__invSel={
    selectPage:function(){
      var map=load();
      document.querySelectorAll("[data-inv-pick]").forEach(function(el){
        el.checked=true;
        var id=el.getAttribute("data-inv-id");
        if(id)map[id]=el.getAttribute("data-inv-value")||"";
      });
      save(map);renderCount();
    },
    clearAll:function(){
      save({});
      document.querySelectorAll("[data-inv-pick]").forEach(function(el){el.checked=false;});
      renderCount();
    },
    injectPicks:function(form){
      form.querySelectorAll("[data-inv-injected]").forEach(function(n){n.remove();});
      var map=load();
      Object.keys(map).forEach(function(id){
        var input=document.createElement("input");
        input.type="hidden";
        input.name="pick";
        input.value=map[id];
        input.setAttribute("data-inv-injected","1");
        form.appendChild(input);
      });
      return Object.keys(map).length;
    }
  };
  document.addEventListener("change",function(ev){
    var t=ev.target;
    if(!t||!t.getAttribute||t.getAttribute("data-inv-pick")!=="1")return;
    var map=load();
    var id=t.getAttribute("data-inv-id");
    if(!id)return;
    if(t.checked)map[id]=t.getAttribute("data-inv-value")||"";
    else delete map[id];
    save(map);renderCount();
  });
  document.addEventListener("submit",function(ev){
    var form=ev.target;
    if(!form||form.id!=="inventory-bulk-form")return;
    var n=window.__invSel.injectPicks(form);
    if(!n){
      ev.preventDefault();
      alert("Select at least one row first (can span pages).");
    }
  });
  if(/[?&]saved=/.test(location.search)){
    save({});
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",restorePage);
  }else{
    restorePage();
  }
})();`;

  const selectBtn = `<button type="button" class="mf-btn" ${
    rowCount === 0 ? "disabled" : ""
  } onclick="window.__invSel&&window.__invSel.selectPage()">Select all on page (${rowCount})</button>`;
  const clearBtn = `<button type="button" class="mf-btn" onclick="window.__invSel&&window.__invSel.clearAll()">Clear all selected</button>`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: boot }} />
      <div className="flex flex-wrap items-center gap-2">
        <div dangerouslySetInnerHTML={{ __html: selectBtn }} />
        <div dangerouslySetInnerHTML={{ __html: clearBtn }} />
        <span id="inv-sel-count" className="text-sm text-muted-foreground">
          None selected
        </span>
      </div>
    </>
  );
}
