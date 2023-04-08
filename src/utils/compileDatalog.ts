import type {
  DatalogArgument,
  DatalogBinding,
  DatalogClause,
} from "roamjs-components/types/native";

const toVar = (v = "undefined") => v.replace(/[\s"()[\]{}/\\^]/g, "");

const compileDatalog = (
  d:
    | Partial<DatalogClause>
    | Partial<DatalogArgument>
    | Partial<DatalogBinding>,
  level: number
): string => {
  switch (d.type) {
    case "data-pattern":
      return `[${d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""}${(
        d.arguments || []
      )
        .map((a) => compileDatalog(a, level))
        .join(" ")}]`;
    case "src-var":
      return `$${toVar(d.value)}`;
    case "constant":
    case "underscore":
      return d.value || "_";
    case "variable":
      return `?${toVar(d.value)}`;
    case "fn-expr":
      if (!d.binding) return "";
      return `[(${d.fn} ${(d.arguments || [])
        .map((a) => compileDatalog(a, level))
        .join(" ")}) ${compileDatalog(d.binding, level)}]`;
    case "pred-expr":
      return `[(${d.pred} ${(d.arguments || [])
        .map((a) => compileDatalog(a, level))
        .join(" ")})]`;
    case "rule-expr":
      return `[${d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""}${(
        d.arguments || []
      )
        .map((a) => compileDatalog(a, level))
        .join(" ")}]`;
    case "not-clause":
      return `(${d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""}not ${(
        d.clauses || []
      )
        .map((a) => compileDatalog(a, level + 1))
        .join(" ")})`;
    case "or-clause":
      return `(${d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""}or ${(
        d.clauses || []
      )
        .map((a) => compileDatalog(a, level + 1))
        .join("\n")})`;
    case "and-clause":
      return `${"".padStart(level * 2, " ")}(and\n${(d.clauses || [])
        .map((c) => compileDatalog(c, level + 1))
        .join("\n")}\n${"".padStart(level * 2, " ")})`;
    case "not-join-clause":
      return `(${
        d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""
      }not-join [${(d.variables || [])
        .map((v) => compileDatalog(v, level))
        .join(" ")}] ${(d.clauses || [])
        .map((a) => compileDatalog(a, level + 1))
        .join(" ")})`;
    case "or-join-clause":
      return `(${
        d.srcVar ? `${compileDatalog(d.srcVar, level)} ` : ""
      }or-join [${(d.variables || [])
        .map((v) => compileDatalog(v, level))
        .join(" ")}]\n${(d.clauses || [])
        .map((a) => compileDatalog(a, level + 1))
        .join("\n")})`;
    case "bind-scalar":
      if (!d.variable) return "";
      return compileDatalog(d.variable, level);
    default:
      return "";
  }
};

export default compileDatalog;
