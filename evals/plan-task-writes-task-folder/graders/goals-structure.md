---
type: regex
weight: 1
target: { source: file, path: .agents/tasks/add-csv-export/goals.md }
pattern: '^(?![\s\S]*?(?:^|\n)\*\*Status\b)(?=[\s\S]*?(?:^|\n)##[ \t]+Goals\b[^\n]*(?:\n(?!#)[^\n]*)*?\n[-*+][ \t]+G\d+(?=[ \t]|\n|$))(?![\s\S]*?(?:^|\n)##[ \t]+Goals\b[^\n]*(?:\n(?!#)[^\n]*)*?\n[-*+][ \t]+(?!G\d+(?:[ \t]|\n|$))\S)(?![\s\S]*?\n[-*+][ \t]+(G\d+)(?![\w])[\s\S]*?\n[-*+][ \t]+\1(?![\w]))'
---
