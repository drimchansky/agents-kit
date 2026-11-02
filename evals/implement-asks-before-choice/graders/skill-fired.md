---
type: regex
weight: 1
arm: with-only
target: last_message
match: not_contains
flags: i
pattern: '(?:/?agents-kit:implement|/implement\b|slash command|skill|plugin)[^.\n]{0,60}?(?:is\s+not|isn.t|was\s+not|wasn.t|not|un)\s*(?:installed|available|recogni[sz]ed|registered|loaded)|unknown\s+(?:slash\s+)?(?:command|skill)|no\s+such\s+(?:slash\s+)?(?:command|skill)|(?:isn.t|is\s+not|not)\s+(?:installed|available)\s+in\s+this\s+session'
---
