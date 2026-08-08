/**
 * Cross-page product selection via sessionStorage + native DOM.
 */
export function ProductSelectionBoot({
  storageKey,
  rowCount,
  formId,
}: {
  storageKey: string;
  rowCount: number;
  formId: string;
}) {
  const boot = `
(function(){
  var KEY=${JSON.stringify(storageKey)};
  var FORM_ID=${JSON.stringify(formId)};
  function load(){
    try{return JSON.parse(sessionStorage.getItem(KEY)||"{}");}catch(e){return{};}
  }
  function save(map){sessionStorage.setItem(KEY,JSON.stringify(map));}
  function count(){return Object.keys(load()).length;}
  function renderCount(){
    var el=document.getElementById("prod-sel-count");
    if(!el)return;
    var n=count();
    el.textContent=n?(n+" selected across pages"):"None selected";
  }
  function restorePage(){
    var map=load();
    document.querySelectorAll("[data-prod-pick]").forEach(function(el){
      var id=el.getAttribute("data-prod-id");
      el.checked=!!(id&&map[id]);
    });
    renderCount();
  }
  window.__prodSel={
    selectPage:function(){
      var map=load();
      document.querySelectorAll("[data-prod-pick]").forEach(function(el){
        el.checked=true;
        var id=el.getAttribute("data-prod-id");
        if(id)map[id]=id;
      });
      save(map);renderCount();
    },
    clearAll:function(){
      save({});
      document.querySelectorAll("[data-prod-pick]").forEach(function(el){el.checked=false;});
      renderCount();
    },
    injectPicks:function(form){
      form.querySelectorAll("[data-prod-injected]").forEach(function(n){n.remove();});
      var map=load();
      Object.keys(map).forEach(function(id){
        var input=document.createElement("input");
        input.type="hidden";
        input.name="pick";
        input.value=map[id];
        input.setAttribute("data-prod-injected","1");
        form.appendChild(input);
      });
      return Object.keys(map).length;
    }
  };
  document.addEventListener("change",function(ev){
    var t=ev.target;
    if(!t||!t.getAttribute||t.getAttribute("data-prod-pick")!=="1")return;
    var map=load();
    var id=t.getAttribute("data-prod-id");
    if(!id)return;
    if(t.checked)map[id]=id;
    else delete map[id];
    save(map);renderCount();
  });
  document.addEventListener("submit",function(ev){
    var form=ev.target;
    if(!form||form.id!==FORM_ID)return;
    var n=window.__prodSel.injectPicks(form);
    if(!n){
      ev.preventDefault();
      alert("Select at least one product first (can span pages).");
      return;
    }
    if(!confirm("Permanently delete selected products? This cannot be undone.")){
      ev.preventDefault();
    }
  });
  if(/[?&]deleted=/.test(location.search)){
    save({});
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",restorePage);
  }else{
    restorePage();
  }
})();`;

  const selectBtn = `<button type="button" class="rounded-md border border-border px-3 py-1.5 text-sm" ${
    rowCount === 0 ? "disabled" : ""
  } onclick="window.__prodSel&&window.__prodSel.selectPage()">Select all on page (${rowCount})</button>`;
  const clearBtn = `<button type="button" class="rounded-md border border-border px-3 py-1.5 text-sm" onclick="window.__prodSel&&window.__prodSel.clearAll()">Clear all selected</button>`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: boot }} />
      <div className="flex flex-wrap items-center gap-2">
        <div dangerouslySetInnerHTML={{ __html: selectBtn }} />
        <div dangerouslySetInnerHTML={{ __html: clearBtn }} />
        <span id="prod-sel-count" className="text-sm text-muted-foreground">
          None selected
        </span>
      </div>
    </>
  );
}
