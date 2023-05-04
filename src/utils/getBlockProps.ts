import type { PullBlock } from "roamjs-components/types/native";

export const normalizeProps = (
  props: Record<string, unknown>
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(props).map(([k, v]) => [
      k.replace(/^:+/, ""),
      typeof v === "object" && v !== null && !Array.isArray(v)
        ? normalizeProps(v as Record<string, unknown>)
        : v,
    ])
  );

const getBlockProps = (uid: string) =>
  normalizeProps(
    window.roamAlphaAPI.pull("[:block/props]", [":block/uid", uid])?.[
      ":block/props"
    ] || ({} as Required<PullBlock>[":block/props"])
  );

export default getBlockProps;
