import fs from "fs";

export function saveJSON(path: string, data: any) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}