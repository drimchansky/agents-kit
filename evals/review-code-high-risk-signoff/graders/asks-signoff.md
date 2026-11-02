---
type: regex
weight: 3
target: trace
flags: i
pattern: '"type":"tool_use","id":"[^"]*","name":"AskUserQuestion","input":\{(?:(?!"type":")[^\n])*?sign(?:s|ed|ing)?[\s-]*off|"role":"assistant","content":\[[^\n]*?\{"type":"text","text":"(?:[^"\\]|\\.)*?(?:sign(?:s|ed|ing)?[\s-]*off(?:[^"\\?!.]|\.(?![\s"\\])|\\[^n])*?\?|(?:please|reply)(?:[^"\\?!.]|\.(?![\s"\\])|\\[^n]){0,160}?sign(?:s|ed|ing)?[\s-]*off)'
---
