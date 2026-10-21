import { useStore } from "../lib/createStore";
import { catColor, catPrefs } from "../lib/catcolor";

/** bolinha na cor da categoria */
export function Dot({ c }: { c?: string }) {
  const p = useStore(catPrefs, s => s);
  return c ? <i className="cdot" style={{ background: catColor(c, p) }} aria-hidden="true" /> : null;
}
