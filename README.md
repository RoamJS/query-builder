# Query Builder

Introduces new user interfaces for building queries in Roam.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FYERyR8FnXO.png?alt=media&token=7522a921-3e17-424f-b141-08e4109f9b75)

For more information, check out our docs at [https://github.com/RoamJS/query-builder](https://github.com/RoamJS/query-builder)

## Table of Contents

- [RoamJS Query Builder](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#roamjs-query-builder)
  - [Query Blocks](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#query-blocks)
  - [Query Pages](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#query-pages)
  - [Query Drawer](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#query-drawer)
  - [Usage](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#usage)
  - [Conditions](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#conditions)
  - [Selections](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#selections)
  - [Manipulating Results](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#manipulating-results)
  - [Layouts](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#layouts)
  - [Exporting](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#exporting)
  - [Styling](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#styling)
  - [SmartBlocks Integration](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#smartblocks-integration)
  - [Developer API](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#developer-api)
  - [Examples](https://github.com/RoamJS/query-builder/blob/main/docs/query-builder.md#examples)
- [Discourse Graphs](https://github.com/RoamJS/query-builder/blob/main/docs/discourse-graphs.md)
- [Native Roam Queries](https://github.com/RoamJS/query-builder/blob/main/docs/roam-queries.md#native-roam-queries)
  - [Creating Native Roam Queries](https://github.com/RoamJS/query-builder/blob/main/docs/roam-queries.md#creating-native-roam-queries)
  - [Manipulating Native Roam Queries](https://github.com/RoamJS/query-builder/blob/main/docs/roam-queries.md#manipulating-native-roam-queries)
    - [Sorting](https://github.com/RoamJS/query-builder/blob/main/docs/roam-queries.md#sorting)
    - [Randomization](https://github.com/RoamJS/query-builder/blob/main/docs/roam-queries.md#randomization)
    - [Context](https://github.com/RoamJS/query-builder/blob/main/docs/roam-queries.md#context)
    - [Aliases](https://github.com/RoamJS/query-builder/blob/main/docs/roam-queries.md#aliases)
- [Sortable Linked References](https://github.com/RoamJS/query-builder/blob/main/docs/sortable-linked-refs.md)

## Nomenclature

There are some important terms to know and have exact definitions on since they will be used throughout the docs.

- `Page` - A Page is anything in Roam that was created with `[[brackets]]`, `#hashtag`, `#[[hashtag with brackets]]`, or `Attribute::`. Clicking on these links in your graph takes you to its designated page, each with its own unique title, and they have no parent.
- `Block` - A bullet or line of text in Roam. While you can also go to pages that have a zoomed in block view, their content is not unique, and they always have one parent.
- `Node` - A superset of `Block`s and `Page`s.
