import toCellValue from "./toCellValue";

const BUTTON_MARKUP_REGEX = /\{\{([^{}]*)\}\}/g;
const BUTTON_PREFIX_REGEX = /^\s*(?:\[\[)?button(?:\]\])?\s*:/i;

const stripButtonMarkup = (value: string): string => {
  let output = value;
  let previous = "";
  while (output !== previous) {
    previous = output;
    output = output.replace(BUTTON_MARKUP_REGEX, (_, inner: string) =>
      inner.replace(BUTTON_PREFIX_REGEX, "").trim()
    );
  }
  return output;
};

const toTextOnlyValue = ({
  value,
  uid,
  defaultValue = "",
}: {
  value: number | Date | string;
  uid: string;
  defaultValue?: string;
}) => stripButtonMarkup(toCellValue({ value, uid, defaultValue }));

export default toTextOnlyValue;
