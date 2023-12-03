// WIP
// Move to roamjs-components
import { IButtonProps, MenuItem } from "@blueprintjs/core";
import { SelectProps, MultiSelect } from "@blueprintjs/select";
import React, { ReactText } from "react";

const MultipleSelect = <T extends ReactText>(
  props: Omit<SelectProps<T>, "itemRenderer"> & {
    ButtonProps?: IButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;
  } & { emptyValueText?: string; transformItem?: (s: T) => React.ReactNode }
): JSX.Element => {
  const MultiItemSelect = MultiSelect.ofType<T>();
  const itemPredicate = (query: string, item: T) => {
    const text = props.transformItem ? props.transformItem(item) : item;
    return String(text).toLowerCase().includes(query.toLowerCase());
  };
  const { activeItem, filterable = false, ...selectProps } = props;
  return (
    <MultiItemSelect
      {...selectProps}
      itemRenderer={(item, { modifiers, handleClick }) => (
        <MenuItem
          key={item}
          text={props.transformItem ? props.transformItem(item) : item}
          active={modifiers.active}
          onClick={handleClick}
        />
      )}
      tagRenderer={(item) =>
        props.transformItem ? props.transformItem(item) : item
      }
      itemPredicate={props.filterable ? itemPredicate : undefined}
    ></MultiItemSelect>
  );
};

export default MultipleSelect;
