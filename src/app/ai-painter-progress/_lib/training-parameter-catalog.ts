import modelDictionary from "../../../../data/ai-painter/system-governance/local-ai-model-data-dictionary-v1.json";

export type TrainingParameterDefinition = {
  id: string;
  name: string;
  code: string;
  category: string;
  kind: string;
  dataType: string;
  aliases: string[];
  plainLanguage: string;
  interpretation: string;
  readingRule: string;
  source: string;
};

export const trainingParameterCatalog =
  modelDictionary.entries as TrainingParameterDefinition[];

export const trainingParameterDictionaryMetadata = {
  schemaVersion: modelDictionary.schemaVersion,
  status: modelDictionary.status,
  modelId: modelDictionary.modelId,
  updatedAtAsiaShanghai: modelDictionary.updatedAtAsiaShanghai,
  purposeZh: modelDictionary.purposeZh,
  categories: modelDictionary.categories,
  entryCount: modelDictionary.entries.length,
};

export function fuzzyParameterMatch(
  parameter: TrainingParameterDefinition,
  query: string,
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const fields = [
    parameter.name,
    parameter.code,
    parameter.category,
    parameter.kind,
    parameter.dataType,
    parameter.plainLanguage,
    parameter.interpretation,
    parameter.readingRule,
    parameter.source,
    ...parameter.aliases,
  ].map((value) => value.toLowerCase());
  return terms.every((term) =>
    fields.some((field) => fuzzyFieldMatch(term, field)),
  );
}

function fuzzyFieldMatch(term: string, field: string) {
  if (field.includes(term)) return true;
  if (term.length < 3) return false;
  return field
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter(Boolean)
    .some(
      (word) =>
        Math.abs(word.length - term.length) <= 2 &&
        editDistance(word, term) <= (term.length > 6 ? 2 : 1),
    );
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[right.length];
}
