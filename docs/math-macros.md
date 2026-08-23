# LaTeX macros

Open **Preferences > Features > LaTeX macros** and enter one definition per
line:

```text
\R = \mathbb{R}
\norm = \left\lVert #1 \right\rVert
\ip = \left\langle #1, #2 \right\rangle
```

The following Markdown then uses the definitions only inside math:

```markdown
Inline: $\norm{x} \leq \ip{x}{x}$

$$
\R
$$
```

The setting is stored in MarkText preferences and does not change the
Markdown file. `#1` through `#9` are KaTeX argument placeholders. A JSON
object with the same name/value shape is also accepted.

Macros do not affect ordinary prose or fenced code blocks. After changing a
definition, the current formula is re-rendered automatically; HTML export
uses the same definitions.
