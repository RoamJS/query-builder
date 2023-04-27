import { Button, InputGroup, Label } from "@blueprintjs/core";
import React, { useRef, useState, useMemo } from "react";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import setInputSetting from "roamjs-components/util/setInputSetting";

const DiscourseNodeCanvasSettings = ({ uid }: { uid: string }) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), [uid]);
  const [color, setColor] = useState<string>(() =>
    getSettingValueFromTree({ tree, key: "color" })
  );
  const [alias, setAlias] = useState<string>(() =>
    getSettingValueFromTree({ tree, key: "alias" })
  );
  return (
    <div>
      <Label style={{ width: 120 }}>
        Color Picker
        <InputGroup
          type={"color"}
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setInputSetting({
              blockUid: uid,
              key: "color",
              value: e.target.value,
            });
          }}
        />
      </Label>
      <Label style={{ width: 240 }}>
        Display Alias
        <InputGroup
          value={alias}
          onChange={(e) => {
            setAlias(e.target.value);
            setInputSetting({
              blockUid: uid,
              key: "alias",
              value: e.target.value,
            });
          }}
        />
      </Label>
    </div>
  );
};

export default DiscourseNodeCanvasSettings;
