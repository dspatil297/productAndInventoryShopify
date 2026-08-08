import { JsonObjectField } from "@/components/merchant/JsonObjectField";
import { PairListField } from "@/components/merchant/PairListField";
import { TagListField } from "@/components/merchant/TagListField";
import type { ResolvedMetafieldEditor } from "@/lib/metafields/resolve-metafield-editor";

export function StructuredMetafieldField({
  name,
  editor,
  dataMfInput = false,
  dataBaseline,
}: {
  name: string;
  editor: ResolvedMetafieldEditor;
  dataMfInput?: boolean;
  dataBaseline?: string;
}) {
  if (editor.kind === "pair_list") {
    return (
      <PairListField
        name={name}
        defaultValue={editor.hiddenValue}
        mode={editor.mode}
        storage={editor.storage}
        listFormat={editor.listFormat}
      />
    );
  }

  if (editor.kind === "json_object") {
    return (
      <JsonObjectField
        name={name}
        defaultValue={editor.hiddenValue}
        mode={editor.mode}
        fields={editor.fields}
      />
    );
  }

  if (editor.kind === "tags") {
    return (
      <TagListField
        name={name}
        defaultValue={editor.hiddenValue}
        dataMfInput={dataMfInput}
        dataBaseline={dataBaseline}
      />
    );
  }

  return null;
}
