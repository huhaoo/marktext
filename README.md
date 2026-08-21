# MarkText math-macros fork

This working copy is based on the official MarkText `v0.19.1` Windows x64
runtime. The runtime was extracted from the official installation package so
that it can be tested and packaged in the current offline workspace.

The feature adds a small Math macros editor to the Preferences window. Each
line defines one KaTeX macro:

```text
\R = \mathbb{R}
\norm = \left\lVert #1 \right\rVert
```

Macros are read only by the three math-rendering paths. Ordinary Markdown text
is never rewritten. The implementation uses KaTeX's own `macros` option, so
`#1` ... `#9` are expanded by KaTeX.

See [docs/math-macros.md](docs/math-macros.md) for user instructions and
[docs/math-macros-implementation.md](docs/math-macros-implementation.md) for
the short source-level reapplication guide.
