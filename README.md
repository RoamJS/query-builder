# Query Builder<!-- omit in toc -->

Introduces new user interfaces for building queries in Roam.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FTTIyJxNaux.png?alt=media&token=fa991711-f319-43e1-8a9c-6a64d818df29)

For more information, check out our docs at [https://roamjs.com/extensions/query-builder](https://roamjs.com/extensions/query-builder)

## Table of Contents<!-- omit in toc -->

- [Nomenclature](#nomenclature)
- [RoamJS Query Builder](#roamjs-query-builder)
  - [Query Blocks](#query-blocks)
  - [Query Pages](#query-pages)
  - [Query Drawer](#query-drawer)
  - [Usage](#usage)
  - [Conditions](#conditions)
  - [Selections](#selections)
  - [Manipulating Results](#manipulating-results)
  - [Layouts](#layouts)
  - [Exporting](#exporting)
  - [Styling](#styling)
  - [SmartBlocks Integration](#smartblocks-integration)
  - [Developer API](#developer-api)
  - [Demos](#demos)
- [Native Roam Queries](#native-roam-queries)
  - [Creating Native Roam Queries](#creating-native-roam-queries)
  - [Manipulating Native Roam Queries](#manipulating-native-roam-queries)
    - [Sorting](#sorting)
    - [Randomization](#randomization)
    - [Context](#context)
    - [Aliases](#aliases)
- [Sortable Linked References](#sortable-linked-references)
- [Discourse Graphs](#discourse-graphs)

## Nomenclature

There are some important terms to know and have exact definitions on since they will be used throughout the docs.

- `Page` - A Page is anything in Roam that was created with `[[brackets]]`, `#hashtag`, `#[[hashtag with brackets]]`, or `Attribute::`. Clicking on these links in your graph takes you to its designated page, each with its own unique title, and they have no parent.
- `Block` - A bullet or line of text in Roam. While you can also go to pages that have a zoomed in block view, their content is not unique, and they always have one parent.
- `Node` - A superset of `Block`s and `Page`s.

## RoamJS Query Builder

Query Builder can be used to create queries via a [Query Block](#query-blocks), [Query Pages](#query-pages), or the [Query Drawer](#query-drawer).

These queries are far more powerful than vanilla Roam queries, as it taps into Roam's underlying query language surfaced through an approachable UI.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FkZkUZkpxWj.png?alt=media&token=c836a4a9-0e1d-41ca-a2a0-aad0c34afcf2)

### Query Blocks

The above UI is available as a block component. This allows you to create several on a page, wherever on the page you want. 

To create one, simply add `{{query block}}` to any block on the page.

### Query Pages

With Query Pages, you designate certain pages in your Roam graph as "views" into your data. 

On the Roam Depot Settings page for Query Builder, you should see a setting called `Query Pages`. You could use this to denote which page titles in your Roam Graph will be used to create query pages. Use the `*` as a wildcard.

By default, Query Pages is set to be titled with `queries/*`. This means any page in your graph prefixed with `queries/` can be used to save a query. You can denote multiple page title formats.

Example: `[[queries/Demo]]`

### Query Drawer

The above UI is also available as a left hand drawer, accessible from the command palette. This allows you to execute a query no matter where in your graph you are. 

To open, enter `Open Query Drawer` from the Roam Command Palette.

### Usage

Create a [Query Block](#query-blocks), navigate to a [Query Page](#query-pages), or open the [Query Drawer](#query-drawer) to begin to building your query.  You can use this editor to create and save a query. 

There are two important parts to a query: [Conditions](#conditions) and [Selections](#selections).

After specifying conditions and selections, hit the `Query` button to return results in your graph. These results will always include a `text` field which will link to the relevant block or page reference. Hitting `Query` also effectively "Saves" the query to the graph.

The results returned will be organized in a table with sortable and filterable columns. Click on the columns to sort the data and use the filter icon to narrow down the table to your desired results:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F4Tl0Yotz6V.png?alt=media&token=db2db5e3-4b66-489f-9d6d-ad271a170463)

### Conditions

**Conditions** specify which blocks you want to return. They determine the **rows** of the table. The anatomy of a Condition is a triple: `source`, `relationship`, & `target`:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F43zLKIaYmR.png?alt=media&token=d279b43a-790c-472a-9ac4-28c05f76563f)

You can use a combination of multiple **conditions** to select the data you want. 

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fq6Tn9LVu89.png?alt=media&token=548ab58b-2cd3-4b5a-aca4-e553b3e55b19)

`relationship`s will autocomplete as you type:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FdM2m9nT_4G.png?alt=media&token=aded28a9-2971-4a4c-9ad2-3014f971f0ea)

Here are all the supported `relationship`s:

- `has title` - The `source` page has the exact text `target` as a title. If `target` is equal to `{date}`, then it matches any Daily Note Page. Supports date NLP to resolve a single date, e.g. `{date:today}`. The `target` also supports Regular Expressions by starting and ending the value with a `/`.
- `references` - The `source` block or page references the `target` block or page.
- `references title` - The `source` block or page references a page with `target` as the title. If `target` is equal to `{date}`, then it matches any Daily Note Page. Supports date NLP to resolve a single date, e.g. `{date:today}`. The `target` also supports Regular Expressions by starting and ending the value with a `/`.
- `is referenced by` - The `source` block or page is referenced by the `target` block or page.
- `is in page` - The `source` block is in the `target` page.
- `is in page with title` - The `source` block is in a page with title `target`. If `target` is equal to `{date}`, then it matches any Daily Note Page. Supports date NLP to resolve a single date, e.g. `{date:today}`. The `target` also supports Regular Expressions by starting and ending the value with a `/`.
- `has attribute` - The `source` block or page has an attribute with value `target`.
- `has child` - The `source` block or page has the `target` block as a child.
- `has ancestor` - The `source` block has the `target` block or page as an ancestor up the outliner tree.
- `has descendent` - The `source` block or page has the `target` block as a descendant somewhere down the outliner tree
- `with text` - The `source` block or page has the exact text `target` somewhere in its block text or page title
- `created by` - The `source` block or page was created by the user with a display name of `target`
- `edited by` - The `source` block or page was last edited by the user with a display name of `target`
- `with title in text` - The `source` page has the exact text `target` somewhere in its page title.
- `created before` - The `source` block or page was created before the naturally specified `target`
- `created after` - The `source` block or page was created after the naturally specified `target`
- `edited before` - The `source` block or page was edited before the naturally specified `target`
- `edited after` - The `source` block or page was edited after the naturally specified `target`
- `titled before` - The `source` page is a DNP that is before the naturally specified `target`
- `titled after` - The `source` page is a DNP that is after the naturally specified `target`

### Selections

**Selections** specify what data from the blocks that match your conditions get returned. They determine the **columns** of the table. By default, the block text or page title is always returned and hyperlinked. Every selection is made up of two parts: the `label` and the `data`:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FRfEkGB3PWo.png?alt=media&token=3d48fe9e-6fab-4a5e-846a-be426a4ab18c)

The `label`, which gets specified after **AS**, denotes the name of the column that gets used. The `data`, which gets specified after **Select**, denotes what kind of data to return. 

The following data types are supported:

- `Created Date` - The date the block or page was created
- `Created Time` - Same as above, but in `hh:mm` format
- `Edited Date` - The date the block or page was edited
- `Edited Time` - Same as above, but in `hh:mm` format
- `Author` - The user who created the block or page
- `Last Edited By` - The user who created the block or page
- `node:{node}` - Returns any intermediary node you defined in one of the conditions.  For example:
  - `node:page` will return the title of a `page` referenced in a condition.
  - `node:placeholder` will return the title of a `placeholder` referenced in a condition.
- `node:{node}:{field}` - Specify one of the first six options as the field to return the related metadata for the intermediary node.  For example:
  - `node:page:Author` will return the user who created the `page` defined in a condition.
  - `node:placeholder:Client` will return the value of the `Client` attribute from the `placeholder` node defined in a condition.
- `node:{node}:/regular_expression/` - returns match according to a regular expression between `/`'s.  For example:
  - `node:node:/(\d\d?:\d\d)/` will return time in the format of "hours:minutes" from the main `node` being queried
  - `node:placeholder:/#([^\s]*)/` will return the text after the first hashtag from the `placeholder` node defined in a condition.
- `node` - Edit the column header of the first column
  - ![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fgkc5hYMG4K.png?alt=media&token=c506c0a6-81e5-45c5-8825-bf62ef9860a1)
- Anything else is assumed to be an attribute of the exact text

You can also use the aliases in previous selects to derive values for future columns. The following derived selects are supported:

- `add({alias1}, {alias2})` - Add the values of two columns. Supports adding values to dates. If one of the aliases is `today`, then today's date will be used. 
- `subtract({alias1}, {alias2})`- Subtract the values betweenn two columns. Supports adding values to dates. If one of the aliases is `today`, then today's date will be used.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fz7UNWC6zmZ.png?alt=media&token=e2f13f04-d2cb-4055-9493-4f9b367e97b7)

### Manipulating Results

After you fire a query, the results will output in a table view. There are multiple ways to post process these results after they output to the screen.

#### Sort<!-- omit in toc -->

Clicking on the table header for a given column will trigger an alphabetical sort. Clicking again will toggle descending order. Clicking once more will toggle the sort off. You could have multiple columns selected for sorting:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FP1-KDvuRhS.png?alt=media&token=b85999f9-f9a6-4a36-acc9-bb15724507a3)

#### Filter<!-- omit in toc -->

Each column is also filterable. The filter works just like the page and reference filters in native Roam, where you could pick values to include and remove:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FG7d1TrIzNq.png?alt=media&token=8df90fc5-5e8d-4347-9721-bd067ac7616a)

#### View Type<!-- omit in toc -->

Each column also has a view type. Choosing a view type will change how the cell is displayed in the table. The supported view types are:

- `plain` - Outputted as just plain text
- `link` - If the column is a block, cells will be outputted as a link to the block. If the column is a page, cells will be outputted as a link to the page.
- `embed` - Embeds the contents of the block or page in the cell.

All changes to the outputted results are saved automatically.

### Layouts

By default, the query builder will use the `Table` layout. You can switch to a different layout by hitting the more menu on the top right of the results and clicking on the `Layout` option. 

The following values are also supported:

- `Line` - Displays your data as a line chart. You need to have at least **two** selections for this layout to work, where the first is a selection that returns date values and all subsequent selections return numeric values.
- `Bar` - Displays your data as a bar chart. You need to have at least **two** selections for this layout to work, where the first is a selection that returns date values and all subsequent selections return numeric values.
- `Timeline` - Displays your data as an interactive timeline view. You need to have a selection chosen labelled **Date** that returns date values for this layout to work.

### Exporting

Next to the save button is a button that will allow you to export your results. There are currently two formats available to export to:

- CSV - All the columns in the table will become columns in the CSV
- Markdown - The columns will become frontmatter data and the children of the block or page will become markdown content.

### Styling

Every [Query Block](#query-blocks) or [Query Page](#query-pages) is rooted with a `div` that has an `id` of `roamjs-query-page-${uid}` where `uid` is the block reference of the query block or the page reference of the page. You could use this id to style individual queries with affecting other ones.

### SmartBlocks Integration

This extension comes with its own SmartBlocks command! The `<%QUERYBUILDER%>` command will run an existing [Query Block](#query-blocks) or [Query Page](#query-pages) instance in your graph and return the results as separate blocks. The command takes in two arguments:

1. The block reference, alias, or page title of the query instance
1. The format to output each result in. You can use placeholders, like `{text}` to insert the value from the result in. There's a placeholder available for each Selection label used in the query.

#### Alias

You can set the alias of a [Query Block](#query-blocks) in the top right corner of the UI.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FN_YUvsTh-w.png?alt=media&token=f734f73b-7fa4-48f6-97e0-d6c3671ca02c)

The end of the title of a [Query Page](#query-pages) works as well.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FNVOH1yVd5x.png?alt=media&token=e9698dc6-0c48-4cbb-bc47-46bf3959eb27)

#### Examples

`<%QUERYBUILDER:6-qLCJsSb,{text}%>`

`<%QUERYBUILDER:myQuery,{uid}%>`

`<%QUERYBUILDER:queries/myQuery%>`

### Developer API

For developers of other extensions who want to use the queries defined by users, we expose the following API, available on the global `window.roamjs.extension.queryBuilder` object:

- `listActiveQueries` - `() => { uid: string }[]` Returns an array of blocks or pages where the user has a query defined from query builder.
- `runQuery` - `(uid: string) => Promise<Result[]>` Runs the query defined at the input `uid` and returns a promise that resolves to the array of results from the user's graphs. `Result`s have the following schema:
  - `text` - `string` The page title or block text of the primary node involved in the result.
  - `uid` - `string` The reference of the primary node involved in the result.
  - `${string}-uid` - `string` If the users define selections that return intermediary nodes, the reference of those nodes will always end in `-uid` and will always be of type `string`.
  - `{string}` - `string | number | Date` All other fields returned in the result can be any of the primitive value types.

### Demos

#### General Demo<!-- omit in toc -->

Demo showing [Query Block](#query-blocks), [Query Pages](#query-pages), [Query Drawer](#query-drawer), [Conditions](#conditions), [Selections](#selections) and a few example queries.

<video src="https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fj0Li5mCafX.mp4?alt=media&token=58ee51b2-9a7b-4547-81ad-01672b3b5820" controls="controls"></video>

[Direct Video Link](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fj0Li5mCafX.mp4?alt=media&token=58ee51b2-9a7b-4547-81ad-01672b3b5820)

#### Conversation with Conor White-Sullivan<!-- omit in toc -->

About Roam Depot, extensions, and a Query Builder demo.  Demo starts around 13 minutes.

(in the demo you'll see the `block` being used, but that can be interchanged with `node`)

[![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FEY0iYQHf3N.png?alt=media&token=c8958afa-0c7c-495c-908a-bd5edcb02fd1)](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FEY0iYQHf3N.png?alt=media&token=c8958afa-0c7c-495c-908a-bd5edcb02fd1)

[View on Grain](https://grain.com/share/recording/9d0e349b-bb0d-4267-a362-e2a79667b787/UOW64KlylDapMRhDJjwuTrDl8bzMOcQ3tUGECdhR)

## Native Roam Queries

In addition to new [RoamJS Query Builder](#roamjs-query-builder) components, this extension enhances Roam's native querying experience by providing features such as an intuitive UI for creating and editing queries, sorting and randomizing query results, and displaying more context in these results.

### Creating Native Roam Queries

In a block, type `{{qb}}`.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FSNq4QmaRxy.png?alt=media&token=5b7c1173-da57-4d83-851b-1719edffab02)

 Similar to date picker, there will be an overlay that appears next to the QUERY button. After specifying different query components that you're interested in searching, hit save to insert the query syntax into the block.

The overlay is fully keyboard accessible. Each input is focusable and you can `tab` and `shift+tab` through them. For the query component dropdown, you could use the following key strokes to navigate:

- Arrow Up/Arrow Down - Navigate Options
- Enter - Open Dropdown
- a - Select 'AND'
- o - Select 'OR'
- b - Select 'BETWEEN'
- t - Select 'TAG'
- n - Select 'NOT'

On any deletable component, you could hit `ctrl+Backspace` or `cmd+Backspace` to delete the icon. Hitting `enter` on the save button will output the query into the block.

There will also be an edit button rendered on any existing query. Clicking the edit icon will overlay the builder to edit the existing query!

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FPjJhLRaE28.png?alt=media&token=a94026f9-b7f7-494b-af74-15c93aa0f500)

### Manipulating Native Roam Queries

The legacy Query Tools extension was merged with this one to bring all native query manipulation features under Query Builder. These features could be configured within the Roam Depot Settings for Query Builder.

- `Default Sort` - The default sorting all native queries in your graph should use
- `Sort Blocks` - If set to 'True', sort the query results by blocks instead of pages.
- `Context` - The default value for Context for all queries. See below.

<video src="https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FKSJOK_DMOD.mp4?alt=media&token=4ffea2b3-c6d8-4ec6-aa39-7186333a4be2" controls="controls"></video>

[Direct Link to Video](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FKSJOK_DMOD.mp4?alt=media&token=4ffea2b3-c6d8-4ec6-aa39-7186333a4be2)

#### Sorting

On expanded queries, there will be a sort icon that appears next to the results text. Clicking on the sort icon will make a sort menu visible to the user.

To persist a particular sort on a query, create a block on the page with the text `Default Sort`. Nest the value under that block.

To configure sorting by blocks on a single query instead of on all queries in your DB, add a block that says `Sort Blocks` as a child to the specific query.

Here are the options you can sort by:

- **Sort By Page Title** - This will sort all the query results in ascending alphabetical order of the page title.
- **Sort By Page Title Descending** - This will sort all the query results in descending alphabetical order of the page title.
- **Sort By Word Count** - This will sort all the query results in ascending order of the word count.
- **Sort By Word Count Descending** - This will sort all the query results in descending alphabetical order of the word count.
- **Sort By Created Date** - This will sort all the query results in ascending order that the page was created.
- **Sort By Created Date Descending** - This will sort all the query results in descending order that the page was created.
- **Sort By Edited Date** - This will sort all the query results in ascending order that the page was last edited.
- **Sort By Edited Date Descending** - This will sort all the query results in descending order that the page was last edited.
- **Sort By Daily Note** - This will sort all the query results in ascending order by Daily Note, followed by created date of non-daily note pages.
- **Sort By Daily Note Descending** - This will sort all the query results in descending order by Daily Note, followed by created date of non-daily note pages.

#### Randomization

Sometimes we have queries with hundreds of results and want to return a random element from that query. Returning random results from multiple queries could lead to serendipitous connections. To return a random result from a query, add a block that says `Random` as a child of the query. Nest the value representing the number of random results you'd like returned from the query.

#### Context

By default, query results only display the most nested block in the result. To display more context in a given query, add a block that says `Context` as a child block of the query. Set the value to the number of levels you'd like displayed, or `Top` to display full context, as a child of this Context block.

#### Aliases

By default, query results display the query logic itself for the label. To display an alias for the given query, add a block that says Alias as a child block of the query, with the value of the alias nested below that.

## Sortable Linked References

In your Roam Depot Settings, there is a flag called `Sortable Linked References`. When enabled, there will appear a sort icon next to the filter icon near the linked references. Clicking on the sort icon will make a sort menu visible to the user.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FrH9xJYbsTn.png?alt=media&token=863e38d5-03bd-4b33-95fe-a62254d271dd)

You could also add a `Default Sort` attribute with a valid value on the page itself to have a specific sorting for just that page.

Here are the options you can sort by:

- **Sort By Page Title** - This will sort all the linked references in ascending alphabetical order of the page title.
- **Sort By Page Title Descending** - This will sort all the linked references in descending alphabetical order of the page title.
- **Sort By Created Date** - This will sort all the linked references in ascending order that the page was created.
- **Sort By Created Date Descending** - This will sort all the linked references in descending order that the page was created.
- **Sort By Daily Note** - This will sort all the linked references in ascending order by Daily Note, followed by created date of non-daily note pages.
- **Sort By Daily Note Descending** - This will sort all the linked references in descending order by Daily Note, followed by created date of non-daily note pages.

## Discourse Graphs

This extension implements the Discourse Graph protocol, developed by Joel Chan. To enable the features associated with this protocol, toggle the `Discourse Graphs Enabled` switch.

For more about the suite of tools this mode brings, checkout our documentation for how to use this extension at https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/.

Contact Joel Chan (joelchan@umd.edu or [@JoelChan86](https://twitter.com/joelchan86) on Twitter or in the `#discourse-graph` channel on the [Academia Roamana Discord](https://discord.gg/FHrtGe25AJt)) for more details!
