# RoamJS Query Builder

Query Builder can be used to create queries via a [Query Block](#query-blocks), [Query Pages](#query-pages), or the [Query Drawer](#query-drawer).

These queries are far more powerful than vanilla Roam queries, as it taps into Roam's underlying query language surfaced through an approachable UI.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FkZkUZkpxWj.png?alt=media&token=c836a4a9-0e1d-41ca-a2a0-aad0c34afcf2)

## Query Blocks

The above UI is available as a block component. This allows you to create several on a page, wherever on the page you want.

To create one, simply add `{{query block}}` to any block on the page.

## Query Pages

With Query Pages, you designate certain pages in your Roam graph as "views" into your data.

On the Roam Depot Settings page for Query Builder, you should see a setting called `Query Pages`. You could use this to denote which page titles in your Roam Graph will be used to create query pages. Use the `*` as a wildcard.

By default, Query Pages is set to be titled with `queries/*`. This means any page in your graph prefixed with `queries/` can be used to save a query. You can denote multiple page title formats.

Example: `[[queries/Demo]]`

## Query Drawer

The above UI is also available as a left hand drawer, accessible from the command palette. This allows you to execute a query no matter where in your graph you are.

To open, enter `Open Query Drawer` from the Roam Command Palette.

## Usage

Create a [Query Block](#query-blocks), navigate to a [Query Page](#query-pages), or open the [Query Drawer](#query-drawer) to begin to building your query. You can use this editor to create and save a query.

There are two important parts to a query: [Conditions](#conditions) and [Selections](#selections).

After specifying conditions and selections, hit the `Query` button to return results in your graph. These results will always include a `text` field which will link to the relevant block or page reference. Hitting `Query` also effectively "Saves" the query to the graph.

The results returned will be organized in a table with sortable and filterable columns. Click on the columns to sort the data and use the filter icon to narrow down the table to your desired results:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F4Tl0Yotz6V.png?alt=media&token=db2db5e3-4b66-489f-9d6d-ad271a170463)

## Conditions

**Conditions** specify which blocks you want to return. They determine the **rows** of the table. The anatomy of a Condition is a triple: `source`, `relationship`, & `target`:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F43zLKIaYmR.png?alt=media&token=d279b43a-790c-472a-9ac4-28c05f76563f)

You can use a combination of multiple **conditions** to select the data you want.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fq6Tn9LVu89.png?alt=media&token=548ab58b-2cd3-4b5a-aca4-e553b3e55b19)

`relationship`s will autocomplete as you type:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FdM2m9nT_4G.png?alt=media&token=aded28a9-2971-4a4c-9ad2-3014f971f0ea)

### Supported Relationships

