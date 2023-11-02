import { Radio, RadioGroup, Switch, Tooltip } from "@blueprintjs/core";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CustomField } from "roamjs-components/components/ConfigPanels/types";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import createBlock from "roamjs-components/writes/createBlock";

const DiscourseNodeConfigPanel: CustomField["options"]["component"] = ({
  uid,
}: {
  uid: string;
}) => {
  const containerRef = useRef(null);
  const tree = useMemo(() => getBasicTreeByParentUid(uid), [uid]);
  const [isKeyImage, setIsKeyImage] = useState(
    () => getSettingValueFromTree({ tree, key: "key-image" }) === "true"
  );
  const [keyImageOption, setKeyImageOption] = useState(() =>
    getSettingValueFromTree({ tree, key: "key-image-option" })
  );
  const smartblockTemplateNode = useMemo(
    () => getSubTree({ parentUid: uid, tree, key: "smartblock-template" }),
    [uid, tree]
  );

  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      (smartblockTemplateNode.uid
        ? Promise.resolve(smartblockTemplateNode.uid)
        : createBlock({
            node: { text: "smartblock-template", children: [] },
            parentUid: uid,
          }).then((uid) => {
            return uid;
          })
      )
        .then((uid) =>
          getFirstChildUidByBlockUid(uid)
            ? uid
            : createBlock({
                node: { text: "" },
                parentUid: uid,
              })
        )
        .then(() => {
          window.roamAlphaAPI.ui.components.renderBlock({
            uid: smartblockTemplateNode.uid,
            el,
          });
        });
    }
  }, [containerRef, smartblockTemplateNode.uid, keyImageOption]);

  return (
    <>
      <Tooltip content="Add an image to each Discourse Node">
        <Switch
          label="Use Key Images"
          checked={isKeyImage}
          onChange={(e) => {
            const target = e.target as HTMLInputElement;
            setIsKeyImage(target.checked);
            if (target.checked) {
              setKeyImageOption("first-image");
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
        />
      </Tooltip>

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
        <Tooltip content="Where to get the image from" />
        <Radio label="First image on page" value="first-image" />
        <Radio value="smartblock">
          <Tooltip content="Must return an image URL">SmartBlock</Tooltip>
        </Radio>
      </RadioGroup>
      {keyImageOption === "smartblock" && (
        <div
          ref={containerRef}
          style={{
            border: "1px solid #33333333",
            padding: "8px 0",
            borderRadius: 4,
          }}
          className={"roamjs-config-blocks"}
        />
      )}
    </>
  );
};

export default DiscourseNodeConfigPanel;
