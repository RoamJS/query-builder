import React from "react";
import { Chart, AxisOptions, AxisOptionsBase } from "react-charts";
import { Result } from "roamjs-components/types/query-builder";

type ChartData = [Result[string], Result[string]];

const Charts = ({
  data,
  type,
  columns,
}: {
  type: AxisOptionsBase["elementType"];
  data: Result[];
  columns: string[];
}): JSX.Element => {
  const chartData = React.useMemo(
    () =>
      columns.slice(1).map((col) => {
        return {
          label: col,
          data: data.map((d) => [d[columns[0]], d[col]] as ChartData),
        };
      }),
    [data, columns]
  );
  const primaryAxis = React.useMemo<AxisOptions<ChartData>>(
    () => ({
      primary: true,
      type: "timeLocal",
      position: "bottom" as const,
      getValue: ([d]) =>
        d instanceof Date
          ? d
          : typeof d === "string"
          ? window.roamAlphaAPI.util.pageTitleToDate(d)
          : new Date(d),
    }),
    []
  );
  const secondaryAxes = React.useMemo<AxisOptions<ChartData>[]>(
    () =>
      columns.slice(1).map(() => ({
        type: "linear",
        position: "left" as const,
        getValue: (d) => Number(d[1]) || 0,
        elementType: type,
      })),
    [type]
  );

  return (
    <div style={{ height: 300 }}>
      <Chart options={{ data: chartData, primaryAxis, secondaryAxes }} />
    </div>
  );
};

export default Charts;
