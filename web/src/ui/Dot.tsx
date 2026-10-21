import { useStore } from "../lib/createStore";
import { catColor, catPrefs } from "../lib/catcolor";
import { catIconPath } from "../lib/catIcons";

/** ícone da categoria na cor dela (o nome ficou "Dot" por causa da bolinha de antes) */
export function Dot({ c }: { c?: string }) {
  const p = useStore(catPrefs, s => s);
  return c ? <svg className="cdot" viewBox="0 0 24 24" style={{ color: catColor(c, p) }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: catIconPath(c) }} /> : null;
}
