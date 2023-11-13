import {
  InputGroup,
  Label,
  Radio,
  RadioGroup,
  Switch,
  Tooltip,
  Icon,
} from "@blueprintjs/core";
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
  const [queryBuilderAlias, setQueryBuilderAlias] = useState<string>(() =>
    getSettingValueFromTree({ tree, key: "query-builder-alias" })
  );
  const [isKeyImage, setIsKeyImage] = useState(
    () => getSettingValueFromTree({ tree, key: "key-image" }) === "true"
  );
  const [keyImageOption, setKeyImageOption] = useState(() =>
    getSettingValueFromTree({ tree, key: "key-image-option" })
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
      {/* <Tooltip content="Add an image to each Discourse Node"> */}
      <Switch
        // label="Use Key Images"
        style={{ width: 240, lineHeight: "normal" }}
        alignIndicator="right"
        checked={isKeyImage}
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setIsKeyImage(target.checked);
          if (target.checked) {
            if (!keyImageOption) setKeyImageOption("first-image");
            setInputSetting({
              blockUid: uid,
              key: "key-image",
              value: "true",
            });
          } else {
            setInputSetting({
              blockUid: uid,
              key: "key-image",
              value: "false",
            });
          }
        }}
      >
        Key Image
        <Tooltip content={"Add an image to the Discourse Node"}>
          <Icon
            icon={"info-sign"}
            iconSize={12}
            className={"align-middle opacity-80 ml-2"}
          />
        </Tooltip>
      </Switch>
      {/* </Tooltip> */}
      <RadioGroup
        disabled={!isKeyImage}
        selectedValue={!!keyImageOption ? keyImageOption : "first-image"}
        label="Key Image Location"
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setKeyImageOption(target.value);
          setInputSetting({
            blockUid: uid,
            key: "key-image-option",
            value: target.value,
          });
        }}
      >
        <Radio label="First image on page" value="first-image" />
        <Radio value="query-builder">
          Query Builder reference
          <Tooltip content={"Use a Query Builder alias or block reference"}>
            <Icon
              icon={"info-sign"}
              iconSize={12}
              className={"align-middle opacity-80 ml-2"}
            />
          </Tooltip>
        </Radio>
      </RadioGroup>
      <InputGroup
        style={{ width: 240 }}
        disabled={keyImageOption !== "query-builder" || !isKeyImage}
        value={queryBuilderAlias}
        onChange={(e) => {
          setQueryBuilderAlias(e.target.value);
          setInputSetting({
            blockUid: uid,
            key: "query-builder-alias",
            value: e.target.value,
          });
        }}
      />
    </div>
  );
};

export default DiscourseNodeCanvasSettings;
