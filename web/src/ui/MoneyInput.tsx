import type { InputHTMLAttributes } from "react";
import { moneyMask } from "../lib/format";

/** campo de valor: digita só números e vai formatando (centavos). `value` é o texto já formatado. */
export function MoneyInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <input type="text" className="money" inputMode="numeric" placeholder="0,00" value={value} onChange={e => onChange(moneyMask(e.target.value))} {...rest} />;
}
