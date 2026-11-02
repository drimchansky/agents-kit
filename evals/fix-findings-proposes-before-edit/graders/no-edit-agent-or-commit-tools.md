---
type: regex
weight: 3
target: trace
match: not_contains
pattern: '"type":"tool_use","id":"[^"]*","name":"(?:Write|Edit|MultiEdit|NotebookEdit|Agent|Task)"|"type":"tool_use","id":"[^"]*","name":"Skill","input":\{(?:[^"}]|"(?:[^"\\]|\\.)*")*?"skill":"(?:[\w-]+:)?(?:commit|squash-push|rebase)"'
---
