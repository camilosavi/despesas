import { useStore } from "../lib/createStore";
import { catColor, catPrefs } from "../lib/catcolor";

/** bolinha na cor da categoria */
export function Dot({ c }: { c?: string }) {
  const p = useStore(catPrefs, s => s);
  return c ? <span className="cdot" style={{ background: catColor(c, p) }} aria-hidden="true"></span> : null;
}
