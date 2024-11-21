import {
  Button,
  Classes,
  Dialog,
  Intent,
  RadioGroup,
  Radio,
  FormGroup,
  NumericInput,
} from "@blueprintjs/core";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import renderOverlay from "roamjs-components/util/renderOverlay";
import createBlock from "roamjs-components/writes/createBlock";

type QueryTesterProps = {
  onClose: () => void;
  isOpen: boolean;
};

type QueryType = {
  label: string;
  description: string;
  fn: () => Promise<void>;
};

const getTimestamp = () => {
  const timestamp = new Date();
  const minutes = String(timestamp.getMinutes()).padStart(2, "0");
  const seconds = String(timestamp.getSeconds()).padStart(2, "0");
  const milliseconds = String(timestamp.getMilliseconds()).padStart(3, "0");
  return `${minutes}:${seconds}:${milliseconds}`;
};
const getRandomTimestamp = () => {
  const now = Date.now();
  const thirteenMonthsAgo = now - 13 * 30 * 24 * 60 * 60 * 1000;
  const fifteenMonthsAgo = now - 15 * 30 * 24 * 60 * 60 * 1000;

  return Math.floor(
    Math.random() * (thirteenMonthsAgo - fifteenMonthsAgo) + fifteenMonthsAgo
  );
};
const fakeBackendQuery = (id: number, delayTime: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([id]);
    }, delayTime);
  });
};
const artificialGetDatalogQueryTime = (buildTime: number) => {
  const startTime = Date.now();
  while (Date.now() - startTime < buildTime) {
    // Simulate work by blocking the thread
  }
};
const queryTypes = ["EVD", "CLM", "RES", "HYP", "ISS", "CON"];
const baseQuery = `[:find
    (pull ?node [:block/string :node/title :block/uid])
    (pull ?node [:block/uid])
  :where
    [(re-pattern "^\\\\[\\\\[TYPE\\\\]\\\\] - (.*?)$") ?QUE-.*?$-regex]
    [?node :node/title ?Question-Title]
    [?node :block/children ?Summary]
    [?node :block/children ?Workbench]
    [?Workbench :block/children ?Notes]
    [?Notes :block/children ?childNotes]
    [?node :create/time ?node-CreateTime]
    [(< ${getRandomTimestamp()} ?node-CreateTime)]
    (or     [?Summary :block/string ?Summary-String]
      [?Summary :node/title ?Summary-String])
    (not
      [?Summary :block/children ?childSummary]
    )
    (or     [?Notes :block/string ?Notes-String]
      [?Notes :node/title ?Notes-String])
    [(re-find ?QUE-.*?$-regex ?Question-Title)]
    [(clojure.string/includes? ?Summary-String "Summary")]
    [(clojure.string/includes? ?Notes-String "Notes")]
  ]`;

const CellEmbed = ({
  selectedQuery,
  queryBlockUid,
}: {
  selectedQuery: number;
  queryBlockUid: string;
}) => {
  const contentRef = useRef<HTMLDivElement | null>(null);

  const tree = useMemo(
    () => getBasicTreeByParentUid(queryBlockUid),
    [queryBlockUid]
  );
  useEffect(() => {
    const container = contentRef.current;
    const uid = tree[selectedQuery].uid;

    if (container && uid) {
      const existingBlock = container.querySelector(".roam-block-container");
      if (existingBlock) {
        existingBlock.remove();
      }

      const blockEl = document.createElement("div");
      blockEl.className = "roam-block-container";
      container.appendChild(blockEl);

      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el: blockEl,
      });
    }

    return () => {
      if (container) {
        const existingBlock = container.querySelector(".roam-block-container");
        if (existingBlock) {
          existingBlock.remove();
        }
      }
    };
  }, [tree, selectedQuery, queryBlockUid]);

  return (
    <div className="w-full">
      <div ref={contentRef} />
    </div>
  );
};

