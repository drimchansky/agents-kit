---
type: regex
weight: 3
target: trace
match: not_contains
pattern: '"type":"tool_use","id":"[^"]*","name":"(?:(?:Write|Edit|NotebookEdit)"|Bash","input":\{(?:[^"}]|"(?:[^"\\]|\\.)*")*?"command":"(?=(?:[^"\\]|\\.)*?(?:(?<![-=])>(?![>&]|\s*/dev/)|(?:\\[nrt]|(?<![\w.-]))(?:(?:tee|touch|mkdir|cp|mv)\s|sed(?:\s[^"\\|;&]*?)?\s-(?:\w*i|-in-place))))(?=(?:[^"\\]|\\.)*?(?:plan\.md|goals\.md|\.agents/tasks|src/config\.ts)))'
---
