/**
 * Mirrors lib/csv/productImport.ts parseCsv critical cases.
 * Keep in sync when changing the TS parser.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    if (row.length === 1 && row[0] === "" && rows.length > 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      pushField();
      continue;
    }
    if (char === "\n") {
      pushField();
      pushRow();
      continue;
    }
    if (char === "\r") {
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0 || inQuotes) {
    pushField();
    pushRow();
  }

  return rows;
}

export async function runCsvSelfCheck() {
  const parsed = parseCsv('title,custom.field\n"A, B",x\nC,"y""z"\n');
  if (parsed.length !== 3) {
    throw new Error(`expected 3 rows, got ${parsed.length}`);
  }
  if (parsed[1][0] !== "A, B") {
    throw new Error(`quoted comma broken: ${parsed[1][0]}`);
  }
  if (parsed[2][1] !== 'y"z') {
    throw new Error(`escaped quote broken: ${parsed[2][1]}`);
  }
}
