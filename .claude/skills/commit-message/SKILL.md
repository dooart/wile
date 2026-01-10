---
name: commit-message
description: Use this skill when asked to commit changes; format messages with lowercase titles and detailed problem/solution paragraphs.
---

When the user asks you to commit code changes, use this exact format:

## format structure

```
lowercase title summarizing the change

problem paragraph explaining what was broken/wrong/suboptimal. this should be detailed and comprehensive, explaining the root cause, symptoms, and why it needed to be fixed. use flowing prose, not bullet points. can be multiple sentences, as long as needed to fully explain the context.

solution paragraph explaining what was done to fix it, what specific code/files were changed, what the new behavior is, and why this solves the problem. include implementation details. use flowing prose, not bullet points. can be multiple sentences, as long as needed to fully document the changes.
```

## rules

- title: all lowercase, concise summary
- title must not contain any issue id, user story id, ticket id, or similar reference
- no section headers like "problem:" or "solution:" or "changes:"
- no bullet points anywhere
- no "next steps" section
- problem and solution are just two paragraphs of flowing text
- solution paragraph includes both what changed AND the implementation details (files, parameters, logic)
- be as detailed as necessary in both paragraphs
- maintain professional technical writing style
- do NOT include "generated with" or "co-authored by claude" spam into the commit message

## example

```
implement restorative masonry: balanced 50/50 noise bias

the 80% fake wall bias trained a "demolition crew" model that learned to delete walls but not restore them. the training was asymmetric: 80% of noise blocks were fake walls (teaching deletion) and only 20% were fake holes (barely teaching restoration). this caused maps to dissolve into static over time as the model aggressively removed structure without learning to fill holes.

changed the noise bias from 80/20 to 50/50 by updating is_wall_low probability from 0.8 to 0.5 in train_rssm.py. now 50% of noise blocks are fake walls (teaching deletion) and 50% are fake holes (teaching restoration). this forces the model to learn contextual reasoning instead of a "delete everything" heuristic and matches the inference distribution where errors are bidirectional.
```
