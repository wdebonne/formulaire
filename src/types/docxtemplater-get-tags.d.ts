// docxtemplater expose get-tags.js sans déclaration TypeScript (seul inspect-module.js en a
// une, mais il dépend de lodash — cf. src/lib/docx-template.ts).
declare module 'docxtemplater/js/get-tags.js' {
  export function getTags(postParsed: unknown): Record<string, unknown>
  export function isPlaceholder(part: unknown): boolean
}
