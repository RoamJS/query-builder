// Mock types
const getTimestamp = () => {
  const timestamp = new Date();
  const minutes = String(timestamp.getMinutes()).padStart(2, "0");
  const seconds = String(timestamp.getSeconds()).padStart(2, "0");
  const milliseconds = String(timestamp.getMilliseconds()).padStart(3, "0");
  return `${minutes}:${seconds}:${milliseconds}`;
};

const getDatalogQuery = (id, duration = 1000) => {
  console.log(`🏋️‍♀️🟢 - ${id} getDatalogQuery -`, getTimestamp());
  const startTime = Date.now();

  // Block the thread for 1 second
  while (Date.now() - startTime < duration) {
    // Do nothing, just wait
  }

  console.log(`🏋️‍♀️🔴 - ${id} getDatalogQuery -`, getTimestamp());
};

const fakeBackendQuery = (id, durationMin = 1, durationMax = 4) => {
  // Convert seconds to milliseconds
  const durationMinMs = durationMin * 1000;
  const durationMaxMs = durationMax * 1000;
  return new Promise((resolve) => {
    const delay =
      id === 1
        ? 0
        : Math.floor(Math.random() * ((durationMaxMs - durationMinMs) / 1000)) *
            1000 +
          durationMinMs;

    const startTime = getTimestamp();
    console.log(`🔎🟢 - ${id} Query -`, startTime, delay);

    setTimeout(() => {
      console.log(`🔎🔴 - ${id} Query`);
      console.log(startTime, "Start");
      console.log(getTimestamp(), "End");
      console.log("Delay -", delay);
      resolve([id]);
    }, delay);
  });
};

const fireQuery = async (args) => {
  getDatalogQuery(args);
  const results = await fakeBackendQuery(args);
  return Promise.all(
    results.map((r) => ({
      text: r,
    }))
  );
};

// Mock function that mimics resultsWithRelation behavior
const getDiscourseResults = async () => {
  console.log("--- Starting Parallel Queries ---");
  console.time("total");

  // Mock relations data
  const relations = [1, 2, 3, 4];

  const resultsWithRelation = await Promise.all(
    relations.map(async (r) => {
      const results = fireQuery(r);

      return results.then((results) => ({
        relation: r,
        results,
      }));
    })
  ).catch((e) => {
    console.error(e);
    return [];
  });

  console.timeEnd("total");
  return resultsWithRelation;
};

// Run the test
// getDiscourseResults().then((results) => {
//   console.log("\nFinal Results:");
//   console.log(JSON.stringify(results, null, 2));
// });

export { getTimestamp, getDatalogQuery, fakeBackendQuery, fireQuery };