| Relationship            | Description                                                                                                                                 | Example                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `created after`         | The `source` block or page was created after the naturally specified `target`.                                                              |                                           |
| `created before`        | The `source` block or page was created before the naturally specified `target`.                                                             |                                           |
| `created by`            | The `source` block or page was created by the user with a display name of `target`.                                                         |                                           |
| `edited after`          | The `source` block or page was edited after the naturally specified `target`.                                                               |                                           |
| `edited before`         | The `source` block or page was edited before the naturally specified `target`.                                                              |                                           |
| `edited by`             | The `source` block or page was last edited by the user with a display name of `target`.                                                     |                                           |
| `has ancestor`          | The `source` block has the `target` block or page as an ancestor up the outliner tree.                                                      |                                           |
| `has attribute`         | The `source` block or page has an attribute with value `target`.                                                                            |                                           |
| `has child`             | The `source` block or page has the `target` block as a child.                                                                               |                                           |
| `has descendent`        | The `source` block or page has the `target` block as a descendant somewhere down the outliner tree.                                         |                                           |
| `has title`             | The `source` page has the exact text `target` as a title. Supports date NLP. The `target` also supports Regular Expressions.                | [Link](examples.md#has-title)             |
| `is in page`            | The `source` block is in the `target` page.                                                                                                 |                                           |
| `is in page with title` | The `source` block is in a page with title `target`. Supports date NLP. The `target` also supports Regular Expressions.                     | [Link](examples.md#is-in-page-with-title) |
| `is referenced by`      | The `source` block or page is referenced by the `target` block or page.                                                                     |                                           |
| `references`            | The `source` block or page references the `target` block or page.                                                                           |                                           |
| `references title`      | The `source` block or page references a page with `target` as the title. Supports date NLP. The `target` also supports Regular Expressions. | [Link](examples.md#references-title)      |
| `titled after`          | The `source` page is a DNP that is after the naturally specified `target`.                                                                  |                                           |
| `titled before`         | The `source` page is a DNP that is before the naturally specified `target`.                                                                 |                                           |
| `with text`             | The `source` block or page has the exact text `target` somewhere in its block text or page title.                                           |                                           |
| `with title in text`    | The `source` page has the exact text `target` somewhere in its page title.                                                                  |                                           |

## Selections

**Selections** specify what data from the blocks that match your conditions get returned. They determine the **columns** of the table. By default, the block text or page title is always returned and hyperlinked. Every selection is made up of two parts: the `label` and the `data`:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FRfEkGB3PWo.png?alt=media&token=3d48fe9e-6fab-4a5e-846a-be426a4ab18c)

The `label`, which gets specified after **AS**, denotes the name of the column that gets used. The `data`, which gets specified after **Select**, denotes what kind of data to return.

### Supported Data Types

**Metadata**

| Data             | Description                            | Example |
| ---------------- | -------------------------------------- | ------- |
| `Author`         | The user who created the block or page |         |
| `Created Date`   | The date the block or page was created |         |
| `Created Time`   | Same as above, but in `hh:mm` format   |         |
| `Edited Date`    | The date the block or page was edited  |         |
| `Edited Time`    | Same as above, but in `hh:mm` format   |         |
| `Last Edited By` | The user who created the block or page |         |

**Additional Data Types**

| Data                               | Description                                                                                   | Example                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------- |
| `{attribute}`                      | Returns the value of an `{attribute}` associated with the queried results.                    |                                        |
| `node:{node}`                      | Returns any intermediary node you defined in one of the conditions.                           | [Link](examples.md#intermediate-node)  |
| `node:{node}:{data}`               | Specify one of the [metadata](#metadata) `{data}` options to return for an intermediary node. | [Link](examples.md#field)              |
| `node:{node}:/regular_expression/` | Returns a match according to a regular expression between `/`'s.                              | [Link](examples.md#regular-expression) |
| `node`                             | Edit the column header of the first column                                                    | [Link](examples.md#node)               |
| `add({label1}, {label2})`          | Add the values of two columns. Supports adding values to dates.                               | [Link](examples.md#add-or-subtract)    |
| `subtract({label1}, {label2})`     | Subtract the values betweenn two columns. Supports adding values to dates.                    | [Link](examples.md#add-or-subtract)    |

## Manipulating Results

After you fire a query, the results will output in a table view. There are multiple ways to post process these results after they output to the screen.

### Sort<!-- omit in toc -->

Clicking on the table header for a given column will trigger an alphabetical sort. Clicking again will toggle descending order. Clicking once more will toggle the sort off. You could have multiple columns selected for sorting:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FP1-KDvuRhS.png?alt=media&token=b85999f9-f9a6-4a36-acc9-bb15724507a3)

### Filter<!-- omit in toc -->

Each column is also filterable. The filter works just like the page and reference filters in native Roam, where you could pick values to include and remove:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FG7d1TrIzNq.png?alt=media&token=8df90fc5-5e8d-4347-9721-bd067ac7616a)

### View Type<!-- omit in toc -->

Each column also has a view type. Choosing a view type will change how the cell is displayed in the table.

The supported view types are:

| View Type | Description                                           |
| --------- | ----------------------------------------------------- |
| `plain`   | Outputted as plain text                               |
| `link`    | Outputted as text that links to the block or page     |
| `embed`   | Embeds the contents of the block or page in the cell. |

All changes to the outputted results are saved automatically.

## Layouts

By default, the query builder will use the `Table` layout. You can switch to a different layout by hitting the more menu on the top right of the results and clicking on the `Layout` option.

The following layouts are available:

| Layout     | Description                                         | Example                             |
| ---------- | --------------------------------------------------- | ----------------------------------- |
| `Line`     | Displays your data as a line chart.                 | [Link](examples.md#Line)            |
| `Bar`      | Displays your data as a bar chart.                  | [Link](examples.md#Bar)             |
| `Timeline` | Displays your data as an interactive timeline view. | [Link](examples.md#Timeline)        |
| `Kanban`   | Displays your data as a Kanban board.               | <!--[Link](examples.md#Kanban)  --> |

## Exporting

Next to the save button is a button that will allow you to export your results. There are currently two formats available to export to:

- CSV - All the columns in the table will become columns in the CSV
- Markdown - The columns will become frontmatter data and the children of the block or page will become markdown content.

## Styling

Every [Query Block](#query-blocks) or [Query Page](#query-pages) is rooted with a `div` that has an `id` of `roamjs-query-page-${uid}` where `uid` is the block reference of the query block or the page reference of the page. You could use this id to style individual queries with affecting other ones.

## SmartBlocks Integration

This extension comes with its own SmartBlocks command! The `<%QUERYBUILDER%>` command will run an existing [Query Block](#query-blocks) or [Query Page](#query-pages) instance in your graph and return the results as separate blocks. The command takes in two arguments:

1. The block reference, alias, or page title of the query instance
1. The format to output each result in. You can use placeholders, like `{text}` to insert the value from the result in. There's a placeholder available for each Selection label used in the query.

### Alias

You can set the alias of a [Query Block](#query-blocks) in the top right corner of the UI.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FN_YUvsTh-w.png?alt=media&token=f734f73b-7fa4-48f6-97e0-d6c3671ca02c)

The end of the title of a [Query Page](#query-pages) works as well.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FNVOH1yVd5x.png?alt=media&token=e9698dc6-0c48-4cbb-bc47-46bf3959eb27)

### Examples

`<%QUERYBUILDER:6-qLCJsSb,{text}%>`

`<%QUERYBUILDER:myQuery,{uid}%>`

`<%QUERYBUILDER:queries/myQuery%>`

## Developer API

For developers of other extensions who want to use the queries defined by users, we expose the following API, available on the global `window.roamjs.extension.queryBuilder` object:

- `listActiveQueries` - `() => { uid: string }[]` Returns an array of blocks or pages where the user has a query defined from query builder.
- `runQuery` - `(uid: string) => Promise<Result[]>` Runs the query defined at the input `uid` and returns a promise that resolves to the array of results from the user's graphs. `Result`s have the following schema:
  - `text` - `string` The page title or block text of the primary node involved in the result.
  - `uid` - `string` The reference of the primary node involved in the result.
  - `${string}-uid` - `string` If the users define selections that return intermediary nodes, the reference of those nodes will always end in `-uid` and will always be of type `string`.
  - `{string}` - `string | number | Date` All other fields returned in the result can be any of the primitive value types.

## Demos

### General Demo<!-- omit in toc -->

Demo showing [Query Block](#query-blocks), [Query Pages](#query-pages), [Query Drawer](#query-drawer), [Conditions](#conditions), [Selections](#selections) and a few example queries.

<video src="https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fj0Li5mCafX.mp4?alt=media&token=58ee51b2-9a7b-4547-81ad-01672b3b5820" controls="controls"></video>

[Direct Video Link](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fj0Li5mCafX.mp4?alt=media&token=58ee51b2-9a7b-4547-81ad-01672b3b5820)

### Conversation with Conor White-Sullivan<!-- omit in toc -->

About Roam Depot, extensions, and a Query Builder demo. Demo starts around 13 minutes.

(in the demo you'll see the `block` being used, but that can be interchanged with `node`)

[![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FEY0iYQHf3N.png?alt=media&token=c8958afa-0c7c-495c-908a-bd5edcb02fd1)](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FEY0iYQHf3N.png?alt=media&token=c8958afa-0c7c-495c-908a-bd5edcb02fd1)

[View on Grain](https://grain.com/share/recording/9d0e349b-bb0d-4267-a362-e2a79667b787/UOW64KlylDapMRhDJjwuTrDl8bzMOcQ3tUGECdhR)
