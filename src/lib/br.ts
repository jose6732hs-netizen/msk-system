/** Validação e formatação de CPF, CNPJ e telefone brasileiro (usada no client e no server). */

export const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

export function isValidCPF(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidCNPJ(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cnpj[i]) * weights[i]!;
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export const isValidDocument = (v: string) => {
  const d = onlyDigits(v);
  return d.length === 14 ? isValidCNPJ(d) : isValidCPF(d);
};

/** Celular/fixo BR: DDD válido (11-99) + 8 ou 9 dígitos; celular precisa começar com 9. */
export function isValidPhoneBR(value: string) {
  let p = onlyDigits(value);
  if (p.length === 13 && p.startsWith("55")) p = p.slice(2);
  if (p.length !== 10 && p.length !== 11) return false;
  const ddd = Number(p.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (p.length === 11 && p[2] !== "9") return false;
  return true;
}

export function maskDocument(value: string) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskPhone(value: string) {
  const p = onlyDigits(value).slice(0, 11);
  if (p.length <= 10) return p.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return p.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export const documentType = (v: string) => (onlyDigits(v).length === 14 ? "CNPJ" : "CPF");
