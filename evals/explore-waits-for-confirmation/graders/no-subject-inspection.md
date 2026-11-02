---
type: regex
weight: 3
target: trace
match: not_contains
pattern: '"type":"tool_use","id":"[^"]*","name":"(?:(?:Agent|Task|WebFetch|WebSearch)"|Read","input":\{(?=(?:[^"}]|"(?:[^"\\]|\\.)*")*?"file_path":"(?:[^"\\]|\\.)*?(?:(?<=["/])subject(?=[/"])|[Ll]atency))|Glob","input":\{(?=(?:[^"}]|"(?:[^"\\]|\\.)*")*?"(?:pattern|path)":"(?:[^"\\]|\\.)*?(?:(?<=["/])subject(?=[/"])|[Ll]atency))|Grep","input":\{(?:(?=(?:[^"}]|"(?:[^"\\]|\\.)*")*?"(?:path|glob)":"(?:[^"\\]|\\.)*?(?:(?<=["/])subject(?=[/"])|[Ll]atency))|(?=(?:[^"}]|"(?:[^"\\]|\\.)*")*?"pattern":"(?:[^"\\]|\\.)*?(?:[Ll]atency|[Ss]pike))|(?!(?:[^"}]|"(?:[^"\\]|\\.)*")*?"path":)|(?=(?:[^"}]|"(?:[^"\\]|\\.)*")*?"path":"(?:\.?/?|(?:[^"\\]|\\.)*?/cwd/?)"))|Bash","input":\{(?:[^"}]|"(?:[^"\\]|\\.)*")*?"command":"(?:[^"\\]|\\.)*?(?:[Ll]atency|[Ss]pike|(?:\\[nrt]|(?<![\w.-]))subject(?![\w-])|(?:\\[nrt]|(?<![\w.-]))(?:claude\s+(?:[^"\\|;&]*?\s)?(?:-p|--print)(?![\w-])|codex\s+(?:exec|e)(?![\w-]))))'
---
