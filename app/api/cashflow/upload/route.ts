import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * Parse a CSV line handling quoted fields that may contain commas and newlines.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Split full CSV text into lines, respecting quoted fields that span newlines.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        i++; // skip \n after \r
      }
      if (current.trim()) {
        lines.push(current);
      }
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    lines.push(current);
  }

  return lines;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No CSV file provided. Send a file via FormData with key 'file'." },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "File must be a CSV." },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = splitCsvLines(text);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row." },
        { status: 400 }
      );
    }

    // Parse header
    const headers = parseCsvLine(lines[0]).map(normalizeHeader);

    const requiredColumns = ["date", "name", "amount"];
    for (const col of requiredColumns) {
      if (!headers.includes(col)) {
        return NextResponse.json(
          { error: `Missing required column: ${col}` },
          { status: 400 }
        );
      }
    }

    // Map CSV column names to expected header keys
    const colIndex = (name: string) => headers.indexOf(name);

    // Parse rows
    const rows: Array<{
      date: string;
      name: string;
      amount: number;
      status: string;
      category: string;
      parent_category: string;
      type: string;
      account: string;
      account_mask: string;
      recurring: string;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      if (fields.length < 3) continue; // skip malformed rows

      const excluded = fields[colIndex("excluded")]?.toLowerCase();
      const txnType = fields[colIndex("type")] ?? "";
      // Keep income and internal transfer rows even if excluded — Copilot marks these excluded by default
      if ((excluded === "true" || excluded === "yes" || excluded === "1") && txnType !== "income" && txnType !== "internal transfer") {
        continue;
      }

      const amount = parseFloat(fields[colIndex("amount")] ?? "0");
      if (isNaN(amount)) continue;

      rows.push({
        date: fields[colIndex("date")] ?? "",
        name: fields[colIndex("name")] ?? "",
        amount,
        status: fields[colIndex("status")] ?? "",
        category: fields[colIndex("category")] ?? "",
        parent_category: fields[colIndex("parent_category")] ?? "",
        type: fields[colIndex("type")] ?? "",
        account: fields[colIndex("account")] ?? "",
        account_mask: fields[colIndex("account_mask")] ?? "",
        recurring: fields[colIndex("recurring")] ?? "",
      });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid (non-excluded) rows found in CSV." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Dedupe rows within the dataset — keep last occurrence per unique key
    const deduped = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      const key = `${row.date}|${row.name}|${row.amount}|${row.account_mask}`;
      deduped.set(key, row);
    }
    const uniqueRows = Array.from(deduped.values());

    // Upsert in batches of 500 to avoid payload limits.
    const BATCH_SIZE = 500;
    let totalUpserted = 0;

    for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
      const batch = uniqueRows.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase
        .from("transactions")
        .upsert(batch, {
          onConflict: "date,name,amount,account_mask",
          ignoreDuplicates: false,
        })
        .select("id");

      if (error) {
        return NextResponse.json(
          {
            error: `Database error during upsert (batch starting at row ${i}): ${error.message}`,
          },
          { status: 500 }
        );
      }

      totalUpserted += data?.length ?? batch.length;
    }

    return NextResponse.json({
      success: true,
      rows_processed: uniqueRows.length,
      rows_upserted: totalUpserted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process CSV upload: ${message}` },
      { status: 500 }
    );
  }
}
