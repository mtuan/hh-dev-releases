# Dashboard style bundles

`bundles/default.css` is the renderer's default style entry. The build compiles it and all imports into one `dist/src/styles.css` file.

- `themes/` owns fonts and semantic design-token values.
- `components/` owns reusable UI component and application-shell styles.
- `pages/` owns route-specific layout and presentation.
- `foundation.css` owns resets and document defaults shared by every theme.

To add a theme, create `themes/<theme>.css` with the same semantic token contract and a matching bundle:

```css
@import '../themes/<theme>.css';
@import './shared.css';
```

Do not override shared component geometry inside a theme. Themes provide semantic tokens; components and pages consume them.
