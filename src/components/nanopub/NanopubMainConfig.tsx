import React from "react";
import { InputGroup, Label } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types";

type NanopubMainConfigProps = {
  onloadArgs: OnloadArgs;
};

const NanopubMainConfig = ({ onloadArgs }: NanopubMainConfigProps) => {
  //   const { value, onChange } = useSingleChildValue({
  //     defaultValue: onloadArgs.extensionAPI.settings.get("orcid") as string,
  //     title,
  //     parentUid,
  //     order: 0,
  //     transform: (s) => s,
  //     toStr: (s) => s,
  //   });
  return (
    <Label>
      ORCID
      <InputGroup
        defaultValue={onloadArgs.extensionAPI.settings.get("orcid") as string}
        onChange={(e) => {
          onloadArgs.extensionAPI.settings.set("orcid", e.target.value);
        }}
        placeholder="0000-0000-0000-0000"
      />
    </Label>
  );
};

NanopubMainConfig.type = "text";

export default NanopubMainConfig;
