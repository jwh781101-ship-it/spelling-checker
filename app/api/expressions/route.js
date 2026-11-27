import { confusables } from "../../data/confusables.mjs";

const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 50;
const key = (value) => typeof value === "string" ? value.normalize("NFC").replace(/\s/gu, "") : "";

export async function GET(request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  // 원본 길이도 제한해 공백으로 구성된 비정상 입력을 제한한다.
  if (!query || query.length > MAX_QUERY_LENGTH) return Response.json({ items: [] });
  const needle = key(query);
  if (!needle) return Response.json({ items: [] });
  const items = [];
  for (const item of confusables) {
    const fields = [item.correct, item.wrong, item.example, ...(Array.isArray(item.aliases) ? item.aliases : [])];
    if (fields.some((field) => key(field).includes(needle))) {
      items.push(item);
      if (items.length >= MAX_RESULTS) break;
    }
  }
  return Response.json({ items });
}
