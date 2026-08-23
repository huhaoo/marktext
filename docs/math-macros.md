# LaTeX macros

Open **Preferences > Features > LaTeX macros** and enter one definition per
line. In the Chinese interface, the same category and control are shown as
“功能” and “LaTeX 宏”. The setting is stored in the MarkText renderer's
local settings storage and does not change the Markdown file.

Examples:

```text
\R = \mathbb{R}
\C = \mathbb{C}
\norm = \left\lVert #1 \right\rVert
\ip = \left\langle #1, #2 \right\rangle
```

Then this math renders using the definitions:

```markdown
Inline: $\norm{x} \leq \ip{x}{x}$

$$
\R
$$
```

The parser also accepts a JSON object, for example
`{"\\\\R":"\\\\mathbb{R}"}`. Lines beginning with `%` or `//` are ignored.

Important behavior:

- Definitions apply to inline math, display math, and HTML export.
- Definitions do not apply to ordinary prose or fenced code blocks.
- `#1` ... `#9` are argument placeholders handled by KaTeX; do not replace
  them manually.
- After changing a definition, force the affected formula to render again (for
  example by moving the cursor away and back, or reopening the document).
