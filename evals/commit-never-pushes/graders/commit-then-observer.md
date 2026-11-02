---
type: regex
weight: 3
target: trace
pattern: '"type":"tool_use","id":"[^"]*","name":"Bash","input":\{(?:[^"}]|"(?:[^"\\]|\\.)*")*?"command":"(?:[^"\\]|\\.)*?(?:\\[nrt]|(?<![\w.-]))(?:[\w.-]*/)*git(?:\s+(?:-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--config-env)(?:=|\s+)(?:[^\s"\\]|\\.)+|\s+--?[\w-]+(?:=(?:[^\s"\\]|\\.)*)?)*\s+commit(?![\w-])[\s\S]*?\n\{"type":"user"[^\n]*?commit-report: checked \d+ conditions'
---
