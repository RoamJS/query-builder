# Conditions

## Created After

Coming Soon.

## Created Before

Coming Soon.

## Created By

Coming Soon.

## Edited After

Coming Soon.

## Edited Before

Coming Soon.

## Edited By

Coming Soon.

## Has Ancestor

Coming Soon.

## Has Attribute

Coming Soon.

## Has Child

Coming Soon.

## Has Descendent

Coming Soon.

## Has Title

`has title` - The `source` page has the exact text `target` as a title.

- If `target` is equal to `{date}`, then it matches any Daily Note Page.
- Supports date NLP to resolve a single date, e.g. `{date:today}`.
- The `target` also supports Regular Expressions by starting and ending the value with a `/`.

## Is In Page

Coming Soon.

## Is In Page With Title

`is in page with title` - The `source` block is in a page with title `target`.

- If `target` is equal to `{date}`, then it matches any Daily Note Page.
- Supports date NLP to resolve a single date, e.g. `{date:today}`.
- The `target` also supports Regular Expressions by starting and ending the value with a `/`.

## Is Referenced By

Coming Soon.

## References

Coming Soon.

## References Title

`references title` - The `source` block or page references a page with `target` as the title.

- If `target` is equal to `{date}`, then it matches any Daily Note Page.
- Supports date NLP to resolve a single date, e.g. `{date:today}`.
- The `target` also supports Regular Expressions by starting and ending the value with a `/`.

## Titled After

Coming Soon.

## Titled Before

Coming Soon.

## With Title

Coming Soon.

## With Title In Text

Coming Soon.

# Selections

## Add or Subtract

`add({alias1}, {alias2})` - Add the values of two columns.

`subtract({alias1}, {alias2})` - Subtract the values betweenn two columns.

Supports adding values to dates.

If one of the aliases is `today`, then today's date will be used.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fz7UNWC6zmZ.png?alt=media&token=e2f13f04-d2cb-4055-9493-4f9b367e97b7)

## Attribute

Coming Soon.

## Author

Coming Soon.

## Created Date

Coming Soon.

## Created Time

Coming Soon.

## Edited Date

Coming Soon.

## Edited Time

Coming Soon.

## Field

`node:{node}:{field}` - Specify one of the first six options as the field to return the related metadata for the intermediary node.

- `node:page:Author` will return the user who created the `page` defined in a condition.
- `node:placeholder:Client` will return the value of the `Client` attribute from the `placeholder` node defined in a condition.

## Intermediate Node

`node:{node}` - Returns any intermediary node you defined in one of the conditions.

- `node:page` will return the title of a `page` referenced in a condition.
- `node:placeholder` will return the title of a `placeholder` referenced in a conditi

## Last Edited By

Coming Soon.

## Node

`node` - Edit the column header of the first column

- ![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fgkc5hYMG4K.png?alt=media&token=c506c0a6-81e5-45c5-8825-bf62ef9860a1)

## Regular Expression

`node:{node}:/regular_expression/` - returns match according to a regular expression between `/`'s.

- `node:node:/(\d\d?:\d\d)/` will return time in the format of "hours:minutes" from the main `node` being queried
- `node:placeholder:/#([^\s]*)/` will return the text after the first hashtag from the `placeholder` node defined in a condition.

# Layouts

The following layouts are available for displaying your data:

## Line

Displays your data as a line chart.

You need to have at least **two** selections for this layout to work

- The **first** is a selection that returns **date values**
- all subsequent selections return **numeric values**.

## Bar

Displays your data as a bar chart.

You need to have at least **two** selections for this layout to work

- The **first** is a selection that returns **date values**
- all subsequent selections return **numeric values**.

## Timeline

Displays your data as an interactive timeline view.

- You need to have a selection chosen labelled **Date** that returns **date values** for this layout to work.

## Kanban

<!-- Displays your data as a Kanban board. -->

Coming soon.
