import React from "react";
import { InputGroup, Label } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types";
import Description from "roamjs-components/components/Description";

type NanopubMainConfigProps = {
  onloadArgs: OnloadArgs;
};

const NanopubMainConfig = ({ onloadArgs }: NanopubMainConfigProps) => {
  return (
    <Label>
      ORCID
      <Description description="Just the 16 digits, e.g. 0000-0000-0000-0000" />
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
