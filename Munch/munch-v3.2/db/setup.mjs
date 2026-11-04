import { readFile, readdir } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Run `neon env pull` first.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");

/** Split on semicolons while respecting single-quoted strings and -- comments. */
function splitStatements(text) {
  const statements = [];
  let current = "";
  let inString = false;
  let inComment = false;
  let dollarTag = null;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (!inString && !inComment && char === "$") {
      const match = /^\$[A-Za-z0-9_]*\$/.exec(text.slice(i));
      if (match) {
        const tag = match[0];
        if (dollarTag === tag) {
          dollarTag = null;
          current += tag;
          i += tag.length - 1;
          continue;
        }
        if (!dollarTag) {
          dollarTag = tag;
          current += tag;
          i += tag.length - 1;
          continue;
        }
      }
    }

    if (dollarTag) {
      current += char;
      continue;
    }

    if (inComment) {
      current += char;
      if (char === "\n") inComment = false;
      continue;
    }
    if (!inString && char === "-" && next === "-") {
      inComment = true;
      current += char;
      continue;
    }
    if (char === "'") {
      if (inString && next === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inString = !inString;
      current += char;
      continue;
    }
    if (char === ";" && !inString && !dollarTag) {
      statements.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current);

  return statements
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

const statements = splitStatements(schema);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Schema ready (${statements.length} statements).`);

/* Migrations apply after the base schema, in filename order. They are
   idempotent, so this is safe to re-run. */
const migrationDir = new URL("./migrations/", import.meta.url);
const migrations = (await readdir(migrationDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of migrations) {
  const text = await readFile(new URL(file, migrationDir), "utf8");
  const migrationStatements = splitStatements(text);
  for (const statement of migrationStatements) {
    await sql.query(statement);
  }
  console.log(`Migration applied: ${file} (${migrationStatements.length} statements).`);
}
