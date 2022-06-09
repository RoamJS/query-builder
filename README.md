# Query Builder
      
Introduces new user interfaces for building queries in Roam.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FeNXPrcflN2.png?alt=media&token=6fca69c3-f5ca-4b21-b7a0-fb5583d07135)

For more information, check out our docs at [https://roamjs.com/extensions/query-builder](https://roamjs.com/extensions/query-builder)

## Query Pages
With Query Pages, you could designate certain pages in your Roam graph as "views" into your data. These queries are far more powerful than vanilla Roam queries, as it taps into Roam's underlying query language surfaced through an approachable UI.

### Setup
On the `roam/js/query-builder` page, you should see a tab called `Query Pages` under `Home`. You could use this to denote which page titles in your Roam Graph will be used to create query pages. Use the `*` as a wildcard.

By default, Query Pages is set to be titled with `queries/*`. This means any page in your graph prefixed with `queries/` can be used to save a query. You can denote multiple page title formats.

### Usage
Navigate to any valid query page in your graph and you should see a Query Editor on the page:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FSINndquBoY.png?alt=media&token=37c28efd-7e1f-4580-9806-fda8ae77df08)

You can use this editor to create and save a query. There are two important parts to a query: **Conditions** and **Selections**.

After specifying conditions and selections, hit the `Query` button to return results in your graph. These results will always include a `text` field which will link to the relevant block or page reference. Hitting `Query` also effectively "Saves" the query to the graph.

The results returned will be organized in a table with sortable and filterable columns. Click on the columns to sort the data and use the input on the top right to filter your table to desired results:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FZj7bCiNIDa.png?alt=media&token=8dabd2ce-c7e5-41d7-b5bf-f77883651dde)

### Conditions
**Conditions** specify which blocks you want to return. They determine the __rows__ of the table. The anatomy of a Condition is a triple: `source`, `relationship`, & `target`:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FVVTSrLrvtl.png?alt=media&token=e6c3484f-0343-4f2f-bd05-60b7ffef7316)

You will use a combination of multiple conditions to select the data you want. Here are all the supported relationships:
- `references` - The `source` block or page references the `target` block or page.
- `references title` - The `source` block or page references a page with `target` as the title.
- `is in page` - The `source` block is in the `target` page.
- `is in page with title` - The `source` block is in a page with title `target`.
- `has title` - The `source` page has the exact text `target` as a title. If `target` is equal to `{date}`, then it matches any Daily Note Page.
- `has attribute` - The `source` block or page has an attribute with value `target`.
- `has child` - The `source` block or page has the `target` block as a child.
- `has ancestor` - The `source` block has the `target` block or page as an ancestor up the outliner tree.
- `has descendent` - The `source` block or page has the `target` block as a descendant somewhere down the outliner tree
- `with text` - The `source` block or page has the exact text `target` somewhere in its block text or page title
- `created by` - The `source` block or page was created by the user with a display name of `target`
- `with title in text` - The `source` page has the exact text `target` somewhere in its page title.
- `created before` - The `source` block or page was created before the naturally specified `target`
- `created after` - The `source` block or page was created after the naturally specified `target`
- `edited before` - The `source` block or page was edited after the naturally specified `target`
- `edited after` - The `source` block or page was edited after the naturally specified `target`

### Selections
**Selections** specify what data from the blocks that match your conditions get returned. They determine the __columns__ of the table. By default, the block text or page title is always returned and hyperlinked. Every selection is made up of two parts: the `label` and the `data`:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F36a81va0fE.png?alt=media&token=bb19988b-f7cd-44ce-8880-c4f46530f7af)

The `label`, which gets specified after **AS**, denotes the name of the column that gets used. The `data`, which gets specified after **Select**, denotes what kind of data to return. The following data types are supported:
- `Created Date` - The date the block or page was created
- `Edited Date` - The date the block or page was created
- `Author` - The user who created the block or page
- Anything else is assumed to be an attribute of the exact text

### Manipulating Results
After you fire a query, the results will output in a table view. There are multiple ways to post process these results after they output to the screen.

Clicking on the table header for a given column will trigger an alphabetical sort. Clicking again will toggle descending order. Clicking once more will toggle the sort off. You could have multiple columns selected for sorting:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FP1-KDvuRhS.png?alt=media&token=b85999f9-f9a6-4a36-acc9-bb15724507a3)

Each column is also filterable. The filter works just like the page and reference filters in native Roam, where you could pick values to include and remove:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FG7d1TrIzNq.png?alt=media&token=8df90fc5-5e8d-4347-9721-bd067ac7616a)

