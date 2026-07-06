// The chassis's component-grammar wiring: a theme supplies its own icon set (the concrete glyph
// data) and its own defineComponent() list; this module wires either into the engine's render
// helpers with no theme-specific knowledge of its own. A theme reads makeIconRenderer, never
// iconSpan/glyph directly, so re-skinning the icon SET (swapping the glyph data passed in) never
// touches a component's build() function. Copied verbatim from cairn-cms's showcase per the
// chassis's own subtractability rule (src/chassis/README.md): Task 1's scaffold omitted this file
// since zero components were registered at scaffold time; Task 3 re-adds it now that the club
// content's migrated directives (passage, callout, cards/card) need real icons.
import { glyph, type IconSet } from '@glw907/cairn-cms';
import { iconSpan } from '@glw907/cairn-cms/render';
import type { Element } from 'hast';

/**
 * Wires a theme's icon set into the engine's glyph-rendering helpers, returning a function that
 * looks up one glyph by name and renders it as an inline icon span, with an optional semantic
 * role attribute. A theme's defineComponent() build() functions call the returned function; this
 * module never sees which names a theme declares.
 */
export function makeIconRenderer(icons: IconSet): (name: string, role?: string) => Element {
  return (name, role) => iconSpan(glyph(name, icons), role);
}