const QueryTester = ({ onClose, isOpen }: QueryTesterProps) => {
  const [selectedQuery, setSelectedQuery] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);
  const [buildTime, setBuildTime] = useState<number>(3000);
  const [delayTime, setDelayTime] = useState<number>(3000);
  const [queryBlockUid, setQueryBlockUid] = useState<string | null>(null);

  // lol couldn't get highlighting to work properly, so creating the blocks and rending them
  useEffect(() => {
    const createQueryBlock = async () => {
      const currentPageUid = getCurrentPageUid();
      const newUid = await createBlock({
        node: {
          open: false,
          text: "",
          children: [
            ...queries.map((query, i) => ({
              text: `\`\`\`const ${query.label.replace(/\s+/g, "")} = ${query.fn.toString()} \`\`\``,
            })),
          ],
        },
        parentUid: currentPageUid,
      });
      setQueryBlockUid(newUid);
      return () => {
        window.roamAlphaAPI.deleteBlock({
          block: { uid: newUid },
        });
      };
    };
    createQueryBlock();
  }, []);
  const asyncQWithDelay = useCallback(async () => {
    console.log("async.q: Promise.all(map(async) => await fireQuery)");
    console.log("with artificial query delay");
    console.log(`buildTime: no getDatalogQueryTime`);
    console.log(`delayTime: ${delayTime}`);

    const fireQueryX = async (type: string, i: number) => {
      console.log(`🔎🟢`, getTimestamp(), `Query`, type, i);

      // Artifical Query Delay
      await new Promise((resolve) => setTimeout(resolve, delayTime));

      const queryResults = await window.roamAlphaAPI.data.async.q(
        baseQuery.replace("TYPE", type)
      );
      console.log(`🔎🛑`, getTimestamp(), `Query`, type, i);
      return { type, results: queryResults };
    };

    // adding async/await results in the same behavior
    Promise.all(queryTypes.map((type, i) => fireQueryX(type, i)));

    // Results
    //
    // These results makes sense ✅
    // queries sent at 32:079
    // delay is 3 seconds
    // queries ends between 35:581 - 35:774
    // difference is actual query time, server queues, and network time
    //
    // 🔎🟢 50:32:078 Query EVD 0
    // 🔎🟢 50:32:079 Query CLM 1
    // 🔎🟢 50:32:079 Query RES 2
    // 🔎🟢 50:32:079 Query HYP 3
    // 🔎🟢 50:32:079 Query ISS 4
    // 🔎🟢 50:32:079 Query CON 5
    // 🔎🛑 50:35:581 Query HYP 3
    // 🔎🛑 50:35:686 Query CON 5
    // 🔎🛑 50:35:760 Query ISS 4
    // 🔎🛑 50:35:770 Query EVD 0
    // 🔎🛑 50:35:771 Query RES 2
    // 🔎🛑 50:35:774 Query CLM 1
  }, [delayTime]);
  const asyncQWithDelayAndBuildTime = useCallback(async () => {
    console.log("async.q: Promise.all(map(async) => await fireQuery)");
    console.log("with artificial query delay and query build time");
    console.log(`buildTime: ${buildTime}`);
    console.log(`delayTime: ${delayTime}`);

    const fireQueryX = async (type: string, i: number) => {
      // Artificial getDatalogQueryTime
      console.log(`💽💽`, getTimestamp(), `Build`, type, i);
      artificialGetDatalogQueryTime(buildTime);

      // Artifical Query Delay
      console.log(`🔎🟢`, getTimestamp(), `Query`, type, i);
      await new Promise((resolve) => setTimeout(resolve, delayTime));

      const queryResults = await window.roamAlphaAPI.data.async.q(
        baseQuery.replace("TYPE", type)
      );
      console.log(`🔎🛑`, getTimestamp(), `Query`, type, i);
      return { type, results: queryResults };
    };

    // adding async/await results in the same behavior
    Promise.all(queryTypes.map((type, i) => fireQueryX(type, i)));

    // Results
    //
    // I would like the query to be sent right after the build time is over
    // I'm not sure if that is possible, and that doesn't seem to be the case with these results
    //
    // The delay is 3 seconds
    //
    // these results don't make sense
    // last query starts at 34:322
    // RES - starts at 31:322, ends at 35:624
    // 1.5 seconds after last query start (The delay is 3 seconds)
    //
    // 36:535 Query HYP 3 - 1 second after previous query?
    // 37:533 Query ISS 4 - 1 second after previous query?
    // 38:540 Query CON 5 - 1 second after previous query?
    //
    // 🔎🟢 55:29:322 Query EVD 0
    // 🔎🟢 55:30:322 Query CLM 1
    // 🔎🟢 55:31:322 Query RES 2
    // 🔎🟢 55:32:322 Query HYP 3
    // 🔎🟢 55:33:322 Query ISS 4
    // 🔎🟢 55:34:322 Query CON 5
    // 🔎🛑 55:35:624 Query RES 2
    // 🔎🛑 55:35:683 Query CLM 1
    // 🔎🛑 55:35:689 Query EVD 0
    // 🔎🛑 55:36:535 Query HYP 3 (this delay doesn't make sense)
    // 🔎🛑 55:37:533 Query ISS 4 (this delay doesn't make sense)
    // 🔎🛑 55:38:540 Query CON 5 (this delay doesn't make sense)
  }, [delayTime, buildTime]);
  const fakeBackendQueryNoDelay = useCallback(async () => {
    console.log("fakeBackendQuery()");
    console.log(`buildTime: no getDatalogQueryTime`);
    console.log(`fakeQueryTime: ${delayTime}`);

    const fireQueryX = async (type: string, i: number) => {
      console.log(`🔎🟢`, getTimestamp(), `Query`, type, i);

      const queryResults = await fakeBackendQuery(i, delayTime);

      console.log(`🔎🛑`, getTimestamp(), `Query`, type, i);
      return { type, results: queryResults };
    };

    // adding async/await results in the same behavior
    Promise.all(queryTypes.map((type, i) => fireQueryX(type, i)));

    // Results
    //
    // Queryies returned at the same time ✅
    //
    // 🔎🟢 22:19:526 Query EVD 0
    // 🔎🟢 22:19:527 Query CLM 1
    // 🔎🟢 22:19:527 Query RES 2
    // 🔎🟢 22:19:527 Query HYP 3
    // 🔎🟢 22:19:527 Query ISS 4
    // 🔎🟢 22:19:527 Query CON 5
    // 🔎🛑 22:22:541 Query EVD 0
    // 🔎🛑 22:22:541 Query CLM 1
    // 🔎🛑 22:22:541 Query RES 2
    // 🔎🛑 22:22:542 Query HYP 3
    // 🔎🛑 22:22:542 Query ISS 4
    // 🔎🛑 22:22:542 Query CON 5
  }, []);
  const fakeBackendQueryWithBuildTime = useCallback(async () => {
    console.log("async.q: fakeBackendQuery() with artificial query build time");
    console.log(`buildTime: ${buildTime}`);
    console.log(`fakeQueryTime: ${delayTime}`);

    const fireQueryX = async (type: string, i: number) => {
      console.log(`💽💽`, getTimestamp(), `Build`, type, i);
      artificialGetDatalogQueryTime(buildTime);

      console.log(`🔎🟢`, getTimestamp(), `Query`, type, i);
      const queryResults = await fakeBackendQuery(i, delayTime);
      console.log(`🔎🛑`, getTimestamp(), `Query`, type, i);

      return { type, results: queryResults };
    };

    // adding async/await results in the same behavior
    Promise.all(queryTypes.map((type, i) => fireQueryX(type, i)));

    // Results
    //
    // Run 1
    // these results don't make sense
    // last query starts at 34:322
    // RES - starts at 31:322, ends at 35:624
    // 1 seconds after last query start (The delay is 3 seconds)
    //
    // 59:752 Query HYP 3 - 1 second after previous query?
    // 00:751 Query ISS 4 - 1 second after previous query?
    // 01:754 Query CON 5 - 1 second after previous query?
    //
    // 🔎🟢 23:52:750 Query EVD 0
    // 🔎🟢 23:53:750 Query CLM 1
    // 🔎🟢 23:54:750 Query RES 2
    // 🔎🟢 23:55:750 Query HYP 3
    // 🔎🟢 23:56:750 Query ISS 4
    // 🔎🟢 23:57:750 Query CON 5
    // 🔎🛑 23:58:757 Query EVD 0
    // 🔎🛑 23:58:758 Query CLM 1
    // 🔎🛑 23:58:758 Query RES 2
    // 🔎🛑 23:59:752 Query HYP 3
    // 🔎🛑 24:00:751 Query ISS 4
    // 🔎🛑 24:01:754 Query CON 5

    // Run 2
    // 10 second build time
    // 3 second delay time
    //
    // no delay between last query start and first query return
    // no delay between query1 - query5
    // 3 seconds between last query and second last query
    //
    // fakeBackendQuery() with artificial query build time
    // buildTime: 10000
    // fakeQueryTime: 3000
    // 💽💽 02:05:873 Build EVD 0
    // 🔎🟢 02:15:873 Query EVD 0
    // 💽💽 02:15:873 Build CLM 1
    // 🔎🟢 02:25:873 Query CLM 1
    // 💽💽 02:25:873 Build RES 2
    // 🔎🟢 02:35:873 Query RES 2
    // 💽💽 02:35:873 Build HYP 3
    // 🔎🟢 02:45:873 Query HYP 3
    // 💽💽 02:45:873 Build ISS 4
    // 🔎🟢 02:55:873 Query ISS 4
    // 💽💽 02:55:873 Build CON 5
    // 🔎🟢 03:05:873 Query CON 5
    // 🔎🛑 03:05:886 Query EVD 0
    // 🔎🛑 03:05:887 Query CLM 1
    // 🔎🛑 03:05:887 Query RES 2
    // 🔎🛑 03:05:887 Query HYP 3
    // 🔎🛑 03:05:888 Query ISS 4
    // 🔎🛑 03:08:881 Query CON 5

    // Run 3
    // 10 second build time
    // 10 second delay time
    //
    // no delay between last query start and first query return
    // no delay between query1 - query5
    // 10 seconds between last query and second last query
    //
    // fakeBackendQuery() with artificial query build time
    // buildTime: 10000
    // fakeQueryTime: 10000
    // 💽💽 05:16:136 Build EVD 0
    // 🔎🟢 05:26:137 Query EVD 0
    // 💽💽 05:26:137 Build CLM 1
    // 🔎🟢 05:36:137 Query CLM 1
    // 💽💽 05:36:137 Build RES 2
    // 🔎🟢 05:46:137 Query RES 2
    // 💽💽 05:46:137 Build HYP 3
    // 🔎🟢 05:56:137 Query HYP 3
    // 💽💽 05:56:137 Build ISS 4
    // 🔎🟢 06:06:137 Query ISS 4
    // 💽💽 06:06:137 Build CON 5
    // 🔎🟢 06:16:137 Query CON 5
    // 🔎🛑 06:16:176 Query EVD 0
    // 🔎🛑 06:16:176 Query CLM 1
    // 🔎🛑 06:16:176 Query RES 2
    // 🔎🛑 06:16:177 Query HYP 3
    // 🔎🛑 06:16:177 Query ISS 4
    // 🔎🛑 06:26:145 Query CON 5
  }, [delayTime, buildTime]);

  const queries: QueryType[] = useMemo(
    () => [
      {
        label: "async.q with Delay",
        description:
          "async.q: Promise.all(map(async) => await fireQuery) with artificial query delay",
        fn: asyncQWithDelay,
      },
      {
        label: "async.q with Delay and Build Time",
        description:
          "async.q: Promise.all(map(async) => await fireQuery) with artificial query delay and query build time",
        fn: asyncQWithDelayAndBuildTime,
      },
      {
        label: "fakeBackendQuery",
        description: "fakeBackendQuery() - no delay",
        fn: fakeBackendQueryNoDelay,
      },
      {
        label: "fakeBackendQuery with Delay and Build Time",
        description: "fakeBackendQuery() with artificial query build time",
        fn: fakeBackendQueryWithBuildTime,
      },
    ],
    [delayTime, buildTime]
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        onClose();
        if (queryBlockUid) {
          window.roamAlphaAPI.deleteBlock({
            block: { uid: queryBlockUid },
          });
        }
      }}
      autoFocus={false}
      enforceFocus={false}
      canEscapeKeyClose={true}
      className="w-full h-full bg-white"
    >
      <style>
        {`
          label.bp3-control.bp3-radio {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
        `}
      </style>
      <div className={`${Classes.DIALOG_BODY} overflow-y-auto p-4 select-none`}>
        <div className="space-y-4">
          <div className="flex gap-4">
            <FormGroup label="Build Time (ms)">
              <NumericInput
                type="number"
                value={buildTime}
                onValueChange={(e) => setBuildTime(Number(e))}
                disabled={isRunning}
              />
            </FormGroup>
            <FormGroup label="Delay Time (ms)">
              <NumericInput
                type="number"
                value={delayTime}
                onValueChange={(e) => setDelayTime(Number(e))}
                disabled={isRunning}
              />
            </FormGroup>
          </div>

          <RadioGroup
            selectedValue={selectedQuery}
            onChange={(e) => setSelectedQuery(Number(e.currentTarget.value))}
            // className="flex flex-col gap-3"
          >
            {queries.map((query, i) => (
              <Radio key={i} value={i}>
                <div className="flex-1">
                  <div className="font-bold">{query.label}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {query.description}
                  </div>
                </div>
              </Radio>
            ))}
          </RadioGroup>

          <div className="flex justify-end">
            <Button
              intent={Intent.PRIMARY}
              onClick={async () => {
                setIsRunning(true);
                await queries[selectedQuery].fn();
                setIsRunning(false);
              }}
              disabled={isRunning}
            >
              Run Query Test
            </Button>
          </div>

          {queryBlockUid && (
            <>
              <CellEmbed
                selectedQuery={selectedQuery}
                queryBlockUid={queryBlockUid}
              />
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export const renderQueryTester = (props: QueryTesterProps) =>
  renderOverlay({ Overlay: QueryTester, props });

export default QueryTester;