Each column also has a view type. Choosing a view type will change how the cell is displayed in the table. The supported view types are:
- `plain` - Outputted as just plain text
- `link` - If the column is a block, cells will be outputted as a link to the block. If the column is a page, cells will be outputted as a link to the page.
- `embed` - Embeds the contents of the block or page in the cell. 
At any point, you could save the selected filters, sorts, and views so that any time you return to the query, they are applied automatically:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FbOPvKM8ilS.png?alt=media&token=838b5724-b848-42b5-8cf0-17fde8cbb29c)

### Exporting

Next to the save button is a button that will allow you to export your results. There are currently two formats available to export to:
- CSV - All the columns in the table will become columns in the CSV
- Markdown - The columns will become frontmatter data and the children of the block or page will become markdown content.

### Query Blocks

The above component is also available as a block component. This allows you to create several on a page, wherever on the page you want. To create one, simply add `{{query block}}` to any block on the page.

### Styling

Every Query Page is rooted with a `div` that has an `id` of `roamjs-query-page-${uid}` where `uid` is the block refence of the query block or the page reference of the page. You could use this id to style individual queries with affecting other ones.

[Demo](https://www.loom.com/share/12bdc4c42cf8449e8b7a712fe285a072)

## Creating Vanilla Roam Queries

In a block, type `{{query builder}}`. Similar to date picker, there will be an overlay that appears next to the query builder button. After specifying different query components that you're interested in searching, hit save to insert the query syntax into the block.

The Overlay is fully keyboard accessible. Each input is focusable and you can `tab` and `shift+tab` through them. For the query component dropdown, you could use the following key strokes to navigate:
- Arrow Up/Arrow Down - Navigate Options
- Enter - Open Dropdown
- a - Select 'AND'
- o - Select 'OR'
- b - Select 'BETWEEN'
- t - Select 'TAG'
- n - Select 'NOT'

On any deletable component, you could hit `ctrl+Backspace` or `cmd+Backspace` to delete the icon. Hitting `enter` on the save button will output the query into the block.
There will also be an edit button rendered on any existing query. Clicking the builder will overlay the Query Builder to edit the existing query!

[Demo](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FKSJOK_DMOD.mp4?alt=media&token=4ffea2b3-c6d8-4ec6-aa39-7186333a4be2)

---

## Manipulating Native Roam Queries

The legacy Query Tools extension was merged with this one to bring all native query manipulation features under Query Builder. These features could be configured on the "Native Queries" tab of the `roam/js/query-builder` page.
- `Sort Blocks` - If set to 'True', sort the query results by blocks instead of pages.
- `Context` - The default value for Context for all queries. See below.
- `Default Sort` - The default sorting all native queries in your graph should use

### Sorting

On expanded queries, there will be a sort icon that appears next to the results text. Clicking on the sort icon will make a sort menu visible to the user with the following options:
- Sort By Page Title - This will sort all the query results in ascending alphabetical order of the page title.
- Sort By Page Title Descending - This will sort all the query results in descending alphabetical order of the page title.
- Sort By Word Count - This will sort all the query results in ascending order of the word count.
- Sort By Word Count Descending - This will sort all the query results in descending alphabetical order of the word count.
- Sort By Created Date - This will sort all the query results in ascending order that the page was created.
- Sort By Created Date Descending - This will sort all the query results in descending order that the page was created.
- Sort By Edited Date - This will sort all the query results in ascending order that the page was last edited.
- Sort By Edited Date Descending - This will sort all the query results in descending order that the page was last edited.
- Sort By Daily Note - This will sort all the query results in ascending order by Daily Note, followed by created date of non-daily note pages.
- Sort By Daily Note Descending - This will sort all the query results in descending order by Daily Note, followed by created date of non-daily note pages.

To persist a particular sort on a query, create a block on the page with the text `Default Sort`. Nest the value under that block.

To configure sorting by blocks on a single query instead of on all queries in your DB, add a block that says `Sort Blocks` as a child to the specific query.

### Randomization

Sometimes we have queries with hundreds of results and want to return a random element from that query. Returning random results from multiple queries could lead to serendipitous connections. To return a random result from a query, add a block that says `Random` as a child of the query. Nest the value representing the number of random results you'd like returned from the query.

### Context

By default, query results only display the most nested block in the result. To display more context in a given query, add a block that says `Context` as a child block of the query. Set the value to the number of levels you'd like displayed, or `Top` to display full context, as a child of this Context block.

### Aliases

By default, query results display the query logic itself for the label. To display an alias for the given query, add a block that says Alias as a child block of the query, with the value of the alias nested below that.
